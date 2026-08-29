/* ---------- 訓練夥伴/對手專屬稱號判定：較勁/合作累積次數 ---------- */
/* 對照 flow/shared.js checkRiskTierTitle 同一種寫法(兩條平行賽道，各自
   TIER1/TIER2 門檻)，補齊 CROSSROADS 抉擇原本沒有的稱號階梯(見
   data/trainingPartner.js RIVALRY_TIER_TITLE 開頭的稽核說明)。跟
   checkRiskTierTitle 不共用同一個函式，因為那個是綁死讀 S.riskTierPickCount
   的通用版本，這裡的資源效果(competeGrowthFlatBonus/cooperateChemistryFlatBonus)
   要疊加到不同的 S 欄位上，寫一個小型專用版本比硬套通用函式更直接。 */
import { RIVALRY_TIER_TITLE } from '../data/trainingPartner.js';

/* 入口：flow/proSeason.js 每季呼叫一次(這季的 CROSSROADS 抉擇都結算完之後
   再判定)。不分成功失敗——CROSSROADS 本身沒有成敗，選了哪個就算數。 */
export function checkRivalryHonors(S) {
  const unlocked = [];
  const compete = S.rivalryPickCount?.compete || 0;
  const cooperate = S.rivalryPickCount?.cooperate || 0;

  if (compete >= RIVALRY_TIER_TITLE.COMPETE.TIER1.threshold && !S.honors.includes(RIVALRY_TIER_TITLE.COMPETE.TIER1.label)) {
    S.honors.push(RIVALRY_TIER_TITLE.COMPETE.TIER1.label);
    S.popularity += RIVALRY_TIER_TITLE.COMPETE.TIER1.effect.popularityBonus;
    unlocked.push('COMPETE_TIER1');
  }
  if (compete >= RIVALRY_TIER_TITLE.COMPETE.TIER2.threshold && !S.honors.includes(RIVALRY_TIER_TITLE.COMPETE.TIER2.label)) {
    S.honors.push(RIVALRY_TIER_TITLE.COMPETE.TIER2.label);
    S.competeGrowthFlatBonus = (S.competeGrowthFlatBonus || 0) + RIVALRY_TIER_TITLE.COMPETE.TIER2.effect.competeGrowthFlatBonus;
    unlocked.push('COMPETE_TIER2');
  }
  if (cooperate >= RIVALRY_TIER_TITLE.COOPERATE.TIER1.threshold && !S.honors.includes(RIVALRY_TIER_TITLE.COOPERATE.TIER1.label)) {
    S.honors.push(RIVALRY_TIER_TITLE.COOPERATE.TIER1.label);
    S.popularity += RIVALRY_TIER_TITLE.COOPERATE.TIER1.effect.popularityBonus;
    unlocked.push('COOPERATE_TIER1');
  }
  if (cooperate >= RIVALRY_TIER_TITLE.COOPERATE.TIER2.threshold && !S.honors.includes(RIVALRY_TIER_TITLE.COOPERATE.TIER2.label)) {
    S.honors.push(RIVALRY_TIER_TITLE.COOPERATE.TIER2.label);
    S.cooperateChemistryFlatBonus = (S.cooperateChemistryFlatBonus || 0) + RIVALRY_TIER_TITLE.COOPERATE.TIER2.effect.cooperateChemistryFlatBonus;
    unlocked.push('COOPERATE_TIER2');
  }

  return unlocked;
}
