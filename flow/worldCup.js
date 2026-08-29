/* ---------- 世界盃：小插曲事件線 ---------- */
/* 對照 national.js 的簡化設計：只做世界盃，不是主旋律。青年版(青訓期，
   一次性機會)跟成人版(職業生涯，四年一次窗口)共用同一套「入圍/入選/晉級輪次」
   判定邏輯，差別只在獎勵——青年版獎勵是「淘汰率打折」，成人版獎勵是
   「轉會買氣(transferBuzz)+特殊稱號」。 */

import { REGION } from '../data/regions.js';
import { POS_MARKET } from '../data/abilities.js';
import {
  WC_ROUND_ORDER,
  WC_ROUND_FAME,
  WC_ROUND_MATCHES,
  WC_HONOR,
  YOUTH_WC_FAME,
  NATIONAL_CAP_ABILITY_BONUS,
} from '../data/national.js';
import { calcOVR, positionKey } from './shared.js';
import { withPlaystyleBonus } from './badges.js';
import { clamp } from '../core/rng.js';
import { assignNationalRivalIfFirstCap, compareToRival, nationalRivalClimax, checkTrainingComradeSelected } from './nationalRival.js';
import { RIVAL_HONOR, RIVAL_COMPETE_STAT_BOOST } from '../data/nationalRival.js';

/* 地區能不能打進世界盃：squadCeiling 當機率基準，設地板/天花板讓極端值
   也留一點懸念(強權不是100%穩進，弱旅也不是完全沒機會)。 */
function qualifies(region, chance) {
  return chance(clamp(region.squadCeiling / 100, 0.05, 0.95));
}

/* 打進世界盃了，這個球員有沒有被徵召：talentPoolDepth 越深，隊內競爭越激烈，
   門檻越高——這裡故意只吃當下 OVR(粗略代理)，不额外分權重，維持簡單。
   wcReadinessBoost 是機會/社交選項(WC_AUDITION/SQUAD_BONDING，見
   yearlyOptions.js)疊加的備戰籌碼，直接壓低入選門檻。 */
function selectedForSquad(S, region) {
  const threshold = region.talentPoolDepth * 0.5 * (1 - (S.wcReadinessBoost || 0));
  return calcOVR(S) >= threshold;
}

/* 逐輪骰晉級，squadCeiling 越高每一輪晉級機率越高。readinessBoost 疊加在
   每一輪的晉級機率上(來源同上，WC_TAPER 保留體力備戰也走這個管道)。 */
function runTournament(region, chance, readinessBoost = 0) {
  let round = 'GROUP';
  for (const r of WC_ROUND_ORDER.slice(1)) {
    if (!chance(clamp(region.squadCeiling / 140 + readinessBoost, 0.02, 0.9))) break;
    round = r;
  }
  return round;
}

/* 這屆世界盃個人進球/助攻：跟 proSeason.js generateSeasonStats() 同一種
   簡化精神，用場次(見 WC_ROUND_MATCHES) × 位置權重 × 能力值算，不蓋一套
   獨立的賽事模擬。位置權重寫死在這裡(不是共用資料表)，理由跟
   generateSeasonStats() 的 GOAL_W/AST_W 一樣：這是這個公式的內部細節。
   GK 沒有進球/助攻，維持 0——守門員本來就幾乎不會發生這種事。
   稽核抓出來的斷點：這裡原本直接讀 S.ab.SHO/S.ab.PAS 的原始值，沒有像
   generateSeasonStats() 那樣疊加 withPlaystyleBonus()(常態徽章的動態加成)
   跟 permanentResidual(大傷永久殘留)——一個手握「重炮」徽章的球員，聯賽
   數據吃得到那 +3，世界盃數據卻吃不到，徽章代表「現在真的更強」，沒理由
   國際賽場不算，這裡補上跟聯賽數據同一套計算值。 */
const WC_GOAL_W = { ST: 0.5, WG: 0.3, AM: 0.25, CM: 0.15, FB: 0.08, DM: 0.05, CB: 0.05 };
const WC_AST_W = { AM: 0.3, WG: 0.25, CM: 0.2, FB: 0.15, ST: 0.1, DM: 0.1, CB: 0.05 };

/* extraBoost：國家隊隱藏對手線 CROSSROADS 選了「個人表現」時的臨時加成
   (見 data/nationalRival.js RIVAL_COMPETE_STAT_BOOST)，只影響這一屆的
   計算結果，不寫回 S.ab——呼應「短暫的個人能力提升」，不是永久成長。 */
function personalTournamentStats(S, round, extraBoost = 0) {
  if (S.pos === 'GK') return { goals: 0, assists: 0 };
  const matches = WC_ROUND_MATCHES[round] || 0;
  const gw = WC_GOAL_W[S.subPosition] ?? 0.1;
  const aw = WC_AST_W[S.subPosition] ?? 0.1;
  const boostedAb = withPlaystyleBonus(S);
  const residual = S.permanentResidual || 0;
  const effSHO = clamp(boostedAb.SHO + residual + extraBoost, 1, 85);
  const effPAS = clamp(boostedAb.PAS + residual + extraBoost, 1, 85);
  const goals = Math.round(matches * gw * (effSHO / 80));
  const assists = Math.round(matches * aw * (effPAS / 80));
  return { goals, assists };
}

/* ---------- 青年世界盃：青訓期一次性機會 ---------- */
/* 在 careerStart.js 的青訓三年迴圈裡呼叫一次即可(不用每年都骰)。
   還沒指派 subPosition，位置加成用不了，這裡就不算位置倍率，是刻意簡化，
   不是漏做——青年階段位置定型本來就還沒發生。 */
export function checkYouthWorldCup(S, ri, chance) {
  const region = REGION[S.region];
  if (!qualifies(region, chance)) return null;
  if (!selectedForSquad(S, region)) return null;

  const round = runTournament(region, chance);
  const nationMult = 2 - region.squadCeiling / 100;
  const roundIdx = WC_ROUND_ORDER.indexOf(round);
  const fame = YOUTH_WC_FAME * (1 + roundIdx * 0.3) * nationMult;

  S.national.tournamentsPlayed.push({ year: S.year, round, level: 'YOUTH' });
  S.youthWCSelected = true; // resolveDebut() 讀這個旗標打折淘汰率

  return { round, fame };
}

/* ---------- 成人世界盃：職業生涯每 4 年一次窗口 ---------- */
export function checkWorldCupWindow(S, ri, chance) {
  if (S.year % 4 !== 0) return null;
  // CROSSROADS(個人表現/團隊優先)的選擇在季初常駐階段就已經決定(見
  // flow/nationalRival.js resolveRivalCrossroads)，這裡讀取+立刻清空——
  // 不管這季最後有沒有真的入選/晉級到哪一輪，這個暫存值都只屬於這一季，
  // 不會殘留到下一屆世界盃。
  const rivalChoice = S.wcRivalChoice;
  S.wcRivalChoice = null;
  const region = REGION[S.region];
  if (!qualifies(region, chance)) return null;
  if (!selectedForSquad(S, region)) {
    S.wcReadinessBoost = 0; // 備戰籌碼用過即歸零，不管有沒有真的入選
    return null;
  }

  // 入選本身就有加成，不等戰績——代表國家出賽是一種歷練，跟晉級輪次的
  // 人氣/稱號獎勵分開算(那個才看戰績好壞)。
  for (const k of Object.keys(S.ab)) {
    S.ab[k] = clamp(S.ab[k] + NATIONAL_CAP_ABILITY_BONUS, 1, 85);
  }

  // 訓練夥伴線交叉(COMRADE 版，見 flow/nationalRival.js
  // checkTrainingComradeSelected 的稽核說明)：要在 runTournament 之前
  // 呼叫，這樣如果真的骰中，加成才吃得到這一屆的判定，不會晚一步。
  const partnerAlsoSelected = checkTrainingComradeSelected(S, chance);

  // trainingBondWCBoost 是訓練夥伴線「羈絆時刻」成功/失敗疊加的永久值
  // (見 data/trainingPartner.js BOND_MOMENT_HONOR)，跟 wcReadinessBoost
  // (機會/社交選項攢的暫時值，這裡讀完就歸零)是兩個不同來源、相加後
  // 才是這屆賽事實際套用的晉級加成——trainingBondWCBoost 不在這裡歸零，
  // 它是生涯累積值，不隨單屆世界盃用完即棄。
  const round = runTournament(region, chance, (S.wcReadinessBoost || 0) + (S.trainingBondWCBoost || 0));
  S.wcReadinessBoost = 0;
  const key = positionKey(S);
  const nationMult = 2 - region.squadCeiling / 100; // 小國晉級同一輪，加成比強權大
  const posMult = 1 - POS_MARKET[key]; // 冷門位置(GK/CB/DM)意外亮眼，加成比熱門位置大
  const fame = WC_ROUND_FAME[round] * nationMult * posMult;

  S.national.caps += 1;
  // 國家隊隱藏對手線：只有真的入選(這裡是第一次拿到cap)才會指派，見
  // flow/nationalRival.js 開頭的稽核說明。已經有對手就回傳 null，不重複指派。
  const rivalAssigned = assignNationalRivalIfFirstCap(S, ri, chance);
  const { goals, assists } = personalTournamentStats(S, round, rivalChoice === 'compete' ? RIVAL_COMPETE_STAT_BOOST : 0);
  S.national.goals += goals;
  S.national.assists += assists;
  const entry = { year: S.year, round, goals, assists };
  S.national.tournamentsPlayed.push(entry);
  const roundIdx = WC_ROUND_ORDER.indexOf(round);
  const bestIdx = S.national.bestTournament ? WC_ROUND_ORDER.indexOf(S.national.bestTournament.round) : -1;
  if (roundIdx > bestIdx) S.national.bestTournament = entry;

  S.transferBuzz = (S.transferBuzz || 0) + fame;

  // 這屆戰績比較：只有已經有對手(不一定是這屆才指派的)才會比較，見
  // flow/nationalRival.js compareToRival。
  const rivalComparison = compareToRival(S, chance, round);

  const honors = checkWCHonors(S, round, rivalChoice);
  // 對手線的收尾疊加段落：只在真的奪冠那屆才評估，見
  // flow/nationalRival.js nationalRivalClimax 開頭的稽核說明(疊加，不是
  // 取代既有的冠軍退休/WORLD_CHAMPION 文案)。
  const rivalClimax = round === 'CHAMPION' ? nationalRivalClimax(S) : null;
  return { round, fame, honors, goals, assists, champion: round === 'CHAMPION', rivalAssigned, rivalComparison, rivalClimax, partnerAlsoSelected };
}

/* 世界盃特殊稱號：對照 traits.js PLAYING_STYLE 的重量感，一輩子最多各拿一次。
   rivalChoice 是這季 CROSSROADS 的選擇(見 flow/nationalRival.js
   resolveRivalCrossroads)，只有 SELFISH_CROWN 這個隱藏結局用得到。 */
function checkWCHonors(S, round, rivalChoice) {
  const unlocked = [];
  const roundIdx = WC_ROUND_ORDER.indexOf(round);

  if (roundIdx >= WC_ROUND_ORDER.indexOf('SF') && !S.honors.includes(WC_HONOR.WC_STAR.label)) {
    S.honors.push(WC_HONOR.WC_STAR.label);
    S.ab.STA = clamp(S.ab.STA + WC_HONOR.WC_STAR.effect.ability, 1, 85);
    S.transferBuzz += WC_HONOR.WC_STAR.effect.fameBonus;
    unlocked.push('WC_STAR');
  }

  const seniorAppearances = S.national.tournamentsPlayed.filter((t) => !t.level).length;
  const bestIdx = S.national.bestTournament ? WC_ROUND_ORDER.indexOf(S.national.bestTournament.round) : -1;
  if (
    seniorAppearances >= 2 &&
    bestIdx >= WC_ROUND_ORDER.indexOf('QF') &&
    !S.honors.includes(WC_HONOR.ETERNAL_CAPTAIN.label)
  ) {
    S.honors.push(WC_HONOR.ETERNAL_CAPTAIN.label);
    S.wagePremiumBonus += WC_HONOR.ETERNAL_CAPTAIN.effect.wagePremium;
    S.retireCapBonus += WC_HONOR.ETERNAL_CAPTAIN.effect.retireCapDelay;
    unlocked.push('ETERNAL_CAPTAIN');
  }

  if (round === 'CHAMPION') {
    // 球王的累積戰績計數(見 data/traits.js GOAT 的稽核說明)——每次真的
    // 奪冠都算一座，不受稱號本身是否已經拿過影響(跟 checkBallonDor/
    // checkGoldenBoot 同一種「稱號一次性、計數不設限」的雙軌寫法)。
    S.trophyCount.wcTitles = (S.trophyCount.wcTitles || 0) + 1;
    if (!S.honors.includes(WC_HONOR.WORLD_CHAMPION.label)) {
      S.honors.push(WC_HONOR.WORLD_CHAMPION.label);
      S.ab.STA = clamp(S.ab.STA + WC_HONOR.WORLD_CHAMPION.effect.ability, 1, 85);
      S.transferBuzz += WC_HONOR.WORLD_CHAMPION.effect.fameBonus;
      unlocked.push('WORLD_CHAMPION');
    }
  }

  // 國家隊隱藏對手線的隱藏結局：選了「個人表現」卻依然帶隊奪冠，見
  // data/nationalRival.js RIVAL_HONOR.SELFISH_CROWN 的稽核說明——這是
  // 使用者定案的確切觸發條件(不是戰績比較的走向)，跟 WORLD_CHAMPION 一樣
  // 一輩子最多拿一次。
  if (round === 'CHAMPION' && rivalChoice === 'compete' && !S.honors.includes(RIVAL_HONOR.SELFISH_CROWN.label)) {
    S.honors.push(RIVAL_HONOR.SELFISH_CROWN.label);
    S.transferBuzz += RIVAL_HONOR.SELFISH_CROWN.effect.fameBonus;
    unlocked.push('SELFISH_CROWN');
  }

  return unlocked;
}

/* ---------- 世界盃封頂退休：兩段式 ---------- */
/* 對照 transfer.js 的 evaluatePromotionOffer/evaluateContractCrisis 同一種
   分工——稽核抓出來的斷點：這個決定原本直接寫死在 proSeasonTick 裡「年紀
   夠接近退休門檻就自動退休」，玩家完全沒有插手的餘地，跟遊戲裡其他所有
   「引擎骰出來的重大決定」(晉級/豪門挖角/合約危機/租借邀約)都遵守的
   evaluate/resolve 兩段式架構不一致——那套架構存在的目的就是讓 headless
   環境可以用 recommend 自動選，之後接 UI 才能在同一個決策點插入玩家的
   真實選擇，不用重寫判定邏輯。剛奪冠、年紀又還沒真的逼近上限的球員，
   理論上應該有機會自己決定「要不要見好就收」，不該被引擎直接幫他做決定。
   headless/demo 用 recommend：接近退休門檻(3年內)才建議退休，跟原本寫死
   的門檻邏輯完全一致，只是拆成兩段，行為不變。 */
export function evaluateChampionRetirement(S, worldCup, cap) {
  if (S.retired || !worldCup || !worldCup.champion) return null;
  const nearEnd = S.age >= cap - 3;
  return { options: { retired: true, continue: true }, recommend: nearEnd ? 'retired' : 'continue' };
}

export function resolveChampionRetirement(S, choice) {
  if (choice !== 'retired') return null;
  S.retired = true;
  S.stage = 'RETIRED';
  S.retiredAsChampion = true;
  return { type: 'retiredAsChampion' };
}
