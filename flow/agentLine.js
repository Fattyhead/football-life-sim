/* ---------- 經紀人線引擎 ---------- */
/* 架構完全比照 flow/trainingRivalry.js(見 data/agent.js 開頭的稽核說明)，
   evaluate/resolve 兩階段模式，唯一的結構性差異是起點門檻卡在「真的
   轉正式之後」——這裡的所有函式都只會被 flow/proSeason.js 呼叫，不會
   被 flow/youthChoice.js/flow/careerStart.js 呼叫，青訓期完全沒有這條
   線，不是漏做。 */

import { AGENT_TYPE, AGENT_NAME_POOL, AGENT_BOND_YEARS_THRESHOLD, AGENT_BOND_SUCCESS_CHANCE, AGENT_BOND_HONOR } from '../data/agent.js';

// 跟訓練夥伴線 ENCOUNTER_TRIGGER_CHANCE/戀愛線 PAPARAZZI_EVENT_CHANCE
// 同一個量級——年度自動觸發，不用玩家投入，三條線的觸發頻率刻意對齊。
const ENCOUNTER_TRIGGER_CHANCE = 0.3;
const LEAVE_CHANCE = 0.08; // 每季一定機率的自然離隊(經紀人轉去代理更大牌的球星)
const CROSSROADS_BASE_CHANCE = 0.22;
const BOLD_MOVE_BUZZ_GAIN = 0.2; // 大膽操作疊加的轉會買氣
const BOLD_MOVE_RISK_COST = 0.03; // 大膽操作扣的合約風險折扣
const STEADY_MOVE_WAGE_GAIN = 0.03; // 穩紮穩打疊加的薪資溢價
const STEADY_MOVE_RISK_GAIN = 0.03; // 穩紮穩打疊加的合約風險折扣
const RELEASE_RISK_DISCOUNT_FLOOR = -0.3; // 跟 flow/transfer.js releaseRiskChance() 的 0.3 上限對稱，避免無限往負值累積

function pickAgentType(ri) {
  return ri(0, 1) === 0 ? 'AMBITIOUS' : 'STEADY';
}

/* 每季自動判定，不看這季選了什麼類別。已經有經紀人時，處理「這段關係
   還在不在」的常駐骰；還沒有經紀人時完全不用做事——遇到新經紀人的機會
   是一個真正的抉擇(見 evaluateAgentEncounter)，不屬於這個純自動 ambient
   函式的範圍(跟訓練夥伴線 runTrainingRivalryAmbient 同一個道理)。 */
export function runAgentAmbient(S, ri, chance) {
  const log = {};
  if (!S.agent) return { log };

  S.agent.years += 1;
  if (chance(LEAVE_CHANCE)) {
    log.agentLeft = { ...S.agent };
    S.agent = null;
  }
  return { log };
}

/* 年度自動觸發：還沒有經紀人時，這季有機率遇到一個人主動聯繫你，想成為
   代理人——類型在觸發當下就骰定，玩家看到的候選人跟真的接受後指派的是
   同一個。回傳 null 代表這季沒遇到。 */
export function evaluateAgentEncounter(S, ri, chance) {
  if (S.agent) return null;
  if (!chance(ENCOUNTER_TRIGGER_CHANCE)) return null;
  const type = pickAgentType(ri);
  const def = AGENT_TYPE[type];
  const name = AGENT_NAME_POOL[ri(0, AGENT_NAME_POOL.length - 1)];
  const title = def.flavorTitles[ri(0, def.flavorTitles.length - 1)];
  return { type: 'ENCOUNTER', candidate: { type, name, title }, options: { accept: true, ignore: true }, recommend: 'accept' };
}

export function resolveAgentEncounter(S, pending, choice) {
  const log = {};
  if (choice === 'accept') {
    // bondFired：世紀交易(見 evaluateAgentBondMoment)一輩子只評估一次，
    // 掛在經紀人物件本身，換新經紀人時自然歸零。
    S.agent = { ...pending.candidate, years: 0, bondFired: false };
    log.agentAssigned = S.agent;
  } else {
    log.agentEncounterIgnored = { name: pending.candidate.name };
  }
  return log;
}

/* 緊接在 runAgentAmbient() 之後呼叫。years<1 代表這季才剛指派，還沒到
   能骰 CROSSROADS 的時候。recommend 給 headless 掃描/UI 預設用，比照
   訓練夥伴線同一種偏保守的預設(穩紮穩打)。 */
export function evaluateAgentCrossroadsMoment(S, chance) {
  if (!S.agent || S.agent.years < 1) return null;
  const def = AGENT_TYPE[S.agent.type];
  if (!chance(CROSSROADS_BASE_CHANCE * def.frictionMult)) return null;
  return { type: 'CROSSROADS', options: { bold: true, steady: true }, recommend: 'steady' };
}

/* 套用玩家(或 headless 用 recommend)的選擇。大膽操作：疊加轉會買氣，
   代價是合約風險折扣扣一點(跟俱樂部的關係更緊繃，但曝光度衝高了)；
   穩紮穩打：疊加薪資溢價+合約風險折扣，沒有額外曝光度(跟俱樂部關係
   更穩固)。AMBITIOUS/STEADY 類型各自在自己擅長的那個選項上疊加一點
   額外量，兩個選項都不是絕對正確答案，是兩種不同的機制風格——完全對照
   flow/trainingRivalry.js resolveTrainingRivalryMoment 的設計。 */
export function resolveAgentCrossroadsMoment(S, ri, chance, choice) {
  const log = {};
  if (!S.agent) return { log };
  const def = AGENT_TYPE[S.agent.type];

  // 累積次數：不分大膽/穩紮效果好壞，選了哪個就算數，給
  // AGENT_CROSSROADS_TITLE(見 data/agent.js)的門檻判定用。
  S.agentPickCount = S.agentPickCount || { bold: 0, steady: 0 };
  S.agentPickCount[choice] = (S.agentPickCount[choice] || 0) + 1;

  if (choice === 'bold') {
    const buzzGain = BOLD_MOVE_BUZZ_GAIN + (def.boldBuzzBonus || 0);
    S.transferBuzz = (S.transferBuzz || 0) + buzzGain;
    S.releaseRiskDiscount = Math.max(RELEASE_RISK_DISCOUNT_FLOOR, (S.releaseRiskDiscount || 0) - BOLD_MOVE_RISK_COST);
    log.agentBold = { agent: { ...S.agent }, buzzGain };
  } else {
    const wageGain = STEADY_MOVE_WAGE_GAIN;
    const riskGain = STEADY_MOVE_RISK_GAIN + (def.steadyDiscountBonus || 0);
    S.wagePremiumBonus = (S.wagePremiumBonus || 0) + wageGain;
    S.releaseRiskDiscount = (S.releaseRiskDiscount || 0) + riskGain;
    log.agentSteady = { agent: { ...S.agent }, wageGain, riskGain };
  }
  return { log };
}

/* 組合函式：季初常駐階段(類別選項之前)呼叫一次即可——只處理「起點」，
   不處理 CROSSROADS(那個要等類別確認選了機會才評估)。呼叫端只有
   flow/proSeason.js(不像訓練夥伴線還要給 flow/careerStart.js 共用，
   這條線 PRO-only)。 */
export function prepareAgentChoice(S, ri, chance) {
  const ambient = runAgentAmbient(S, ri, chance);
  const pending = S.agent ? null : evaluateAgentEncounter(S, ri, chance);
  return { ambientLog: ambient.log, pending };
}

export function resolveAgentChoiceStep(S, ri, chance, ambientLog, pending, choice) {
  if (!pending) return ambientLog;
  const resolvedLog = resolveAgentEncounter(S, pending, choice ?? pending.recommend);
  return { ...ambientLog, ...resolvedLog };
}

/* CROSSROADS 版的 prepare/resolve——呼叫時機在「玩家確定選了機會類別+
   子選項+風險層之後、這季正式套用選項效果之前」，跟訓練夥伴線
   prepareTrainingCrossroadsChoice 同一個相對位置。category 由呼叫端
   傳入。 */
export function prepareAgentCrossroadsChoice(S, category, chance) {
  if (category !== 'OPPORTUNITY') return { pending: null };
  return { pending: evaluateAgentCrossroadsMoment(S, chance) };
}

export function resolveAgentCrossroadsChoiceStep(S, ri, chance, pending, choice) {
  if (!pending) return {};
  return resolveAgentCrossroadsMoment(S, ri, chance, choice ?? pending.recommend).log;
}

/* 世紀交易：經紀人合作第一次滿 AGENT_BOND_YEARS_THRESHOLD 年、且這季
   真的選了機會類別時，自動評估一次(不是玩家選擇，命運安排的高潮時刻，
   跟 CROSSROADS 的主動選擇不同)。用 >= 不用 ===：S.agent.years 每季
   ambient 都會遞增(不看類別)，如果滿門檻那季剛好沒選機會，years 會
   繼續往上跳，用 === 會讓這個機會永遠錯過；用 >= 配合 bondFired 旗標，
   之後任何一季選了機會都還能補上這次評估，只會發生一次。
   效果留在機會線自己的地盤(薪資溢價/合約風險折扣)，不用像訓練線那樣
   借用別的系統的機率池——機會線本來就有自己的資源可以花。 */
export function checkAgentBondMoment(S, category, chance) {
  if (category !== 'OPPORTUNITY') return null;
  if (!S.agent || S.agent.bondFired) return null;
  if (S.agent.years < AGENT_BOND_YEARS_THRESHOLD) return null;

  S.agent.bondFired = true;
  const def = AGENT_BOND_HONOR[S.agent.type];
  const success = chance(AGENT_BOND_SUCCESS_CHANCE);
  if (success) {
    if (!S.honors.includes(def.label)) S.honors.push(def.label);
    S.wagePremiumBonus = (S.wagePremiumBonus || 0) + def.effect.wagePremium;
    S.releaseRiskDiscount = (S.releaseRiskDiscount || 0) + def.effect.releaseRiskDiscount;
  } else {
    S.wagePremiumBonus = (S.wagePremiumBonus || 0) - def.effect.wagePremium / 2;
    S.releaseRiskDiscount = Math.max(RELEASE_RISK_DISCOUNT_FLOOR, (S.releaseRiskDiscount || 0) - def.effect.releaseRiskDiscount / 2);
  }
  return { type: S.agent.type, success, agent: { name: S.agent.name, title: S.agent.title } };
}
