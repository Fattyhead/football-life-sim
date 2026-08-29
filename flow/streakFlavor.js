/* ---------- 隱晦線索：風險層/委身特質的累積次數提示 ---------- */
/* 使用者定案：稱號門檻(見 data/growth.js RISK_TIER_TITLE/data/mastery.js
   TRAINING_MASTERY 等)不該讓玩家一眼看穿數字——「你那個真的倒退了...
   玩家不需要知道吧」「不要這麼明顯哈 隱晦點」，改成依累積次數換不同
   語氣的句子，不提名字、不提數字，只在氣氛上暗示「這已經變成一種模式
   了」，越接近解鎖語氣越重。跟主敘事(flow/narrate.js narrateSeason 的
   單句)分開顯示，是額外的一條線索文字，不搶主線——UI 在風險層/委身
   特質結算時各自呼叫一次這裡的函式。文字內容跟門檻/分桶邏輯照抄
   season_screen_prototype.html mockup 已經定案、使用者驗收過的版本，
   不重寫。 */

import { RISK_TIER_TITLE } from '../data/growth.js';
import { TRAINING_MASTERY, OPPORTUNITY_MASTERY, SOCIAL_MASTERY } from '../data/mastery.js';

/* count 是目前累積次數，thresholds 是這條線的稱號門檻(由小到大)，pool 是
   { low, mid, high } 三桶文字。距離下一個門檻越近，桶越「重」：剩2次以內
   用 high，剩5次以內用 mid，再遠用 low(但 count<=1 時完全不給提示，太早
   暗示反而顯得刻意)。已經拿到最高檔(沒有下一個門檻)回傳空字串，不用再
   暗示。用 (count+nextThreshold) 取模決定挑池子裡哪一句，避免每次都固定
   講同一句。 */
function computeStreakFlavor(count, thresholds, pool) {
  const nextThreshold = thresholds.find((t) => t > count);
  if (!nextThreshold) return '';
  const remaining = nextThreshold - count;
  const bucket = remaining <= 2 ? 'high' : remaining <= 5 ? 'mid' : count <= 1 ? null : 'low';
  if (!bucket) return '';
  const lines = pool[bucket];
  return lines[(count + nextThreshold) % lines.length];
}

const RISK_STREAK_FLAVOR = {
  SAFE: {
    low: ['你這幾次又選了最穩的那條路。', '教練這幾次都對你的訓練節奏點頭。'],
    mid: ['隊友開始打趣，說你比誰都謹慎。', '「穩」這個字，好像已經黏在你身上了。'],
    high: ['更衣室裡，已經有人開始模仿你這種打法。', '這種滴水不漏的堅持，已經不太像巧合了。'],
  },
  AGGRESSIVE: {
    low: ['又一次的頭鐵嘗試。', '你沒有猶豫，直接選了最猛的那條路。'],
    mid: ['教練已經開始念你別老是賭這麼大。', '隊友都說，你是真的不怕輸。'],
    high: ['這股衝勁，連隨隊記者都開始留意了。', '你的名字，已經開始跟「賭一把」畫上等號。'],
  },
};

/* 風險層(穩健/冒進)的隱晦線索——BALANCED(平衡)沒有專屬稱號(見
   RISK_TIER_TITLE)，這裡也就沒有對應的文字池，呼叫時回傳空字串。 */
export function computeRiskStreakFlavor(S, tierKey) {
  const table = RISK_TIER_TITLE[tierKey];
  const pool = RISK_STREAK_FLAVOR[tierKey];
  if (!table || !pool) return '';
  const thresholds = [table.TIER1.threshold, table.TIER2.threshold];
  const count = S.riskTierPickCount[tierKey] || 0;
  return computeStreakFlavor(count, thresholds, pool);
}

const CATEGORY_STREAK_FLAVOR = {
  TRAINING: {
    low: ['你這幾週幾乎沒缺過訓練場。', '教練開始記得你固定報到的時間。'],
    mid: ['隊醫都說，你的訓練量已經超出一般球員的標準。', '「認真」這兩個字，隊友已經懶得再誇你了——你早就是這樣。'],
    high: ['訓練場的燈光，你比清潔工還熟。', '這種紀律，已經不是「認真」能形容的了。'],
  },
  OPPORTUNITY: {
    low: ['你又跟球探圈的人喝了杯咖啡。', '你的名片夾，又厚了一點。'],
    mid: ['圈內開始流傳，你認識的人比你的隊友還多。', '每次轉會窗，總有人第一個想到聯絡你。'],
    high: ['整個聯盟的人脈網，你已經摸得一清二楚。', '沒有人比你更清楚這個行業的錢怎麼流動。'],
  },
  SOCIAL: {
    low: ['更衣室裡，你又是那個被大家圍著聊天的人。', '隊友都愛找你一起打發時間。'],
    mid: ['媒體開始注意到，你的社交行程排得比訓練還滿。', '私底下，已經有人這樣叫你了。'],
    high: ['你的社交生活，已經自成一個話題。', '這種受歡迎程度，連經紀公司都得認真看待。'],
  },
};

const MASTERY_BY_CATEGORY = { TRAINING: TRAINING_MASTERY, OPPORTUNITY: OPPORTUNITY_MASTERY, SOCIAL: SOCIAL_MASTERY };

/* 三類別委身特質(訓練/機會/社交累積8/16次)的隱晦線索。 */
export function computeCategoryStreakFlavor(S, category) {
  const mastery = MASTERY_BY_CATEGORY[category];
  const pool = CATEGORY_STREAK_FLAVOR[category];
  if (!mastery || !pool) return '';
  const thresholds = [mastery.TIER1.threshold, mastery.TIER2.threshold];
  const count = S.categoryPickCount[category] || 0;
  return computeStreakFlavor(count, thresholds, pool);
}

/* 積極操盤(INVEST_AGGRESSIVE)連賺/連賠的隱晦線索——這條線沒有對應的
   稱號/門檻(不像風險層/委身特質那樣有明確 threshold 可以算「還差幾次」)，
   純粹是氣氛提示，不掛任何機制效果，跟 computeStreakFlavor() 的「越接近
   門檻語氣越重」邏輯不同，這裡改成單純依連續次數長度分桶(2次=low、
   3-4次=mid、5次以上=high)，長度為1不給提示(太早暗示顯得刻意，跟其他
   隱晦線索同一個判斷)。S.investStreak 正數代表連賺、負數代表連賠(見
   flow/yearlyChoice.js applyInvestment)。 */
const INVEST_STREAK_FLAVOR = {
  win: {
    low: ['這次操盤，手氣似乎不錯。', '存款簿上，又多了一筆漂亮的數字。'],
    mid: ['連續幾次出手都精準得不像運氣。', '身邊開始有人向你打聽「怎麼挑的」。'],
    high: ['這種連勝，已經不太像單純的運氣了。', '你的操盤紀錄，開始有人認真研究起來。'],
  },
  loss: {
    low: ['這次的賭注，沒能如願。', '存款簿上，又少了一筆。'],
    mid: ['連續幾次出手都不太順。', '朋友開始委婉勸你「要不要休息一下」。'],
    high: ['這種連敗，賭性堅強四個字已經不夠形容了。', '存款簿越來越薄，你卻還沒想停手。'],
  },
};
export function computeInvestStreakFlavor(S) {
  const streak = S.investStreak || 0;
  const magnitude = Math.abs(streak);
  if (magnitude <= 1) return '';
  const pool = INVEST_STREAK_FLAVOR[streak > 0 ? 'win' : 'loss'];
  const bucket = magnitude <= 2 ? 'low' : magnitude <= 4 ? 'mid' : 'high';
  const lines = pool[bucket];
  return lines[magnitude % lines.length];
}

/* 求婚/出軌誘惑的隱晦線索——比照上面 INVEST_STREAK_FLAVOR 的手法(純氣氛
   提示，不掛任何機制效果，也不是「累積次數」那種門檻分桶)，這裡直接把
   flow/romance.js 算出來的原始機率(rejectChance/discoverChance，玩家看
   不到這兩個數字本身)分桶挑一句對應語氣的文字。跟風險層(小心翼翼/
   走在鋼索上的男人等)那組「顯示明確%數」的做法刻意不同——戀愛本來就
   不該是精算遊戲，只給感覺，不給數字，跟這兩個抉擇本身「氣氛式」的
   文案風格(見 web/src/components/LoveChoice.jsx)一致。 */
const PROPOSE_RISK_FLAVOR = {
  stable: ['你們感情基礎穩固，這次應該不會有意外。', '這段感情走到這裡，你心裡其實很篤定。', '這種默契，不太可能被一句話打破。'],
  uncertain: ['說不準對方會怎麼回答，但你決定賭一把。', '感覺應該沒問題，但誰也不敢打包票。'],
  risky: ['老實說，你們認識的時間還不長，這次會不會答應，你自己心裡也沒底。', '這段感情還很新，貿然開口，多少有點冒險。', '你心裡清楚，這次不見得會如你所願。'],
};
export function computeProposeRiskFlavor(rejectChance) {
  if (rejectChance == null) return '';
  const bucket = rejectChance < 0.08 ? 'stable' : rejectChance < 0.18 ? 'uncertain' : 'risky';
  const lines = PROPOSE_RISK_FLAVOR[bucket];
  return lines[Math.round(rejectChance * 1000) % lines.length];
}

const AFFAIR_RISK_FLAVOR = {
  normal: ['感覺應該藏得住，但誰知道呢。', '這種事，運氣占了很大成分。'],
  elevated: ['你已經不是第一次了——這次要是被抓，恐怕很難善了。', '風聲比你想像的更容易走漏，尤其是現在的你。'],
};
export function computeAffairRiskFlavor(discoverChance) {
  if (discoverChance == null) return '';
  const bucket = discoverChance > 0.4 ? 'elevated' : 'normal';
  const lines = AFFAIR_RISK_FLAVOR[bucket];
  return lines[Math.round(discoverChance * 1000) % lines.length];
}

/* 訓練夥伴/對手 CROSSROADS(較勁/合作)的隱晦線索——跟上面兩個不同的是，
   這個抉擇沒有「求婚被拒/出軌被抓」那種隱藏機率可以分桶(compete/
   cooperate 的效果是決定性的，不是骰出來的，見 flow/trainingRivalry.js
   resolveTrainingRivalryMoment)，這裡改成依對手類型(RIVAL 較勁感重，
   COMRADE 較溫和，見 data/trainingPartner.js frictionMult)給氣氛提示，
   用 S.trainingPartner.years 決定挑池子裡哪一句(不消耗 RNG，跟其他
   隱晦線索同一個「純氣氛」原則)。 */
const RIVALRY_RISK_FLAVOR = {
  RIVAL: ['你們倆的較勁勁頭壓都壓不住，這次的選擇份量不小。', '教練都看得出來，你們是真的憋著一股勁。', '這股競爭氣氛，已經是整支球隊都感覺得到的事。'],
  COMRADE: ['你們感情不錯，不管怎麼選，交情應該都還在。', '這段默契經營了一陣子，這次的選擇不至於傷了和氣。'],
};
export function computeRivalryRiskFlavor(S) {
  if (!S.trainingPartner) return '';
  const lines = RIVALRY_RISK_FLAVOR[S.trainingPartner.type];
  if (!lines) return '';
  return lines[(S.trainingPartner.years || 0) % lines.length];
}
