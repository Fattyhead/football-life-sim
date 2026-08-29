/* ---------- 年度選項判定 ---------- */
/* 對照 data/yearlyOptions.js 的三大方向，這裡是實際套用邏輯。三個方向主/副
   效果分開處理，刻意不讓某個方向偷跑到別的方向的地盤(訓練管能力、機會管
   生涯籌碼、社交管戀愛人氣)。headless/demo 用 pickYearlyChoice() 隨機選，
   真正的 UI 要讓玩家自己選類別跟子選項，applyYearlyChoice() 本身不管
   選擇是怎麼來的。 */

import { TRAINING_OPTION, OPPORTUNITY_OPTION, SOCIAL_OPTION } from '../data/yearlyOptions.js';
import { RISK_TIERS, ABILITY_HARD_CAP } from '../data/growth.js';
import { INVESTMENT_TIER, WEALTH_HONOR } from '../data/wealth.js';
import { TRAINING_MASTERY, OPPORTUNITY_MASTERY, SOCIAL_MASTERY } from '../data/mastery.js';
import { pickFocusTarget, addAbilityPoints, resolveRiskTier, checkRiskTierTitle, applyMasteryEffect, clubPrestigeOf } from './shared.js';
import { SQUAD_CHEMISTRY } from '../data/career.js';
import { careerStage, wcCalendarContext } from './context.js';
import { startDatingFromSocial } from './romance.js';

/* 依生涯階段(EARLY/PRIME/LATE)、世界盃日曆(PRE_WC_YEAR/WC_YEAR/null)、
   存款(cost)三個軸篩出這季真正開放的子選項——標 stage:['ANY'] 的一定過，
   calendar/cost 沒標的一定過，標了才要對得上/夠付才會出現。這是唯一決定
   「同一個類別今年給哪幾個選項」的地方，pickYearlyChoice 用它決定候選池，
   之後真正接 UI 也是呼叫這個函式決定要顯示哪幾個選項，不用另外寫一份篩選
   邏輯。cost 是金錢在這個遊戲裡唯一的用途：存款不夠，砸錢版選項就不會
   出現在候選池裡，不是「選了才發現錢不夠」，一開始就篩掉。 */
export function availableOptions(S, table) {
  // 稽核抓出來的斷點：flow/context.js 的 careerStage()/wcCalendarContext()
  // 內部都用 S.age+1/S.year+1 推算「這季實際會過的年齡/年份」——這是為了
  // 配合 frameChoice.js 的呼叫慣例(story.js 在 proSeasonTick 把年齡/年份
  // +=1「之前」就呼叫 frameChoice，所以需要 +1 往前看一步)。但這裡
  // (availableOptions)是從 proSeasonTick 內部、age/year 已經 +=1「之後」
  // 才被呼叫的——直接傳 S 進去，等於在已經正確的年齡/年份上又多加了一次
  // +1，導致整套階段/日曆判定永遠領先真實進度一季(LATE 限定的終局選項
  // 提早一季開放、世界盃日曆限定選項跟真正的世界盃判定錯開一季)。
  // 修法：傳一份 age/year 各減 1 的淺拷貝進去，抵銷掉那個為了配合
  // frameChoice.js 呼叫時機而存在、但在這裡不成立的額外 +1，不動
  // context.js 本身(frameChoice.js 的呼叫方式本來就是對的，不能跟著改)。
  const stage = careerStage({ ...S, age: S.age - 1, year: S.year - 1 });
  const calendar = wcCalendarContext({ ...S, year: S.year - 1 });
  return Object.entries(table)
    .filter(([key, def]) => {
      // 已經買下球隊，不會再出現在選單裡——單向門，跟前面幾個「用過即歸零」
      // 的旗標不同，這個是永久狀態，特例排除比另外加一個篩選欄位更直接。
      if (key === 'BUY_CLUB' && S.ownsClub) return false;
      // 已經入股就不會再出現「入股」選項(不管走哪條路徑入股的)，同一種
      // 單向門邏輯——見 data/yearlyOptions.js BUY_CLUB_SHARES_FAME/AGENT
      // 的稽核說明。
      if ((key === 'BUY_CLUB_SHARES_FAME' || key === 'BUY_CLUB_SHARES_AGENT') && S.clubShares) return false;
      const stageOk = def.stage.includes('ANY') || def.stage.includes(stage);
      const calendarOk = !def.calendar || def.calendar.includes(calendar);
      // tier：只給 TOP5 生涯後期的資產選項(豪宅/太空旅行/買下球隊)用，
      // 沒標的一定過，跟 calendar/cost 同一種「undefined=不限制」語意。
      const tierOk = !def.tier || def.tier.includes(S.tier);
      const costOk = !def.cost || S.savings >= def.cost;
      // requiresHonor：目前只有 PIVOT_TO_CELEBRITY 用(見 data/yearlyOptions.js)，
      // 跟 stage/calendar/tier/cost 同一種「undefined=不限制」語意，篩「有沒有
      // 解鎖過某個稱號」，不是存款/階段這種數值門檻。
      const honorOk = !def.requiresHonor || S.honors.includes(def.requiresHonor);
      // requiresCaps：NATIONAL_TEAM_STATUS 用——「已經是有資歷的國腳」才
      // 開放，跟 requiresHonor 同一種「undefined=不限制」語意，只是門檻
      // 換成國家隊出賽數而不是稱號。
      const capsOk = !def.requiresCaps || S.national.caps >= def.requiresCaps;
      // requiresLoveStatus：DEEPEN_RELATIONSHIP/DATE_NIGHT(見 data/yearlyOptions.js)
      // 用——社交選項依戀愛狀態演化，跟 requiresHonor/requiresCaps 同一種
      // 「undefined=不限制」語意，門檻換成 S.love.st 是不是在允許的狀態
      // 清單裡。青訓期沒有 S.love(這個表青訓期不會被傳進來)，這裡不用
      // 額外判斷。
      const loveStatusOk = !def.requiresLoveStatus || def.requiresLoveStatus.includes(S.love.st);
      // requiresClubPrestige：入股球隊/買下球隊都要求真的在豪門(ELITE)，
      // 不是隨便一支TOP5球隊，見 data/yearlyOptions.js BUY_CLUB/
      // BUY_CLUB_SHARES_FAME/AGENT 的稽核說明——「門檻收窄，不是機率
      // 收窄」是使用者明確定案的方向，這裡是硬條件，不是骰運氣。
      const clubPrestigeOk = !def.requiresClubPrestige || clubPrestigeOf(S.club) === def.requiresClubPrestige;
      // requiresPopularity/requiresWage：入股球隊「靠自己紅到頂」那條
      // 路徑的數值門檻，跟 requiresCaps 同一種「undefined=不限制」語意。
      const popularityOk = !def.requiresPopularity || (S.popularity || 0) >= def.requiresPopularity;
      const wageOk = !def.requiresWage || (S.wage || 0) >= def.requiresWage;
      // requiresAgentBond：入股球隊「靠經紀人牽線」那條路徑——要求經紀人
      // 的世紀交易已經評估過(不管成功失敗，代表這段關係真的夠深，經紀人
      // 才有本錢幫你牽這條線)，見 flow/agentLine.js checkAgentBondMoment
      // 的 bondFired 旗標。跟 requiresPopularity/requiresWage 是「兩條
      // 路徑擇一」的關係(見 data/yearlyOptions.js BUY_CLUB_SHARES_FAME/
      // AGENT 拆成兩個選項項目的稽核說明)，不是同一個選項裡的 AND 條件。
      const agentBondOk = !def.requiresAgentBond || !!S.agent?.bondFired;
      return stageOk && calendarOk && tierOk && costOk && honorOk && capsOk && loveStatusOk && clubPrestigeOk && popularityOk && wageOk && agentBondOk;
    })
    .map(([key]) => key);
}

/* 訓練選項各 growthMode 對應的候選能力集合，GK 用自己的能力集合對應。
   骰子成長系統(大頭)搬去 flow/seasonOpener.js 之後，這裡不再是「均分骰子
   點數的能力清單」，而是「風險層(小頭)要收斂成單一目標時的候選池」——
   見下面 pickTargetFrom()。 */
function growthKeys(S, mode) {
  const isGK = S.pos === 'GK';
  switch (mode) {
    case 'physical':
      return isGK ? ['STA', 'REF'] : ['STA', 'PHY'];
    case 'technical':
      return isGK ? ['KIC', 'HAN'] : ['PAS', 'DRI', 'SHO'];
    case 'single': {
      // 鎖定目標(見 shared.js pickFocusTarget)，不是每次重算「離潛力最遠」——
      // 那個heuristic會讓連續選很多次也在練不同能力，力量被打散。
      const target = pickFocusTarget(S);
      return target ? [target] : [];
    }
    case 'all':
    default:
      return Object.keys(S.ab);
  }
}

/* 把 growthKeys() 給的候選集合收斂成風險層(±1/2/3)要打在哪一項——優先
   S.focusTarget(玩家正在主攻的方向，前提是它本身在候選集合裡)，否則挑
   集合裡離潛力天花板最遠的一項，跟 applyAbilityNudge() 的既有 heuristic
   同一套邏輯，不要另外發明一份。候選集合已經全部封頂(或本來就是空集合，
   例如 WC_TAPER 沒有 growthMode)回傳 null，呼叫端據此判斷這個選項這次
   沒有風險層可言。 */
function pickTargetFrom(S, candidates) {
  // 稽核抓出來的斷點：潛力是軟上限(超過還能練，只是變貴，見
  // flow/shared.js addAbilityPoints)，這裡的候選過濾條件要用真正練不動
  // 的門檻 ABILITY_HARD_CAP，不能用 S.pot[k]，不然超過潛力的能力會被
  // 誤判成「已經封頂」，永遠選不到，等於這個能力提前停止成長。
  const keys = candidates.filter((k) => S.ab[k] < ABILITY_HARD_CAP);
  if (keys.length === 0) return null;
  if (S.focusTarget && keys.includes(S.focusTarget)) return S.focusTarget;
  keys.sort((a, b) => S.pot[b] - S.ab[b] - (S.pot[a] - S.ab[a]));
  return keys[0];
}

/* 均衡訓練(growthMode:'all')專用：風險層的點數不要全部灌進單一項，要
   拆給多項能力，呼應「均衡」字面意義——這輪稽核抓出來的斷點：拆分成
   大頭/小頭之後，均衡訓練的風險層一度也收斂成單一目標，desc 卻還講
   「全能力值平均成長」，機制文案對不上，改機制配合原本文案(使用者
   定案)，不是改文案將就機制。count 抓 RISK_TIERS 該檔的 abilityDelta
   (穩健1/平衡2/冒進3)——每一級本來就是1點，要分成幾份跟這個數字天生
   對得起來，不用另外設計比例。挑候選集合裡「離潛力最遠」的前 count 項，
   不隨機挑，讓每次分配都優先補最需要的地方；不特別優先 S.focusTarget，
   那是 FOCUSED 的地盤，均衡訓練不該再去黏同一個目標。候選不夠 count
   項就用剩下能用的全部(可能只剩1-2項)，不強求湊滿。 */
function pickTargetsFrom(S, candidates, count) {
  const keys = candidates.filter((k) => S.ab[k] < ABILITY_HARD_CAP);
  if (keys.length === 0) return [];
  keys.sort((a, b) => S.pot[b] - S.ab[b] - (S.pot[a] - S.ab[a]));
  return keys.slice(0, Math.min(count, keys.length));
}

/* 機會選項的副效果只挑一項能力給一點點成長，不是每項都加——不然加總起來
   (外場7項×每項+1)會逼近訓練選項的主要成長量，副效果就變成另一個訓練
   選項了，跟「機會選項不動能力值」的設計初衷矛盾。優先加在 pickFocusTarget()
   鎖定的同一個目標上(玩家正在主攻的方向)，這樣機會選項的小加成才會真的
   幫上忙，不是加在一個玩家根本沒在練的能力上；沒有鎖定目標(還沒選過
   FOCUSED，或者目標已經練滿)才退回「離潛力最遠」這個舊 heuristic。 */
export function applyAbilityNudge(S, amount) {
  const keys = Object.keys(S.ab).filter((k) => S.ab[k] < ABILITY_HARD_CAP);
  if (keys.length === 0) return 0;
  let k;
  if (S.focusTarget && S.ab[S.focusTarget] < ABILITY_HARD_CAP) {
    k = S.focusTarget;
  } else {
    keys.sort((a, b) => S.pot[b] - S.ab[b] - (S.pot[a] - S.ab[a]));
    k = keys[0];
  }
  // 改用跟訓練骰子同一套小數進度累積(見 flow/shared.js addAbilityPoints)，
  // 不再直接整數加值——機會/社交的小幅加成本來就該跟訓練骰子共用同一套
  // 成長邏輯，不然兩種來源的成長行為會不一致(訓練骰子湊不滿一級會留著，
  // 這裡卻直接给整數，等於平白繞過成本表)。
  return addAbilityPoints(S, k, amount, S.pos === 'GK');
}

/* 投資：真的有下檔風險的判定，不是包裝過的穩賺選項——動用「目前存款」
   的一部分(portion)，骰一個結果乘數(outcomeRange)，虧錢是真的會發生的
   結果，不是敘事上的假裝。回傳 {staked, mult, result} 給呼叫端記log/判斷
   賺賠方向。 */
function applyInvestment(S, ri, tierKey) {
  const tier = INVESTMENT_TIER[tierKey];
  const staked = Math.round(S.savings * tier.portion * 100) / 100;
  if (staked <= 0) return { staked: 0, mult: 1, result: 0 };
  const [lo, hi] = tier.outcomeRange;
  const mult = ri(Math.round(lo * 100), Math.round(hi * 100)) / 100;
  const result = Math.round(staked * mult * 100) / 100;
  S.savings = Math.round((S.savings - staked + result) * 100) / 100;
  // 連賺/連賠追蹤，只算積極操盤(AGGRESSIVE)——保守理財(CONSERVATIVE)本來
  // 就波動不大，不是使用者說的「賭性堅強」路線，不該混進同一個計數，見
  // flow/streakFlavor.js computeInvestStreakFlavor()。正數=連賺、負數=連賠，
  // 方向翻轉時歸1重新算，不是清零後才開始算，跟其他隱晦線索計數同一套寫法。
  if (tierKey === 'AGGRESSIVE') {
    if (result > staked) {
      S.investStreak = (S.investStreak || 0) > 0 ? S.investStreak + 1 : 1;
    } else if (result < staked) {
      S.investStreak = (S.investStreak || 0) < 0 ? S.investStreak - 1 : -1;
    }
  }
  return { staked, mult, result };
}

/* 三類別委身判定：每季選了哪個類別就呼叫一次，累加次數、達到8/16門檻且
   還沒拿過對應特質才推進。三條線共用同一個函式，不要各類別分支各寫一份
   重複的門檻判斷。 */
const MASTERY_BY_CATEGORY = { TRAINING: TRAINING_MASTERY, OPPORTUNITY: OPPORTUNITY_MASTERY, SOCIAL: SOCIAL_MASTERY };
function checkCategoryMastery(S, category, log) {
  S.categoryPickCount[category] = (S.categoryPickCount[category] || 0) + 1;
  const mastery = MASTERY_BY_CATEGORY[category];
  for (const tierKey of ['TIER1', 'TIER2']) {
    const def = mastery[tierKey];
    if (S.categoryPickCount[category] >= def.threshold && !S.honors.includes(def.label)) {
      S.honors.push(def.label);
      applyMasteryEffect(S, def.effect);
      log.unlockedMastery = [...(log.unlockedMastery || []), def.label];
    }
  }
}

/* 這個選項底下有沒有風險層(小頭)可選：TRAINING 要有 growthMode，
   OPPORTUNITY 要有 abilityNudge，SOCIAL 一律沒有(mockup 明確定案的範圍，
   見 data/growth.js RISK_TIERS 註解)。UI 的 ChoiceMenu 決定要不要多秀一步
   穩健/平衡/冒進，headless 的 pickYearlyChoice() 也用這個判斷要不要一併
   隨機選一個風險層。 */
export function optionHasRiskTier(category, def) {
  if (category === 'TRAINING') return !!def.growthMode;
  if (category === 'OPPORTUNITY') return !!def.abilityNudge;
  return false;
}

/* headless/demo 用：隨機選一個大方向 + 隨機選該方向底下「這季真的開放」的
   子選項(見上面 availableOptions)，有風險層的話再隨機選一檔穩健/平衡/
   冒進。真正接 UI 之後，UI 只要呼叫 availableOptions() 決定要秀哪幾顆
   按鈕，這個函式就不用了。 */
export function pickYearlyChoice(S, ri) {
  const categories = [
    ['TRAINING', TRAINING_OPTION],
    ['OPPORTUNITY', OPPORTUNITY_OPTION],
    ['SOCIAL', SOCIAL_OPTION],
  ];
  const [category, table] = categories[ri(0, categories.length - 1)];
  const keys = availableOptions(S, table);
  const option = keys[ri(0, keys.length - 1)];
  let riskTierKey;
  if (optionHasRiskTier(category, table[option])) {
    const tierKeys = Object.keys(RISK_TIERS);
    riskTierKey = tierKeys[ri(0, tierKeys.length - 1)];
  }
  return { category, option, riskTierKey };
}

/* 入口：套用玩家(或 headless 隨機)選的年度選項。回傳 log + 這季暫時性的
   injury 機率乘數(不寫回 S，只給 proSeasonTick 這一季用)，避免跟
   PLAYING_STYLE 疊加的永久 injuryChanceMult 混在一起累積。riskTierKey 是
   optionHasRiskTier() 判定為 true 時才有意義的第三個選擇(穩健/平衡/
   冒進)，沒有風險層的選項這個參數會被忽略。 */
const TABLE_BY_CATEGORY = { TRAINING: TRAINING_OPTION, OPPORTUNITY: OPPORTUNITY_OPTION, SOCIAL: SOCIAL_OPTION };

export function applyYearlyChoice(S, ri, chance, category, optionKey, riskTierKey) {
  const log = { category, option: optionKey };
  let seasonInjuryMult = 1;

  // 砸錢版選項統一在這裡扣款，不分散到各類別的分支裡各寫一次——
  // availableOptions() 已經篩過存款夠不夠，這裡只管扣，不用再判斷。
  const chosenDef = TABLE_BY_CATEGORY[category][optionKey];
  if (chosenDef.cost) {
    S.savings = Math.round((S.savings - chosenDef.cost) * 100) / 100;
    log.moneySpent = chosenDef.cost;
  }

  if (category === 'TRAINING') {
    const def = TRAINING_OPTION[optionKey];
    checkCategoryMastery(S, 'TRAINING', log);
    // growthMode: null(WC_TAPER 保留體力備戰世界盃) 這季不練俱樂部能力，
    // 直接跳過風險層，把資源全押去 wcReadinessGain。骰子成長(大頭)已經
    // 搬去 flow/seasonOpener.js 的獨立季初步驟，這裡的 growthMode 現在只
    // 決定風險層(小頭，±1/2/3)要收斂打在哪一項(或哪幾項)能力上。
    const candidates = def.growthMode ? growthKeys(S, def.growthMode) : [];
    if (def.growthMode === 'all' && candidates.length && riskTierKey) {
      // 均衡訓練：拆給多項能力，見上面 pickTargetsFrom() 的註解。
      const targets = pickTargetsFrom(S, candidates, RISK_TIERS[riskTierKey].abilityDelta);
      if (targets.length) {
        const resolved = resolveRiskTier(S, chance, riskTierKey);
        const { success } = resolved;
        // growthDeltaMult(見 data/yearlyOptions.js VETERAN_WISDOM 的稽核說明)：
        // 選項本身能不能讓成長量跟其他選項有真的差異的唯一入口，預設1不影響
        // 現有選項(目前只有 BALANCED 會走這個分支，BALANCED 沒有這個欄位)。
        const delta = resolved.delta * (def.growthDeltaMult ?? 1);
        checkRiskTierTitle(S, riskTierKey, log);
        const perTarget = delta / targets.length;
        let gain = 0;
        for (const t of targets) gain += addAbilityPoints(S, t, perTarget, S.pos === 'GK');
        log.riskTier = riskTierKey;
        log.riskSuccess = success;
        log.riskTargets = targets;
        if (gain !== 0) log.growthGain = gain;
        seasonInjuryMult = success ? (def.injuryChanceMult ?? 1) : 1;
      } else {
        seasonInjuryMult = def.injuryChanceMult ?? 1;
      }
    } else {
      const target = candidates.length ? pickTargetFrom(S, candidates) : null;
      if (target && riskTierKey) {
        const resolved = resolveRiskTier(S, chance, riskTierKey);
        const { success } = resolved;
        // growthDeltaMult：見上面「均衡訓練」分支同一處註解，這裡是
        // FOCUSED/CONDITIONING/VETERAN_WISDOM/PRIVATE_CAMP 實際會走的分支。
        const delta = resolved.delta * (def.growthDeltaMult ?? 1);
        checkRiskTierTitle(S, riskTierKey, log);
        const gain = addAbilityPoints(S, target, delta, S.pos === 'GK');
        log.riskTier = riskTierKey;
        log.riskSuccess = success;
        log.riskTarget = target;
        if (gain !== 0) log.growthGain = gain;
        // 整個選項的成敗綁在一起：失敗時這個選項原本要給的傷病機率調整
        // (injuryChanceMult)也一併落空，還原成中性的1，不是只有能力值那半
        // 受風險影響——跟下面 OPPORTUNITY 分支「主/副效果綁一起」同一個
        // 原則，兩個類別的失敗語意要一致。
        seasonInjuryMult = success ? (def.injuryChanceMult ?? 1) : 1;
        // 「主攻優勢項目」的連續投入季數：目標不變就累加，換了新目標(舊的
        // 練滿了)才歸1重新算。只有真的成功時才算「這季有投入」，失敗(倒扣)
        // 不該延續連續紀錄。
        if (def.growthMode === 'single' && success) {
          S.focusTargetStreak = S.focusStreakKey === target ? (S.focusTargetStreak || 0) + 1 : 1;
          S.focusStreakKey = target;
          log.focusedKey = target;
          log.focusStreak = S.focusTargetStreak;
        }
      } else {
        // 沒有候選能力(WC_TAPER)或候選能力全部封頂：沒有風險層可言，
        // injuryChanceMult 照舊決定性套用，跟原本沒有風險概念時的行為一致。
        seasonInjuryMult = def.injuryChanceMult ?? 1;
      }
    }
    if (def.wcReadinessGain) {
      S.wcReadinessBoost = (S.wcReadinessBoost || 0) + def.wcReadinessGain;
      log.wcReadinessGain = def.wcReadinessGain;
    }
    // 訓練夥伴/對手：認識新夥伴已經改成年度自動觸發(見
    // flow/trainingRivalry.js evaluateTrainingEncounter)，不用選訓練；
    // CROSSROADS(較勁/合作)雖然要卡在選了訓練類別，但呼叫時機在
    // flow/proSeason.js proSeasonTick/flow/youthChoice.js applyYouthChoice
    // 裡(玩家確定選了訓練之後、這裡真正套用選項效果之前)，不在這個
    // 函式裡處理——見 flow/trainingRivalry.js 開頭的稽核說明。
  } else if (category === 'OPPORTUNITY') {
    const def = OPPORTUNITY_OPTION[optionKey];
    checkCategoryMastery(S, 'OPPORTUNITY', log);
    // 整個選項的成敗綁在一起(使用者定案)：有 abilityNudge 的選項才有風險
    // 層可言，成功才拿到這個選項全部的主效果(轉會買氣/薪資溢價/釋出風險
    // 折扣/租借加成/世界盃整備/人氣)，失敗則主效果全部落空，副效果(能力
    // 值)是真的對稱倒扣，不是只打折。沒有 abilityNudge 的選項(RETIREMENT_PREP/
    // PR_FIRM/INVEST_*/BUY_CLUB/PIVOT_TO_CELEBRITY)完全不受影響，維持原本
    // 100%決定性的行為。
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
    if (success && def.transferBuzzGain) {
      S.transferBuzz = (S.transferBuzz || 0) + def.transferBuzzGain;
      log.transferBuzzGain = def.transferBuzzGain;
    }
    if (success && def.wagePremiumGain) {
      S.wagePremiumBonus += def.wagePremiumGain;
      log.wagePremiumGain = def.wagePremiumGain;
    }
    if (success && def.releaseRiskDiscountGain) {
      S.releaseRiskDiscount = (S.releaseRiskDiscount || 0) + def.releaseRiskDiscountGain;
      log.releaseRiskDiscountGain = def.releaseRiskDiscountGain;
    }
    if (success && def.loanOfferBonusMult) log.loanOfferBonusMult = def.loanOfferBonusMult;
    if (success && def.wcReadinessGain) {
      S.wcReadinessBoost = (S.wcReadinessBoost || 0) + def.wcReadinessGain;
      log.wcReadinessGain = def.wcReadinessGain;
    }
    if (success && def.popularityGain) {
      S.popularity += def.popularityGain;
      log.popularityGain = def.popularityGain;
    }
    if (def.investTier) {
      const result = applyInvestment(S, ri, def.investTier);
      log.invest = result;
      if (result.result > result.staked) {
        S.investWins = (S.investWins || 0) + 1;
        if (S.investWins >= 5 && !S.honors.includes(WEALTH_HONOR.SHREWD_INVESTOR.label)) {
          S.honors.push(WEALTH_HONOR.SHREWD_INVESTOR.label);
          S.popularity += WEALTH_HONOR.SHREWD_INVESTOR.effect.popularityBonus;
          log.unlockedShrewdInvestor = true;
        }
      }
    }
    if (def.clubOwnership) {
      S.ownsClub = true;
      log.boughtClub = true;
      // 已經入股(見 data/yearlyOptions.js BUY_CLUB_SHARES_FAME/AGENT)的
      // 話，買斷剩下的股份退一部分錢回來——「已經是股東」的談判優勢，
      // 不直接改 availableOptions() 的 cost 篩選門檻(那個是通用機制，
      // 改成看單一選項的動態成本會打亂其他選項的假設)，用退款達到同一個
      // 效果，玩家實際花費比帳面 cost 少，感受得到台階的存在。
      if (S.clubShares) {
        const refund = Math.round(chosenDef.cost * 0.2 * 100) / 100;
        S.savings = Math.round((S.savings + refund) * 100) / 100;
        log.clubSharesRefund = refund;
      }
      // CLUB_OWNER 之前只設了 S.ownsClub 旗標，沒有正式推進 honors——
      // 補上，讓「買下球隊」在生涯稱號清單裡看得到。
      if (!S.honors.includes(WEALTH_HONOR.CLUB_OWNER.label)) {
        S.honors.push(WEALTH_HONOR.CLUB_OWNER.label);
        S.popularity += WEALTH_HONOR.CLUB_OWNER.effect.popularityBonus;
        log.unlockedClubOwner = true;
      }
      // 使用者定案：買下球隊是明確的終局選擇，不是混在機會選項裡隨機被
      // 選到的普通按鈕——選了就代表「不踢了，我要當老闆」，當季直接
      // 封頂退休，比繼續當「免疫降級的球員兼老闆」踢到自然衰老更有
      // 儀式感，也更符合「球員轉老闆」的現實邏輯。proSeasonTick 這一輪
      // 還是會正常跑完(照樣結算這季的數據)，只是跑完之後外層迴圈看到
      // S.retired 就不會再呼叫下一季。
      S.retired = true;
      S.stage = 'RETIRED';
      log.retiredAsOwner = true;
    }
    // 入股球隊：機會線(經紀人)專屬解鎖的台階，不是終局選擇，不觸發退休
    // ——見 data/yearlyOptions.js BUY_CLUB_SHARES_FAME/AGENT 的稽核說明。
    if (def.clubShares) {
      S.clubShares = true;
      log.boughtClubShares = true;
      if (!S.honors.includes(WEALTH_HONOR.CLUB_SHAREHOLDER.label)) {
        S.honors.push(WEALTH_HONOR.CLUB_SHAREHOLDER.label);
        S.popularity += WEALTH_HONOR.CLUB_SHAREHOLDER.effect.popularityBonus;
        log.unlockedClubShareholder = true;
      }
    }
    if (def.celebrityPivot) {
      // 跟買下球隊同一種「明確的終局選擇」設計：選了就代表「不踢了，全職
      // 經營場外身分」，當季直接封頂退休，不是混在機會選項裡隨機被選到的
      // 普通按鈕(見上面 requiresHonor 篩選，這個選項本來就只有拿到全球
      // 偶像稱號的生涯末期才會出現在候選池裡)。
      S.retired = true;
      S.stage = 'RETIRED';
      S.retiredAsCelebrity = true;
      log.retiredAsCelebrity = true;
    }
  } else if (category === 'SOCIAL') {
    const def = SOCIAL_OPTION[optionKey];
    checkCategoryMastery(S, 'SOCIAL', log);
    // 使用者定案(統一戀愛線/訓練線的觸發模式)：認識新對象改成要求玩家
    // 當季真的選了社交類別才會骰(見 flow/romance.js startDatingFromSocial
    // 的稽核說明)——跟以前「不看選了什麼類別，常駐事件自己骰」不一樣，
    // 求婚/出軌誘惑等「已經有對象之後」的大事件維持原本常駐判定，不受
    // 影響。SECRET_ENCOUNTER 的旗標要在骰認識新對象之前先設好，這樣
    // 如果這季剛好也骰中開始交往，pickPartner 才能正確讀到。
    if (def.forceNextPartnerHidden) S.loveForceRoyalNext = true;
    if (S.love.st === 'single' || S.love.st === 'divorced') {
      const startedDating = startDatingFromSocial(S, ri, chance, def.loveDatingChanceGain || 0);
      if (startedDating) log.startedDating = startedDating;
    }
    if (def.loveAffairOpportunityGain && (S.love.st === 'dating' || S.love.st === 'married')) {
      S.loveAffairOpportunityBoost = (S.loveAffairOpportunityBoost || 0) + def.loveAffairOpportunityGain;
    }
    if (def.loveProposeChanceGain) {
      S.loveProposeChanceBonus = (S.loveProposeChanceBonus || 0) + def.loveProposeChanceGain;
    }
    if (def.loveWaitStreakRelief) {
      S.loveWaitStreakReliefBonus = (S.loveWaitStreakReliefBonus || 0) + def.loveWaitStreakRelief;
    }
    if (def.loveAffairResistanceGain) {
      S.loveAffairResistanceBonus = (S.loveAffairResistanceBonus || 0) + def.loveAffairResistanceGain;
    }
    if (def.popularityGain) {
      S.popularity += def.popularityGain;
      log.popularityGain = def.popularityGain;
    }
    if (def.seasonFormBonus) S.seasonForm += def.seasonFormBonus;
    if (def.injuryChanceMult) seasonInjuryMult *= def.injuryChanceMult;
    // 媒體通告的緋聞風險是獨立的「公關翻車」判定，不是走 romance.js 的
    // 感情緋聞系統——這裡代表「這次通告講錯話/形象翻車」，直接扣一點人氣，
    // 跟這個選項本來想拿的 popularityGain 是同一個資源上的風險/報酬，
    // 邏輯自洽。
    if (def.scandalRiskAdd && chance(def.scandalRiskAdd)) {
      S.popularity = Math.max(0, S.popularity - 2);
      log.mediaScandal = true;
    }
    if (def.wcReadinessGain) {
      S.wcReadinessBoost = (S.wcReadinessBoost || 0) + def.wcReadinessGain;
      log.wcReadinessGain = def.wcReadinessGain;
    }
    // 一擲千金：花掉的不是固定 cost(那個在函式開頭已經統一扣過)，是「當下
    // 存款」本身，所以獨立處理，把存款歸零前先記下花了多少給 log/narrate 用。
    if (def.blowSavings) {
      const blown = S.savings;
      S.savings = 0;
      log.moneySpent = blown;
      log.blewItAll = true;
      S.everBlewItAll = true; // RAGS_TO_RICHES 稱號要看「曾經歸零過」，見 flow/proSeason.js 的檢查
    }
  }

  // 稽核抓出來的斷點：S.seasonForm(直接加進這季RAT，見 proSeason.js
  // generateSeasonStats)以前只有 SOCIAL 類別會動它，TRAINING/OPPORTUNITY
  // 一律歸零——這裡補一個跟社交線同一個欄位、但量級小很多的「近況起伏」
  // 小隨機(-1到+1)，不用另外開一條平行的「訓練手感」機制。改成 SOCIAL
  // 之外的類別也要疊加(不是重設)：戀愛系統改成每季自動判定之後(見
  // flow/romance.js)，S.seasonForm 這時候已經被 prepareLoveChoice/
  // resolveLoveChoiceStep 設定過一次(戀愛常駐事件的貢獻，不分這季選了
  // 哪個類別都會發生)，這裡如果用 = 而不是 +=，會把那份貢獻整個蓋掉。
  if (category !== 'SOCIAL') {
    S.seasonForm += ri(-1, 1);
  }

  // 「廣結善緣的性格」(OPPORTUNITY_MASTERY.TIER1)是持續生效的被動特質，不是只在
  // 選了機會類別那季才加——跟 transferBuzz 本身會衰退是同一個道理，這個
  // 加成每季都要疊加，不分這季選了哪個類別。
  if (S.transferBuzzFlatBonus) {
    S.transferBuzz = (S.transferBuzz || 0) + S.transferBuzzFlatBonus;
  }

  // 隊伍核心力：不分這季選了哪個類別，只要還在同一支球隊，共同訓練/出賽
  // 本身就會自然培養默契；選中社交的「隊友聚會」再加碼。青訓期/租借空窗
  // (S.club 為 null)不會呼叫到這裡，不用另外判斷。
  if (S.club) {
    const bonding = category === 'SOCIAL' && optionKey === 'TEAMMATE_BONDING' ? SQUAD_CHEMISTRY.bondingBonus : 0;
    S.squadChemistry = Math.min(SQUAD_CHEMISTRY.max, (S.squadChemistry || 0) + SQUAD_CHEMISTRY.seasonGain + bonding);
  }

  return { log, seasonInjuryMult };
}
