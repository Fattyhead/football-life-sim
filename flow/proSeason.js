/* ---------- 職業生涯：單一球季 tick ---------- */
/* 對照原版棒球 flow/phases.js 的年度推進：年齡增長、年度選項(訓練/機會/社交，
   見 yearlyOptions.js)、傷病(帶傷上陣看選了什麼類別)、租借邀約、球季數據生成、
   場外收入/存款累積、衰退、常態特質自動解鎖、生涯定位標籤判定、世界盃小插曲、
   租借賽季結算或(俱樂部杯賽→轉會晉級/降級判定→合約倒數/續約)、引退判定。
   成長不再是自動 tick，改成年度選項的 TRAINING 類別才會觸發
   (見 flow/yearlyChoice.js)——沒選訓練，這季能力值就不會自己漲。 */

import { DECLINE_START, RETIRE_CAP, DECLINE_RATE, baseDecline } from '../data/decline.js';
import { ABILITY_HARD_CAP } from '../data/growth.js';
import { INJURY_TIER, INJURY_TIER_ORDER } from '../data/injury.js';
import { PARTNER_TYPE, HIDDEN_PARTNER, LOVE_STATUS } from '../data/love.js';
import { prepareLoveChoice, resolveLoveChoiceStep } from './romance.js';
import {
  prepareTrainingChoice,
  resolveTrainingChoiceStep,
  prepareTrainingCrossroadsChoice,
  resolveTrainingCrossroadsChoiceStep,
  checkTrainingBondMoment,
} from './trainingRivalry.js';
import { evaluateRivalCrossroads, resolveRivalCrossroads } from './nationalRival.js';
import { blankSeasonStat } from '../core/state.js';
import { clamp } from '../core/rng.js';
import { positionKey, signContract, clubPrestigeOf } from './shared.js';
import { checkPlaystyleBadges, withPlaystyleBonus } from './badges.js';
import {
  evaluatePromotionOffer,
  acceptPromotionOffer,
  declinePromotionOffer,
  evaluateLateralMoveOffer,
  acceptLateralMoveOffer,
  declineLateralMoveOffer,
  checkDemotion,
  evaluateContractCrisis,
  resolveContractCrisis,
  updatePromotionFormStreak,
} from './transfer.js';
import { checkClubCup } from './clubCup.js';
import { checkLoanOffer, loanTargetTier, sendOnLoan, resolveLoanSeason } from './loan.js';
import { checkWorldCupWindow, evaluateChampionRetirement, resolveChampionRetirement } from './worldCup.js';
import { checkBossMilestone, resolveBossRetirement } from './wealthPeak.js';
import { checkPlayingStyleUnlocks } from './playingStyle.js';
import { checkEliteMilestones, checkBallonDor, checkGoldenBoot, checkGoatHonor } from './eliteHonors.js';
import { checkFameHonors } from './fameHonors.js';
import { checkTrainingHonors } from './trainingHonors.js';
import { checkRivalryHonors } from './rivalryHonors.js';
import { checkAgentHonors } from './agentHonors.js';
import {
  prepareAgentChoice,
  resolveAgentChoiceStep,
  prepareAgentCrossroadsChoice,
  resolveAgentCrossroadsChoiceStep,
  checkAgentBondMoment,
} from './agentLine.js';
import { WEALTH_HONOR } from '../data/wealth.js';
import { assignSubPosition } from './careerStart.js';
import { pickYearlyChoice, applyYearlyChoice, availableOptions } from './yearlyChoice.js';
import { TRAINING_OPTION, OPPORTUNITY_OPTION, SOCIAL_OPTION } from '../data/yearlyOptions.js';
import { rollSeasonOpener, applySeasonAllocation, trackSeasonSixes } from './seasonOpener.js';

/* 這一季實際踢球的層級：租借中看租借目的地，沒租借看原本的 tier。
   球季數據要記在哪個 stats 桶要看這個而不是 S.tier，不然租借期間的數據
   會算錯地方。 */
function effectiveTier(S) {
  return S.onLoan ? S.loanTier : S.tier;
}

/* 傷病基礎發生率：injury.js 只定義「傷了會怎樣」，沒定義「多常會傷」，這裡補上。
   數字先抓大概(之後好調)：每季 22% 機率發生點什麼，一旦發生，級距用權重骰，
   輕微傷最常見、大傷最少見——跟現實傷病分布的直覺一致。 */
const SEASON_INJURY_CHANCE = 0.22;

/* 場外收入常數——歐元化重新校準(見 data/contract.js 開頭的稽核說明)。
   原本是 0.15，配合舊的抽象薪資指數量級；薪資改成真實歐元數字後，這裡
   不跟著放大的話，「場外收入超過薪水」(見 flow/wealthHonors.js 梅老闆)
   會變成永遠不可能發生——人氣值(popularity)本身沒有跟著歐元化(它是
   場外知名度的獨立小數值，不是貨幣單位，維持原本量級)，只有這個把
   人氣值換算成場外收入的乘數要放大，讓場外收入能落在跟薪水同一個
   數量級。抓 20000：人氣值 100(接近生涯封頂)、代言加乘 2、稱號加成
   0.2，算出來約 €2880萬，落在 CONTENDER/ELITE 薪資的同一個量級，
   「梅老闆」條件才有機會真的成立。 */
const OUTSIDE_INCOME_MULT = 20000;
const INJURY_TIER_WEIGHT = { MINOR: 0.5, SMALL: 0.3, MEDIUM: 0.15, MAJOR: 0.05 };

function rollInjuryTier(ri) {
  const roll = ri(1, 100) / 100;
  let acc = 0;
  for (const tier of INJURY_TIER_ORDER) {
    acc += INJURY_TIER_WEIGHT[tier];
    if (roll <= acc) return tier;
  }
  return 'MINOR';
}

/* 衰退：只在超過該位置起衰年齡才套用，逐項能力扣 baseDecline × DECLINE_RATE。
   上限用85(不是80)，跟徽章/稱號/世界盃寫 S.ab 用同一把尺——這輪稽核
   抓出來的真bug：徽章/世界盃可以把 ab 推到85，這裡原本卻夾在80，代表
   一個能力值85的球員只要進入衰退期，第一次衰退判定不管實際扣多少，
   都會被這個clamp硬摔回80(等於憑空多扣5點，比真正的衰退量還重)，
   跟「衰退是照表訂速率慢慢掉」的設計意圖不符。 */
function applyDecline(S) {
  const key = positionKey(S);
  const start = DECLINE_START[key] + (S.declineStartBonus || 0);
  if (S.age < start) return 0;
  const base = baseDecline(S.age, start);
  let totalLoss = 0;
  for (const k of Object.keys(S.ab)) {
    const rate = DECLINE_RATE[k] ?? 1.0;
    const loss = Math.round(base * rate);
    S.ab[k] = clamp(S.ab[k] - loss, 1, 85);
    totalLoss += loss;
  }
  return totalLoss;
}

/* 設定 S.injury 為某個級距，共用邏輯給「新發生的傷」跟「帶傷上陣惡化成
   更重的傷」兩處呼叫，MAJOR 的副作用(重大傷病計數/傷前巔峰快照/永久殘留)
   只在這裡處理一次，不要兩處各寫一份容易漏。 */
function applyInjury(S, ri, chance, tier) {
  const def = INJURY_TIER[tier];
  const [minW, maxW] = tier === 'MAJOR' ? def.rehab.conservative.restWeeks : def.restWeeks;
  S.injury = { tier, weeksRemaining: ri(minW, maxW), rehabPlan: tier === 'MAJOR' ? 'conservative' : null };
  if (tier === 'MAJOR') {
    S.bigInjCount += 1;
    S.injuryFreeStreak = 0;
    S.preInjuryPeakRAT = S.peakRAT; // COMEBACK_KING 判定要用的「傷前巔峰」快照
    if (chance(def.permanentResidual.chance)) {
      S.permanentResidual += def.permanentResidual.debuff;
    }
  }
}

/* 傷病骰：命中就進 S.injury，套用 statDebuff(直接反映在 stats 產出上，
   不直接扣 ab，傷病是暫時性的，跟衰退的永久性不同——除非是大傷的永久殘留)。
   seasonInjuryMult 是這季年度選項算出來的暫時乘數(訓練選項/隊友聚會/生小孩)，
   跟 S.injuryChanceMult(PLAYING_STYLE 疊加的永久乘數)分開算再相乘，
   避免暫時性效果被誤存成永久值。 */
function rollInjury(S, ri, chance, seasonInjuryMult) {
  // debutInjuryMult 是青訓期社交選項(FAMILY_SUPPORT，見 data/youthOptions.js)
  // 疊乘的出道後第一次受傷機率折扣，用過即歸1——這是出道球季第一次骰新傷
  // 才會生效(此時 S.injury.tier 必定是 null，一定會走到這個函式)，之後
  // 的球季就是純粹的 1 倍數，不會一直生效。
  const mult = (S.injuryChanceMult || 1) * seasonInjuryMult * (S.debutInjuryMult ?? 1);
  S.debutInjuryMult = 1;
  if (!chance(SEASON_INJURY_CHANCE * mult)) return null;
  const tier = rollInjuryTier(ri);
  applyInjury(S, ri, chance, tier);
  return tier;
}

/* 恢復中的既有傷病，這季怎麼處理：選了訓練類別代表「帶傷上陣」，套用
   injury.js 原本設計好、卻一直沒接上引擎的 playThrough.escalateChance——
   有機率惡化成下一級，沒惡化才照表訂時間繼續恢復。選其他類別代表「休養」，
   沒有惡化風險，安全但沒有額外好處，這是重新用「已經存在的年度選擇」
   表達玩家決定，不是另外加一個「休養/帶傷上陣」的新步驟。 */
function tickExistingInjury(S, ri, chance, category, log) {
  const tier = S.injury.tier;
  const playingThrough = category === 'TRAINING';

  if (playingThrough && tier !== 'MAJOR') {
    const escalate = INJURY_TIER[tier].playThrough;
    // S.injuryEscalateMult 是 PLAYING_STYLE(如 ROCK_AT_THE_BACK)疊乘的專屬
    // 乘數，跟季度「會不會受新傷」的 injuryChanceMult 是不同的判定點，不要共用。
    if (chance(escalate.escalateChance * (S.injuryEscalateMult || 1))) {
      applyInjury(S, ri, chance, escalate.escalateTo);
      log.injuryEscalated = { from: tier, to: escalate.escalateTo };
      return;
    }
  }

  S.injury.weeksRemaining = Math.max(0, S.injury.weeksRemaining - 38); // 一整季自然恢復掉一季份的週數
  if (S.injury.weeksRemaining === 0) {
    log.recovered = tier;
    S.injuryFreeStreak += 1;
    S.injury = { tier: null, weeksRemaining: 0, rehabPlan: null };
  }
}

/* 球季數據生成：簡化版公式，能力值直接轉數據，不是真的模擬每場比賽。
   位置權重寫死在這個函式裡(不是共用資料表)，因為這是這個公式的內部細節，
   不是其他系統會查的靜態表——真的要做「戰術/陣型」層級的模擬再拉出來獨立檔案。 */
const GOAL_W = { ST: 0.5, WG: 0.3, AM: 0.25, CM: 0.15, FB: 0.08, DM: 0.05, CB: 0.05 };
const AST_W = { AM: 0.3, WG: 0.25, CM: 0.2, FB: 0.15, ST: 0.1, DM: 0.1, CB: 0.05 };

function generateSeasonStats(S, ri, chance) {
  const stat = blankSeasonStat();
  stat.yr = S.year;
  const missedWeeks = S.injury.tier ? S.injury.weeksRemaining : 0;
  const maxApp = 34;
  const debuff = S.injury.tier ? INJURY_TIER[S.injury.tier].statDebuff : 0;
  // 疊加常態徽章的動態加成(見 flow/badges.js)，再扣傷病debuff——徽章代表
  // 「現在真的更強」，這季的數據產出該吃得到，不是只反映在 calcOVR 上。
  // clamp 到 85(不是 80)，讓徽章允許突破常規天花板的部分真的能在數據上
  // 顯現出來，不會被下游默默砍掉。permanentResidual(大傷康復後的永久殘留
  // debuff)也在這裡扣——之前宣告了卻沒有任何地方真的讀它(見 shared.js
  // calcOVR 同一次稽核抓到的斷點)，這季的數據產出也要吃得到，不只是薪資/
  // 位置判定會受影響。
  const boostedAb = withPlaystyleBonus(S);
  const residual = S.permanentResidual || 0;
  const effAb = {};
  for (const k of Object.keys(S.ab)) effAb[k] = clamp(boostedAb[k] + debuff + residual, 1, 85);

  stat.APP = clamp(maxApp - Math.round((missedWeeks / 38) * maxApp), 0, maxApp);

  // 稽核抓出來的斷點：GLS/AST/CS 原本完全沒有 ri()，能力值沒變這幾個數字
  // 就永遠不變——4000種子實測，66.3%的生涯至少出現過連續5季以上GLS/AST
  // 一模一樣的紀錄，平均連續季數5.83、最長17季，能力練滿封頂後的「巔峰
  // 平原期」反而是數字最死的一段。這裡補上一個小幅±15%的隨機波動
  // (`variance`)，比照 TKL 既有的 ri(1,2) 同一種「有隨機但還是錨定在能力
  // 值上」的精神，但幅度小很多——TKL 的 ri(1,2) 其實是±50%(1倍到2倍)，
  // 對進球/助攻這種玩家最在意的門面數字來說太劇烈，這裡刻意做得更保守。
  const variance = () => ri(85, 115) / 100;

  if (S.pos === 'GK') {
    stat.SV = Math.round(stat.APP * (effAb.DIV / 80) * ri(2, 4));
    stat.GA = Math.round(stat.APP * (1 - effAb.HAN / 100) * ri(1, 2));
    stat.CS = Math.round(stat.APP * (effAb.POS / 160) * variance());
  } else {
    const gw = GOAL_W[S.subPosition] ?? 0.1;
    const aw = AST_W[S.subPosition] ?? 0.1;
    stat.GLS = Math.round(stat.APP * gw * (effAb.SHO / 80) * variance());
    stat.AST = Math.round(stat.APP * aw * (effAb.PAS / 80) * variance());
    stat.TKL = Math.round(stat.APP * (effAb.DEF / 80) * ri(1, 2));
    stat.CS = Math.round(stat.APP * (effAb.DEF / 160) * variance());
  }
  stat.YC = ri(0, Math.max(1, Math.round(stat.APP / 10)));
  stat.RC = chance(0.05) ? 1 : 0;
  // RAT 要跟其他數據一樣吃 effAb(扣過傷病debuff)，不能用未扣debuff的 calcOVR(S)，
  // 不然受重傷那季的「賽季評分」還是滿血水準，跟 APP/GLS 這些數據互相矛盾。
  // seasonForm(這季由社交選項/戀愛狀態算出來的點數，見 romance.js)直接加在後面
  // ——但下修成 formFloor 之後的值(見 applyYearlyChoice() 尾端註解)：稽核
  // 抓出來的斷點，出軌被抓+同季離婚可以疊出約-8~-9的 seasonForm，直接把
  // RAT 砸到絕對地板1.0，完全不看實際能力(用「一直選社交/戀愛」的極端
  // 策略實測，0.56%的賽季會撞到這個地板)。這裡只夾住負向那一側，讓場外
  // 因素的殺傷力有上限，不會讓RAT完全脫離能力值決定的基準；正向那一側
  // (穩定婚姻/家庭加成)不設上限，維持現有的正向敘事份量。
  const formFloor = -5;
  // 稽核抓出來的第二個斷點(RAT公式重算實測時才發現)：正向那一側原本
  // 刻意不設上限("維持現有的正向敘事份量")，這個決定是在舊公式的
  // 脈絡下做的——舊公式光靠能力值就常態封頂在10分，多加的正向 form
  // 邊際影響很小，不設上限沒差。但這次重算把能力值驅動的基準壓縮到
  // 6.0-8.3，正向 form 如果還是不設上限，會變成主導因素而不是調味：
  // 穩定婚姻(+1)+FAMILY_FIRST永久加成(+2)+對象穩定加成(+2)這種「已婚
  // 生涯的常態基準」每季都會疊到+5，不是偶爾發生的尖峰——換算下來會
  // 讓大多數穩定已婚的球員直接把RAT推回封頂，等於重算等於白做。這裡
  // 補一個對稱思路的上限(不是照抄下限的-5，正向情境本來就比負向常見，
  // 上限抓緊一點)，讓 form 回到「調味」的份量，不會反過來蓋過能力值
  // 決定的基準——這是重新檢視過舊決定後的修正，不是忘記那個決定。
  const formCeiling = 3;
  const effectiveForm = Math.max(formFloor, Math.min(formCeiling, S.seasonForm || 0));
  const effOVR = Object.values(effAb).reduce((a, b) => a + b, 0) / Object.keys(effAb).length;
  // 稽核抓出來的真斷點(這輪要求「模擬真實數據」，實測4000種子才發現)：
  // 舊公式 5 + effOVR/80×5，只要 effOVR 夠高(豪門/精英徽章疊加後很常見)
  // 就直接逼近甚至打到10分再被 clamp 削平——實測 TOP5 主力球季的 RAT
  // 中位數幾乎每個位置都卡在10.0封頂，跟現實(WhoScored/Sofascore式賽季
  // 平均分頂級也就7.8-8.3，10分幾乎不存在)、跟FIFA/EA FC的評分手感都
  // 對不上，而且會直接害死「數據比較」這個後期玩法——半數以上的人都是
  // 10.0，這個數字就沒有比較意義了。
  // 新公式把「能力值決定的基準分」壓縮到 6.0(effOVR=30，普通球員) ～
  // 8.3(effOVR=80，接近滿潛力的頂級球員)這個貼近現實的區間，effOVR 每
  // 高出30一個單位、往上加(2.3/50)分，線性內插；effectiveForm(場外狀態)
  // 的貢獻也跟著乘上0.4折算——場外因素該是「調味」不是「主菜」，不該
  // 靠場外狀態疊加就把評分單獨推回封頂，這是舊公式沒限制住的另一個
  // 漏洞。下游所有讀 RAT 當門檻的地方(杯賽資格/晉級/降級/租借留隊/金球獎/
  // 精英球季敘事門檻)都跟著這次一起重新校準——校準方法：反推舊門檻
  // 對應的 effOVR，代入新公式算出等值的新門檻，維持「這個門檻原本要求
  // 多好的能力值」這個語意不變，不是憑感覺挑新數字，見各自檔案的稽核
  // 說明。 */
  stat.RAT = clamp(Math.round((6.0 + ((effOVR - 30) / 50) * 2.3 + effectiveForm * 0.4) * 10) / 10, 1, 10);
  stat.DPG[S.subPosition || 'GK'] = stat.APP;
  return stat;
}


/* 稽核抓出來的斷點：proSeasonTick() 原本是「一次呼叫做完整個球季」的
   寫法，中間用 pickYearlyChoice() 隨機幫玩家做選擇——UI 需要在「亮出這季
   訓練/機會/社交各自開放哪些子選項」跟「套用玩家真正選的選項、跑完剩下
   這季」之間真正暫停等按鈕，這個函式結構完全沒有留這個縫。拆成
   prepareSeasonChoice()(年齡/年份遞增 + 守位重新評估 + 算出這季候選池，
   不消耗選擇本身的 RNG) + resolveSeasonChoice()(從套用選擇開始，原本
   函式剩下的全部內容一字不動) 兩塊，headless 用的 proSeasonTick() 保留、
   內部改呼叫這兩塊組回原本邏輯，行為完全不變(用相同種子重跑
   demo.js/story.js 驗證過輸出逐字相同)。 */
export function prepareSeasonChoice(S) {
  // log.year/log.age 原本是「年齡/年份遞增前」的快照(對照下面 S.age+=1
  // 之前的值)，拆開後這個快照要單獨保留、傳給 resolveSeasonChoice()，
  // 不然季末組出來的 log 會誤用遞增後的值，跟 demo.js/story.js 印出來的
  // 「${log.year}年（${S.age}歲）」對不上。
  const snapshot = { year: S.year, age: S.age };

  S.age += 1;
  S.year += 1;

  // 每季重新評估細分守位：OVR 漲到新門檻就有機會轉去更有挑戰性的位置(比如
  // FB 熬成 CB)，也會累計 subPositionYears——不是只在轉正式那一刻定生死。
  // 這個呼叫一季只能做一次(會累加 S.subPositionYears)，resolveSeasonChoice()
  // 不會再呼叫第二次。
  const prevSubPos = S.subPosition;
  assignSubPosition(S);
  const subPositionChanged = S.subPosition !== prevSubPos ? { from: prevSubPos, to: S.subPosition } : undefined;

  return {
    options: {
      TRAINING: availableOptions(S, TRAINING_OPTION),
      OPPORTUNITY: availableOptions(S, OPPORTUNITY_OPTION),
      SOCIAL: availableOptions(S, SOCIAL_OPTION),
    },
    partialLog: { ...snapshot, ...(subPositionChanged && { subPositionChanged }) },
  };
}

/* 國家隊隱藏對手線版的 prepare/resolve——沒有常駐 ambient 事件可以合併
   (這條線的「常駐」部分是世界盃當年直接在 flow/worldCup.js 裡處理，
   見 checkWorldCupWindow 的 rivalAssigned/rivalComparison/rivalClimax)，
   這裡只有真正的世界盃年才會有的 CROSSROADS 抉擇，沒有 pending 就回傳
   空物件，呼叫端不用另外判斷。 */
export function prepareRivalChoice(S, chance) {
  const pending = evaluateRivalCrossroads(S, chance);
  return { pending };
}

export function resolveRivalChoiceStep(S, pending, choice) {
  if (!pending) return {};
  return resolveRivalCrossroads(S, choice ?? pending.recommend);
}

/* 入口：套用玩家(或 headless 用 pickYearlyChoice 隨機挑)選好的年度選項，
   跑完這一整季剩下的內容。partialLog 是 prepareSeasonChoice() 回傳的
   年齡/年份快照(+可能有的轉位置事件/季初分配結果/戀愛常駐事件結果)，
   先併進最終的 log 裡。riskTierKey 是這個選項有風險層(見 yearlyChoice.js
   optionHasRiskTier)時玩家(或 headless)選的穩健/平衡/冒進，沒有風險層
   的選項會被忽略。

   稽核修正(接 UI 互動)：這一季裡還有六個「引擎骰出來的重大決定」——
   租借邀約/晉級報價/豪門挖角報價/合約危機/世界盃封頂退休/梅老闆退休——
   全部都是既有的 evaluate/resolve 兩段式架構，但過去 headless/UI 兩邊
   共用同一個「一路跑到底、每個決定都直接用 recommend」的函式，UI 完全
   沒有插手的縫。這裡沒有像戀愛線/訓練夥伴線那樣拆成一堆各自命名的
   prepare/resolve 函式對(那套適合「在某個固定時機點問一次」的抉擇，
   這六個決定分散在同一季內部、彼此互斥/依序發生，硬拆成六對函式要
   手動搬運大量中繼狀態，容易兜錯)——改用 generator：函式本體完全不變，
   六個決定點原本「直接算」的地方改成 yield 一個 { type, ...offer,
   recommend } 出去，暫停在原地(局部變數、RNG 位置都由 JS 引擎原生保留，
   不用自己手動搬狀態)，呼叫端用 generator.next(選擇) 餵回玩家的答案才
   繼續往下跑。沒有東西要問的決定點完全不會 yield，跟原本「這次沒有
   offer 就不會有任何動作」的行為一致。 */
export function* resolveSeasonChoiceGen(S, ri, chance, category, option, riskTierKey, partialLog = {}) {
  const log = { ...partialLog };

  // 年度選項：訓練/機會/社交三選一(headless 用隨機挑，見 yearlyChoice.js 註解)。
  // 要在傷病骰之前跑，因為訓練選項/隊友聚會會影響這季的傷病機率；
  // 要在球季數據生成之前跑，因為社交選項的 seasonForm 要吃進這季的 RAT。
  const { log: choiceLog, seasonInjuryMult: categoryInjuryMult } = applyYearlyChoice(S, ri, chance, category, option, riskTierKey);
  log.yearlyChoice = choiceLog;
  // 這季真正的傷病機率乘數 = 戀愛常駐事件(如：生小孩、隊友聚會以外的
  // 家庭因素)的貢獻 × 年度選項自己的貢獻，兩者相乘後才是這季實際套用的
  // 值，用完歸1(S.loveSeasonInjuryMult 是 prepareLoveChoice/
  // resolveLoveChoiceStep 疊乘後的暫存值)。
  const seasonInjuryMult = (S.loveSeasonInjuryMult ?? 1) * categoryInjuryMult;
  S.loveSeasonInjuryMult = 1;

  // 傷病：先處理既有傷病(帶傷上陣 vs 休養，看選了什麼類別)，沒有既有傷病才骰新傷
  if (S.injury.tier && S.injury.weeksRemaining > 0) {
    tickExistingInjury(S, ri, chance, category, log);
  } else {
    const newInjury = rollInjury(S, ri, chance, seasonInjuryMult);
    if (newInjury) log.newInjury = newInjury;
    else S.injuryFreeStreak += 1;
  }

  // 租借邀約：只在沒租借中、且原本 tier 不是 TOP5 才可能收到。
  // loanOfferBonusMult 來自機會選項的 STUDY_ABROAD，沒選就是預設值 1。
  if (!S.onLoan) {
    const offered = checkLoanOffer(S, chance, choiceLog.loanOfferBonusMult || 1);
    if (offered) {
      // loanTargetTier 只讀不寫，先給 UI 知道邀約是去哪個層級，玩家答完
      // 才真的呼叫 sendOnLoan()(那個才會骰目的地的實際隊名)。
      const target = loanTargetTier(S);
      const choice = yield { type: 'LOAN_OFFER', target, recommend: 'accept' };
      if ((choice ?? 'accept') !== 'decline') {
        log.loanedTo = sendOnLoan(S, ri);
      } else {
        log.declinedLoan = target;
      }
    }
  }

  // 球季數據：記在這季實際踢球的層級(租借中就是租借目的地)
  const tierForStats = effectiveTier(S);
  const stat = generateSeasonStats(S, ri, chance);
  if (!S.stats[tierForStats]) S.stats[tierForStats] = [];
  S.stats[tierForStats].push(stat);
  log.stat = stat;
  S.peakRAT = Math.max(S.peakRAT, stat.RAT); // COMEBACK_KING 判定要用的生涯最佳球季紀錄

  // 場外收入：人氣值(popularity，社交選項的地盤) × 交往對象的代言加乘，
  // 跟 wage(球場表現決定的薪水)是分開的兩條收入線。
  const partnerMult =
    S.love.st !== LOVE_STATUS.SINGLE && S.love.partner
      ? (S.love.partner.hidden ? HIDDEN_PARTNER : PARTNER_TYPE)[S.love.partner.type].outsideIncomeMult
      : 1;
  // outsideIncomeMultBonus 是場外人氣稱號(見 data/fame.js/flow/fameHonors.js)
  // 疊加的永久係數加成，跟交往對象的代言加乘(partnerMult)相乘而不是相加——
  // 兩個都是「場外收入的倍率」，語意一致。
  S.yearOutsideIncome = Math.round(S.popularity * partnerMult * (1 + (S.outsideIncomeMultBonus || 0)) * OUTSIDE_INCOME_MULT * 100) / 100;
  S.outsideIncome += S.yearOutsideIncome;
  // 生涯薪資總額：終局可比較數據之一(使用者定案)，是「這輩子球場上總共
  // 賺了多少」的毛額，跟 S.savings(淨資產，花費/贍養費都會扣掉)是不同
  // 概念——故意獨立追蹤，不要跟存款混在一起，不然賭輸的投資/一擲千金
  // 都會反過來污染這個「你這輩子球場薪水到底賺了多少」的數字。只算
  // 球場薪水(S.wage)，不含場外收入(那個有自己的 S.outsideIncome 累積
  // 值可以比較)。
  S.careerWageTotal = Math.round(((S.careerWageTotal || 0) + S.wage) * 100) / 100;
  // 存款要真的累積年薪+場外收入，不然只有離婚贍養費會扣錢、踢一輩子球
  // 存款卻永遠不會變多——這是實測抓出來的漏洞，之前只有支出沒有收入。
  S.savings = Math.round((S.savings + S.wage + S.yearOutsideIncome) * 100) / 100;

  // 破產傳奇：曾經一擲千金歸零(S.everBlewItAll，見 flow/yearlyChoice.js
  // BLOW_IT_ALL)，之後存款又累積回100以上——逆轉話題性，跟商業頭腦
  // 同一個場外稀有層，判定放在存款累積完之後，讀的是這季結算完的存款。
  if (
    S.everBlewItAll &&
    S.savings >= WEALTH_HONOR.RAGS_TO_RICHES.recoverySavingsThreshold &&
    !S.honors.includes(WEALTH_HONOR.RAGS_TO_RICHES.label)
  ) {
    S.honors.push(WEALTH_HONOR.RAGS_TO_RICHES.label);
    S.popularity += WEALTH_HONOR.RAGS_TO_RICHES.effect.popularityBonus;
    log.unlockedRagsToRiches = true;
  }

  // 衰退：只在起衰年齡後生效(起衰前的成長改由年度選項的 TRAINING 類別觸發)
  const declineLoss = applyDecline(S);
  if (declineLoss > 0) log.declineLoss = declineLoss;

  // 常態徽章：動態判定，達門檻就有、掉出門檻就收回(見 flow/badges.js)，
  // 要在衰退(applyDecline)之後判定，這樣衰退把能力壓到門檻以下時，
  // 徽章當季就會正確地被收回，不會多留一季。
  const { unlocked, lost } = checkPlaystyleBadges(S);
  if (unlocked.length) log.unlockedPlaystyle = unlocked;
  if (lost.length) log.lostPlaystyle = lost;

  // 生涯定位標籤：用 stat 數值門檻代理聯賽排名(見 flow/playingStyle.js 註解)
  const unlockedStyle = checkPlayingStyleUnlocks(S, stat, log.newInjury === 'MAJOR');
  if (unlockedStyle.length) log.unlockedPlayingStyle = unlockedStyle;

  // 金靴獎：純看這季 GLS，不要求球隊戰績(跟金球獎不同，見
  // flow/eliteHonors.js checkGoldenBoot 的稽核說明)。
  // 稽核抓出來的真斷點(live UI 走一輪才抓到，headless 掃描沒抓到——
  // 掃描腳本讀的也是被蓋掉之後的最終 log，同樣會漏數)：這個判定原本
  // 放在 checkPlayingStyleUnlocks 呼叫「之前」，用 spread 疊加寫
  // log.unlockedPlayingStyle，但上面 checkPlayingStyleUnlocks 那行是
  // 直接用 = 覆蓋(不是疊加)——這是這個函式裡「第一個」寫入
  // log.unlockedPlayingStyle 的既有假設，原本沒錯，直到這裡插進一個
  // 更早執行的疊加式賦值，才破壞了那個假設：只要這季 checkPlayingStyleUnlocks
  // 也有東西要解鎖，金靴獎的結果就會被整個蓋掉，玩家看不到那句敘事，
  // trophyCount 雖然還是有正確累加(不受這個bug影響)，但稱號本身跟
  // 敘事會靜默消失。搬到這行之後(跟下面 checkEliteMilestones/checkGoatHonor
  // 同一個相對位置，那兩個本來就是正確的疊加式賦值)，不再搶在
  // checkPlayingStyleUnlocks 前面。
  const goldenBoot = checkGoldenBoot(S, stat);
  if (goldenBoot) log.unlockedPlayingStyle = [...(log.unlockedPlayingStyle || []), goldenBoot];

  // 精英層稱號(一代宗師/隊史傳奇)：純看累積狀態，見 flow/eliteHonors.js。
  const unlockedElite = checkEliteMilestones(S);
  if (unlockedElite.length) log.unlockedPlayingStyle = [...(log.unlockedPlayingStyle || []), ...unlockedElite];

  // 球王：累積戰績計數封頂認證，純看累積狀態，見 flow/eliteHonors.js
  // checkGoatHonor 的稽核說明。
  const goat = checkGoatHonor(S);
  if (goat) log.unlockedPlayingStyle = [...(log.unlockedPlayingStyle || []), goat];

  // 場外人氣稱號：小有名氣/社群寵兒/全球偶像，見 flow/fameHonors.js。
  const unlockedFame = checkFameHonors(S);
  if (unlockedFame.length) log.unlockedFame = unlockedFame;

  // 訓練線專屬稱號：苦練出頭/自我突破/血肉之驅的極限，見 flow/trainingHonors.js。
  const unlockedTraining = checkTrainingHonors(S);
  if (unlockedTraining.length) log.unlockedTraining = unlockedTraining;

  // 訓練夥伴/對手 CROSSROADS 累積稱號：不服輸的性格/較勁成癮/好隊友/
  // 更衣室的黏著劑，見 flow/rivalryHonors.js。
  const unlockedRivalryHonor = checkRivalryHonors(S);
  if (unlockedRivalryHonor.length) log.unlockedRivalryHonor = unlockedRivalryHonor;

  // 經紀人 CROSSROADS 累積稱號：敢賭的性格/豪賭成癮/穩紮穩打的信條/
  // 合約談判的定心丸，見 flow/agentHonors.js。
  const unlockedAgentHonor = checkAgentHonors(S);
  if (unlockedAgentHonor.length) log.unlockedAgentHonor = unlockedAgentHonor;

  // 世界盃：小插曲，四年一次窗口，沒中不扣分。命中會加 transferBuzz，
  // 影響下面(或之後幾季)的晉級判定機率，這是「踢好世界盃更容易被挖走」的實際機制。
  const worldCup = checkWorldCupWindow(S, ri, chance);
  if (worldCup) log.worldCup = worldCup;

  if (S.onLoan) {
    // 租借賽季結算：表現好留下轉正式，不好回原隊，沒有懲罰，原合約不受影響。
    const loanResult = resolveLoanSeason(S, ri, chance, stat.RAT);
    log.loanResult = loanResult;
  } else {
    // 俱樂部杯賽：RAT 沒到門檻就是沒打進正賽(cupSignal=0)，不扣分。
    // cupSignal 餵給下面的晉級判定，補上 PROMOTION_SIGNAL.cup 原本沒東西可算的權重。
    //
    // 已經待在豪門(ELITE)等級球隊，沒有更高處可轉會——機會選項攢的
    // transferBuzz 改吃「衝擊歐冠/俱樂部冠軍」這條路，不是變成無處可去的
    // 空轉數字：豪門球員的下一個目標本來就不是換更大的球隊，是留下來
    // 拿獎盃、拿金球獎(見 flow/eliteHonors.js checkBallonDor 需要同季捧盃)。
    // 買氣用掉後照樣退燒(×0.5)，跟晉級/豪門挖角判定同一套邏輯。
    const atCeiling = S.tier === 'TOP5' && clubPrestigeOf(S.club) === 'ELITE';
    // trainingBondCupBoost 是訓練夥伴線「羈絆時刻」疊加的永久值(見
    // data/trainingPartner.js BOND_MOMENT_HONOR)，跟豪門買氣轉換來的
    // 暫時加成(atCeiling 分支，用完就打對折)是不同來源，相加後才是這季
    // 實際套用的晉級加成——不分是不是豪門，任何層級的球隊都吃得到。
    const cupBuzzBoost = (atCeiling ? Math.min(0.15, (S.transferBuzz || 0) * 0.3) : 0) + (S.trainingBondCupBoost || 0);
    if (atCeiling) S.transferBuzz = (S.transferBuzz || 0) * 0.5;
    const clubCup = checkClubCup(S, chance, stat.RAT, cupBuzzBoost);
    if (clubCup) log.clubCup = clubCup;

    // 金球獎得主：要同時看這季個人表現(RAT)跟這季球隊有沒有捧盃，兩個都
    // 是這一輪才算出來的當季值，見 flow/eliteHonors.js。
    const ballonDor = checkBallonDor(S, stat, clubCup);
    if (ballonDor) log.unlockedPlayingStyle = [...(log.unlockedPlayingStyle || []), ballonDor];

    // 更新「連續達標季數」(見 transfer.js updatePromotionFormStreak 的稽核
    // 說明)，要在晉級/豪門挖角判定之前跑，兩邊都讀這個累積線。
    updatePromotionFormStreak(S, stat.RAT);

    // 轉會晉級判定(用這季 RAT 當聯賽表現訊號)，兩段式：evaluate 算報價，
    // headless 環境自動接受(見 transfer.js 開頭註解，之後接 UI 只要在
    // 這裡插入玩家的接受/拒絕決定，不用碰 transfer.js 的判定邏輯)。
    // 晉級會直接重簽合約，所以要在下面的「合約到期續約」之前判定，
    // 晉級當季不會又觸發一次到期續約。
    const promotionOffer = evaluatePromotionOffer(S, ri, chance, stat.RAT, clubCup?.cupSignal || 0);
    let promotion = null;
    if (promotionOffer) {
      const choice = yield { type: 'PROMOTION_OFFER', offer: promotionOffer, recommend: 'accept' };
      if ((choice ?? 'accept') !== 'decline') {
        promotion = acceptPromotionOffer(S, ri, promotionOffer);
        log.promotion = promotion;
      } else {
        declinePromotionOffer(S);
      }
    }

    // TOP5 內部的豪門階梯：只有已經在 TOP5、還沒進 ELITE 等級才可能觸發，
    // 跟聯賽晉級互斥(對方在 TOP5 本來就回傳 null，不會重疊，這裡加 !promotion
    // 純粹是避免同一季又晉級又被豪門挖走這種矛盾——玩家拒絕晉級報價也算
    // !promotion，同一季還是有機會遇到豪門挖角，跟原本「沒晉級就可能遇到
    // 豪門挖角」的語意一致)。
    const lateralOffer = !promotion ? evaluateLateralMoveOffer(S, ri, chance, stat.RAT, clubCup?.cupSignal || 0) : null;
    let lateralMove = null;
    if (lateralOffer) {
      const choice = yield { type: 'LATERAL_OFFER', offer: lateralOffer, recommend: 'accept' };
      if ((choice ?? 'accept') !== 'decline') {
        lateralMove = acceptLateralMoveOffer(S, ri, lateralOffer);
        log.lateralMove = lateralMove;
      } else {
        declineLateralMoveOffer(S);
      }
    }

    // 降級：跟晉級/豪門挖角互斥，只有都沒發生才會判定，連續低迷才有風險(見 transfer.js)。
    const demotion = !promotion && !lateralMove ? checkDemotion(S, ri, chance, stat.RAT) : null;
    if (demotion) log.demotion = demotion;

    // 合約倒數，到期不再是無條件續約——先看球隊還想不想留你，兩段式：
    // evaluate 攤出這次真正開放的選項(退休/降級/降薪)，headless 環境用
    // 建議值自動選(見 transfer.js 開頭註解，之後接 UI 只要在這裡插入
    // 玩家的實際選擇，不用碰 transfer.js 的判定邏輯)。沒觸發危機才是
    // 正常續約。
    if (!promotion && !lateralMove && !demotion) {
      S.contract.yearsLeft = Math.max(0, S.contract.yearsLeft - 1);
      if (S.contract.yearsLeft === 0) {
        const crisisOffer = evaluateContractCrisis(S, chance);
        const crisisChoice = crisisOffer
          ? yield { type: 'CONTRACT_CRISIS', offer: crisisOffer, recommend: crisisOffer.recommend }
          : null;
        const crisis = crisisOffer ? resolveContractCrisis(S, ri, crisisChoice ?? crisisOffer.recommend) : null;
        if (crisis) {
          log.contractCrisis = crisis;
          // 敘事優先序修正：合約危機可能剛好跟世界盃奪冠同一季發生
          // (合約到期判定在上面，worldCup 在更早就骰完了)——球隊選在
          // 你捧盃那年不續約，這種巧合不該讓終局摘要讀起來像「被球隊掃地
          // 出門」，改成「捧著冠軍獎盃選擇離開」，跟下面的封頂退休判定
          // 用同一個 S.retiredAsChampion 旗標，flow/legacy.js 才會挑到
          // 對的收尾句。不影響合約危機原本的機制後果(該降級/降薪的分支
          // 不受影響，只有 type==='retired' 這個分支的敘事框架被升級)。
          if (crisis.type === 'retired' && worldCup && worldCup.champion) {
            S.retiredAsChampion = true;
            log.retiredAsChampion = true;
          }
        } else {
          log.contractRenewed = signContract(S, ri, S.tier);
        }
      }
    }
  }

  // 引退判定：ETERNAL_CAPTAIN 等稱號疊加的引退延後(見 flow/worldCup.js)算進上限。
  // !S.retired 守衛：合約危機(見上面)可能這季已經因為年紀/忠誠度判定觸發過
  // 退休，這裡不用再判一次，避免同一季重複標記退休事件。
  const cap = RETIRE_CAP[positionKey(S)] + (S.retireCapBonus || 0);
  // 世界盃奪冠封頂退休：球技線的終極終局選擇，對照財富線的 BUY_CLUB。
  // 兩段式(見 flow/worldCup.js evaluateChampionRetirement/
  // resolveChampionRetirement 的註解)——headless 用 recommend 自動選：
  // 接近自然引退門檻(3年內)才建議退休，還年輕就建議繼續踢(稱號照拿，
  // 不強制打斷生涯，呼應「向上流動不卡關」)，之後接 UI 只要在這裡插入
  // 玩家對這個 offer 的真實選擇，不用碰 worldCup.js 的判定邏輯。
  const championOffer = evaluateChampionRetirement(S, worldCup, cap);
  const championChoice = championOffer
    ? yield { type: 'CHAMPION_RETIREMENT', offer: championOffer, recommend: championOffer.recommend }
    : null;
  const championRetirement = championOffer ? resolveChampionRetirement(S, championChoice ?? championOffer.recommend) : null;
  if (championRetirement) {
    log.retiredAsChampion = true;
  }

  // 梅老闆：財富巔峰的引擎觸發退休選項，跟世界盃封頂同一套 evaluate/
  // resolve 兩段式架構(見 flow/wealthPeak.js 開頭的稽核說明)——跟世界盃
  // 封頂不同的是，這裡稱號拿過就不會再問第二次(場外收入超車薪水一旦
  // 發生，很可能接下來好幾季都成立，每季重問一次會很煩)。放在世界盃
  // 封頂判定之後：如果這季已經因為捧盃選擇退休，S.retired 已經是
  // true，checkBossMilestone 內部的守衛會自動跳過，不會同一季疊兩個
  // 退休決定。稱號本身(log.unlockedWealthHonor)不管退不退休都會給，
  // 疊加式敘事——這就是使用者說的「這些觸發事件的文案就併入該生涯的
  // 結尾，所以才是疊加式」。 */
  const bossMilestone = checkBossMilestone(S, cap);
  if (bossMilestone.unlocked) {
    log.unlockedWealthHonor = 'BOSS';
    const bossChoice = bossMilestone.pending
      ? yield { type: 'BOSS_RETIREMENT', offer: bossMilestone.pending, recommend: bossMilestone.pending.recommend }
      : null;
    const bossRetirement = bossMilestone.pending ? resolveBossRetirement(S, bossChoice ?? bossMilestone.pending.recommend) : null;
    if (bossRetirement) log.retiredAsBoss = true;
  }

  if (!championRetirement && !log.retiredAsBoss && !S.retired && S.age >= cap) {
    S.retired = true;
    S.stage = 'RETIRED';
    log.retired = true;
  }

  return log;
}

/* headless/demo 用的同步版本：把上面的 generator 一路跑到底，每個抉擇點
   都直接採用 recommend——這是原本 resolveSeasonChoice() 的行為，簽名/
   回傳值完全不變，demo.js/story.js/下面的 proSeasonTick() 都不用跟著改。
   真正接 UI 之後，web/src/App.jsx 改成自己手動驅動 resolveSeasonChoiceGen()，
   在每個 yield 停下來問玩家，答完才呼叫 generator.next(選擇) 繼續往下跑
   ——同一份判定邏輯，headless 跟真人玩家只差在「誰決定 yield 出來的
   選擇」，不用維護兩份邏輯，也不會有兩邊行為兜不起來的風險。 */
export function resolveSeasonChoice(S, ri, chance, category, option, riskTierKey, partialLog = {}) {
  const gen = resolveSeasonChoiceGen(S, ri, chance, category, option, riskTierKey, partialLog);
  let step = gen.next();
  while (!step.done) {
    step = gen.next(step.value.recommend);
  }
  return step.value;
}

/* headless 自動分配策略：季初分配的點數池全部押在單一個「離潛力天花板
   最遠」的能力上(比照 applyAbilityNudge/yearlyChoice.js pickTargetFrom
   同一套 heuristic)——不用真的模擬玩家分散分配的行為，這是給種子掃描/
   校準用的簡化策略，行為上等同一直沿同一路線推進，足夠反映真實的成長
   節奏。真正接 UI 之後，UI 讓玩家自己用 +/- 分配，這個函式就不用了。 */
function pickAllocationTarget(S) {
  const keys = Object.keys(S.ab).filter((k) => S.ab[k] < ABILITY_HARD_CAP);
  if (keys.length === 0) return null;
  keys.sort((a, b) => S.pot[b] - S.ab[b] - (S.pot[a] - S.ab[a]));
  return keys[0];
}

/* headless/demo 用的入口：跑一個完整職業球季。稽核抓出來的斷點修正：
   骰子成長(大頭)原本黏在 TRAINING 類別的年度選項裡，現在拆成獨立的
   「季初」步驟(見 flow/seasonOpener.js)，在 prepareSeasonChoice()(年齡/
   年份遞增)之後、pickYearlyChoice()(年度選項)之前先跑——不看這季選了
   什麼類別，每季都會發生。真正接 UI 之後，UI 依序呼叫
   prepareSeasonChoice() → rollSeasonOpener() → (玩家分配) →
   applySeasonAllocation() → 年度選項三步驟 → resolveSeasonChoice()，
   這個函式就不用了。pickYearlyChoice() 內部會重算一次 availableOptions()
   (跟 prepareSeasonChoice() 各自獨立算一次)，是多算不是錯——那是純函式、
   不消耗 RNG，headless 路徑的隨機序列不受影響。 */
export function proSeasonTick(S, ri, chance) {
  const { partialLog } = prepareSeasonChoice(S);

  const opener = rollSeasonOpener(S, ri, 'PRO');
  if (opener.dice.length) {
    const target = pickAllocationTarget(S);
    const gain = target ? applySeasonAllocation(S, { [target]: opener.pool }) : 0;
    trackSeasonSixes(S, opener.sixes, 'PRO');
    partialLog.seasonOpener = { dice: opener.dice, pool: opener.pool, target, gain };
  }

  // 戀愛常駐事件：headless 用 pending.recommend 自動判定(見
  // prepareLoveChoice/resolveLoveChoiceStep 的稽核說明)。這裡呼叫完之後
  // S.love.st 才是本季最終的戀愛狀態，緊接著的 pickYearlyChoice 內部會
  // 重算一次 availableOptions()，天然就能讀到正確的 SOCIAL 選單(這個
  // 專案已經有「availableOptions 是純函式，多算一次是安全的」先例，見
  // 下面 pickYearlyChoice 的呼叫)。
  const { ambientLog, pending } = prepareLoveChoice(S, ri, chance);
  partialLog.love = resolveLoveChoiceStep(S, ri, chance, ambientLog, pending, pending?.recommend);

  // 訓練夥伴/對手常駐事件：同一個位置、同一種 headless 自動判定寫法，
  // 見 prepareTrainingChoice/resolveTrainingChoiceStep 的稽核說明。
  const { ambientLog: trainingAmbientLog, pending: trainingPending } = prepareTrainingChoice(S, ri, chance);
  partialLog.training = resolveTrainingChoiceStep(S, ri, chance, trainingAmbientLog, trainingPending, trainingPending?.recommend);

  // 經紀人常駐事件：同一個位置、同一種 headless 自動判定寫法，見
  // prepareAgentChoice/resolveAgentChoiceStep 的稽核說明——PRO-only，
  // 這裡不用另外判斷，S.agent 起點本來就只會在這個函式裡被指派。
  const { ambientLog: agentAmbientLog, pending: agentPending } = prepareAgentChoice(S, ri, chance);
  partialLog.agent = resolveAgentChoiceStep(S, ri, chance, agentAmbientLog, agentPending, agentPending?.recommend);

  // 國家隊隱藏對手線的 CROSSROADS：同一個位置、同一種 headless 自動判定
  // 寫法，見 prepareRivalChoice/resolveRivalChoiceStep 的稽核說明。
  const { pending: rivalPending } = prepareRivalChoice(S, chance);
  partialLog.nationalRivalCrossroads = resolveRivalChoiceStep(S, rivalPending, rivalPending?.recommend);

  const { category, option, riskTierKey } = pickYearlyChoice(S, ri);
  // 訓練夥伴/對手 CROSSROADS：使用者定案「有訓練才能繼續走下去」——只有
  // 這季真的選了訓練類別、且已經有夥伴時才評估，不是 ambient(見
  // flow/trainingRivalry.js 開頭的稽核說明)。選類別本身是玩家的確定性
  // 動作(不是 chance() 骰出來的)，這裡直接評估+套用不會有預覽亂數序列
  // 的風險，跟 flow/nationalRival.js 的 wcRivalChoice banking 是不同情境
  // (那邊要 banking 是因為「有沒有入選」本身要骰，這裡「選不選訓練」
  // 不用骰)。
  const { pending: crossroadsPending } = prepareTrainingCrossroadsChoice(S, category, chance);
  partialLog.trainingCrossroads = resolveTrainingCrossroadsChoiceStep(S, ri, chance, crossroadsPending, crossroadsPending?.recommend);
  // 羈絆時刻：緊接在 CROSSROADS 之後、resolveSeasonChoice 之前呼叫(見
  // flow/trainingRivalry.js checkTrainingBondMoment 的稽核說明)，跟
  // CROSSROADS 是否觸發無關(兩個是獨立判定，同一季可能都發生)。
  const bondMoment = checkTrainingBondMoment(S, category, chance);
  if (bondMoment) partialLog.trainingCrossroads = { ...partialLog.trainingCrossroads, bondMoment };

  // 經紀人 CROSSROADS(大膽操作/穩紮穩打)：同一個道理，只有這季真的選了
  // 機會類別才評估，見 flow/agentLine.js prepareAgentCrossroadsChoice 的
  // 稽核說明。世紀交易(agentBondMoment)緊接在後，跟訓練線同一個相對位置。
  const { pending: agentCrossroadsPending } = prepareAgentCrossroadsChoice(S, category, chance);
  partialLog.agentCrossroads = resolveAgentCrossroadsChoiceStep(S, ri, chance, agentCrossroadsPending, agentCrossroadsPending?.recommend);
  const agentBondMoment = checkAgentBondMoment(S, category, chance);
  if (agentBondMoment) partialLog.agentCrossroads = { ...partialLog.agentCrossroads, agentBondMoment };
  return resolveSeasonChoice(S, ri, chance, category, option, riskTierKey, partialLog);
}
