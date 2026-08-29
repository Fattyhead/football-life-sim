/* ---------- 經紀人線專屬稱號判定：大膽操作/穩紮穩打累積次數 ---------- */
/* 完全比照 flow/rivalryHonors.js checkRivalryHonors 的寫法(兩條平行賽道，
   各自 TIER1/TIER2 門檻)，見 data/agent.js AGENT_CROSSROADS_TITLE 開頭的
   稽核說明。 */
import { AGENT_CROSSROADS_TITLE } from '../data/agent.js';

/* 入口：flow/proSeason.js 每季呼叫一次(這季的 CROSSROADS 抉擇都結算完
   之後再判定)。不分成功失敗——CROSSROADS 本身沒有成敗，選了哪個就算數。 */
export function checkAgentHonors(S) {
  const unlocked = [];
  const bold = S.agentPickCount?.bold || 0;
  const steady = S.agentPickCount?.steady || 0;

  if (bold >= AGENT_CROSSROADS_TITLE.BOLD.TIER1.threshold && !S.honors.includes(AGENT_CROSSROADS_TITLE.BOLD.TIER1.label)) {
    S.honors.push(AGENT_CROSSROADS_TITLE.BOLD.TIER1.label);
    S.popularity += AGENT_CROSSROADS_TITLE.BOLD.TIER1.effect.popularityBonus;
    unlocked.push('BOLD_TIER1');
  }
  if (bold >= AGENT_CROSSROADS_TITLE.BOLD.TIER2.threshold && !S.honors.includes(AGENT_CROSSROADS_TITLE.BOLD.TIER2.label)) {
    S.honors.push(AGENT_CROSSROADS_TITLE.BOLD.TIER2.label);
    S.transferBuzzFlatBonus = (S.transferBuzzFlatBonus || 0) + AGENT_CROSSROADS_TITLE.BOLD.TIER2.effect.transferBuzzFlatBonus;
    unlocked.push('BOLD_TIER2');
  }
  if (steady >= AGENT_CROSSROADS_TITLE.STEADY.TIER1.threshold && !S.honors.includes(AGENT_CROSSROADS_TITLE.STEADY.TIER1.label)) {
    S.honors.push(AGENT_CROSSROADS_TITLE.STEADY.TIER1.label);
    S.popularity += AGENT_CROSSROADS_TITLE.STEADY.TIER1.effect.popularityBonus;
    unlocked.push('STEADY_TIER1');
  }
  if (steady >= AGENT_CROSSROADS_TITLE.STEADY.TIER2.threshold && !S.honors.includes(AGENT_CROSSROADS_TITLE.STEADY.TIER2.label)) {
    S.honors.push(AGENT_CROSSROADS_TITLE.STEADY.TIER2.label);
    S.releaseRiskDiscount = (S.releaseRiskDiscount || 0) + AGENT_CROSSROADS_TITLE.STEADY.TIER2.effect.releaseRiskDiscountFlatBonus;
    unlocked.push('STEADY_TIER2');
  }

  return unlocked;
}
