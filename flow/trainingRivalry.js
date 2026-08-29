/* ---------- 訓練夥伴/對手引擎 ---------- */
/* 架構照抄 flow/romance.js 的 evaluate/resolve 兩階段模式，但這條線的
   「起點」跟「後續進展」拆成兩個不同的觸發時機——這是使用者兩輪定案
   疊加後的結果，記錄清楚避免之後又搞混：

   第一輪(這輪稍早)原本把整條線都改成跟戀愛基本款一樣的年度自動觸發，
   使用者隨後糾正：「不練球，哪來的對手」這個原則對「起點」要推翻沒錯
   (玩家不用特別投入就會自動遇到人)，但對「後續」不該推翻——原話：
   「你要持續訓練才會有互動...進入訓練選項時就會出現這個對手的事件，
   所以才是有訓練才能繼續走下去」。所以最終定案是：
     起點(認識新對手/夥伴) — 完全自動，見 evaluateTrainingEncounter，
       不看這季選了什麼類別，玩家選接受或不予理會。
     後續(CROSSROADS：較勁/合作) — 只有這季真的選了訓練類別、且已經
       有夥伴時才會評估，見 evaluateTrainingRivalryMoment——不是 ambient
       (跟 evaluateTrainingEncounter 不同一個呼叫時機！)。呼叫端(見
       flow/proSeason.js/careerStart.js/web/src/App.jsx)要在玩家確定
       選了訓練類別、子選項、風險層之後，實際套用選項效果之前，先評估
       這個——沒有隱藏機率預覽的問題(選類別是玩家的確定性動作，不是
       chance() 骰出來的，不會有「預覽就把亂數序列骰掉」的風險，跟
       flow/nationalRival.js 的 CROSSROADS banking 是不同情境)。
     自然離隊(LEAVE_CHANCE) — 維持 ambient，不看類別，跟訓練線的「起點」
       同一個道理：關係會不會自然結束不該由玩家的選擇單向控制。

   runTrainingRivalryAmbient()/evaluateTrainingEncounter()/
   resolveTrainingEncounter() 三個定義在這裡(不是 flow/proSeason.js 的
   私有邏輯)，因為青訓期(flow/careerStart.js)現在也需要同一套常駐階段，
   兩邊都呼叫這裡匯出的版本，不重複寫一份。evaluateTrainingRivalryMoment/
   resolveTrainingRivalryMoment 也一樣匯出給兩邊的「訓練類別確認後」
   呼叫點共用。 */

import {
  TRAINING_PARTNER_TYPE,
  TRAINING_PARTNER_NAME_POOL,
  BOND_MOMENT_YEARS_THRESHOLD,
  BOND_MOMENT_SUCCESS_CHANCE,
  BOND_MOMENT_HONOR,
} from '../data/trainingPartner.js';
import { SQUAD_CHEMISTRY } from '../data/career.js';
import { pickFocusTarget, addAbilityPoints } from './shared.js';

// 跟 flow/romance.js PAPARAZZI_EVENT_CHANCE 同一個量級——年度自動觸發，
// 不用玩家投入，兩條線的觸發頻率刻意對齊，讀起來才像同一套設計語言。
const ENCOUNTER_TRIGGER_CHANCE = 0.3;
const LEAVE_CHANCE = 0.08; // 每季一定機率的自然離隊(轉隊/退出訓練組)，關係收尾
const CROSSROADS_BASE_CHANCE = 0.22;
const COMPETE_CHEMISTRY_PENALTY = 8; // 跟 SQUAD_CHEMISTRY.bondingBonus 同一個量級
const COOPERATE_CHEMISTRY_BONUS = 10; // 跟 SQUAD_CHEMISTRY.seasonGain 同一個量級
const COMPETE_GROWTH_POINTS = [2, 4]; // 較勁贏得的即時能力點數區間(ri範圍)

/* 稽核抓出來的斷點(平衡度稽核，使用者定案「副業不能贏過主業」)：
   S.trainingBondCupBoost/trainingBondWCBoost 本來完全沒有上限——換一次
   俱樂部、新夥伴撐滿6年又成功一次，就再疊加一次，生涯累積值、永久不歸零
   (跟 flow/worldCup.js 的稽核註解對照過)。但真正該負責這兩個機率池的
   本業機制都是有上限/單次的：cupBuzzBoost 的 transferBuzz 分量封頂0.15
   (見 flow/proSeason.js)，WC_AUDITION/SQUAD_BONDING 單次只有0.08、
   WC_TAPER 單次0.15 但每個世界盃週期都要重新投入(用過即歸零，見
   flow/worldCup.js selectedForSquad)。訓練夥伴線的羈絆時刻是「命運安排
   的高潮」，不是玩家能重複刷的本業投入，加成理應明顯小於本業單次能拿到
   的量級——封頂在兩次成功的量(0.06)，清楚低於本業最低的單次門檻(0.08)，
   不會出現「不投入機會/社交，光靠訓練夥伴線也能贏過真的去衝世界盃籌碼
   的玩家」這種副業反超本業的情況。失敗方向的懲罰同樣封頂，避免無限
   累積成一個巨大負值，跟正向上限對稱。 */
const TRAINING_BOND_BOOST_CAP = 0.06;

function pickPartnerType(ri) {
  return ri(0, 1) === 0 ? 'RIVAL' : 'COMRADE';
}

/* 每季自動判定，不看這季選了什麼類別。已經有夥伴時，處理「這段關係
   還在不在」的常駐骰；還沒有夥伴時完全不用做事——遇到新人的機會是
   一個真正的抉擇(見 evaluateTrainingEncounter)，不屬於這個純自動
   ambient 函式的範圍(跟 flow/romance.js runRomanceAmbient 單身/離婚
   分支同一個道理)。 */
export function runTrainingRivalryAmbient(S, ri, chance) {
  const log = {};
  if (!S.trainingPartner) {
    return { log };
  }

  S.trainingPartner.years += 1;
  if (chance(LEAVE_CHANCE)) {
    log.trainingPartnerLeft = { ...S.trainingPartner };
    S.trainingPartner = null;
  }
  return { log };
}

/* 年度自動觸發：還沒有夥伴時，這季有機率遇到一個人——挑釁(→接受就是
   RIVAL)或搭話(→接受就是 COMRADE)，類型在觸發當下就骰定，玩家看到的
   候選人跟真的接受後指派的是同一個。回傳 null 代表這季沒遇到。 */
export function evaluateTrainingEncounter(S, ri, chance) {
  if (S.trainingPartner) return null;
  if (!chance(ENCOUNTER_TRIGGER_CHANCE)) return null;
  const type = pickPartnerType(ri);
  const def = TRAINING_PARTNER_TYPE[type];
  const name = TRAINING_PARTNER_NAME_POOL[ri(0, TRAINING_PARTNER_NAME_POOL.length - 1)];
  const title = def.flavorTitles[ri(0, def.flavorTitles.length - 1)];
  return { type: 'ENCOUNTER', candidate: { type, name, title }, options: { accept: true, ignore: true }, recommend: 'accept' };
}

/* 套用玩家(或 headless 用 recommend)對遭遇事件的選擇——接受就正式指派
   (candidate 是 evaluateTrainingEncounter 當初骰好的那個，不重骰)；
   不予理會零代價，這次算了，之後還可能再遇到人(不一定是同一個)。 */
export function resolveTrainingEncounter(S, pending, choice) {
  const log = {};
  if (choice === 'accept') {
    // bondFired：羈絆時刻(見 evaluateBondMoment 前後的稽核說明)一輩子
    // 只評估一次，掛在夥伴物件本身，換新夥伴時自然歸零(這個物件本身
    // 就是全新的)，不需要另外寫重置邏輯。
    S.trainingPartner = { ...pending.candidate, years: 0, bondFired: false };
    log.trainingPartnerAssigned = S.trainingPartner;
  } else {
    log.trainingEncounterIgnored = { name: pending.candidate.name };
  }
  return log;
}

/* 緊接在 runTrainingRivalryAmbient() 之後呼叫(這樣本季夥伴剛離隊的
   狀態變化能正確反映，不會誤判還有 CROSSROADS 機會)。years<1 代表
   這季才剛指派，還沒到能骰 CROSSROADS 的時候。recommend 給 headless
   掃描/UI 預設用，跟戀愛線同一種「合作」偏保守的預設。 */
export function evaluateTrainingRivalryMoment(S, chance) {
  if (!S.trainingPartner || S.trainingPartner.years < 1) return null;
  const def = TRAINING_PARTNER_TYPE[S.trainingPartner.type];
  if (!chance(CROSSROADS_BASE_CHANCE * def.frictionMult)) return null;
  return { type: 'CROSSROADS', options: { compete: true, cooperate: true }, recommend: 'cooperate' };
}

/* 套用玩家(或 headless 用 recommend)的選擇。較勁：個人能力立即成長，
   但隊伍核心力(S.squadChemistry)受損；合作：隊伍核心力提升，沒有個人
   能力效果。RIVAL/COMRADE 類型各自在自己擅長的那個選項上疊加一點
   額外量(見 data/trainingPartner.js 的稽核說明)，兩個選項都不是絕對
   正確答案，是兩種不同的機制風格。 */
export function resolveTrainingRivalryMoment(S, ri, chance, choice) {
  const log = {};
  if (!S.trainingPartner) return { log };
  const def = TRAINING_PARTNER_TYPE[S.trainingPartner.type];

  // 累積次數：不分較勁/合作的效果好壞，選了哪個就算數，給
  // RIVALRY_TIER_TITLE(見 data/trainingPartner.js)的門檻判定用，比照
  // S.riskTierPickCount 同一種「選了就累加」寫法。
  S.rivalryPickCount = S.rivalryPickCount || { compete: 0, cooperate: 0 };
  S.rivalryPickCount[choice] = (S.rivalryPickCount[choice] || 0) + 1;

  if (choice === 'compete') {
    S.squadChemistry = Math.max(0, (S.squadChemistry || 0) - COMPETE_CHEMISTRY_PENALTY);
    const isGK = S.pos === 'GK';
    const target = pickFocusTarget(S) || Object.keys(S.ab)[ri(0, Object.keys(S.ab).length - 1)];
    // 較勁成癮(RIVALRY_TIER_TITLE.COMPETE.TIER2)解鎖後疊加的固定成長點數，
    // 跟 RIVAL 類型自帶的 competeGrowthBonus 是兩個不同來源，可以疊加。
    const gain = ri(COMPETE_GROWTH_POINTS[0], COMPETE_GROWTH_POINTS[1]) + (def.competeGrowthBonus || 0) + (S.competeGrowthFlatBonus || 0);
    addAbilityPoints(S, target, gain, isGK);
    log.trainingCompete = { partner: { ...S.trainingPartner }, target, gain };
  } else {
    // 更衣室的黏著劑(RIVALRY_TIER_TITLE.COOPERATE.TIER2)解鎖後疊加的固定
    // 隊伍核心力加成，跟 COMRADE 類型自帶的 cooperateChemistryBonus 同理可疊加。
    const bonus = COOPERATE_CHEMISTRY_BONUS + (def.cooperateChemistryBonus || 0) + (S.cooperateChemistryFlatBonus || 0);
    S.squadChemistry = Math.min(SQUAD_CHEMISTRY.max, (S.squadChemistry || 0) + bonus);
    log.trainingCooperate = { partner: { ...S.trainingPartner } };
  }
  return { log };
}

/* 組合函式：季初常駐階段(類別選項之前)呼叫一次即可——只處理「起點」，
   不處理 CROSSROADS(那個要等類別確認選了訓練才評估，見下面
   prepareTrainingCrossroadsChoice 的稽核說明)。定義在這裡(不是
   flow/proSeason.js 的私有邏輯)，因為青訓期(flow/careerStart.js)現在
   也要用同一套常駐階段，兩邊 import 同一份，不要各寫一份容易兜不起來。 */
export function prepareTrainingChoice(S, ri, chance) {
  const ambient = runTrainingRivalryAmbient(S, ri, chance);
  const pending = S.trainingPartner ? null : evaluateTrainingEncounter(S, ri, chance);
  return { ambientLog: ambient.log, pending };
}

export function resolveTrainingChoiceStep(S, ri, chance, ambientLog, pending, choice) {
  if (!pending) return ambientLog;
  const resolvedLog = resolveTrainingEncounter(S, pending, choice ?? pending.recommend);
  return { ...ambientLog, ...resolvedLog };
}

/* CROSSROADS 版的 prepare/resolve——呼叫時機在「玩家確定選了訓練類別+
   子選項+風險層之後、這季正式套用選項效果之前」，不是季初常駐階段
   (見檔案開頭稽核說明)。呼叫端(flow/proSeason.js proSeasonTick、
   flow/careerStart.js runYouthToDebut、web/src/App.jsx handleProPick/
   handleYouthPick)都在同一個時間點呼叫這組函式，category 由呼叫端
   傳入(這個函式本身不知道玩家選了什麼，只負責「如果是訓練類別，
   評估要不要問」)。 */
export function prepareTrainingCrossroadsChoice(S, category, chance) {
  if (category !== 'TRAINING') return { pending: null };
  return { pending: evaluateTrainingRivalryMoment(S, chance) };
}

export function resolveTrainingCrossroadsChoiceStep(S, ri, chance, pending, choice) {
  if (!pending) return {};
  return resolveTrainingRivalryMoment(S, ri, chance, choice ?? pending.recommend).log;
}

/* 羈絆時刻：訓練夥伴線這次審視抓出來的缺口——CROSSROADS 是唯一機制、
   還可以無限重複，沒有戀愛線求婚/婚禮那種一次性、有份量的高潮節點。
   使用者定案：夥伴關係第一次滿 BOND_MOMENT_YEARS_THRESHOLD 年、且這季
   真的選了訓練類別時，自動評估一次——不是玩家選擇(命運安排的高潮時刻，
   跟 CROSSROADS 的主動選擇不同)，真的有輸有贏(不像 CROSSROADS 保證
   成功)。用 >= 不用 ===：S.trainingPartner.years 每季 ambient 都會遞增
   (不看類別)，如果滿門檻那季剛好沒選訓練，years 會繼續往上跳，用 ===
   會讓這個機會永遠錯過；用 >= 配合 bondFired 旗標，之後任何一季選了
   訓練都還能補上這次評估，只會發生一次。
   終身這段關係只有這一次機會——bondFired 掛在夥伴物件本身(見
   resolveTrainingEncounter)，換新夥伴後自然歸零，不是硬性卡死沒有
   第二次機會。呼叫端(flow/proSeason.js proSeasonTick、flow/youthChoice.js
   applyYouthChoice、web/src/App.jsx finishProPick/finishYouthPick)緊接
   在 CROSSROADS 的 resolve 之後、resolveSeasonChoice/resolveYouthYear
   之前呼叫，不需要額外的暫停點(沒有玩家選擇要問)，headless/UI 兩邊都
   在同一個相對位置無條件呼叫，不會有 RNG 消耗不一致的風險。
   效果不落在個人能力/隊伍核心力上(那是 CROSSROADS 的地盤)，而是疊加
   在「所在球隊拿下杯賽/世界盃」這兩個既有機率池上(見
   data/trainingPartner.js BOND_MOMENT_HONOR 的稽核說明)——成功才給
   稱號(同一個稱號一輩子只會進 S.honors 一次，即使之後換了新夥伴又
   再成功一次，也不會重複推入)，但機率加成每次成功都會疊加，失敗
   不給負面稱號，機率永久扣半。 */
export function checkTrainingBondMoment(S, category, chance) {
  if (category !== 'TRAINING') return null;
  if (!S.trainingPartner || S.trainingPartner.bondFired) return null;
  if (S.trainingPartner.years < BOND_MOMENT_YEARS_THRESHOLD) return null;

  S.trainingPartner.bondFired = true;
  const def = BOND_MOMENT_HONOR[S.trainingPartner.type];
  const success = chance(BOND_MOMENT_SUCCESS_CHANCE);
  if (success) {
    if (!S.honors.includes(def.label)) S.honors.push(def.label);
    S.trainingBondCupBoost = Math.min(TRAINING_BOND_BOOST_CAP, (S.trainingBondCupBoost || 0) + def.effect.cupBoost);
    S.trainingBondWCBoost = Math.min(TRAINING_BOND_BOOST_CAP, (S.trainingBondWCBoost || 0) + def.effect.wcBoost);
  } else {
    S.trainingBondCupBoost = Math.max(-TRAINING_BOND_BOOST_CAP, (S.trainingBondCupBoost || 0) - def.effect.cupBoost / 2);
    S.trainingBondWCBoost = Math.max(-TRAINING_BOND_BOOST_CAP, (S.trainingBondWCBoost || 0) - def.effect.wcBoost / 2);
  }
  return { type: S.trainingPartner.type, success, partner: { name: S.trainingPartner.name, title: S.trainingPartner.title } };
}
