import { POSN, DPN, LOVE_STATUS, SQUAD_CHEMISTRY } from './engine.js';

/* PlayerHeader.jsx(固定頭部) 跟 PlayerDetail.jsx(捲動內容區的展開細節) 共用的
   算式，抽出來避免兩個元件各寫一份。這裡也是「個人資料娛樂化」那輪討論
   定案的四個欄位：教練態度/花心程度/投機娛樂指數是純敘事標籤(重用既有
   數值換個說法，不加新state)，隊伍核心力是真的有機制效果的欄位(見
   flow/shared.js squadChemistryMult)，這裡只負責它的顯示標籤。 */

/* 稽核修正(使用者實測回報)：頭部固定條這個位置很窄，薪資/存款是歐元
   實際量級(見 data/contract.js 的稽核說明，這輪貨幣重新校準之後已經是
   真的歐元金額，不是抽象指數了)，六七位數字擠在一起很難一眼看出大小。
   這裡只在頭部這個「隨時看得到但不用細看」的位置用縮寫(萬用K/百萬用
   M，數字世界通用、跟 € 符號搭配也很常見)，終局結算卡/生涯數據那些
   要看精確數字的地方(EndingCard.jsx/EndingScreen.jsx)維持原本的完整
   千分位數字，不要跟著改——兩個是不同的閱讀情境，各自該有各自的精度。 */
export function formatMoney(v) {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}

export function posLabel(S) {
  if (S.pos === 'GK') return POSN.GK;
  return S.subPosition ? DPN[S.subPosition] : POSN[S.pos];
}

/* 稽核修正(使用者反饋：想要「升聯賽=畫面變好看」的成就感)：回傳目前
   該用哪一組聯賽層級 accent 色票(見 index.css .game-shell[data-tier]
   那組定案：青訓冷灰藍→地區銅→跳板銀→五大金，銅/銀/金跟現有稱號系統
   的金色天然接軌，使用者確認過的方向)。租借期間刻意看 S.loanTier 不是
   S.tier——玩家實際在哪個層級踢球，畫面就該長那個層級的樣子，租借合約
   本身不影響「東家」的 S.tier，但畫面體感要跟著人走，不是跟著合約走。
   S.tier 還沒指派(青訓期、或極少數的過渡狀態)一律落在 youth，跟
   stageLabel() 的「業餘」保底邏輯同一個精神：沒有更明確的層級資訊時，
   不亂猜一個聯賽等級出來。 */
export function tierAccentKey(S) {
  if (S.stage === 'YOUTH') return 'youth';
  const effectiveTier = S.onLoan && S.loanTier ? S.loanTier : S.tier;
  if (effectiveTier === 'TOP5') return 'top5';
  if (effectiveTier === 'FEEDER') return 'feeder';
  if (effectiveTier === 'LOCAL') return 'local';
  return 'youth';
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
