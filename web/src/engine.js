/* ---------- 引擎接線層 ---------- */
/* UI 元件不直接散落 `../../flow/xxx.js` 這種深相對路徑各自 import——
   全部集中在這裡重新匯出，之後引擎內部檔案搬動，只要改這一份。
   這一層本身不含任何遊戲邏輯，純粹是接線。 */

export { setSeed, ri, chance } from '../../core/rng.js';
export { newState, playerName, stageLabel } from '../../core/state.js';
export { clubPrestigeOf } from '../../flow/shared.js';
export { buildLifetimeGallery } from '../../flow/achievements.js';

export { REGION, PATHS, LV } from '../../data/regions.js';
export { POSN, DPN, ABL, POS_AB } from '../../data/abilities.js';
export { YOUTH_TRAINING_OPTION, YOUTH_OPPORTUNITY_OPTION, YOUTH_SOCIAL_OPTION } from '../../data/youthOptions.js';
export { TRAINING_OPTION, OPPORTUNITY_OPTION, SOCIAL_OPTION } from '../../data/yearlyOptions.js';
export { RISK_TIERS, ABILITY_HARD_CAP } from '../../data/growth.js';
export { WC_ROUND_LABEL } from '../../data/national.js';
export { SQUAD_CHEMISTRY } from '../../data/career.js';
export { LOVE_STATUS } from '../../data/love.js';

export { gradeOpening, describeOpening } from '../../flow/gradeOpening.js';
export { resolveYouthYear, resolveDebut, calcOVR } from '../../flow/careerStart.js';
export { narrateYouthSeason, narrateSeason, narrateDebut } from '../../flow/narrate.js';
export { frameChoice } from '../../flow/frameChoice.js';
export {
  prepareSeasonChoice,
  resolveSeasonChoice,
  resolveSeasonChoiceGen,
  prepareRivalChoice,
  resolveRivalChoiceStep,
} from '../../flow/proSeason.js';
export { prepareLoveChoice, resolveLoveChoiceStep } from '../../flow/romance.js';
export {
  prepareTrainingChoice,
  resolveTrainingChoiceStep,
  prepareTrainingCrossroadsChoice,
  resolveTrainingCrossroadsChoiceStep,
  checkTrainingBondMoment,
} from '../../flow/trainingRivalry.js';
export {
  prepareAgentChoice,
  resolveAgentChoiceStep,
  prepareAgentCrossroadsChoice,
  resolveAgentCrossroadsChoiceStep,
  checkAgentBondMoment,
} from '../../flow/agentLine.js';
export { rollSeasonOpener, applySeasonAllocation, trackSeasonSixes } from '../../flow/seasonOpener.js';
export { optionHasRiskTier, availableOptions } from '../../flow/yearlyChoice.js';
export { effectiveRiskSuccessPct, previewAbilityLevel } from '../../flow/shared.js';
export { overPotentialMultiplier } from '../../data/growth.js';
export {
  computeRiskStreakFlavor,
  computeCategoryStreakFlavor,
  computeInvestStreakFlavor,
  computeProposeRiskFlavor,
  computeAffairRiskFlavor,
  computeRivalryRiskFlavor,
} from '../../flow/streakFlavor.js';
export { evaluateLegacy } from '../../flow/legacy.js';
