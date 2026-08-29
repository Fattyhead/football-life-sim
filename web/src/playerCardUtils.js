import { POSN, DPN, LOVE_STATUS, SQUAD_CHEMISTRY } from './engine.js';

/* PlayerHeader.jsx(固定頭部) 跟 PlayerDetail.jsx(捲動內容區的展開細節) 共用的
   算式，抽出來避免兩個元件各寫一份。這裡也是「個人資料娛樂化」那輪討論
   定案的四個欄位：教練態度/花心程度/投機娛樂指數是純敘事標籤(重用既有
   數值換個說法，不加新state)，隊伍核心力是真的有機制效果的欄位(見
   flow/shared.js squadChemistryMult)，這裡只負責它的顯示標籤。 */

export function posLabel(S) {
  if (S.pos === 'GK') return POSN.GK;
  return S.subPosition ? DPN[S.subPosition] : POSN[S.pos];
}

export function careerTotals(S) {
  const all = [...(S.stats.LOCAL || []), ...(S.stats.FEEDER || []), ...(S.stats.TOP5 || [])];
  if (all.length === 0) return null;
  const sum = (key) => all.reduce((a, s) => a + s[key], 0);
  const ratAvg = Math.round((sum('RAT') / all.length) * 10) / 10;
  return S.pos === 'GK'
    ? { seasons: all.length, APP: sum('APP'), SV: sum('SV'), CS: sum('CS'), GA: sum('GA'), RAT: ratAvg }
    : { seasons: all.length, APP: sum('APP'), GLS: sum('GLS'), AST: sum('AST'), RAT: ratAvg };
}

/* 配偶／交往對象：S.love.partner 只在 DATING/MARRIED 才有值，SINGLE/DIVORCED
   時是 null——沒有對象就不顯示這一行，不要硬擠一個「無」進畫面。 */
export function partnerInfo(S) {
  const { st, partner } = S.love;
  if (!partner || (st !== LOVE_STATUS.DATING && st !== LOVE_STATUS.MARRIED)) return null;
  const statusLabel = st === LOVE_STATUS.MARRIED ? '配偶' : '交往對象';
  return `${statusLabel}：${partner.name}（${partner.title}）`;
}

/* 花心程度：重用 S.love.affairs(生涯累積出軌次數，PLAYBOY_STAR 稱號也是
   看這個門檻)換個說法顯示——這個數字現在不只是顯示用，也會真的回饋進
   下次出軌誘惑的觸發機率(見 data/love.js AFFAIR.repeatFactor)，這個標籤
   本身還是純讀取，不用額外算，但底下的數字已經不是「純標籤無機制」了。 */
export function fidelityLabel(S) {
  const affairs = S.love.affairs || 0;
  if (affairs === 0) return '忠誠可靠';
  if (affairs < 3) return '偶爾心猿意馬';
  return '花名在外';
}

/* 教練態度：重用 S.poorFormStreak(降級判定也是看這個)換個說法顯示——
   對照 flow/transfer.js checkDemotion 的門檻，streak>=2 降級風險才會真的
   開始骰，這裡的標籤刻意在同一個點上轉為警訊，讓玩家在數字影響到轉會/
   合約之前就先看得到風向要轉了。純標籤，不額外影響降級機率。 */
export function coachAttitudeLabel(S) {
  const streak = S.poorFormStreak || 0;
  if (streak === 0) return '教練信任你';
  if (streak === 1) return '教練持續關注你的狀態';
  if (streak === 2) return '教練已經開始不耐煩';
  return '教練的耐心所剩無幾';
}

/* 投機娛樂指數：財富線的話題性標籤，重用既有的 investWins/everBlewItAll/
   ownsClub，不疊加額外數值效果(避免跟已經校準過的 WEALTH_HONOR 打架)。 */
export function speculationBuzzLabel(S) {
  if (S.ownsClub) return '橫跨球場與商界的話題人物';
  if (S.everBlewItAll) return '曾經一夜歸零的傳奇話題';
  if ((S.investWins || 0) >= 3) return '偶爾成為財經話題';
  return '低調理財，鮮少上頭條';
}

/* 隊伍核心力：真的有機制效果的欄位(見 flow/shared.js squadChemistryMult)，
   門檻對齊 data/career.js SQUAD_CHEMISTRY 的 low/highThreshold，標籤跟機制
   讀同一組數字，不會出現「標籤說磨合中，但其實已經吃到加成」這種不一致。 */
export function chemistryLabel(S) {
  const v = S.squadChemistry || 0;
  if (v < SQUAD_CHEMISTRY.lowThreshold) return '還在磨合';
  if (v >= SQUAD_CHEMISTRY.highThreshold) return '情同手足';
  return '漸入佳境';
}
