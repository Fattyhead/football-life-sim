/* ---------- 俱樂部杯賽 ---------- */
/* 對照 competitions.js 的 CLUB_CUP：之前只定了資料表，從沒接進引擎——
   career.js 的 PROMOTION_SIGNAL 明明分了 0.2 權重給「杯賽」，杯賽系統
   沒接上等於那 0.2 權重憑空消失，晉級判定實際上只用了 0.8 的權重。
   這裡補上，回傳一個 0-1 的 cupSignal，跟 national(transferBuzz)、
   league(RAT) 同一個量級，交給 transfer.js 的 checkPromotion 加總。 */

import { CLUB_CUP, CUP_QUALIFY_RAT, CUP_ROUND_ORDER } from '../data/competitions.js';

/* 逐輪骰晉級，用 seasonRat 當隊伍實力代理(RAT 越高代表球隊+你狀態越好，
   杯賽走得越遠)，跟 worldCup.js 用 squadCeiling 是同一種設計邏輯，
   只是這裡沒有地區參數可用，改用個人賽季表現當唯一輸入。buzzBoost：
   已經待在豪門(ELITE)等級球隊、沒有更高處可轉會的球員，機會選項攢的
   transferBuzz(見 flow/proSeason.js)改疊加在這裡——「衝擊歐冠/俱樂部
   冠軍」才是豪門球員真正的下一個目標，不是繼續找下一支更大的球隊。 */
function runCup(seasonRat, chance, buzzBoost = 0) {
  let round = null;
  for (const r of CUP_ROUND_ORDER) {
    // base 維持原本的 0.1-0.75 區間不變(沒有 buzzBoost 時行為完全不變)，
    // buzzBoost 疊加後才允許衝到 0.85——豪門球員的額外籌碼是「加成」，
    // 不是把所有人的基準線都拉高。
    const base = Math.min(0.75, Math.max(0.1, (seasonRat - 6) / 5));
    const advanceChance = Math.min(0.85, base + buzzBoost);
    if (!chance(advanceChance)) break;
    round = r;
  }
  return round;
}

/* 入口：proSeasonTick 每季呼叫一次，沒打進正賽(RAT 不夠)回傳 null，
   不扣分——跟世界盃一樣是「有資格才有機會，沒資格不懲罰」的設計。 */
export function checkClubCup(S, chance, seasonRat, buzzBoost = 0) {
  if (seasonRat < CUP_QUALIFY_RAT) return null;
  const cup = S.tier === 'TOP5' ? CLUB_CUP.TOP5_ELITE : CLUB_CUP.REGIONAL;
  const round = runCup(seasonRat, chance, buzzBoost);
  if (!round) return { cup: cup.label, round: null, cupSignal: 0.1 }; // 打進正賽但小組/資格賽就出局，還是有一點訊號分

  const roundIdx = CUP_ROUND_ORDER.indexOf(round);
  const cupSignal = Math.min(1, (roundIdx + 1) / CUP_ROUND_ORDER.length + 0.2);
  // wonTitleWithCurrentClub 之前宣告了卻沒人寫入(實測稽核抓出來的斷點)：
  // 捧盃是「跟現在這支球隊」綁定的紀錄，換東家會歸零(見 transfer.js/loan.js
  // 的 S.club 變動處)，narrate.js/legacy.js 才有東西可以講「衛冕」。
  // everWonClubTitle 是生涯累積版，不會因換東家歸零，GRANDMASTER/CLUB_LEGEND
  // 稱號(見 flow/eliteHonors.js)要看「這輩子有沒有捧過盃」，不是「現在這支」。
  if (round === 'CHAMPION') {
    S.wonTitleWithCurrentClub = true;
    S.everWonClubTitle = true;
    // 球王的累積戰績計數(見 data/traits.js GOAT 的稽核說明)——每次真的
    // 捧盃都算一座，不像 wonTitleWithCurrentClub 會因換東家歸零。
    S.trophyCount.clubTitles = (S.trophyCount.clubTitles || 0) + 1;
  }
  return { cup: cup.label, round, cupSignal };
}
