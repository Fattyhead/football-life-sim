/* ---------- 戀愛引擎 ---------- */
/* 對照 love.js 定義的狀態機跟效果表，這裡是實際判定邏輯。

   稽核抓出來的斷點(這輪重寫)：原本 runRomanceSeason() 只有玩家這季主動選
   社交選項的 ROMANCE 才會被呼叫——已婚玩家只要那季選了訓練或機會，婚姻
   就整季「凍結」，不會生小孩、不會被抓包、什麼都不會發生。直接查證原版
   wiki(raw.githubusercontent.com/LeoGGcat/yakyulife/main/YaKyoLife-WIKI.md)
   確認原版不是這樣：戀愛事件是狀態驅動、每季自動判定的，完全不看玩家選了
   什麼年度選項(單身/離婚40%、交往中每年必定觸發、已婚無小孩40%、已婚有
   小孩30%)，跟這個專案已經拆過一次的「季初骰子(大頭)脫鉤於選了哪個類別」
   同一種手法。求婚/出軌誘惑在原版是真正的玩家選擇，這裡拆成獨立的
   evaluate/resolve 兩階段(跟 flow/transfer.js evaluateContractCrisis 同一套
   寫法)，其餘(交往開始/分手/生小孩/緋聞曝光/隱藏王子保密期)維持全自動。

   四個函式的呼叫順序(見 flow/proSeason.js prepareLoveChoice/
   resolveLoveChoiceStep)：
     runRomanceAmbient()        — 每季自動判定，不看選了什麼類別(單身/
                                   離婚狀態下這裡不再做任何事，認識新對象
                                   的兩條管道都搬到 evaluateLoveChoiceMoment/
                                   startDatingFromSocial，見下方稽核說明)
     evaluateLoveChoiceMoment() — 緊接在 ambient 之後，回傳這季有沒有
                                   求婚/出軌誘惑/認識新對象(狗仔)的抉擇
                                   要問玩家
     resolveLoveChoiceMoment()  — 套用玩家(或 headless 用 recommend)的選擇
     finalizeLoveSeason()       — 兩步都跑完之後才能判定的稱號(門檻要看
                                   本季完整結果，不能只看 ambient 那一半)

   使用者第二輪定案(統一戀愛線/訓練線的觸發模式後，再校正一次)：原本
   「認識新對象」整條卡在「這季選了社交」，玩家沒空點社交就整輪沒有
   戀愛故事——參考原版棒球「每年初狗仔自動觸發、玩家承認或否認」的
   設計，改成分兩層：
     基本款(髮小/網紅，見 BASIC_PARTNER_TYPES) — 不用玩家投入，
       evaluateLoveChoiceMoment() 在單身/離婚狀態下每季都有機率自動
       觸發「狗仔拍到」事件，玩家選承認(開始交往)或否認(這次算了，
       下季還可能再遇到)，跟求婚/出軌誘惑同一套 evaluate/resolve 架構、
       同一張 LoveChoice.jsx 卡片。
     高端(女星/演員/歌手/Model/舞孃)+隱藏王子路線 — 維持原樣，只能
       靠 startDatingFromSocial()(選社交類別、MEET_NEW_PEOPLE/
       SECRET_ENCOUNTER)主動追求，狗仔事件保證不會送上這些對象——
       這是使用者明確定案的邊界，不是遺漏。
   startDatingFromSocial() 不在常駐序列裡——這季的類別(訓練/機會/社交)
   要等 pickYearlyChoice()/UI 的 ChoiceMenu 才會決定，比 ambient 晚，
   所以只能搬到 flow/yearlyChoice.js 的 SOCIAL 分支裡呼叫。 */

import {
  LOVE_STATUS,
  PARTNER_TYPE,
  HIDDEN_PARTNER,
  PARTNER_NAME_POOL,
  PARTNER_WEIGHT_BANDS,
  MARRIAGE_EFFECT,
  KIDS_EFFECT,
  BREAKUP_EFFECT,
  DIVORCE_EFFECT,
  AFFAIR,
  LOVE_HONOR,
  FAMILY_FIRST,
  REDEEMED,
  STABLE_MARRIAGE_STREAK_TARGET,
  STABILITY_MOMENT_BASE_CHANCE,
  STABILITY_MOMENT_CHANCE_PER_POINT,
  STABILITY_MOMENT_BONUS,
} from '../data/love.js';

const HIDDEN_UNLOCK_CHANCE = 0.03; // 隱藏王子路線稀有觸發機率，只有 startDatingFromSocial 那條管道才可能骰到
const DATING_START_BASE_CHANCE = 0.35;
// 狗仔自動觸發事件(基本款)：不用玩家投入，單身/離婚狀態下每季都有機率
// 命中，見下面 evaluateLoveChoiceMoment 的 SINGLE/DIVORCED 分支跟
// pickBasicPartner()。跟 startDatingFromSocial()(選社交主動追求，可以
// 遇到全部類型)是兩條並存的管道，不是取代關係。
const PAPARAZZI_EVENT_CHANCE = 0.3;
// 基本款對象類型——只有髮小/網紅這兩種零/低知名度類型會透過狗仔事件
// 自動出現，使用者明確定案：高端(女星/演員/歌手/Model/舞孃)跟隱藏王子
// 路線一律不會出現在這個管道，必須靠 startDatingFromSocial() 主動追求。
const BASIC_PARTNER_TYPES = ['CHILDHOOD_FRIEND', 'INFLUENCER'];
const PROPOSE_BASE_CHANCE = { early: 0.12, established: 0.22 }; // dyrs<2 / dyrs>=2
const BREAKUP_BASE_CHANCE = 0.12;
const BREAKUP_WAIT_STREAK_STEP = 0.05; // 每多等一季求婚，分手機率再加這麼多
const BREAKUP_CHANCE_CAP = 0.5;
/* 使用者定案：選了「求婚」不該保證成功——原本 100% 成功，等於這個選擇
   完全沒有風險，跟出軌誘惑(接受/拒絕都有真實後果)比起來份量不對等。
   拒絕機率吃兩個既有訊號，不用另外發明新欄位：交往越久(dyrs)越熟、
   對象本身的穩定度(PARTNER_TYPE/HIDDEN_PARTNER.stabilityBonus，髮小
   +2 最穩、王子 -3 最不穩)越高，拒絕機率越低——一個交往0年就求婚、
   對象又是最不穩定類型的衝動求婚，被拒機率明顯比熟穩交往多年的對象高，
   這樣「不用門檻卡求婚時機、但太急會有代價」剛好互補，不需要另外限制
   最短交往時間。 */
const PROPOSE_REJECT_BASE_CHANCE = 0.15;
const PROPOSE_REJECT_DYRS_FACTOR = 0.02; // 每多交往1年，拒絕機率再降這麼多
const PROPOSE_REJECT_STABILITY_FACTOR = 0.03; // 對象 stabilityBonus 每1點，拒絕機率反向調整這麼多
const PROPOSE_REJECT_CHANCE_MIN = 0.03;
const PROPOSE_REJECT_CHANCE_MAX = 0.35;

function partnerDef(love) {
  return love.partner.hidden ? HIDDEN_PARTNER[love.partner.type] : PARTNER_TYPE[love.partner.type];
}

/* 求婚被拒機率的計算抽成共用函式——evaluateLoveChoiceMoment() 要在玩家
   還沒決定之前就算出這個數字，餵給 flow/streakFlavor.js 的隱晦線索用
   (只給氣氛提示，不直接顯示百分比)；resolveLoveChoiceMoment() 真正骰
   的時候也讀同一個函式，不要兩邊各算一次，數字才不會兜不起來。 */
function proposeRejectChance(S) {
  const love = S.love;
  const def = partnerDef(love);
  return Math.max(
    PROPOSE_REJECT_CHANCE_MIN,
    Math.min(
      PROPOSE_REJECT_CHANCE_MAX,
      PROPOSE_REJECT_BASE_CHANCE - love.dyrs * PROPOSE_REJECT_DYRS_FACTOR - def.stabilityBonus * PROPOSE_REJECT_STABILITY_FACTOR,
    ),
  );
}

/* 依知名度加權選交往對象類型(見 data/love.js PARTNER_WEIGHT_BANDS 的稽核
   說明)：青訓/剛出道多半遇到髮小，紅了之後多半遇到明星/網紅，不再是
   均勻隨機。 */
function weightedPartnerType(S, ri) {
  const band = PARTNER_WEIGHT_BANDS.find((b) => S.popularity < b.max);
  const entries = Object.entries(band.weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = ri(1, total);
  for (const [type, w] of entries) {
    roll -= w;
    if (roll <= 0) return type;
  }
  return entries[entries.length - 1][0];
}

/* flavorTitles/name：見下方註解，選定當下骰一次、之後這段關係一路沿用
   同一個，不是每季重骰。S.loveForceRoyalNext 是 SECRET_ENCOUNTER(見
   data/yearlyOptions.js)選了之後疊加的旗標——保證這次開始的戀情是隱藏
   王子路線，優先於隨機的 HIDDEN_UNLOCK_CHANCE 骰(消耗掉旗標，跳過骰子，
   不是疊加機率)，讓玩家真的能主動選這條路，不只是提高機率賭運氣。 */
function pickPartner(S, ri, chance) {
  const name = PARTNER_NAME_POOL[ri(0, PARTNER_NAME_POOL.length - 1)];
  if (S.loveForceRoyalNext || chance(HIDDEN_UNLOCK_CHANCE)) {
    S.loveForceRoyalNext = false;
    const def = HIDDEN_PARTNER.ROYAL_PRINCE;
    return { type: 'ROYAL_PRINCE', hidden: true, title: def.flavorTitles[ri(0, def.flavorTitles.length - 1)], name };
  }
  const type = weightedPartnerType(S, ri);
  const def = PARTNER_TYPE[type];
  return { type, hidden: false, title: def.flavorTitles[ri(0, def.flavorTitles.length - 1)], name };
}

/* 狗仔事件專用的抽選——跟 pickPartner() 分開寫(不是共用一份加參數)，
   因為候選池/隱藏路線邏輯都不一樣：這裡只從 BASIC_PARTNER_TYPES 抽，
   完全不骰 HIDDEN_UNLOCK_CHANCE(狗仔絕對不會拍到隱藏王子，這是使用者
   明確定案的邊界)。但 S.loveForceRoyalNext(SECRET_ENCOUNTER 設的旗標)
   仍然優先消耗——玩家已經主動投入過(選了 SECRET_ENCOUNTER)，不該因為
   剛好先撞上免費的狗仔事件就讓這個承諾落空，這樣玩家才不用每季都硬選
   社交賭運氣，任何一個認識新對象的管道都能兌現這個保證。 */
function pickBasicPartner(S, ri) {
  const name = PARTNER_NAME_POOL[ri(0, PARTNER_NAME_POOL.length - 1)];
  if (S.loveForceRoyalNext) {
    S.loveForceRoyalNext = false;
    const def = HIDDEN_PARTNER.ROYAL_PRINCE;
    return { type: 'ROYAL_PRINCE', hidden: true, title: def.flavorTitles[ri(0, def.flavorTitles.length - 1)], name };
  }
  const type = BASIC_PARTNER_TYPES[ri(0, BASIC_PARTNER_TYPES.length - 1)];
  const def = PARTNER_TYPE[type];
  return { type, hidden: false, title: def.flavorTitles[ri(0, def.flavorTitles.length - 1)], name };
}

/* 使用者定案：認識新對象要卡在「這季真的選了社交類別」——只有
   flow/yearlyChoice.js 的 SOCIAL 分支會呼叫這裡，不是每季自動骰(對照
   上面 runRomanceAmbient 保留的常駐提示)。gain 是這季選的 SOCIAL 子選項
   帶的加成(MEET_NEW_PEOPLE 的 loveDatingChanceGain，其他子選項沒有這個
   欄位就是0)，當季直接套用，不用像改版前那樣疊到下一季才生效——玩家
   這季選了認識新朋友，這季就該看到效果，不是「這季埋種子，下季才發芽」。
   呼叫端要保證 S.loveForceRoyalNext(SECRET_ENCOUNTER 設的旗標)在呼叫
   這裡之前就設定好，這樣如果這季剛好也骰中開始交往，pickPartner 才能
   正確讀到。 */
export function startDatingFromSocial(S, ri, chance, gain = 0) {
  const love = S.love;
  if (love.st !== LOVE_STATUS.SINGLE && love.st !== LOVE_STATUS.DIVORCED) return null;
  if (!chance(DATING_START_BASE_CHANCE + gain)) return null;
  const picked = pickPartner(S, ri, chance);
  love.st = LOVE_STATUS.DATING;
  love.partner = picked;
  love.dyrs = 0;
  love.datedTimes += 1;
  return picked;
}

/* 每季自動判定，不看這季選了什麼類別。求婚/出軌誘惑/狗仔事件都不在
   這裡骰(見 evaluateLoveChoiceMoment)——這裡只處理不需要玩家決定的
   自動事件。單身/離婚狀態下這裡完全不用做事：認識新對象的兩條管道
   (狗仔自動觸發/主動選社交)都是「需要玩家決定」或「另外的呼叫時機」，
   不屬於這個純自動 ambient 函式的範圍。 */
export function runRomanceAmbient(S, ri, chance) {
  const log = {};
  const love = S.love;
  let seasonForm = 0;
  let seasonInjuryMult = 1;

  if (love.st === LOVE_STATUS.SINGLE || love.st === LOVE_STATUS.DIVORCED) {
    return { log, seasonForm, seasonInjuryMult };
  }

  const def = partnerDef(love);
  love.dyrs += 1;
  S.popularity += 1; // 穩定關係本身的小幅人氣

  // 穩定度不再是無條件疊加(見 data/love.js STABILITY_MOMENT_* 的稽核說明)——
  // 併成一個分量池，只決定這季有沒有一次甜蜜/溫馨時刻，不是保底每季都加。
  // 已婚才把婚姻本身/FAMILY_FIRST 的分量併進來，交往中只看對象本身的
  // stabilityBonus，跟原本兩段各自的適用範圍一致。
  let stabilityPool = def.stabilityBonus;
  if (love.st === LOVE_STATUS.MARRIED) {
    stabilityPool += MARRIAGE_EFFECT.marriedStabilityBonus + (S.familyStabilityBonus || 0);
  }
  const momentChance = Math.min(
    0.9,
    Math.max(0.05, STABILITY_MOMENT_BASE_CHANCE + stabilityPool * STABILITY_MOMENT_CHANCE_PER_POINT),
  );
  if (chance(momentChance)) {
    seasonForm += STABILITY_MOMENT_BONUS;
    log.stabilityMoment = true;
  }

  if (love.st === LOVE_STATUS.DATING) {
    // 分手骰跟求婚骰不再互斥(求婚搬去 evaluateLoveChoiceMoment 之後才判定)——
    // 拖著不求婚(S.love.waitStreak，見 DEEPEN_RELATIONSHIP/resolveLoveChoiceMoment)
    // 會讓分手機率往上加，呼應原版「拖越久分手風險越高」的設計。
    const waitStreak = Math.max(0, (love.waitStreak || 0) - (S.loveWaitStreakReliefBonus || 0));
    S.loveWaitStreakReliefBonus = 0;
    const breakupChance = Math.min(BREAKUP_CHANCE_CAP, BREAKUP_BASE_CHANCE + waitStreak * BREAKUP_WAIT_STREAK_STEP);
    if (chance(breakupChance)) {
      love.exes.push(love.partner.type);
      love.partner = null;
      love.st = LOVE_STATUS.SINGLE;
      love.dyrs = 0;
      love.waitStreak = 0;
      log.brokeUp = true;
      return { log, seasonForm: BREAKUP_EFFECT.seasonFormPenalty, seasonInjuryMult };
    }
  } else if (love.st === LOVE_STATUS.MARRIED) {
    // 婚姻/FAMILY_FIRST 的穩定度分量已經併進上面的 stabilityPool 判定，
    // 不在這裡另外無條件疊加一次。

    // 生小孩：機率隨已有小孩數遞減(見 data/love.js KIDS_EFFECT 的稽核說明)，
    // 不再是固定機率。
    const kidsChanceTable = KIDS_EFFECT.chanceByExistingKids;
    const kidsChance = kidsChanceTable[Math.min(love.kids, kidsChanceTable.length - 1)];
    if (chance(kidsChance)) {
      love.kids += 1;
      seasonForm += KIDS_EFFECT.newbornSeasonPenalty;
      log.newKid = love.kids;
    } else if (love.kids > 0) {
      const idx = Math.min(love.kids, KIDS_EFFECT.maxStackedKids) - 1;
      const kidBonus = KIDS_EFFECT.perKid[idx];
      seasonForm += kidBonus.maturityBonus;
      seasonInjuryMult *= kidBonus.injuryEscalateChanceMult;
    }

    // 緋聞/曝光風險，只在對象有知名度時滾動——這條線完全自動，跟下面
    // evaluateLoveChoiceMoment 的出軌誘惑是兩件事(對象知名度招來狗仔，
    // 不代表玩家真的做了什麼)。使用者定案：隱藏王子路線已經曝光過就不會
    // 再骰第二次——已經是全世界都知道的事，沒有「再曝光一次」這回事，
    // 不然「皇室緋聞」那句「一夕之間全世界都在談論」的敘事句可能同一段
    // 感情裡重複出現好幾次，讀起來像是每次都是第一次發生。一般(非隱藏)
    // 對象沒有這個防護——緋聞被拍到約會本來就可以一次又一次上新聞，
    // 跟「秘密曝光」是不同性質的事件，只有隱藏線需要「只揭露一次」。
    if (def.fame > 0 && !(love.partner.hidden && S.royalRomanceExposed) && chance(0.05 * def.scandalRiskMult)) {
      love.caught += 1;
      log.scandal = true;

      if (love.partner.hidden) {
        seasonForm += def.secretExposurePenalty.seasonFormPenalty;
        S.wagePremiumBonus += def.secretExposurePenalty.wagePremiumPenalty;
        log.secretExposed = true;
        S.royalRomanceExposed = true;
      } else if (chance(0.4)) {
        log.divorced = true;
        love.exes.push(love.partner.type);
        love.partner = null;
        love.st = LOVE_STATUS.DIVORCED;
        love.dyrs = 0;
        const kidsCostMult = love.kids > 0 ? 1 + DIVORCE_EFFECT.withKidsExtraCostMult : 1;
        S.savings -= Math.round(S.wage * DIVORCE_EFFECT.settlementCostMult * kidsCostMult * 100) / 100;
        seasonForm += DIVORCE_EFFECT.seasonFormPenalty;
      }
    } else if (love.partner.hidden && love.dyrs >= 3 && !log.scandal) {
      seasonForm += def.stableSecretBonus.seasonFormBonus;
      log.stableSecretBonus = true;
      S.royalRomanceStable = true;
    }
  }

  return { log, seasonForm, seasonInjuryMult };
}

/* 緊接在 runRomanceAmbient() 之後呼叫(這樣本季剛分手/剛離婚的狀態變化
   能正確反映，不會誤判還有求婚/出軌機會)。回傳 null(多數季度)或
   { type, options, recommend }——recommend 刻意跟舊版的自動行為一致
   ('propose'/'accept')，headless 掃描的統計分佈才有舊資料可以對照。
   S.loveProposeChanceBonus/S.loveAffairOpportunityBoost/
   S.loveAffairResistanceBonus 是 DEEPEN_RELATIONSHIP/MEET_NEW_PEOPLE/
   DATE_NIGHT 疊加的暫存加成，讀完歸零。這裡多吃一個 ri 參數(其他分支
   用不到，只有 PAPARAZZI 分支要先抽出候選對象給玩家看)。 */
export function evaluateLoveChoiceMoment(S, ri, chance) {
  const love = S.love;

  if (love.st === LOVE_STATUS.SINGLE || love.st === LOVE_STATUS.DIVORCED) {
    // 狗仔自動觸發：基本款專屬，見上方 BASIC_PARTNER_TYPES 的稽核說明。
    // partner 先抽出來放進 pending，resolveLoveChoiceMoment() 收到
    // 「承認」才真的套用，不是每次評估都重骰一次——玩家看到的候選對象
    // 要跟最後承認的是同一個人。
    if (!chance(PAPARAZZI_EVENT_CHANCE)) return null;
    const partner = pickBasicPartner(S, ri);
    return { type: 'PAPARAZZI', partner, options: { admit: true, deny: true }, recommend: 'admit' };
  }

  if (love.st === LOVE_STATUS.DATING) {
    const base = love.dyrs >= 2 ? PROPOSE_BASE_CHANCE.established : PROPOSE_BASE_CHANCE.early;
    const proposeChance = base + (S.loveProposeChanceBonus || 0);
    S.loveProposeChanceBonus = 0;
    if (chance(proposeChance)) {
      // rejectChance 是內部用的隱晦線索原始資料(見 flow/streakFlavor.js
      // computeProposeRiskFlavor)，UI 只會拿去分桶挑氣氛文字，不會直接
      // 顯示這個數字給玩家看。
      return { type: 'PROPOSE', options: { propose: true, wait: true }, recommend: 'propose', rejectChance: proposeRejectChance(S) };
    }
    return null;
  }

  if (love.st === LOVE_STATUS.MARRIED) {
    // repeatFactor：花心程度(love.affairs 累積次數，見 data/love.js AFFAIR
    // 的稽核說明)疊加進觸發機率，讓「越陷越深」是真的機制，不只是稱號
    // 門檻的被動紀錄——曾經出軌過的人，下一次誘惑更容易找上門。
    const triggerChance = Math.min(
      AFFAIR.maxTriggerChance,
      Math.max(
        0,
        AFFAIR.triggerBaseChance +
          S.popularity * AFFAIR.popularityFactor +
          love.affairs * AFFAIR.repeatFactor +
          (S.loveAffairOpportunityBoost || 0) -
          (S.loveAffairResistanceBonus || 0),
      ),
    );
    S.loveAffairOpportunityBoost = 0;
    S.loveAffairResistanceBonus = 0;
    if (chance(triggerChance)) {
      // discoverChance 同上，內部隱晦線索原始資料，不直接顯示給玩家。
      const discoverChance = Math.min(1, AFFAIR.discoverChance * (S.affairDiscoverChanceMult || 1));
      return { type: 'AFFAIR', options: { accept: true, decline: true }, recommend: 'accept', discoverChance };
    }
    return null;
  }

  return null;
}

/* 套用玩家(或 headless 用 evaluateLoveChoiceMoment 給的 recommend)選的
   結果。choice 要保證是 evaluateLoveChoiceMoment() 回傳的 options 裡開放
   的那個(跟 flow/transfer.js resolveContractCrisis 同一種約定)。這裡吃
   整個 pending 物件(不只 type)，因為 PAPARAZZI 分支要讀 pending.partner
   (evaluateLoveChoiceMoment 當初抽出來的候選對象，不能在這裡重骰一次，
   不然玩家看到的人跟真的交往的人會兜不起來)。 */
export function resolveLoveChoiceMoment(S, ri, chance, pending, choice) {
  const log = {};
  const love = S.love;
  let seasonForm = 0;
  let seasonInjuryMult = 1;
  const type = pending.type;

  if (type === 'PAPARAZZI') {
    if (choice === 'admit') {
      love.st = LOVE_STATUS.DATING;
      love.partner = pending.partner;
      love.dyrs = 0;
      love.datedTimes += 1;
      log.startedDating = pending.partner;
    } else {
      log.paparazziDenied = true;
    }
    return { log, seasonForm, seasonInjuryMult };
  }

  if (type === 'PROPOSE') {
    if (choice === 'propose') {
      // 求婚不保證成功——拒絕機率吃交往年數(越久越熟，機率越低)跟對象
      // 本身的穩定度(見上面 PROPOSE_REJECT_STABILITY_FACTOR 的稽核說明)，
      // 公式跟 evaluateLoveChoiceMoment() 算隱晦線索用的那份共用同一個
      // proposeRejectChance()，不要兩邊各算一次。
      if (chance(proposeRejectChance(S))) {
        // 被拒絕：關係還在，但氣氛尷尬——疊加等待期累積的分手風險(跟選
        // 「再等等」同一個後果)，多疊一點 seasonForm 懲罰反映這次的挫折，
        // 跟玩家自己選擇拖延的「再等等」在情緒份量上區分開來。
        love.waitStreak = (love.waitStreak || 0) + 1;
        seasonForm -= 2;
        log.proposalRejected = true;
      } else {
        love.st = LOVE_STATUS.MARRIED;
        love.waitStreak = 0;
        seasonForm += MARRIAGE_EFFECT.weddingSeasonPenalty;
        log.married = love.partner.type;
      }
    } else {
      love.waitStreak = (love.waitStreak || 0) + 1;
      log.proposalDelayed = true;
    }
    return { log, seasonForm, seasonInjuryMult };
  }

  if (type === 'AFFAIR') {
    if (choice === 'decline') {
      log.declinedAffair = true;
      return { log, seasonForm, seasonInjuryMult };
    }

    love.affairs += 1;
    const discoverChance = Math.min(1, AFFAIR.discoverChance * (S.affairDiscoverChanceMult || 1));
    if (chance(discoverChance)) {
      log.affairDiscovered = true;
      seasonForm += AFFAIR.discoveredPenalty.seasonFormPenalty;
      if (chance(AFFAIR.discoveredPenalty.divorceChance)) {
        log.divorced = true;
        love.exes.push(love.partner.type);
        love.partner = null;
        love.st = LOVE_STATUS.DIVORCED;
        love.dyrs = 0;
        const kidsCostMult = love.kids > 0 ? 1 + DIVORCE_EFFECT.withKidsExtraCostMult : 1;
        S.savings -= Math.round(S.wage * DIVORCE_EFFECT.settlementCostMult * kidsCostMult * 100) / 100;
        seasonForm += DIVORCE_EFFECT.seasonFormPenalty;
      }
    } else {
      // 沒被抓到：靜默累加，不留痕跡、不扣分——這是「藏得住」的部分。
      log.affairHidden = true;
    }
    return { log, seasonForm, seasonInjuryMult };
  }

  return { log, seasonForm, seasonInjuryMult };
}

/* 兩步都跑完之後才呼叫——PLAYBOY_STAR 要看本季是否真的新增出軌次數(在
   resolveLoveChoiceMoment 裡才會發生)，FAMILY_FIRST/REDEEMED 的
   stableMarriageStreak 要看本季完整結果(緋聞可能來自 ambient 的 scandal，
   出軌可能來自 resolve 的 affairHidden/affairDiscovered)，只看其中一半
   會誤判。combinedLog 是 ambientLog 跟 resolveLoveChoiceMoment 的 log
   合併後的結果，這個函式會直接在上面補寫解鎖旗標。 */
export function finalizeLoveSeason(S, combinedLog) {
  if (S.love.affairs >= 3 && !S.honors.includes(LOVE_HONOR.PLAYBOY_STAR.label)) {
    S.honors.push(LOVE_HONOR.PLAYBOY_STAR.label);
    S.popularity += LOVE_HONOR.PLAYBOY_STAR.effect.popularityBonus;
    S.affairDiscoverChanceMult = (S.affairDiscoverChanceMult || 1) + LOVE_HONOR.PLAYBOY_STAR.effect.discoverChanceMultBonus;
    combinedLog.unlockedPlayboyStar = true;
  }

  // 隱藏王子路線的兩個稱號(見 data/love.js 的稽核說明)：曝光是大爆點，
  // 精英層；沒曝光、安穩撐過保密期份量刻意壓低，稀有層。兩者不互斥，
  // S.royalRomanceExposed/royalRomanceStable 本身就是「這輩子發生過」的
  // 歷史旗標(只增不減，見 flow/romance.js runRomanceAmbient)，這裡只是
  // 照旗標推進對應稱號，跟其他稱號同一種「未擁有才推進」寫法。
  if (S.royalRomanceExposed && !S.honors.includes(LOVE_HONOR.ROYAL_SCANDAL.label)) {
    S.honors.push(LOVE_HONOR.ROYAL_SCANDAL.label);
    S.popularity += LOVE_HONOR.ROYAL_SCANDAL.effect.popularityBonus;
    combinedLog.unlockedRoyalScandal = true;
  }
  if (S.royalRomanceStable && !S.honors.includes(LOVE_HONOR.QUIETLY_ROYAL.label)) {
    S.honors.push(LOVE_HONOR.QUIETLY_ROYAL.label);
    S.popularity += LOVE_HONOR.QUIETLY_ROYAL.effect.popularityBonus;
    combinedLog.unlockedQuietlyRoyal = true;
  }

  if (S.love.st === LOVE_STATUS.MARRIED && !combinedLog.scandal && !combinedLog.affairHidden && !combinedLog.affairDiscovered) {
    S.stableMarriageStreak = (S.stableMarriageStreak || 0) + 1;
  } else {
    S.stableMarriageStreak = 0;
  }

  if (S.stableMarriageStreak >= STABLE_MARRIAGE_STREAK_TARGET && S.love.kids > 0 && !S.honors.includes(FAMILY_FIRST.label)) {
    S.honors.push(FAMILY_FIRST.label);
    S.familyStabilityBonus = (S.familyStabilityBonus || 0) + FAMILY_FIRST.effect.seasonFormBonus;
    combinedLog.unlockedFamilyFirst = true;
  }

  if (
    S.stableMarriageStreak >= STABLE_MARRIAGE_STREAK_TARGET &&
    S.honors.includes(LOVE_HONOR.PLAYBOY_STAR.label) &&
    !S.honors.includes(REDEEMED.label)
  ) {
    S.honors.push(REDEEMED.label);
    S.popularity += REDEEMED.effect.popularityBonus;
    if (REDEEMED.effect.clearDiscoverChanceMultBonus) S.affairDiscoverChanceMult = 1;
    combinedLog.unlockedRedeemed = true;
  }
}

/* 組合函式：季初常駐階段(類別選項之前)呼叫一次即可。定義在這裡(不是
   flow/proSeason.js 的私有邏輯)，因為青訓期(flow/careerStart.js)現在
   也適用同一套戀愛系統(使用者定案：戀愛線青訓也要有，不是職業生涯
   限定)，兩邊都呼叫這裡匯出的版本，不重複寫一份、也避免
   flow/proSeason.js↔flow/careerStart.js 互相 import 造成循環依賴
   (proSeason.js 本來就要 import careerStart.js 的 assignSubPosition)。
   回傳的 seasonForm/seasonInjuryMult 先暫存到 S(S.loveSeasonInjuryMult，
   跟 S.debutInjuryMult 同一種「這季設定、下一步驟讀完就歸1」用法)，
   年度選項的貢獻是疊加在這之上，不是覆蓋掉(見 flow/yearlyChoice.js
   的稽核說明)。 */
export function prepareLoveChoice(S, ri, chance) {
  const ambient = runRomanceAmbient(S, ri, chance);
  S.seasonForm = ambient.seasonForm;
  S.loveSeasonInjuryMult = ambient.seasonInjuryMult;
  const pending = evaluateLoveChoiceMoment(S, ri, chance);
  return { ambientLog: ambient.log, pending };
}

/* 套用玩家(或 headless 用 pending.recommend)的選擇——pending 是
   prepareLoveChoice() 回傳的那個，沒有 pending 就直接回傳 ambientLog
   原樣(這季沒有戀愛抉擇)。finalizeLoveSeason 一定要在這裡(兩步都跑完)
   才呼叫，PLAYBOY_STAR/FAMILY_FIRST/REDEEMED 的門檻要看本季完整結果，
   只看 ambient 那一半會誤判。 */
export function resolveLoveChoiceStep(S, ri, chance, ambientLog, pending, choice) {
  if (!pending) {
    finalizeLoveSeason(S, ambientLog);
    return ambientLog;
  }
  const resolved = resolveLoveChoiceMoment(S, ri, chance, pending, choice ?? pending.recommend);
  S.seasonForm += resolved.seasonForm;
  S.loveSeasonInjuryMult = (S.loveSeasonInjuryMult ?? 1) * resolved.seasonInjuryMult;
  const combinedLog = { ...ambientLog, ...resolved.log };
  finalizeLoveSeason(S, combinedLog);
  return combinedLog;
}
