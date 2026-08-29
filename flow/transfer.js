/* ---------- 轉會晉級／降級 ---------- */
/* 對照 career.js PROMOTION_SIGNAL 的三個訊號加權(聯賽/國家隊/杯賽)——
   俱樂部杯賽現在接上了(flow/clubCup.js)，三個訊號權重都有東西可以算，
   不再是設計了 0.2 權重卻永遠是 0 的半成品。國家隊訊號用 S.transferBuzz
   (世界盃人氣，見 flow/worldCup.js)頂上，這就是「世界盃踢好了、國內聯賽
   更容易被挖走」的實際機制。transferBuzz 每次晉級判定後衰減一半，
   不是一次性用完即棄——買氣是慢慢退的，不是開關式的。

   轉會費摩擦：合約剩餘年限越長，買斷代價越高(見 contract.js
   TRANSFER_FEE_FACTOR)，晉級機率跟著打折——這是「賣方不想放人」的實際
   體現，反過來也代表合約快到期的球員最容易被挖走(現實中球隊也傾向
   賣掉快到期、免得到時候免簽白白流失的球員)。

   降級：對照晉級，表現連續低迷會有被降回下一級的風險，不是只有晉級沒有
   降級——原本標「留給下一輪」，這裡補上。跟晉級判定互斥，同一季不會
   又晉級又降級。

   兩段式設計(evaluate/accept)：實測稽核發現 S.transferRefusalUsed 宣告了
   卻沒有任何地方能寫入——原本 checkPromotion() 骰中就直接執行，沒有
   「報價」這個中間狀態可以掛「玩家拒絕」的邏輯。拆成 evaluate(算分數/
   骰運氣，不改動 state)+ accept(真的執行轉會)兩段，跟 loan.js 的
   checkLoanOffer/sendOnLoan 是同一種分工。headless 環境(demo/story)
   目前一律自動接受(見 proSeason.js)，之後接 UI 只要在 evaluate 回傳報價
   時跳出「接受/拒絕」，選拒絕呼叫 declinePromotionOffer 累加
   transferRefusalUsed，不用重寫這裡的判定邏輯。

   晉級難度校準(這輪稽核)：原始設計下 LOCAL 起步的球員 98.8% 這輩子都會
   摸到 TOP5，晉級形同「活得夠久就一定發生」，跟 TOP5 是精英稱號/最高
   榮譽的門檻這件事矛盾——太容易，門形同虛設。改了三層(leagueSignal
   門檻/PROMOTION_FORM_STREAK 連續達標才有資格/PROMOTION_ATTEMPT_DAMPEN
   折扣)才真的把數字壓下來，過程中還抓到一個真正的漏洞：flow/loan.js
   的租借留隊完全繞過這裡的判定，直接決定性地把 S.tier 設成目標層級，
   是一條比正規晉級更好走的後門，同一輪一併補上同等難度(見 loan.js)。
   最終目標值(6000種子實測)：LOCAL起步約28%這輩子摸到TOP5、FEEDER起步
   約62%、全體約60%——刻意讓「起點越差、爬升越難」，但整體仍有過半
   生涯能碰到終端內容，不是卡死也不是形同虛設。如果這幾個數字之後要
   再調，重跑同一套種子掃描方法，不要單看某一個常數改了多少，三層是
   一起在影響最終比例的。 */

import { REGION } from '../data/regions.js';
import { PROMOTION_SIGNAL, SQUAD_CHEMISTRY } from '../data/career.js';
import { TRANSFER_FEE_FACTOR } from '../data/contract.js';
import { DECLINE_START, RETIRE_CAP } from '../data/decline.js';
import { DP_TH, GK_BAR } from '../data/abilities.js';
import { calcOVR, positionKey, signContract, pickTop5Club, pickFeederClub, pickLocalClub, clubPrestigeOf } from './shared.js';

/* 用當季 RAT(5-10 分制)換算成 0-1 的聯賽表現訊號：7.5 分以下算 0，
   9.5 分(接近頂級)封頂算 1，中間線性內插。
   稽核抓出來的斷點：門檻原本是6.5，用RAT公式(5+effOVR/80*5)反推，
   effOVR只要超過24左右訊號就不是0了——潛力隨便一個種子練到自己的
   軟上限，effOVR普遍落在40-70，訊號輕鬆落在0.5以上，20幾季生涯下來
   幾乎人人都能靠時間磨到晉級(6000種子實測LOCAL起步98.8%這輩子都會
   摸到TOP5)。改成7.5——這是使用者定案：TOP5是終端內容的門(精英稱號/
   最高榮譽都在那)，晉級不該幾乎人人有份，但也不該稀有到大部分玩家一輩子
   看不到終端內容，門檻數字是拿這個折衷目標反覆用種子掃描收斂出來的，
   不是隨便選的，見 data/career.js PROMOTION_SIGNAL 的校準記錄。 */
// 數字跟著 RAT 公式重算校準(見 flow/proSeason.js generateSeasonStats 的
// 稽核說明)：反推舊門檻(7.5→0分、9.5→1分)對應的 effOVR(40/72)，代入新
// 公式算出等值新門檻(6.5/7.9)，維持「這個訊號要求多好的能力值」語意
// 不變，不是憑感覺重挑數字。
function leagueSignal(rat) {
  return Math.max(0, Math.min(1, (rat - 6.5) / 1.4));
}

/* 稽核抓出來的第二個斷點：leagueSignal 只看「現在的能力值」，不管這個
   能力值是「還有餘裕的高潛力種子輕鬆長出來的」還是「低潛力種子拼命
   超過潛力硬磨出來的」——現實球探不只看現在的數字，也看「這個人還有
   多少沒開發的天花板」，兩個當下 effOVR 一樣的球員，市場評價不該一樣。
   用平均剩餘空間(潛力-現值，只算還沒超過潛力的部分，已經超過的不算
   「還沒開發」)正規化成0-1，20分當滿分基準(配合季初骰子池的量級抓出
   來的，不是憑感覺)。這是這輪讓「開局種子品質」真的影響晉級難度的
   關鍵一塊——光靠 flow/shared.js 的超過潛力加倍成本，20幾季生涯下來
   低潛力種子還是能磨到跟高潛力種子差不多的effOVR(實測開局評分C級跟
   A級最終摸到TOP5的比例幾乎沒有差異)，這裡補上「就算磨到了，賣相也
   不一樣」，兩塊一起才會讓評分真的跟後續難度掛勾。 */
export function potentialUpsideSignal(S) {
  const keys = Object.keys(S.ab);
  const totalHeadroom = keys.reduce((sum, k) => sum + Math.max(0, S.pot[k] - S.ab[k]), 0);
  return Math.max(0, Math.min(1, totalHeadroom / keys.length / 20));
}
const PROMOTION_UPSIDE_WEIGHT = 0.3;

/* 稽核抓出來的斷點：只調高 leagueSignal 的門檻(見上面)幾乎沒有效果——
   晉級判定每季都會骰一次，一輪生涯20幾季下來，就算單季機率壓得再低，
   累積下來還是幾乎必中。真正的問題是「重複骰到底」這個結構本身，不是
   單次機率高低。改成「連續達標才有機會被骰到」：這季RAT要到
   PROMOTION_FORM_THRESHOLD 才算數，連續累積到
   PROMOTION_FORM_STREAK_NEEDED 季，晉級/豪門挖角判定才會真的開始骰——
   不是硬性門檻(累積條件玩家隨時能透過認真訓練/避開社交風險重新湊出來，
   不會卡死)，但真的要求「穩定的巔峰表現」，跟單季走運完全是两回事。 */
// 數字跟著 RAT 公式重算校準，同上——反推舊門檻(8.5)對應的 effOVR≈56，
// 代入新公式算出等值新門檻 7.2。
const PROMOTION_FORM_THRESHOLD = 7.2;
const PROMOTION_FORM_STREAK_NEEDED = 3;
/* 光是「累積夠久才有機會」還不夠——一旦真的湊到門檻，score 本身在高RAT
   下還是容易接近頂格，單次嘗試幾乎穩過。這裡疊一個總體折扣，讓「有
   資格嘗試」跟「真的成功」還是有落差，不是拿到門票就等於中獎。跟上面
   兩個常數(門檻/連續季數)、以及 flow/loan.js 的租借留隊難度是同一輪
   一起用種子掃描收斂出來的，三處數字互相牽動，見檔案開頭的完整校準
   說明，不要只看這裡單一個常數改了多少。 */
const PROMOTION_ATTEMPT_DAMPEN = 0.35;

/* proSeasonTick 每季結束呼叫一次，更新「連續達標季數」——不分晉級/豪門
   挖角，同一條累積線兩邊共用，換算成「這球員最近的狀態夠不夠穩定」。 */
export function updatePromotionFormStreak(S, seasonRat) {
  S.promotionFormStreak = seasonRat >= PROMOTION_FORM_THRESHOLD ? (S.promotionFormStreak || 0) + 1 : 0;
}

function promotionTarget(S) {
  // S.retired 守衛：跟下面 lateralMoveTarget/checkDemotion/evaluateContractCrisis
  // 同一個道理(見那幾處註解)——這季稍早的年度選項如果選了 BUY_CLUB/
  // PIVOT_TO_CELEBRITY(見 data/yearlyOptions.js)，S.retired 會提前在這裡
  // 之前就設成 true，已經決定「不踢了」的人不該還被判定晉級。
  if (S.retired) return null;
  if (S.tier === 'TOP5') return null;
  if (S.tier === 'LOCAL') {
    // 歐洲地區沒有跳板聯賽，直接從 LOCAL 有機會被五大聯賽球探發掘
    return REGION[S.region].feeder ? 'FEEDER' : 'TOP5';
  }
  if (S.tier === 'FEEDER') return 'TOP5';
  return null;
}

/* 合約剩餘年限換算轉會費摩擦係數：年限對不上 TRANSFER_FEE_FACTOR 的
   0-4 級距就夾在範圍內，係數 0(快到期，幾乎免簽) ~ 1(還有很多年，買斷貴)。
   解約金倍率(見 flow/shared.js rollReleaseClause)疊加在後面：倍率低(容易
   買走)會把摩擦再壓低、甚至倒過來加成，倍率高(接近鎖死)會加重摩擦。
   2.5 當中性錨點(倍率區間 1.2-4.0 的中段)，clamp 在 0.6-1.3 之間，
   不讓解約金單獨把晉級機率推到荒謬的極端。 */
function feeFrictionMult(S) {
  const years = Math.max(0, Math.min(4, S.contract.yearsLeft));
  const factor = TRANSFER_FEE_FACTOR[years] ?? 1;
  const baseFriction = 1 - factor * 0.4; // 買斷最貴時score打6折，快到期時完全不打折
  const clause = S.contract.releaseClause || 2.5;
  const clauseFactor = Math.max(0.6, Math.min(1.3, 2.5 / clause));
  return baseFriction * clauseFactor;
}

/* 第一段：算分數、骰是否有報價，不改動 tier/club/合約——只有 transferBuzz
   的消耗留在這裡，因為「買氣退燒」跟報價骰不骰得中無關，每次評估都會退，
   跟原本行為一致。入口：每季結束後呼叫一次，seasonRat 是這季的 RAT，
   cupSignal 來自 flow/clubCup.js(沒打進杯賽正賽就是 0)。 */
export function evaluatePromotionOffer(S, ri, chance, seasonRat, cupSignal = 0) {
  const target = promotionTarget(S);
  if (!target) return null;
  // 連續穩定達標才有機會被球探看見，見上面 updatePromotionFormStreak 的
  // 稽核說明——buzz 依然照舊每季退燒(下面那行)，不因為這裡提前 return
  // 就跳過，維持「買氣本來就會慢慢退」的既有行為不變。
  if ((S.promotionFormStreak || 0) < PROMOTION_FORM_STREAK_NEEDED) {
    S.transferBuzz = (S.transferBuzz || 0) * 0.5;
    return null;
  }
  // 稽核抓出來的第二個斷點：光是「連續達標才有資格」還不夠——一個穩定
  // 巔峰期能連續好幾季維持在門檻之上，達標之後每一季都還會重新骰一次，
  // 等於只是把「反覆骰到底」的起點往後延，長生涯下來還是幾乎必中(6000
  // 種子實測只從98.8%壓到80%出頭，調高門檻/拉長連續季數邊際效益都很低)。
  // 改成：一旦真的騎到這次機會(不管成不成功)，這條累積線直接消耗歸零，
  // 要重新累積滿 PROMOTION_FORM_STREAK_NEEDED 季才有下一次機會——一輪
  // 生涯的「真正嘗試次數」被壓到個位數，而不是巔峰期每季都在抽獎。
  S.promotionFormStreak = 0;

  const buzz = S.transferBuzz || 0;
  const score =
    (PROMOTION_SIGNAL.league * leagueSignal(seasonRat) +
      PROMOTION_SIGNAL.national * Math.min(1, buzz) +
      PROMOTION_SIGNAL.cup * cupSignal +
      PROMOTION_UPSIDE_WEIGHT * potentialUpsideSignal(S)) *
    feeFrictionMult(S) *
    PROMOTION_ATTEMPT_DAMPEN;
  S.transferBuzz = buzz * 0.5; // 買氣慢慢退，不是判定完就歸零

  if (score <= 0 || !chance(score)) return null;
  return { target };
}

/* 第二段：真的執行轉會——換 tier/俱樂部、重簽合約(共用 shared.js
   signContract)。換東家，冠軍紀錄跟著上一支球隊留在原地，
   wonTitleWithCurrentClub 歸零(見 flow/clubCup.js CHAMPION 才會設 true)。 */
export function acceptPromotionOffer(S, ri, offer) {
  const { target } = offer;
  const prevTier = S.tier;
  S.tier = target;
  S.lastClub = S.club;
  // 晉級一定是 LOCAL→FEEDER 或 FEEDER/LOCAL→TOP5，用對應的具名俱樂部池。
  const clubName = target === 'TOP5' ? pickTop5Club(ri) : pickFeederClub(ri, S.region);
  S.club = clubName;
  S.clubTally[target][clubName] = (S.clubTally[target][clubName] || 0) + 1;
  S.clubJourney.push({ tier: target, club: clubName }); // 生涯轉會軌跡，見 core/state.js 的稽核說明
  S.wonTitleWithCurrentClub = false;
  S.squadChemistry = SQUAD_CHEMISTRY.base; // 換東家重新磨合，見 data/career.js SQUAD_CHEMISTRY
  S.trainingPartner = null; // 舊夥伴/對手收尾，新東家要重新選訓練才會指派新的，見 data/trainingPartner.js

  const { wage, years } = signContract(S, ri, target);
  return { from: prevTier, to: target, wage, years };
}

/* 玩家拒絕報價：目前 headless 環境沒有呼叫端會用到這個(demo/story 一律
   自動接受)，等真的接 UI，玩家在報價彈窗按下拒絕就呼叫這個。 */
export function declinePromotionOffer(S) {
  S.transferRefusalUsed = (S.transferRefusalUsed || 0) + 1;
}

/* ---------- TOP5 內部的豪門階梯 ---------- */
/* 「向上流動」延伸進 TOP5 內部：CONTENDER 檔次的球隊之後，還有 ELITE
   (豪門)可以挖角，讓已經爬到頂層聯賽的生涯後半段不是「守成」，而是
   持續有新的攀爬目標。已經在 ELITE 等級就沒有更高處可去，跟
   promotionTarget() 在 TOP5 回傳 null 是同一種「已達天花板」邏輯。
   分數公式直接沿用晉級判定同一套(league/national/cup 訊號 × 轉會摩擦)，
   維持同一種設計語言，不用另外發明一套參數。 */
function lateralMoveTarget(S) {
  if (S.tier !== 'TOP5') return null;
  // S.retired(不是單獨檢查 S.ownsClub)：買下球隊(BUY_CLUB)一定會設 S.retired，
  // 這裡改用更廣義的旗標一次涵蓋所有「這季稍早就已經決定不踢了」的終局選項
  // (BUY_CLUB/PIVOT_TO_CELEBRITY，見 data/yearlyOptions.js)，不是每加一種
  // 新的終局選擇都要在這裡多補一行專屬判斷。
  if (S.retired) return null;
  if (clubPrestigeOf(S.club) === 'ELITE') return null;
  return 'ELITE';
}

export function evaluateLateralMoveOffer(S, ri, chance, seasonRat, cupSignal = 0) {
  const target = lateralMoveTarget(S);
  if (!target) return null;
  // 跟 evaluatePromotionOffer 同一個門檻，同一條 S.promotionFormStreak
  // 累積線——豪門挖角一樣要連續穩定表現才有機會，不是另開一套規則。
  if ((S.promotionFormStreak || 0) < PROMOTION_FORM_STREAK_NEEDED) {
    S.transferBuzz = (S.transferBuzz || 0) * 0.5;
    return null;
  }
  // 同 evaluatePromotionOffer：真的騎到機會就消耗掉累積線，不是達標之後
  // 每季都能再抽一次。
  S.promotionFormStreak = 0;

  const buzz = S.transferBuzz || 0;
  const score =
    (PROMOTION_SIGNAL.league * leagueSignal(seasonRat) +
      PROMOTION_SIGNAL.national * Math.min(1, buzz) +
      PROMOTION_SIGNAL.cup * cupSignal +
      PROMOTION_UPSIDE_WEIGHT * potentialUpsideSignal(S)) *
    feeFrictionMult(S) *
    PROMOTION_ATTEMPT_DAMPEN;
  S.transferBuzz = buzz * 0.5;

  if (score <= 0 || !chance(score)) return null;
  return { target };
}

/* 玩家拒絕豪門挖角：跟 declinePromotionOffer 共用同一個計數器
   (S.transferRefusalUsed)——兩者都是「轉會報價，玩家說不要」，沒有理由
   分開算兩條線，接 UI 之後玩家在報價彈窗按下拒絕就呼叫這個。 */
export function declineLateralMoveOffer(S) {
  S.transferRefusalUsed = (S.transferRefusalUsed || 0) + 1;
}

export function acceptLateralMoveOffer(S, ri, offer) {
  const prevClub = S.club;
  S.lastClub = S.club;
  const clubName = pickTop5Club(ri, offer.target);
  S.club = clubName;
  S.clubTally.TOP5[clubName] = (S.clubTally.TOP5[clubName] || 0) + 1;
  S.clubJourney.push({ tier: 'TOP5', club: clubName }); // 生涯轉會軌跡，見 core/state.js 的稽核說明
  S.wonTitleWithCurrentClub = false;
  S.squadChemistry = SQUAD_CHEMISTRY.base; // 換東家重新磨合，見 data/career.js SQUAD_CHEMISTRY
  S.trainingPartner = null; // 舊夥伴/對手收尾，新東家要重新選訓練才會指派新的，見 data/trainingPartner.js

  const { wage, years } = signContract(S, ri, 'TOP5');
  return { from: prevClub, to: clubName, wage, years };
}

/* 門檻經實測校準：generateSeasonStats() 算出來的 RAT 實際分布大多落在
   7.0-9.5，6.0 這種門檻在正常情況下幾乎摸不到(只有離婚/緋聞曝光這種極端
   seasonForm 懲罰才砸得下去)，導致「連續兩季低於門檻」形同不會發生——
   實測 150 個種子 0 次命中。7.0 才是這套公式底下真正「低於平均」的水準。 */
// 數字跟著 RAT 公式重算校準，同上——反推舊門檻(7.0)對應的 effOVR≈32，
// 代入新公式算出等值新門檻 6.1。
const DEMOTION_RAT_THRESHOLD = 6.1;

/* 降級判定：只有連續兩季以上表現低迷(RAT<6.0)才會有風險，單季失常不會
   馬上被降級，門檻隨連續低迷季數往上加(15%起跳，封頂50%)。 */
export function checkDemotion(S, ri, chance, seasonRat) {
  // 同 lateralMoveTarget 的 S.retired 守衛，理由見那裡的註解。
  if (S.retired) return null;
  if (S.tier === 'LOCAL') {
    S.poorFormStreak = 0;
    return null;
  }
  if (seasonRat >= DEMOTION_RAT_THRESHOLD) {
    S.poorFormStreak = 0;
    return null;
  }
  S.poorFormStreak = (S.poorFormStreak || 0) + 1;
  if (S.poorFormStreak < 2) return null;

  const demotionChance = Math.min(0.5, 0.15 * (S.poorFormStreak - 1));
  if (!chance(demotionChance)) return null;

  // 歐洲地區沒有跳板聯賽(同一個 crash 來源，見 careerStart.js resolveDebut
  // 的同款註解)：從 TOP5 降級照理是先落到 FEEDER，但歐洲球員沒有 FEEDER
  // 可落，直接跳過降到 LOCAL。
  const target = S.tier === 'TOP5' && REGION[S.region].feeder ? 'FEEDER' : 'LOCAL';
  const prevTier = S.tier;
  S.tier = target;
  S.lastClub = S.club;
  const clubName = target === 'LOCAL' ? pickLocalClub(ri, S.region) : pickFeederClub(ri, S.region);
  S.club = clubName;
  S.clubTally[target][clubName] = (S.clubTally[target][clubName] || 0) + 1;
  S.clubJourney.push({ tier: target, club: clubName }); // 生涯轉會軌跡，見 core/state.js 的稽核說明
  S.poorFormStreak = 0;
  S.wonTitleWithCurrentClub = false;
  S.squadChemistry = SQUAD_CHEMISTRY.base; // 換東家重新磨合，見 data/career.js SQUAD_CHEMISTRY
  S.trainingPartner = null; // 舊夥伴/對手收尾，新東家要重新選訓練才會指派新的，見 data/trainingPartner.js

  const { wage, years } = signContract(S, ri, target);
  return { from: prevTier, to: target, wage, years };
}

/* ---------- 合約危機：老化/傷病/連續低迷讓球隊不想再留你 ---------- */
/* 對照現實足球：合約到期不是自動續約的儀式，是球隊要不要繼續投資在你
   身上的真實決定。之前的版本合約一到期就無條件續約，等於「拚搏」只影響
   爬升速度、不影響生死存亡——這裡補上真正的下行風險，跟晉級/豪門階梯
   的上行邏輯對稱：能力數據是會起伏的，能升就有可能降，甚至被放棄。

   風險吃三個因素：
     年紀 — 過起衰年齡越久，球隊續約意願越低。
     能力是否配得上這個層級 — 用 DP_TH/GK_BAR(這個層級「該有的底線」)
       跟目前 calcOVR 的落差當代理，落差越大風險越高。permanentResidual
       (大傷永久殘留debuff，見 shared.js calcOVR 同一次稽核補上的斷點)
       會拖累這個數字，這就是「重傷可能讓你不再被需要」的實際機制，
       不用另外寫一條傷病專屬的釋出判定。
     連續低迷(poorFormStreak) — 跟 checkDemotion 共用同一個計數。
   忠誠度(在同一支球隊待多久、有沒有捧過盃)打折風險，對照原版棒球的
   「城市英雄」羈絆設計：球隊會念舊，給功勳老將更多耐心，不是純看數字
   說話——待滿5季或捧過盃就算「忠誠」，這個定義跟 CLUB_LEGEND 稱號
   (見 flow/eliteHonors.js)的 7 季門檻故意不對齊，忠誠度的保護生效得
   比拿到那個稱號更早，不然這份保護對大多數球員來說都太遲了。
   S.releaseRiskDiscount(機會選項 EXEC_NETWORKING「結識球隊高層」累積，
   見 data/yearlyOptions.js/flow/yearlyChoice.js)也會打折風險——跟高層
   搏感情本來就該是玩家能主動採取、用來緩解這個風險的手段，不能只有
   年紀/能力這種玩家改變不了的被動因素在決定生死，不然這個新系統對
   玩家選擇的回應等於零。 */
function releaseRiskChance(S) {
  const key = positionKey(S);
  const declineStart = DECLINE_START[key] + (S.declineStartBonus || 0);
  const ageFactor = Math.max(0, S.age - declineStart) * 0.02;

  const ovr = calcOVR(S);
  const threshold = S.pos === 'GK' ? GK_BAR[S.tier] : DP_TH[key][S.tier];
  const shortfallFactor = Math.max(0, threshold - ovr) * 0.02;

  const formFactor = (S.poorFormStreak || 0) * 0.05;

  const seasonsAtClub = (S.clubTally[S.tier] && S.clubTally[S.tier][S.club]) || 0;
  const loyaltyDiscount = Math.min(0.5, seasonsAtClub * 0.03 + (S.everWonClubTitle ? 0.15 : 0));
  const networkDiscount = Math.min(0.3, S.releaseRiskDiscount || 0);

  const risk = ageFactor + shortfallFactor + formFactor - loyaltyDiscount - networkDiscount;
  return Math.max(0, Math.min(0.65, risk));
}

/* 兩段式，跟 evaluatePromotionOffer/acceptPromotionOffer 同一種分工——
   稽核抓出來的斷點：原本這裡骰完風險就直接用骰子在退休/降級/降薪三個
   分支之間互斥選一個並立刻執行，等於引擎先幫玩家排除掉兩個選項，不是
   把「這次真的開放哪些路」攤出來讓玩家自己選，跟晉級/豪門挖角的兩段式
   模式不一致，以後接 UI 又要重寫一次。

   第一段：只判定「這次要不要重新協商」，攤出這次真正開放的選項——
   退休永遠開放；降級只要不是已經在最底層就開放；降薪續約當保底，
   永遠開放。key 名稱刻意跟 resolveContractCrisis() 的 choice 字串
   ('retired'/'dropped'/'paycut')完全一致，不要再取一個「retire」這種
   看起來像但對不上的名字——UI 之後拿 options 的 key 當按鈕、選完直接
   把同一個字串丟回 resolveContractCrisis()，兩邊對不上會靜默走錯分支，
   這種斷點很難從畫面上看出來。同時給一個 headless/demo 用的建議選擇
   (recommend)，之後接 UI 只是拿掉這個建議、換成玩家實際按的按鈕，
   判定邏輯不用重寫。

   這季稍早已經決定不踢了的人(S.retired，涵蓋 BUY_CLUB/PIVOT_TO_CELEBRITY
   等終局選項，見 data/yearlyOptions.js)不會走到這裡——你不會被一支
   已經不再屬於你的球隊釋出，跟 checkDemotion/lateralMoveTarget 的
   S.retired 守衛是同一個道理。 */
export function evaluateContractCrisis(S, chance) {
  if (S.retired) return null;
  const risk = releaseRiskChance(S);
  if (!chance(risk)) return null;

  const key = positionKey(S);
  const cap = RETIRE_CAP[key] + (S.retireCapBonus || 0);
  const nearRetirement = S.age >= cap - 2;
  const atBottom = S.tier === 'LOCAL';
  const seasonsAtClub = (S.clubTally[S.tier] && S.clubTally[S.tier][S.club]) || 0;
  const loyal = S.everWonClubTitle || seasonsAtClub >= 5;

  const options = { retired: true, dropped: !atBottom, paycut: true };

  let recommend;
  if ((nearRetirement || atBottom) && !(loyal && chance(0.5))) {
    recommend = 'retired';
  } else if (options.dropped && chance(loyal ? 0.3 : 0.65)) {
    recommend = 'dropped';
  } else {
    recommend = 'paycut';
  }

  return { options, recommend, loyal };
}

/* 第二段：真的執行玩家(或 headless 用 recommend)選的那個分支——choice
   要保證是 evaluateContractCrisis() 回傳的 options 裡開放的那個。忠誠
   功勳老將(在原球隊待滿5季或捧過盃)在 evaluate 階段的 recommend 就比較
   有利：本來該退休時優先給一次留隊機會，該降級時優先建議降薪續約，
   這是「城市英雄」羈絆的實際效果，不只是一句 flavor text。 */
export function resolveContractCrisis(S, ri, choice) {
  if (choice === 'retired') {
    S.retired = true;
    S.stage = 'RETIRED';
    return { type: 'retired' };
  }

  if (choice === 'dropped') {
    const target = S.tier === 'TOP5' && REGION[S.region].feeder ? 'FEEDER' : 'LOCAL';
    const prevTier = S.tier;
    S.tier = target;
    S.lastClub = S.club;
    const clubName = target === 'LOCAL' ? pickLocalClub(ri, S.region) : pickFeederClub(ri, S.region);
    S.club = clubName;
    S.clubTally[target][clubName] = (S.clubTally[target][clubName] || 0) + 1;
    S.clubJourney.push({ tier: target, club: clubName }); // 生涯轉會軌跡，見 core/state.js 的稽核說明
    S.poorFormStreak = 0;
    S.wonTitleWithCurrentClub = false;
    S.squadChemistry = SQUAD_CHEMISTRY.base; // 換東家重新磨合，見 data/career.js SQUAD_CHEMISTRY
    S.trainingPartner = null; // 舊夥伴/對手收尾，新東家要重新選訓練才會指派新的，見 data/trainingPartner.js
    const { wage, years } = signContract(S, ri, target, 0.75);
    return { type: 'dropped', from: prevTier, to: target, wage, years };
  }

  // paycut：短約(1年)證明自己，留在原球隊、原層級。
  const { wage } = signContract(S, ri, S.tier, 0.7);
  S.contract.yearsLeft = 1;
  return { type: 'paycut', wage, years: 1 };
}
