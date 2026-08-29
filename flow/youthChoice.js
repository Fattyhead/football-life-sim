/* ---------- 青訓期年度選項判定 ---------- */
/* 對照 data/youthOptions.js 的三大方向，這裡是實際套用邏輯，結構比照
   flow/yearlyChoice.js：headless/demo 用 pickYouthChoice() 隨機選，真正的
   UI 要讓玩家自己選類別跟子選項，applyYouthChoice() 本身不管選擇是怎麼
   來的。青訓期只有 3 年、沒有 stage/calendar/cost 篩選，三個類別的全部
   子選項每年都開放，不用另外寫一份 availableOptions()。 */

import { YOUTH_TRAINING_OPTION, YOUTH_OPPORTUNITY_OPTION, YOUTH_SOCIAL_OPTION } from '../data/youthOptions.js';
import { RISK_TIERS, ABILITY_HARD_CAP } from '../data/growth.js';
import { applyAbilityNudge, optionHasRiskTier } from './yearlyChoice.js';
import { pickFocusTarget, addAbilityPoints, resolveRiskTier, checkRiskTierTitle } from './shared.js';
import { prepareTrainingCrossroadsChoice, resolveTrainingCrossroadsChoiceStep, checkTrainingBondMoment } from './trainingRivalry.js';

const TABLE_BY_CATEGORY = {
  TRAINING: YOUTH_TRAINING_OPTION,
  OPPORTUNITY: YOUTH_OPPORTUNITY_OPTION,
  SOCIAL: YOUTH_SOCIAL_OPTION,
};

/* headless/demo 用：隨機選一個大方向 + 隨機選該方向底下的子選項，有風險
   層的話再隨機選一檔穩健/平衡/冒進(比照 yearlyChoice.js pickYearlyChoice)。
   真正接 UI 之後，UI 只要列出三個類別底下的全部子選項讓玩家選，
   這個函式就不用了。 */
export function pickYouthChoice(ri) {
  const categories = [
    ['TRAINING', YOUTH_TRAINING_OPTION],
    ['OPPORTUNITY', YOUTH_OPPORTUNITY_OPTION],
    ['SOCIAL', YOUTH_SOCIAL_OPTION],
  ];
  const [category, table] = categories[ri(0, categories.length - 1)];
  const keys = Object.keys(table);
  const option = keys[ri(0, keys.length - 1)];
  let riskTierKey;
  if (optionHasRiskTier(category, table[option])) {
    const tierKeys = Object.keys(RISK_TIERS);
    riskTierKey = tierKeys[ri(0, tierKeys.length - 1)];
  }
  return { category, option, riskTierKey };
}

/* PHYSICAL_BASE(打底體能)用的能力集合，對照職業版 growthKeys() 的
   'physical' 模式(見 flow/yearlyChoice.js)——GK/外場的體能組合不同，
   青訓期沒有共用那個函式(它是 yearlyChoice.js 的內部細節，沒有匯出)，
   這裡集合只有兩項，直接複寫一份比額外匯出一個函式簡單。 */
function physicalKeys(S) {
  return S.pos === 'GK' ? ['STA', 'REF'] : ['STA', 'PHY'];
}

/* 訓練子選項對應的候選能力集合，比照 yearlyChoice.js growthKeys()。 */
function growthKeys(S, mode) {
  if (mode === 'all') return Object.keys(S.ab);
  if (mode === 'physical') return physicalKeys(S);
  const k = pickFocusTarget(S);
  return k ? [k] : [];
}

/* 把候選能力集合收斂成風險層要打在哪一項——跟 yearlyChoice.js
   pickTargetFrom() 同一套 heuristic(優先 S.focusTarget，否則挑離潛力
   最遠的)，青訓期沒有匯出那個函式，這裡複寫一份，跟上面 physicalKeys
   同一個理由。候選集合全部封頂回傳 null。 */
function pickTargetFrom(S, candidates) {
  // 稽核抓出來的斷點：潛力是軟上限，超過還能練只是變貴(見 flow/shared.js
  // addAbilityPoints)，過濾條件要用真正練不動的 ABILITY_HARD_CAP，不能
  // 用 S.pot[k]。
  const keys = candidates.filter((k) => S.ab[k] < ABILITY_HARD_CAP);
  if (keys.length === 0) return null;
  if (S.focusTarget && keys.includes(S.focusTarget)) return S.focusTarget;
  keys.sort((a, b) => S.pot[b] - S.ab[b] - (S.pot[a] - S.ab[a]));
  return keys[0];
}

/* 均衡訓練(growthMode:'all')專用：跟 yearlyChoice.js pickTargetsFrom()
   同一套邏輯(拆給多項能力，不只灌一項)，青訓期沒有匯出那個函式，這裡
   複寫一份，跟上面 pickTargetFrom 同一個理由。 */
function pickTargetsFrom(S, candidates, count) {
  const keys = candidates.filter((k) => S.ab[k] < ABILITY_HARD_CAP);
  if (keys.length === 0) return [];
  keys.sort((a, b) => S.pot[b] - S.ab[b] - (S.pot[a] - S.ab[a]));
  return keys.slice(0, Math.min(count, keys.length));
}

/* 入口：套用玩家(或 headless 隨機)選的青訓期年度選項。跟職業版
   applyYearlyChoice() 同一種分工原則，三個類別各管各的地盤，不重疊。
   riskTierKey 是 optionHasRiskTier() 判定為 true 時才有意義的第三個選擇
   (穩健/平衡/冒進)，骰子成長(大頭)已經搬去 flow/seasonOpener.js 的獨立
   季初步驟，這裡的 growthMode/abilityNudge 現在只決定風險層(小頭)。 */
export function applyYouthChoice(S, ri, chance, category, optionKey, riskTierKey) {
  const log = { category, option: optionKey };
  const def = TABLE_BY_CATEGORY[category][optionKey];

  if (category === 'TRAINING') {
    // single：鎖定目標(見 shared.js pickFocusTarget)，目標會延續到職業
    // 生涯(同一個 S.focusTarget 欄位)，青訓期選定的主攻方向不會出道就
    // 重置歸零。all(均衡訓練)拆給多項能力，比照 yearlyChoice.js 同一套
    // 處理，不再收斂成單一目標。
    const candidates = growthKeys(S, def.growthMode);
    if (def.growthMode === 'all' && candidates.length && riskTierKey) {
      const targets = pickTargetsFrom(S, candidates, RISK_TIERS[riskTierKey].abilityDelta);
      if (targets.length) {
        const { success, delta } = resolveRiskTier(S, chance, riskTierKey);
        checkRiskTierTitle(S, riskTierKey, log);
        const perTarget = delta / targets.length;
        let gain = 0;
        for (const t of targets) gain += addAbilityPoints(S, t, perTarget, S.pos === 'GK');
        log.riskTier = riskTierKey;
        log.riskSuccess = success;
        log.riskTargets = targets;
        if (gain !== 0) log.growthGain = gain;
      }
    } else {
      const target = candidates.length ? pickTargetFrom(S, candidates) : null;
      if (target && riskTierKey) {
        const { success, delta } = resolveRiskTier(S, chance, riskTierKey);
        checkRiskTierTitle(S, riskTierKey, log);
        const gain = addAbilityPoints(S, target, delta, S.pos === 'GK');
        log.riskTier = riskTierKey;
        log.riskSuccess = success;
        log.riskTarget = target;
        if (gain !== 0) log.growthGain = gain;
        if (def.growthMode !== 'physical' && success) log.focusedKey = target;
      }
    }
    // 訓練夥伴/對手 CROSSROADS：跟職業版 flow/proSeason.js proSeasonTick
    // 同一個道理——認識新夥伴/對手已經改成年度自動觸發(見
    // flow/careerStart.js runYouthToDebut 的常駐階段)，不用選訓練；但
    // 已經有夥伴之後，CROSSROADS(較勁/合作)這個「繼續走下去」的環節
    // 仍然要卡在真的選了訓練類別，見 flow/trainingRivalry.js 開頭的
    // 稽核說明。跟職業版共用同一組 prepare/resolve，不要各寫一份。
    const { pending: crossroadsPending } = prepareTrainingCrossroadsChoice(S, category, chance);
    Object.assign(log, resolveTrainingCrossroadsChoiceStep(S, ri, chance, crossroadsPending, crossroadsPending?.recommend));
    // 羈絆時刻：跟職業版同一個相對呼叫位置(見 flow/proSeason.js)。實務上
    // 青訓三年內夥伴 years 最多到 2，門檻是 6，這裡永遠不會真的觸發，
    // 純粹是保持兩邊呼叫模式一致，之後門檻若調低也不用回頭補這段。
    const bondMoment = checkTrainingBondMoment(S, category, chance);
    if (bondMoment) log.bondMoment = bondMoment;
  } else if (category === 'OPPORTUNITY') {
    // 整個選項的成敗綁在一起(跟職業版 OPPORTUNITY 同一個原則)：有
    // abilityNudge 的選項(SHOWCASE_MATCH/POSITION_VERSATILITY)才有風險層，
    // 成功才拿到 cutRateMult(轉正式淘汰率折扣)+能力值副效果，失敗則
    // cutRateMult 落空、能力值真的倒扣。SCOUT_VISIT 沒有 abilityNudge，
    // 完全不受影響，維持原本 100%決定性的行為。
    let success = true;
    if (def.abilityNudge && riskTierKey) {
      const resolved = resolveRiskTier(S, chance, riskTierKey);
      checkRiskTierTitle(S, riskTierKey, log);
      success = resolved.success;
      log.riskTier = riskTierKey;
      log.riskSuccess = success;
      const gain = applyAbilityNudge(S, resolved.delta);
      if (gain !== 0) log.abilityNudgeGain = gain;
    }
    if (success) S.youthCutRateMult = (S.youthCutRateMult ?? 1) * def.cutRateMult;
  } else if (category === 'SOCIAL') {
    if (def.abilityNudge) {
      const gain = applyAbilityNudge(S, def.abilityNudge);
      if (gain > 0) log.abilityNudgeGain = gain;
    }
    if (def.popularitySeed) {
      S.popularity += def.popularitySeed;
      log.popularityGain = def.popularitySeed;
    }
    if (def.debutInjuryMult) {
      S.debutInjuryMult = (S.debutInjuryMult ?? 1) * def.debutInjuryMult;
      log.debutInjuryMultApplied = true;
    }
  }

  return log;
}
