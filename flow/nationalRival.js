/* ---------- 國家隊隱藏對手引擎 ---------- */
/* 對照 data/nationalRival.js 開頭的稽核說明：起點卡在真的入選國家隊，
   之後每屆世界盃的戰績比較是常駐判定，收尾疊加在世界盃奪冠事件上，
   CROSSROADS(個人表現/團隊優先)補齊跟戀愛線/訓練線一致的完整度(玩家
   抉擇/機制效果/專屬稱號/UI 都要有)。evaluateRivalCrossroads/
   resolveRivalCrossroads 這組兩階段寫法，跟 flow/romance.js
   evaluateLoveChoiceMoment/resolveLoveChoiceMoment、
   flow/trainingRivalry.js evaluateTrainingRivalryMoment/
   resolveTrainingRivalryMoment 同一套架構、同一個呼叫時機(季初常駐
   階段，見 flow/proSeason.js prepareRivalChoice/resolveRivalChoiceStep)，
   但 checkWorldCupWindow(flow/worldCup.js)真正判定世界盃結果是在同一季
   稍後才發生——所以這裡的選擇結果先暫存在 S.wcRivalChoice，等
   checkWorldCupWindow 讀取+清空、套用真正的效果。 */

import {
  NATIONAL_RIVAL_NAME_POOL,
  RIVAL_COMPARISON_BASE_CHANCE,
  RIVAL_COMPARISON_ROUND_FACTOR,
  RIVAL_CROSSROADS_TRIGGER_CHANCE,
  RIVAL_TEAMFOCUS_READINESS_BONUS,
  TRAINING_RIVAL_CROSSOVER_CHANCE,
  TRAINING_COMRADE_SELECTED_CHANCE,
  PARTNER_ALSO_SELECTED_READINESS_BONUS,
} from '../data/nationalRival.js';
import { WC_ROUND_ORDER } from '../data/national.js';

/* 第一次入選國家隊(S.national.caps 從0變1)才會指派——沒入選過，這條線
   不存在，呼叫端(flow/worldCup.js checkWorldCupWindow)在確定入選之後、
   caps 遞增之後呼叫。已經有對手就不重複指派。
   訓練夥伴線交叉(見 data/nationalRival.js 開頭的稽核說明)：這時候如果
   正好有一位 RIVAL 型的訓練對手，有機率就是他一起入選，直接沿用同一個
   名字，不重新抽——比隨機分配一個素不相識的新面孔更有連貫感。
   COMRADE 型夥伴或沒骰中，都退回原本隨機指派的邏輯。fromClub 旗標純粹
   給 narrate.js 判斷要不要用專屬文案，不影響 aheadCount/behindCount/
   CROSSROADS 等既有邏輯(那些都只看 S.nationalRival.name，不管名字是
   哪裡來的)。 */
export function assignNationalRivalIfFirstCap(S, ri, chance) {
  if (S.nationalRival || S.national.caps !== 1) return null;
  const fromClub = S.trainingPartner?.type === 'RIVAL' && chance(TRAINING_RIVAL_CROSSOVER_CHANCE);
  const name = fromClub ? S.trainingPartner.name : NATIONAL_RIVAL_NAME_POOL[ri(0, NATIONAL_RIVAL_NAME_POOL.length - 1)];
  S.nationalRival = { name, aheadCount: 0, behindCount: 0, fromClub: !!fromClub };
  return S.nationalRival;
}

/* 訓練夥伴線交叉的另一半：COMRADE 型夥伴有機率跟玩家一起入選這屆國家隊
   ——不需要先有 S.nationalRival，這條不是「對手」線的專利，純粹是「你的
   老搭檔也上場了」的溫馨版本，每屆世界盃窗口都會重新評估(不是一次性)，
   跟訓練夥伴/對手線本身的存續無關(換了新東家、訓練夥伴變動，這裡讀的
   是「當下」的 S.trainingPartner)。呼叫端(flow/worldCup.js
   checkWorldCupWindow)要在玩家自己確定入選之後、真正套用 readinessBoost
   之前呼叫，這樣加成才吃得到這一屆的判定。回傳 null 代表沒發生。 */
export function checkTrainingComradeSelected(S, chance) {
  if (S.trainingPartner?.type !== 'COMRADE') return null;
  if (!chance(TRAINING_COMRADE_SELECTED_CHANCE)) return null;
  S.wcReadinessBoost = (S.wcReadinessBoost || 0) + PARTNER_ALSO_SELECTED_READINESS_BONUS;
  return { name: S.trainingPartner.name };
}

/* 每屆世界盃的戰績比較：玩家這屆踢得越深，這次「領先對手」的機率越高。
   純敘事用途，不影響任何機制數值——呼應「不新造隊長機制」的定案，張力
   只透過比較結果的文字呈現，不掛任何屬性/薪資效果。回傳 'ahead'/'behind'
   或 null(還沒有對手，這屆不比較)。 */
export function compareToRival(S, chance, round) {
  if (!S.nationalRival) return null;
  const roundIdx = WC_ROUND_ORDER.indexOf(round);
  const aheadChance = Math.min(0.9, RIVAL_COMPARISON_BASE_CHANCE + roundIdx * RIVAL_COMPARISON_ROUND_FACTOR);
  const ahead = chance(aheadChance);
  if (ahead) S.nationalRival.aheadCount += 1;
  else S.nationalRival.behindCount += 1;
  return ahead ? 'ahead' : 'behind';
}

/* 世界盃奪冠時的收尾疊加段落——只在真的有對手(入選過國家隊)時才有內容，
   回傳 null 就代表這條線這輩子沒被觸發過，呼叫端(flow/worldCup.js)不用
   額外判斷。看整個對抗史(aheadCount vs behindCount)決定收尾的口吻：
   多半領先 vs 多半在追趕，兩種份量不同的收尾。 */
export function nationalRivalClimax(S) {
  if (!S.nationalRival) return null;
  const { name, aheadCount, behindCount, fromClub } = S.nationalRival;
  return { name, aheadCount, behindCount, fromClub: !!fromClub, dominant: aheadCount >= behindCount ? 'ahead' : 'behind' };
}

/* CROSSROADS：只有已經有對手、且這年真的是世界盃年(S.year % 4 === 0)
   才會評估——這裡直接用跟 flow/worldCup.js checkWorldCupWindow 完全
   相同的判斷式(不是 wcCalendarContext 那種要校正 +1 的日曆窗口)，因為
   兩邊都是在同一季、S.year 已經 +=1 之後才被呼叫，同一個時間點讀同一個
   值，不需要任何校正。機率骰(0.6)決定這季會不會真的遇到這個抉擇——
   跟出軌誘惑同一種「系統隨機」的設計語言，不是每個世界盃年都保證問到。 */
export function evaluateRivalCrossroads(S, chance) {
  if (!S.nationalRival) return null;
  if (S.year % 4 !== 0) return null;
  if (!chance(RIVAL_CROSSROADS_TRIGGER_CHANCE)) return null;
  return { type: 'RIVAL_CROSSROADS', options: { compete: true, teamFocus: true }, recommend: 'teamFocus' };
}

/* 套用玩家(或 headless 用 recommend)的選擇——這裡只暫存選擇跟套用團隊
   優先的效果(wcReadinessBoost 是持續累積到這季稍後才被消耗的資源池，
   現在加也沒問題)，個人表現的效果(這屆世界盃個人數據臨時加成)要等
   checkWorldCupWindow 真正判定比賽結果時才套用，見 flow/worldCup.js。
   S.wcRivalChoice 這個暫存欄位由 checkWorldCupWindow 負責讀取+清空。 */
export function resolveRivalCrossroads(S, choice) {
  const log = {};
  S.wcRivalChoice = choice;
  if (choice === 'compete') {
    log.rivalCompete = { name: S.nationalRival.name };
  } else {
    S.wcReadinessBoost = (S.wcReadinessBoost || 0) + RIVAL_TEAMFOCUS_READINESS_BONUS;
    log.rivalTeamFocus = { name: S.nationalRival.name };
  }
  return log;
}
