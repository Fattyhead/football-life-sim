/* ---------- 訓練線專屬稱號判定：超過潛力累積等級里程碑 ---------- */
/* 對照 flow/fameHonors.js 同一種寫法(人氣值三階，這裡是超過潛力累積等級
   三階)，補齊訓練線原本沒有的稱號階梯(見 data/mastery.js TRAINING_HONOR
   開頭的稽核說明)。 */
import { TRAINING_HONOR } from '../data/mastery.js';

/* 入口：proSeasonTick 每季呼叫一次(這季的能力值成長都結算完之後再判定)。
   三個都是「累積到門檻就永久解鎖」，不會因為後續能力值變化(如受傷/衰退)
   收回——S.overPotentialLevelsGained 本身只增不減(見 flow/shared.js
   addAbilityPoints)，稱號自然也不該收回。 */
export function checkTrainingHonors(S) {
  const unlocked = [];
  const gained = S.overPotentialLevelsGained || 0;

  if (gained >= TRAINING_HONOR.BREAKTHROUGH.threshold && !S.honors.includes(TRAINING_HONOR.BREAKTHROUGH.label)) {
    S.honors.push(TRAINING_HONOR.BREAKTHROUGH.label);
    S.popularity += TRAINING_HONOR.BREAKTHROUGH.effect.popularityBonus;
    unlocked.push('BREAKTHROUGH');
  }

  if (gained >= TRAINING_HONOR.SELF_TRANSCENDENCE.threshold && !S.honors.includes(TRAINING_HONOR.SELF_TRANSCENDENCE.label)) {
    S.honors.push(TRAINING_HONOR.SELF_TRANSCENDENCE.label);
    S.overPotentialDiscountMult = (S.overPotentialDiscountMult ?? 1) * TRAINING_HONOR.SELF_TRANSCENDENCE.effect.overPotentialDiscountMult;
    unlocked.push('SELF_TRANSCENDENCE');
  }

  if (gained >= TRAINING_HONOR.LIMIT_BREAKER.threshold && !S.honors.includes(TRAINING_HONOR.LIMIT_BREAKER.label)) {
    S.honors.push(TRAINING_HONOR.LIMIT_BREAKER.label);
    S.outsideIncomeMultBonus = (S.outsideIncomeMultBonus || 0) + TRAINING_HONOR.LIMIT_BREAKER.effect.outsideIncomeMultBonus;
    unlocked.push('LIMIT_BREAKER');
  }

  return unlocked;
}
