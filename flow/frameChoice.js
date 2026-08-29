/* ---------- 選擇情境包裝 ---------- */
/* 機制完全不動：還是「訓練/機會/社交」一年三選一，一次選擇，不加步驟——
   這是明確要求，不做分支小情境。這裡只負責在玩家(或 headless 隨機)做選擇
   之前，先生一句情境話，讓每年的選單讀起來不一樣。三個軸：
     年齡(離起衰年齡多遠)、所在隊伍/層級、身體狀態(有沒有傷)，
   加上「跟上一年連貫」——這句話要看得出跟前一年發生的事有關係，
   不是每年獨立生成、讀起來互不相干的隨機語句。

   這裡呼叫時機在 proSeasonTick 把年齡+1之前，所以年齡要用 S.age+1
   (這季實際會過的歲數)，不能直接讀 S.age，不然跟同一行印出來的年份
   標題會差一歲，讀起來會覺得對不上。 */

import { DECLINE_START } from '../data/decline.js';
import { LV } from '../data/regions.js';
import { positionKey } from './shared.js';
import { wcCalendarContext } from './context.js';

/* 每個年齡帶原本是單一固定句，同一帶通常橫跨好幾季(當打之年可能連續
   踩10季)，沒有 continuity 可用的平淡年份裡，這句話會逐字重複到玩家
   看得出來——實測讀story.js輸出抓到的真問題，改成每帶一組同義變化，
   用 ri 隨機挑，跟 TRANSITION_LINES 同一種修法。 */
function ageClause(age, declineStart, ri) {
  const pool =
    age < 19
      ? [`${age}歲的你還是隊上最年輕的面孔`, `${age}歲，你在更衣室裡還是資淺的那個`, `${age}歲，隊友都還把你當弟弟妹妹看待`]
      : age < declineStart
        ? [`${age}歲，正是當打之年`, `${age}歲，狀態正處在生涯的高點`, `${age}歲的你，是隊上最穩定的存在之一`]
        : age < declineStart + 4
          ? [`${age}歲，身體開始有點跟不上腦子的想法`, `${age}歲，你得比以前更花心思保養身體`, `${age}歲，狀態偶爾起伏，但你還在適應`]
          : [`${age}歲，你比更衣室裡大多數人都資深`, `${age}歲，年輕隊友都喊你一聲前輩`, `${age}歲，你早就是更衣室裡的定海神針`];
  return pool[ri(0, pool.length - 1)];
}

/* 身體狀態只在「剛好跨過門檻」那一年提一次，不是連續好幾季的狀態都講——
   不然無傷連續達標一路 3、4、5...季，每年都講「難得穩定」會變成常態標語，
   反而失去「值得一提」的意義。有傷勢在身則沒有這個問題，傷勢本身就是
   有變化的事件(受傷/痊癒才會觸發，不會像 streak 一樣一直累加)。 */
function bodyClause(S) {
  if (S.injury.tier) return '帶著還沒完全好的傷勢';
  if (S.injuryFreeStreak === 3) return '這幾年身體狀態難得地穩定';
  return null;
}

/* 跟上一年連貫：讀上一季的 log，挑一件事延續到這一年的開場白裡。
   沒有 prevLog(第一年)或上一年沒什麼特別的，就回傳 null，讓年齡狀態頂上去，
   不會硬湊一句空話。 */
function continuityClause(prevLog) {
  if (!prevLog) return null;
  if (prevLog.retired) return null;
  if (prevLog.promotion) return `升上${LV[prevLog.promotion.to].label}後的第一年，一切都還在適應`;
  if (prevLog.newInjury === 'MAJOR') return '去年那場大傷的陰影還沒完全散去';
  if (prevLog.worldCup) return '世界盃的餘溫還沒退';
  // 戀愛系統改成每季自動判定之後，這三個欄位搬到 log.love(見
  // flow/romance.js 的稽核說明)，不再掛在 log.yearlyChoice 底下。
  if (prevLog.love?.married) return '新婚的生活還在磨合';
  if (prevLog.love?.newKid) return '家裡多了新成員，生活步調完全不同';
  if (prevLog.love?.divorced) return '剛結束一段婚姻，心裡還有點亂';
  if (prevLog.loanedTo) return '租借生活才剛開始，一切都很陌生';
  if (prevLog.unlockedPlayingStyle?.length) return '踢法定型後，外界對你的期待也跟著提高';
  return null;
}

/* 世界盃日曆：這句話直接對應 yearlyOptions.js 裡 WC_TAPER/WC_AUDITION/
   SQUAD_BONDING 這幾個只在特定日曆窗口才會出現的選項——沒有這句提示，
   玩家會看不懂「機會/社交選項今年怎麼多了一個平常沒有的按鈕」。 */
function wcClause(context) {
  if (context === 'PRE_WC_YEAR') return '明年就是世界盃，教練組已經開始物色人選';
  if (context === 'WC_YEAR') return '今年正是世界盃年，怎麼分配體力是個難題';
  return null;
}

/* 收尾語不再是固定的「新的一季開始了」，隨機挑一句同義變化——這句話
   本身沒有資訊量，純粹是接續選單的過場，但過場也不該27年一字不改。
   原本只有4句，一輪20幾季的生涯平均每句要repeat5-6次，池子加大到8句
   降低看得出重複的機率。 */
const TRANSITION_LINES = [
  '你得決定這一年要怎麼過',
  '下一步怎麼走，你自己決定',
  '新的賽季在等你',
  '教練跟經紀人都在等你的答案',
  '新的一年，新的選擇擺在你面前',
  '球季即將開打，你得先想清楚方向',
  '該把時間花在哪，決定權在你手上',
  '又是一個需要做出取捨的球季',
];

/* 入口：這季選擇開始前的情境句。prevLog 是上一季 proSeasonTick 回傳的 log
   (第一年傳 null)。回傳的句子接在選單前面，不是取代選單，機制不變。
   ri 用來挑收尾語的變化，跟遊戲其他判定共用同一份種子亂數。 */
export function frameChoice(S, prevLog, ri) {
  const age = S.age + 1; // 這季實際會過的歲數，對齊外層印出來的年份標題
  const declineStart = DECLINE_START[positionKey(S)] + (S.declineStartBonus || 0);
  const continuity = continuityClause(prevLog);
  const body = bodyClause(S);
  const wc = wcClause(wcCalendarContext(S));
  const parts = [`在${S.club}，${continuity || ageClause(age, declineStart, ri)}`];
  if (body) parts.push(body);
  if (wc) parts.push(wc);
  parts.push(TRANSITION_LINES[ri(0, TRANSITION_LINES.length - 1)]);
  return parts.join('，') + '。';
}
