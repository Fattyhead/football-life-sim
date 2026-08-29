/* ---------- 場外稱號判定：人氣值里程碑 ---------- */
import { FAME_HONOR } from '../data/fame.js';

/* 入口：proSeasonTick 每季呼叫一次(人氣值這季的變動都結算完之後再判定)。
   三個都是「累積到門檻就永久解鎖」，不會因為人氣值後續變化而收回——
   稱號反映的是「達成過」這件事，跟 flow/badges.js 動態判定的徽章邏輯不同。 */
export function checkFameHonors(S) {
  const unlocked = [];

  if (S.popularity >= FAME_HONOR.LOCAL_CELEBRITY.popularityThreshold && !S.honors.includes(FAME_HONOR.LOCAL_CELEBRITY.label)) {
    S.honors.push(FAME_HONOR.LOCAL_CELEBRITY.label);
    S.outsideIncomeMultBonus = (S.outsideIncomeMultBonus || 0) + FAME_HONOR.LOCAL_CELEBRITY.effect.outsideIncomeMultBonus;
    unlocked.push('LOCAL_CELEBRITY');
  }

  if (S.popularity >= FAME_HONOR.MEDIA_DARLING.popularityThreshold && !S.honors.includes(FAME_HONOR.MEDIA_DARLING.label)) {
    S.honors.push(FAME_HONOR.MEDIA_DARLING.label);
    S.outsideIncomeMultBonus = (S.outsideIncomeMultBonus || 0) + FAME_HONOR.MEDIA_DARLING.effect.outsideIncomeMultBonus;
    unlocked.push('MEDIA_DARLING');
  }

  // 精英層要疊加「已解鎖至少2個其他稱號」——原意是「人氣要跟其他生涯成就
  // 疊在一起才夠格」，但實測發現單純扣掉這季新解鎖的還不夠：小有名氣(45)/
  // 社群寵兒(58)兩個門檻都比全球偶像(70)低，等衝到70分時，這兩個幾乎必然
  // 已經解鎖過了，會被自己這條人氣階梯的下兩層灌水湊數(實測 38.9% 的全球
  // 偶像解鎖，「另外2個稱號」根本就是這兩個而已，不是真的跨領域成就)。
  // 這裡把同一個場外人氣階梯的三個稱號都排除，只算階梯以外的真實成就。
  const fameLadderLabels = new Set([FAME_HONOR.LOCAL_CELEBRITY.label, FAME_HONOR.MEDIA_DARLING.label, FAME_HONOR.GLOBAL_ICON.label]);
  const otherHonorsCount = S.honors.filter((h) => !fameLadderLabels.has(h)).length;
  if (
    S.popularity >= FAME_HONOR.GLOBAL_ICON.popularityThreshold &&
    otherHonorsCount >= FAME_HONOR.GLOBAL_ICON.otherHonorsRequired &&
    !S.honors.includes(FAME_HONOR.GLOBAL_ICON.label)
  ) {
    S.honors.push(FAME_HONOR.GLOBAL_ICON.label);
    S.outsideIncomeMultBonus = (S.outsideIncomeMultBonus || 0) + FAME_HONOR.GLOBAL_ICON.effect.outsideIncomeMultBonus;
    unlocked.push('GLOBAL_ICON');
  }

  return unlocked;
}
