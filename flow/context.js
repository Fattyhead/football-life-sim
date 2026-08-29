/* ---------- 生涯階段／世界盃日曆判定 ---------- */
/* 給 yearlyChoice.js(篩選當季開放哪些子選項)跟 frameChoice.js(情境文字)
   共用，避免兩邊各自寫一份年齡帶/世界盃窗口判斷邏輯，兩邊對不上。
   都用 S.year+1/S.age+1 算「這季實際會過的年份/歲數」——呼叫時機在
   proSeasonTick 把年齡/年份+1之前，見 frameChoice.js 的同一個註解。 */

import { DECLINE_START } from '../data/decline.js';
import { positionKey } from './shared.js';

/* EARLY 用「進聯盟後第幾年」而不是單純看年齡——參考原版用 18 歲/進聯盟
   當分界的做法，但進聯盟後第幾年更準：LOCAL_ACADEMY 路線可能晚一點才
   轉正式，年紀不小但敘事上仍算「早期」，用絕對年齡切會誤判。
   PRIME：進聯盟滿3年後、還沒到起衰年齡。LATE：起衰後，生涯末年。 */
export function careerStage(S) {
  const yearsIntoCareer = S.year + 1 - (S.debutYear ?? S.year + 1);
  if (yearsIntoCareer < 3) return 'EARLY';
  const declineStart = DECLINE_START[positionKey(S)] + (S.declineStartBonus || 0);
  if (S.age + 1 < declineStart) return 'PRIME';
  return 'LATE';
}

/* WC_YEAR：這季就是世界盃年(對照 worldCup.js 的 S.year%4===0 判定)。
   PRE_WC_YEAR：下一季才是世界盃年，這季是備戰/組隊年。其餘回傳 null。 */
export function wcCalendarContext(S) {
  const upcomingYear = S.year + 1;
  if (upcomingYear % 4 === 0) return 'WC_YEAR';
  if ((upcomingYear + 1) % 4 === 0) return 'PRE_WC_YEAR';
  return null;
}
