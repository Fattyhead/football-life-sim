/* ---------- 精英層稱號判定 ---------- */
/* 跟 flow/playingStyle.js 分開放，因為這幾個要跨季讀取 S.clubTally/
   S.everWonClubTitle/S.traits 這些累積狀態，不是單季 stat 門檻就能判定——
   精英層刻意要求疊多個條件，對得起「稀有中的稀有」這個份量感。 */

import { PLAYING_STYLE } from '../data/traits.js';
import { clubPrestigeOf } from './shared.js';
import { clamp } from '../core/rng.js';

/* 跟 flow/playingStyle.js applyEffect() 同一套欄位語意，這裡只是獨立一份
   避免精英層的判定函式反過來依賴 playingStyle.js(職責分開，兩邊各自處理
   自己那幾個稱號)。 */
function applyEffect(S, effect) {
  if (effect.ability) {
    for (const [k, v] of Object.entries(effect.ability)) {
      if (S.ab[k] !== undefined) S.ab[k] = clamp(S.ab[k] + v, 1, 85);
    }
  }
  if (effect.wagePremium) S.wagePremiumBonus += effect.wagePremium;
  if (effect.retireCapDelay) S.retireCapBonus += effect.retireCapDelay;
  if (effect.popularityBonus) S.popularity += effect.popularityBonus;
}

function hasEliteClub(S) {
  return Object.keys(S.clubTally.TOP5 || {}).some((name) => clubPrestigeOf(name) === 'ELITE');
}

/* GRANDMASTER／CLUB_LEGEND：不吃這季 stat，純看累積狀態，每季呼叫一次即可。 */
export function checkEliteMilestones(S) {
  const unlocked = [];

  if (
    !S.traits.playingStyle.includes('GRANDMASTER') &&
    hasEliteClub(S) &&
    S.everWonClubTitle &&
    S.traits.playingStyle.length >= 1
  ) {
    S.traits.playingStyle.push('GRANDMASTER');
    S.honors.push(PLAYING_STYLE.GRANDMASTER.label);
    applyEffect(S, PLAYING_STYLE.GRANDMASTER.effect);
    unlocked.push('GRANDMASTER');
  }

  const seasonsAtCurrentClub = (S.clubTally[S.tier] && S.clubTally[S.tier][S.club]) || 0;
  if (
    !S.traits.playingStyle.includes('CLUB_LEGEND') &&
    seasonsAtCurrentClub >= PLAYING_STYLE.CLUB_LEGEND.seasonsAtClubThreshold &&
    S.everWonClubTitle
  ) {
    S.traits.playingStyle.push('CLUB_LEGEND');
    S.honors.push(PLAYING_STYLE.CLUB_LEGEND.label);
    applyEffect(S, PLAYING_STYLE.CLUB_LEGEND.effect);
    unlocked.push('CLUB_LEGEND');
  }

  return unlocked;
}

/* BALLON_DOR：要同時看「這季個人表現」跟「這季球隊有沒有捧盃」，兩個都是
   proSeasonTick 這一輪才算出來的當季值，所以獨立呼叫，不跟上面兩個共用
   入口——呼叫時機要在 checkClubCup() 之後。個人表現用 RAT(通用跨位置的
   球季評分，跟 transfer.js/clubCup.js 判定用同一把尺)當門檻，不用另外
   重寫一套位置別的 stat 判定。 */
// 數字跟著 RAT 公式重算校準(見 flow/proSeason.js generateSeasonStats 的
// 稽核說明)：反推舊門檻(9.0)對應的 effOVR≈64，代入新公式算出等值新
// 門檻 7.6。
export function checkBallonDor(S, stat, clubCupResult) {
  if (stat.RAT < 7.6) return null;
  if (clubCupResult?.round !== 'CHAMPION') return null;

  // 稽核抓出來的斷點修正：這個條件符合，代表現實裡的「拿下一座金球獎」，
  // 應該每次都算——原本用 S.traits.playingStyle.includes 擋掉重複觸發，
  // 導致累積計數(球王要用，見 data/traits.js GOAT 的稽核說明)永遠停在
  // 0 或 1，跟現實梅西C羅可以拿好幾座金球獎的直覺不符。稱號本身(第一次
  // 才有的完整敘事+能力加成)還是維持一次性，但底層條件符合就要讓
  // trophyCount 累加，不受稱號有沒有拿過影響。
  S.trophyCount.ballonDor = (S.trophyCount.ballonDor || 0) + 1;

  const firstTime = !S.traits.playingStyle.includes('BALLON_DOR');
  if (!firstTime) return 'BALLON_DOR_REPEAT';

  S.traits.playingStyle.push('BALLON_DOR');
  S.honors.push(PLAYING_STYLE.BALLON_DOR.label);
  applyEffect(S, PLAYING_STYLE.BALLON_DOR.effect);
  // 一次性能力加成給「當季最強項」，不是固定寫死哪一項——呼應這個稱號
  // 本來就是表彰「這一季你是最好的」，不是某個位置的專屬招牌。
  const bestKey = Object.entries(S.ab).sort((a, b) => b[1] - a[1])[0][0];
  S.ab[bestKey] = clamp(S.ab[bestKey] + 3, 1, 85);
  return 'BALLON_DOR';
}

/* 金靴獎：跟 checkBallonDor 同一種「一次性稱號+累積計數」雙軌寫法，見
   data/traits.js GOLDEN_BOOT 的稽核說明。門檻只看這季 GLS，不看球隊
   戰績(跟金球獎不同——現實金靴獎本來就不要求奪冠，是純個人射手數據的
   榮譽，這裡刻意不加隊伍條件，兩個稱號的觸發邏輯該不一樣)。 */
export function checkGoldenBoot(S, stat) {
  // 稽核抓出來的斷點：門檻原本抓18球，實測3000種子只觸發15次——GLS
  // 只吃單一能力值(SHO)且有位置權重(見 proSeason.js GOAL_W，ST才0.5，
  // 其餘位置更低)，跟 RAT(綜合多項能力平均)是完全不同的難度曲線，18球
  // 已經接近 ST 滿潛力訓練下的理論天花板(約21球)，等於只有近乎完美的
  // SHO 專精 ST 才碰得到，跟金球獎(6413次/3000)的稀有度差了兩個數量級。
  // 下修到10球，重新掃描校準過。
  if (stat.GLS < 10) return null;

  S.trophyCount.goldenBoot = (S.trophyCount.goldenBoot || 0) + 1;

  const firstTime = !S.traits.playingStyle.includes('GOLDEN_BOOT');
  if (!firstTime) return 'GOLDEN_BOOT_REPEAT';

  S.traits.playingStyle.push('GOLDEN_BOOT');
  S.honors.push(PLAYING_STYLE.GOLDEN_BOOT.label);
  applyEffect(S, PLAYING_STYLE.GOLDEN_BOOT.effect);
  return 'GOLDEN_BOOT';
}

/* 球王：累積戰績(金球獎+金靴獎+俱樂部冠軍+世界盃冠軍座數合計)達到門檻
   才解鎖，見 data/traits.js GOAT 的稽核說明——每季呼叫一次即可，純看
   累積狀態，不吃這季的 stat。 */
export function checkGoatHonor(S) {
  if (S.traits.playingStyle.includes('GOAT')) return null;
  const total =
    (S.trophyCount.ballonDor || 0) + (S.trophyCount.goldenBoot || 0) + (S.trophyCount.clubTitles || 0) + (S.trophyCount.wcTitles || 0);
  // 稽核抓出來的斷點：門檻原本抓10座，實測3000種子觸發363次(12.1%的
  // 生涯)，對「封頂認證」來說太寬鬆——clubTitles 只要待在一支好球隊
  // 打得夠久，一輩子疊出好幾座俱樂部冠軍不算稀奇，加上金球獎本身就有
  // 兩位數的平均觸發率，10座這個合計數比預期容易湊到。上修到25，重新
  // 掃描校準過。
  if (total < 25) return null;

  S.traits.playingStyle.push('GOAT');
  S.honors.push(PLAYING_STYLE.GOAT.label);
  applyEffect(S, PLAYING_STYLE.GOAT.effect);
  return 'GOAT';
}
