/* ---------- 財富巔峰：梅老闆 ---------- */
/* 使用者定案：既有的財富終局路線(BUY_CLUB)是玩家主動選擇的年度選項，
   選了本身就是承諾，沒有另外詢問——這條不一樣，觸發條件(場外收入超過
   球場薪水)是引擎自然算出來的里程碑，不是玩家去點的按鈕，所以要走
   flow/worldCup.js evaluateChampionRetirement/resolveChampionRetirement
   那套「引擎觸發 → 跳出真正的選擇 → 兩段式 evaluate/resolve」架構，
   不是 BUY_CLUB 那種「選了就是決定」的架構——這是使用者親自糾正過的
   理解落差，記錄下來避免之後又混淆。

   跟世界盃封頂退休的一個關鍵差異：奪冠這件事本身很稀有、天然不會連續
   發生，每次奪冠都值得重新問一次「退休嗎」；但「場外收入超過薪水」一旦
   發生，很可能接下來好幾季都持續成立(場外收入通常是複利式成長，不會
   曇花一現)，如果每季都重新問一次會很煩。這裡刻意只在稱號第一次解鎖
   的那一季問，之後不會再問第二次——用「稱號還沒拿過」當唯一的守衛，
   不用另外開一個「已經問過」的旗標，稱號本身的一次性剛好就是問一次的
   保證。 */

import { WEALTH_HONOR } from '../data/wealth.js';

/* 入口：proSeasonTick 每季呼叫一次，在場外收入(S.yearOutsideIncome)/
   薪水(S.wage)都已經是這季最終值之後才能呼叫(呼叫端保證順序)。稱號
   拿過就不會再回傳 pending，之後就算場外收入持續超車也不會再問。 */
export function checkBossMilestone(S, cap) {
  if (S.retired) return { unlocked: false, pending: null };
  if (S.honors.includes(WEALTH_HONOR.BOSS.label)) return { unlocked: false, pending: null };
  if ((S.yearOutsideIncome || 0) <= (S.wage || 0)) return { unlocked: false, pending: null };

  S.honors.push(WEALTH_HONOR.BOSS.label);
  S.popularity += WEALTH_HONOR.BOSS.effect.popularityBonus;

  // recommend 跟世界盃封頂同一套判斷：接近自然引退門檻(3年內)才建議
  // 退休，還年輕就建議繼續踢，稱號照拿，不強制打斷生涯(向上流動不卡關)。
  const nearEnd = S.age >= cap - 3;
  return { unlocked: true, pending: { options: { retired: true, continue: true }, recommend: nearEnd ? 'retired' : 'continue' } };
}

export function resolveBossRetirement(S, choice) {
  if (choice !== 'retired') return null;
  S.retired = true;
  S.stage = 'RETIRED';
  S.retiredAsBoss = true;
  return { type: 'retiredAsBoss' };
}
