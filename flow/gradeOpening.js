/* ---------- 開局評價 ---------- */
/* 參考 YaKyoLife 社群自建的「Seed 驗證器」——玩家投入一整輪人生前，
   會想先知道這個種子的天花板值不值得玩。原版沒有內建這個，是玩家自己
   寫工具反查的，代表這一層「種子攻略/開局評價」本身就是驅動可玩性/
   重玩動機的核心，不是可有可無的裝飾。

   評分只讀「已經存在的潛力/地區資料」，不引入新的隨機性——這是把
   newState() 骰出來的結果讀出來評分，不是另一套要調校的系統。
   同一顆種子換位置、換路徑結果不同，因為 newState() 的洗牌吃 POS_AB，
   位置不同能力欄位不同，RNG 消耗順序跟著不同——這點跟原版「同 Seed
   換守位要重新初始化」是同一個道理，我們的 core/state.js 本來就這樣做。 */

import { REGION } from '../data/regions.js';
import { PLAYSTYLE, PLAYING_STYLE } from '../data/traits.js';
import { POSN_TO_DPN } from '../data/abilities.js';

/* 門檻原本是憑感覺訂的(45/65/80)，這輪稽核用8000種子實測分數分佈後
   發現離譜偏斜——分數幾乎全部落在43-63之間(P10=43,P90=63,P99=76,
   max=87)，舊門檻把79%的種子全塞進B級，C/A/S三級加起來反而只佔
   一小撮，跟「四級制」的預期完全不成比例。改成貼著實測分佈切的
   門檻(約略對應P25/P70/P93)，讓四個字母級真的各自代表一段有意義
   的區間，不是名義上分四級、實際上只有一級在動。 */
const GRADE_THRESHOLD = [
  { min: 67, grade: 'S' },
  { min: 58, grade: 'A' },
  { min: 48, grade: 'B' },
  { min: 0, grade: 'C' },
];

/* 潛力品質分(0-40)：最高潛力越接近80分越好——這是能不能解鎖 PLAYSTYLE
   常態徽章(門檻多半落在70-75)的關鍵，潛力頂不到門檻，這條路線就走不到。 */
function potQualityScore(S) {
  const topPot = Math.max(...Object.values(S.pot));
  return Math.round(Math.max(0, Math.min(1, (topPot - 46) / (80 - 46))) * 40);
}

/* 潛力總和分(0-30)：反映整體天花板厚不厚，用能力數量正規化，
   GK 6 項跟外場 7 項的滿分基準不一樣，不能共用同一個除數。 */
function potSumScore(S) {
  const keyCount = Object.keys(S.pot).length;
  const maxPossible = keyCount * 80;
  const minPossible = keyCount * 44; // 每項至少落在平庸級距下限
  return Math.round(Math.max(0, Math.min(1, (S.potSum0 - minPossible) / (maxPossible - minPossible))) * 30);
}

/* 地區契合分(0-30)：地區起始傾向(startBonus)加分的項目，如果剛好也是
   潛力洗牌洗到高檔的項目，代表「地區優勢」跟「這顆種子的天賦」是疊加
   而不是浪費——每命中一項給 6 分，最多 30。 */
function regionSynergyScore(S) {
  const region = REGION[S.region];
  let hits = 0;
  for (const [k, v] of Object.entries(region.startBonus)) {
    if (v > 0 && (S.pot[k] ?? 0) >= 60) hits += 1;
  }
  return Math.min(30, hits * 6);
}

/* 這顆種子的潛力洗牌，撐不撐得起 traits.js 的門檻——只看「潛力天花板」
   夠不夠，不看「有沒有練到」(那要玩過才知道)，是給玩家的路線建議，
   不是保證一定拿得到。 */
function suggestedStyles(S) {
  const hits = [];
  for (const [key, def] of Object.entries(PLAYSTYLE)) {
    const meets = Object.entries(def.cond).every(([k, v]) => (S.pot[k] ?? 0) >= v);
    if (meets) hits.push(def.label);
  }
  const candidates = S.pos === 'GK' ? ['GK'] : POSN_TO_DPN[S.pos];
  for (const [key, def] of Object.entries(PLAYING_STYLE)) {
    if (def.positions === null) continue; // COMEBACK_KING 靠劇情不是潛力，不列入開局建議
    if (!def.positions.some((p) => candidates.includes(p))) continue;
    hits.push(`${def.label}(潛力可行，需要靠生涯機遇達成)`);
  }
  return hits;
}

export function gradeOpening(S) {
  const score = potQualityScore(S) + potSumScore(S) + regionSynergyScore(S);
  const grade = GRADE_THRESHOLD.find((g) => score >= g.min).grade;
  const topAbility = Object.entries(S.pot).sort((a, b) => b[1] - a[1])[0];

  return {
    grade,
    score,
    topAbility: topAbility[0],
    topPot: topAbility[1],
    potSum: S.potSum0,
    suggestedStyles: suggestedStyles(S),
  };
}

/* 使用者定案(2026-08-27)：開局評價畫面不能讓玩家一眼看穿種子好壞——
   「要讓玩家自己探索這個種子好壞，不能在起始畫面就能理解」。這輪稽核
   把 gradeOpening() 的字母級/分數重新校準過(見 project memory 第13項
   發現)，讓C/B/A/S真的各自代表有意義的一段分佈，但如果UI直接把
   「【A】85分」印出來，校準得再準也是一眼劇透，等於白做——改成跟
   flow/streakFlavor.js 同一種手法：只給模糊的氣氛文字，不提數字、
   不提字母級，玩家得自己在生涯裡感受種子強弱。真正的 grade/score
   還是回傳(gradeOpening 本身不動，供 headless debug script/story.js
   繼續顯示完整資訊)，只有真人玩的 React UI(web/src/screens/GradeScreen.jsx)
   改讀這個新函式。用 score 本身取模挑句子(不消耗 ri())，同一個種子
   每次重跑都是同一句，不是每次隨機——這是刻意的，種子既然決定性，
   顯示的文字也該決定性，不然玩家會以為畫面本身有隨機成分。 */
const OPENING_FLAVOR = {
  C: [
    '球探報告寫得很保守——普通體格，普通腳法，沒有太多驚喜。',
    '沒有人會特別記住第一次看你踢球的那個下午。',
    '一切都很平凡，包括你自己在內。',
  ],
  B: [
    '球探筆記裡打了個問號——「基本功還算紮實，看看往後怎麼發展」。',
    '教練說你「還算有點底子」，語氣裡聽不出太多期待，也聽不出失望。',
    '不算亮眼，但也不是一張白紙。',
  ],
  A: [
    '已經有幾個球探悄悄留意起你了。',
    '教練罕見地多看了你兩眼——那種眼神，隊友都懂什麼意思。',
    '「這孩子好像有點東西」，這句話開始在圈內小範圍流傳。',
  ],
  S: [
    '第一次訓練，教練就愣了一下——這種天賦，他見過的不多。',
    '球探報告只留了一句話：「務必留意」。',
    '有些人一出場就看得出來，不會只是普通球員。',
  ],
};

const TOP_ABILITY_HINT = [
  '如果要說有什麼比較拿手的地方，大概是{ability}。',
  '練{ability}的時候，你自己都感覺得到一點不一樣。',
  '{ability}，教練似乎特別願意在這上面多花時間帶你。',
];

/* 給真人玩的 UI 用：只回傳模糊線索，不回傳 grade.grade/grade.score/
   grade.suggestedStyles 這幾個會直接洩底的欄位。abilityHintTemplate
   帶一個「{ability}」佔位符，實際能力名稱由呼叫端代入(這個檔案不需要
   引入 data/abilities.js 的 ABL 字典，UI 端本來就已經有了)。 */
export function describeOpening(grade) {
  const flavorPool = OPENING_FLAVOR[grade.grade];
  const flavorLine = flavorPool[grade.score % flavorPool.length];
  const abilityHintTemplate = TOP_ABILITY_HINT[grade.topPot % TOP_ABILITY_HINT.length];
  return { flavorLine, abilityHintTemplate };
}
