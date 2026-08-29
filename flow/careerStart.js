/* ---------- 生涯開局流程：青訓期 → 職業起步 ---------- */
/* 對照原版棒球 flow/phases.js 的 startYear()/phasePre 年度推進，但這裡只做
   最前段——青訓三年(stageYr 1→3)的成長，接一次淘汰判定(見 regions.js PATHS)，
   通過就轉正式指派 tier/細分守位/合約。之後的球季推進迴圈(轉會窗/賽季/
   衰退/傷病)是下一階段的事，這裡只負責把開局這一段串起來。 */

import { POSN_TO_DPN, DP_TH } from '../data/abilities.js';
import { REGION, PATHS } from '../data/regions.js';
import { YOUTH_WC_CUT_RATE_MULT } from '../data/national.js';
import { GENIUS } from '../data/mastery.js';
import { ABILITY_HARD_CAP } from '../data/growth.js';
import { calcOVR, signContract, pickTop5Club, pickFeederClub, pickLocalClub } from './shared.js';
import { checkYouthWorldCup } from './worldCup.js';
import { pickYouthChoice, applyYouthChoice } from './youthChoice.js';
import { rollSeasonOpener, applySeasonAllocation, trackSeasonSixes } from './seasonOpener.js';
import { prepareLoveChoice, resolveLoveChoiceStep } from './romance.js';
import { prepareTrainingChoice, resolveTrainingChoiceStep } from './trainingRivalry.js';

export { calcOVR };

/* 地區起始傾向只在開局套用一次，疊加在 newState() 生出的基礎骰值上。
   上限跟其他所有會直接寫 S.ab 的系統(徽章/稱號/世界盃/衰退)統一用85——
   這輪稽核抓出來的不一致：這裡原本用80當上限，跟其餘系統的85不一樣，
   雖然開局這個時間點還不會真的撞到上限，但統一數字比留著兩把不同的尺
   更不容易之後又埋一個新的斷點。 */
export function applyRegionBonus(S) {
  const bonus = REGION[S.region].startBonus;
  for (const [k, v] of Object.entries(bonus)) {
    if (S.ab[k] !== undefined) S.ab[k] = Math.min(85, Math.max(1, S.ab[k] + v));
  }
}


/* 指派細分守位：只在自己按鈕分組內挑(見 abilities.js POSN_TO_DPN)，
   優先挑 OVR 能通過門檻裡「門檻最高」的(最有挑戰性/位置價值最高)，
   都通不過就退而求其次挑分組裡門檻最低的——先求上場，不強求踢最難的位置。
   門檻要看「目前所在層級」而不是永遠用 LOCAL——這是實測抓出來的 bug：
   之前寫死 LOCAL 導致職業生涯漲到 TOP5 等級的 OVR，判定卻還在跟 LOCAL 門檻比，
   造成守位判定嚴重失真。轉正式前(還沒有 S.tier)才 fallback 用 LOCAL 當基準。
   這個函式現在是每季呼叫(見 proSeason.js)，不是只在轉正式那一刻跑一次——
   原本只跑一次的設計是另一個實測抓出來的 bug：debut 時 OVR 通常只有 30 出頭，
   遠低於 CB/DM 這類高門檻位置，只能落到 FB/AM 這種備選，之後 OVR 漲再高也
   永遠卡在當初的備選位置，導致 CB/DM/WG 這幾個位置實質上幾乎不會被指派到。 */
export function assignSubPosition(S) {
  if (S.pos === 'GK') {
    S.subPosition = null;
    return;
  }
  const candidates = POSN_TO_DPN[S.pos];
  const ovr = calcOVR(S);
  const tier = S.tier || 'LOCAL';
  const passable = candidates.filter((c) => ovr >= DP_TH[c][tier]);
  if (passable.length > 0) {
    passable.sort((a, b) => DP_TH[b][tier] - DP_TH[a][tier]);
    S.subPosition = passable[0];
  } else {
    S.subPosition = [...candidates].sort((a, b) => DP_TH[a][tier] - DP_TH[b][tier])[0];
  }
  S.subPositionYears[S.subPosition] = (S.subPositionYears[S.subPosition] || 0) + 1;
}

/* 青訓期結束的淘汰判定：對照 regions.js PATHS 的 cutRate，單次骰，不做多季適應。
   通過 → 轉正式，依 path 指派 tier/細分守位/合約；沒通過 → 退回業餘，
   不動天花板，只是這輪沒能轉正式(能不能重新挑戰是之後 flow 層的事，這裡先不管)。 */
export function resolveDebut(S, ri, chance) {
  // 天才判定：青訓三年跑完(不管最後轉正式有沒有過)一定會走到這個函式
  // (headless 的 runYouthToDebut()/未來 UI 各自跑完3次 resolveYouthYear()
  // 後都會呼叫這裡)，是唯一「三年確定跑完」的收斂點，比在迴圈外面另外
  // 判斷更不會漏接。門檻/效果見 data/mastery.js 開頭註解。
  if (S.youthSixes >= GENIUS.threshold && !S.honors.includes(GENIUS.label)) {
    S.honors.push(GENIUS.label);
    S.diceFloorBonus = Math.max(S.diceFloorBonus || 0, GENIUS.effect.diceFloor);
  }

  const path = PATHS[S.path];
  // 入選過青年世界盃：提前被球探看到，淘汰率打折(見 national.js YOUTH_WC_CUT_RATE_MULT)。
  // youthCutRateMult 是青訓期機會選項(見 data/youthOptions.js)累積疊乘的折扣，
  // 兩者是不同來源、可以疊加——「向上機會」不該只靠運氣(入選世界盃)，
  // 玩家自己的選擇也要能真的降低淘汰風險。
  const cutRate = path.cutRate * (S.youthWCSelected ? YOUTH_WC_CUT_RATE_MULT : 1) * (S.youthCutRateMult ?? 1);
  const passed = !chance(cutRate);

  if (!passed) {
    S.stage = 'AMATEUR';
    S.tier = null;
    return { passed: false };
  }

  assignSubPosition(S);

  // 歐洲地區沒有跳板聯賽(REGION.EUR.feeder===null)，但 PATHS 選擇本身跟地區
  // 無關，歐洲出身的角色理論上還是可能選到 FEEDER_INVITE——這裡直接把它
  // 導向 TOP5，對應 regions.js 早就寫好的敘事(「歐洲球員可直接被五大聯賽
  // 球探發掘」)，不是額外規則，只是把已經存在的設計意圖真的接上。
  // 實測抓出來的 crash：pickFeederClub() 對 EUR 地區找不到 feeder.code 會炸。
  const wantsFeeder = S.path === 'FEEDER_INVITE' && REGION[S.region].feeder;
  const tier = S.path === 'LOCAL_ACADEMY' ? 'LOCAL' : wantsFeeder ? 'FEEDER' : 'TOP5';
  S.stage = 'PRO';
  S.tier = tier;
  S.debutYear = S.year;
  // 三個 tier 各自對應正確的具名俱樂部池(data/clubNames.js + localClubNames.js)。
  // 原本 FEEDER_INVITE/TOP5_INVITE 都誤用 LOCAL 聯賽名稱(跟 tier 對不上，
  // 實測抓出來的 bug)，現在依 tier 分開查對的池子。
  S.club = tier === 'TOP5' ? pickTop5Club(ri) : tier === 'FEEDER' ? pickFeederClub(ri, S.region) : pickLocalClub(ri, S.region);
  S.clubTally[tier][S.club] = (S.clubTally[tier][S.club] || 0) + 1;
  S.clubJourney.push({ tier, club: S.club }); // 生涯轉會軌跡起點，見 core/state.js 的稽核說明

  const { wage, years } = signContract(S, ri, tier);
  return { passed: true, tier, wage, years };
}

/* 稽核抓出來的斷點：runYouthToDebut() 原本是「一次呼叫做完青訓三年」的
   寫法，中間用 pickYouthChoice() 隨機幫玩家做選擇——UI 需要在「亮出這年
   的三個類別選項」跟「套用玩家真正選的選項」之間真正暫停等按鈕，這個
   函式結構完全沒有留這個縫。拆成 startYear()(這裡沿用既有的
   applyRegionBonus，不用重複包一層) + resolveYouthYear()(單年份的
   选择套用) 兩塊，headless 用的 runYouthToDebut() 保留、內部改呼叫這兩塊
   組回原本邏輯，行為完全不變(用相同種子重跑 demo.js/story.js 驗證過
   輸出逐字相同)。 */
export function resolveYouthYear(S, ri, chance, category, option, riskTierKey) {
  const choiceLog = applyYouthChoice(S, ri, chance, category, option, riskTierKey);
  S.stageYr = Math.min(3, S.stageYr + 1);
  // 青年世界盃只在青訓二那年骰一次，維持跟原本一樣的時序(不是每年都有
  // 機會，對照真實世界盃/青年賽事本來就是稀有節點)。
  const youthWC = S.stageYr === 2 ? checkYouthWorldCup(S, ri, chance) : null;
  return { ...choiceLog, youthWC };
}

/* headless 自動分配策略，跟 flow/proSeason.js pickAllocationTarget() 同一套
   heuristic(離潛力天花板最遠的一項)，青訓期沒有共用那個函式(職業版是
   proSeason.js 的內部細節，沒有匯出)，這裡複寫一份，理由跟 youthChoice.js
   physicalKeys() 一樣。 */
function pickAllocationTarget(S) {
  const keys = Object.keys(S.ab).filter((k) => S.ab[k] < ABILITY_HARD_CAP);
  if (keys.length === 0) return null;
  keys.sort((a, b) => S.pot[b] - S.ab[b] - (S.pot[a] - S.ab[a]));
  return keys[0];
}

/* 入口：跑完青訓三年 → 轉正式判定。每年一次訓練/機會/社交三選一(對照
   yearlyOptions.js 的職業版年度選項，見 data/youthOptions.js)，不再是
   純被動自動成長——這三年正是生涯最前段、最該建立角色雛形的階段，
   之前完全沒有玩家選擇是實測稽核抓出來的缺口。骰子成長(大頭)搬去
   flow/seasonOpener.js 的獨立季初步驟後，每年開始都先跑一次(不看這年
   選了什麼類別)，跟職業版 flow/proSeason.js proSeasonTick() 同一個順序
   原則。 */
export function runYouthToDebut(S, ri, chance) {
  applyRegionBonus(S);
  let youthWC = null;
  const youthLog = [];
  for (let y = 0; y < 3; y++) {
    const opener = rollSeasonOpener(S, ri, 'YOUTH');
    let seasonOpener;
    if (opener.dice.length) {
      const target = pickAllocationTarget(S);
      const gain = target ? applySeasonAllocation(S, { [target]: opener.pool }) : 0;
      trackSeasonSixes(S, opener.sixes, 'YOUTH');
      seasonOpener = { dice: opener.dice, pool: opener.pool, target, gain };
    }

    // 使用者定案：戀愛線/訓練夥伴線的「起點」是年度自動觸發，青訓期也
    // 適用(不是職業生涯限定)——同一個位置(季初分配之後、類別選項之前)，
    // 同一組 prepare/resolve，跟職業版 flow/proSeason.js proSeasonTick
    // 共用同一份實作(見 flow/romance.js/flow/trainingRivalry.js 開頭的
    // 稽核說明)，不重複寫一份容易兜不起來。
    const { ambientLog: loveAmbientLog, pending: lovePending } = prepareLoveChoice(S, ri, chance);
    const loveLog = resolveLoveChoiceStep(S, ri, chance, loveAmbientLog, lovePending, lovePending?.recommend);
    const { ambientLog: trainingAmbientLog, pending: trainingPending } = prepareTrainingChoice(S, ri, chance);
    const trainingLog = resolveTrainingChoiceStep(S, ri, chance, trainingAmbientLog, trainingPending, trainingPending?.recommend);

    const { category, option, riskTierKey } = pickYouthChoice(ri);
    const { youthWC: wc, ...choiceLog } = resolveYouthYear(S, ri, chance, category, option, riskTierKey);
    if (wc && !youthWC) youthWC = wc;
    // S.stageYr 起始值是 1(見 core/state.js)，拿它當顯示用的年份標籤會在
    // 第三輪撞上 clamp 而重複顯示「第3年」——顯示用年份直接用迴圈序號
    // (y+1)，S.stageYr 只留給 stageLabel()/世界盃判定這些內部邏輯用。
    youthLog.push({ year: y + 1, ...(seasonOpener && { seasonOpener }), ...loveLog, ...trainingLog, ...choiceLog });
  }
  const debut = resolveDebut(S, ri, chance);
  return youthWC ? { ...debut, youthWC, youthLog } : { ...debut, youthLog };
}
