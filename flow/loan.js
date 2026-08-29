/* ---------- 租借 ---------- */
/* 對照 career.js LOAN 的設計：純機會，不是強制事件，也沒有失敗懲罰——
   跟 regions.js PATHS 的青訓淘汰是不同性質的機制，淘汰是生涯起點的一次性豪賭，
   租借是中生涯可以反覆考慮的低風險機會。
   headless/demo 環境下用自動接受模擬玩家選擇，真正的 UI 要讓玩家決定
   接不接受邀約——這裡的判斷邏輯本身跟有沒有 UI 無關，之後接 UI 直接換掉
   「自動接受」那一步就好，checkLoanOffer/resolveLoanSeason 不用動。 */

import { REGION } from '../data/regions.js';
import { DP_TH, GK_BAR } from '../data/abilities.js';
import { SQUAD_CHEMISTRY } from '../data/career.js';
import { calcOVR, positionKey, signContract, pickTop5Club, pickFeederClub } from './shared.js';
import { potentialUpsideSignal } from './transfer.js';

const LOAN_OFFER_CHANCE = 0.15;
/* 稽核抓出來的斷點：租借留隊原本是「RAT>=7.5 就一定留」的決定性判斷，
   完全繞過 flow/transfer.js 剛校準過的晉級難度(連續達標+機率折扣)——
   實測抓到的漏洞：調完 transfer.js 的參數，LOCAL 起步摸到 TOP5 的比例
   卡在80%上下降不下去，回頭直接統計才發現大多數「成功」的生涯根本
   沒經過 evaluatePromotionOffer/evaluateLateralMoveOffer，是從這裡的
   租借留隊直接轉正式的——租借的 checkLoanOffer 門檻(只要OVR達目的地
   門檻的75%)又比正規晉級寬鬆，等於是條更好走的後門。門檻拉高到跟
   transfer.js PROMOTION_FORM_THRESHOLD 同一個水準，而且不再是「達標
   就一定留」，改成達標才有機會被留下，真正成不成還要骰
   LOAN_STAY_CHANCE——租借留隊不該是比正規晉級管道更好走的路。 */
// 數字跟著 RAT 公式重算校準(見 flow/proSeason.js generateSeasonStats 的
// 稽核說明)：維持「跟 transfer.js PROMOTION_FORM_THRESHOLD 同一個水準」
// 這個既有慣例，那邊的舊門檻8.5同步改成7.2，這裡跟著改，不要脫鉤。
const LOAN_STAY_RAT_THRESHOLD = 7.2;
const LOAN_STAY_CHANCE = 0.4;
/* 稽核抓出來的第二輪斷點：租借留隊的機率原本是固定值，不吃
   flow/transfer.js 新加的「潛力還有沒有餘裕」訊號(potentialUpsideSignal)
   ——如果只有正規晉級/豪門挖角管道在乎種子品質，租借留隊又會變回一條
   繞過差異化的後門，跟這輪一開始抓到的漏洞是同一類問題。疊加同一個
   訊號，權重比正規晉級小一點(租借本來就是相對友善的管道，不用疊到
   一樣重)。 */
const LOAN_STAY_UPSIDE_WEIGHT = 0.2;

// 稽核修正：接 UI 互動時，租借邀約要能在玩家按下接受之前先顯示「目的地
// 是哪個層級」——原本是這個檔案內部的私有函式，checkLoanOffer() 命中之後
// 直接呼叫 sendOnLoan() 決定目的地，UI 沒有機會在中間插入玩家的選擇。
// 加 export，讓 flow/proSeason.js 的兩段式抉擇可以先讀出目的地再決定要不要
// 呼叫 sendOnLoan()，這個函式本身的判斷邏輯完全不變。
export function loanTargetTier(S) {
  if (S.tier === 'LOCAL') return REGION[S.region].feeder ? 'FEEDER' : 'TOP5';
  if (S.tier === 'FEEDER') return 'TOP5';
  return null; // TOP5 沒有更高一階可租借
}

/* 每季檢查是否有租借邀約：數值要接近目的地層級的門檻(門檻的 75%)才會有球隊
   願意租，否則就算機率骰中也不會真的收到邀約——球隊不會租一個明顯不夠格的人。
   bonusMult 給機會選項的 STUDY_ABROAD 疊乘用(見 yearlyOptions.js)，預設 1。 */
export function checkLoanOffer(S, chance, bonusMult = 1) {
  if (S.onLoan) return false;
  // 這季稍早的年度選項如果已經選了 BUY_CLUB/PIVOT_TO_CELEBRITY 之類的終局
  // 選項(見 data/yearlyOptions.js)，S.retired 會在 proSeasonTick 呼叫這個
  // 函式之前就設成 true——已經決定不踢了的人不該還收到租借邀約，跟
  // flow/transfer.js 那組 S.retired 守衛同一個道理。
  if (S.retired) return false;
  const target = loanTargetTier(S);
  if (!target) return false;
  const ovr = calcOVR(S);
  const key = positionKey(S);
  const th = S.pos === 'GK' ? GK_BAR[target] : DP_TH[key][target];
  if (ovr < th * 0.75) return false;
  return chance(LOAN_OFFER_CHANCE * bonusMult);
}

/* 出借：這季開始在目的地層級踢球，原隊的合約/tier 不變，只是暫時借出去。
   TOP5 目的地在這裡就挑好實際隊名(見 data/clubNames.js)，記在 S.loanClub，
   留下轉正式時(resolveLoanSeason)直接沿用同一個名字，不會租借顯示一個隊、
   買斷卻換成另一個隨機隊——那樣會讓玩家覺得資料兜不起來。 */
export function sendOnLoan(S, ri) {
  const target = loanTargetTier(S);
  S.onLoan = true;
  S.loanTier = target;
  const destClub = target === 'TOP5' ? pickTop5Club(ri) : pickFeederClub(ri, S.region);
  S.loanClub = `${destClub}(租借)`;
  return target;
}

/* 租借賽季結束評估：表現好(RAT達門檻)可以選擇留下轉正式(共用 signContract)，
   表現不好回原隊，沒有懲罰，原本的合約/tier 完全不受影響。 */
export function resolveLoanSeason(S, ri, chance, seasonRat) {
  const target = S.loanTier;
  // !S.retired 守衛：跟 flow/transfer.js 那組守衛同一個道理(這季稍早的
  // 年度選項如果已經選了 BUY_CLUB/PIVOT_TO_CELEBRITY，S.retired 會在
  // proSeasonTick 呼叫這個函式之前就設成 true)——已經決定不踢了的人，
  // 不該還因為租借表現好被「轉正式」、簽下一份新合約，租借關係照樣
  // 結束(清空 onLoan/loanTier)，但強制走「沒留下」那個分支，不觸發
  // tier/合約異動。達標(RAT夠高)只代表「有機會」，不是保證留下，見上面
  // LOAN_STAY_CHANCE 的稽核說明。
  const qualifies = !S.retired && seasonRat >= LOAN_STAY_RAT_THRESHOLD;
  const stayChance = Math.min(1, LOAN_STAY_CHANCE + LOAN_STAY_UPSIDE_WEIGHT * potentialUpsideSignal(S));
  const stayed = qualifies && chance(stayChance);
  S.onLoan = false;
  S.loanTier = null;

  if (stayed) {
    S.tier = target;
    S.lastClub = S.club;
    S.club = S.loanClub.replace('(租借)', ''); // 沿用租借期間的同一支球隊，不重新亂數
    S.clubTally[target][S.club] = (S.clubTally[target][S.club] || 0) + 1;
    S.clubJourney.push({ tier: target, club: S.club }); // 生涯轉會軌跡，見 core/state.js 的稽核說明
    S.loanClub = null;
    S.wonTitleWithCurrentClub = false;
    S.squadChemistry = SQUAD_CHEMISTRY.base; // 租借留隊算加入新東家，重新磨合
    S.trainingPartner = null; // 舊夥伴/對手收尾，新東家要重新選訓練才會指派新的，見 data/trainingPartner.js
    const { wage, years } = signContract(S, ri, target);
    return { stayed: true, tier: target, wage, years };
  }

  S.loanClub = null;
  return { stayed: false };
}
