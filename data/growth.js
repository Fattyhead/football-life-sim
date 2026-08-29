/* ---------- 骰子成長系統：純資料表 ---------- */
/* 對照原版 YaKyoLife 查證過的規則(WebFetch 查證 GitHub wiki，不是憑印象)：
   訓練不再是單一隨機數直接加能力，改成「擲骰子 → 骰子點數逐級花費」——
   骰幾顆、每級要花多少點數，都是這裡定義的靜態表，實際判定邏輯留給
   flow/shared.js 的 addAbilityPoints()/rollDiceCount()/rollDie()。 */

/* 每季擲幾顆骰，機率分佈直接沿用原版查到的數字：35%/40%/20%/5% 對應
   3/4/5/6顆。用累積機率分段，rollDiceCount() 用一次 ri(1,100) 對照這個表。 */
export const DICE_COUNT_TABLE = [
  { count: 3, cumPct: 35 },
  { count: 4, cumPct: 75 },
  { count: 5, cumPct: 95 },
  { count: 6, cumPct: 100 },
];

/* 四檔成長成本表：現值落在哪個區間，決定「骰子點數要花多少才能加1點
   能力」。直接沿用原版 wiki 查到的數字——外場(對照原版「野手」)/守門員
   (對照原版「投手」)成本不同，守門員(專精型位置，潛力區間本來就比外場
   集中，見 data/potential.js 開頭註解)每一級都比外場貴一截。 */
export const GROWTH_COST_TABLE = {
  outfield: [
    { max: 60, cost: 1 },
    { max: 70, cost: 1 },
    { max: 75, cost: 2 },
    { max: Infinity, cost: 3 },
  ],
  gk: [
    { max: 60, cost: 1 },
    { max: 70, cost: 2 },
    { max: 75, cost: 3 },
    { max: Infinity, cost: 4 },
  ],
};

/* 通用硬上限：不分位置、不分種子，所有能力值練到這裡就是真正的頂——
   跟每項能力各自的「潛力」(軟上限，開局暗抽，見 data/potential.js)是
   兩個不同的東西，這輪稽核重新查證原版 wiki 才修正過來的認知：潛力
   不是練不過去的硬牆，是「便宜成本表結束的地方」，真正的硬牆是這裡。 */
export const ABILITY_HARD_CAP = 80;

/* 超過自己的潛力(軟上限)之後，還想繼續往通用硬上限練，每一級的成本要
   再乘上這個倍率——疊在 GROWTH_COST_TABLE 查出來的那一格上，不是另開
   一檔固定數字(現值70但潛力只有55的人，超過潛力後還在70-74這個級距，
   付的是「70-74本來的成本」×這個倍率，不是固定一個數字)。
   原版 wiki 查到的數字是野手×3／投手(→我們的守門員)×4，單一固定倍率——
   但這輪稽核用種子品質分桶實測後發現：固定倍率配上季初骰子池的量級/
   20幾季的生涯長度，20幾季下來低潛力種子還是追得上高潛力種子的實際
   能力值(開局評分C級跟A級的生涯結果幾乎沒有差異)，「潛力品質」形同
   只影響「多花幾季追平」，追不平的情況幾乎不存在。改成越往上超過越貴
   的階梯式倍率(呼應使用者原本對「超過潛力該指數變貴」的直覺，這裡選擇
   比原版更陡——原版數字是給「骰子成長按選項配給、頻率低很多」的舊
   結構校準的，這輪拆成季初大頭獨立步驟後點數供給量級完全不同，照抄
   原版倍率已經證實不夠用，這是刻意的裝置調整，不是誤讀原版)：超過
   1-5級維持原版倍率，之後每多5級再加重一階，讓「補齊一個大缺口」在
   正常生涯長度內非常吃力，但沒有真的封死(還是能練，只是要花的時間
   長到大多數生涯補不完)。 */
const OVER_POTENTIAL_TIERS = {
  outfield: [
    { maxOverBy: 5, mult: 3 },
    { maxOverBy: 10, mult: 6 },
    { maxOverBy: 15, mult: 9 },
    { maxOverBy: Infinity, mult: 12 },
  ],
  gk: [
    { maxOverBy: 5, mult: 4 },
    { maxOverBy: 10, mult: 8 },
    { maxOverBy: 15, mult: 12 },
    { maxOverBy: Infinity, mult: 16 },
  ],
};

/* 查表：overBy 是「現值超過自己潛力多少級」(呼叫端保證 overBy > 0 才會
   呼叫這個)，回傳對應的倍率。 */
export function overPotentialMultiplier(overBy, isGK) {
  const tiers = isGK ? OVER_POTENTIAL_TIERS.gk : OVER_POTENTIAL_TIERS.outfield;
  return tiers.find((t) => overBy <= t.maxOverBy).mult;
}

/* ---------- 選項的小整數風險層 ---------- */
/* 對照原版「18張事件卡」的三檔(穩健/標準/全力)，成功率跟能力值幅度都
   直接照抄原版查到的絕對值：穩健(基準55% +20%＝75%，±1)、平衡(基準
   55%，±2)、冒進(基準55% -15%＝40%，±3)。這是訓練/機會選項底下再選
   一層(見 flow/shared.js resolveRiskTier)，跟季初的骰子成長系統(大頭，
   DICE_COUNT_TABLE/GROWTH_COST_TABLE)是兩個獨立機制，不要搞混——這裡
   幅度本來就是小整數，不是骰子總和的比例縮放。 */
export const RISK_TIERS = {
  SAFE: { label: '穩健', desc: '幅度小，但成功率最高——連失手都只會小虧一點。', successPct: 75, abilityDelta: 1 },
  BALANCED: { label: '平衡', desc: '標準幅度與機率，有輸有贏。', successPct: 55, abilityDelta: 2 },
  AGGRESSIVE: { label: '冒進', desc: '幅度最大，但成功率最低——失手會真的往下扣不少。', successPct: 40, abilityDelta: 3 },
};

/* 風險層累積次數解鎖的稱號：只有 SAFE(穩健)/AGGRESSIVE(冒進)兩個極端傾向
   有專屬稱號，BALANCED(平衡)沒有(mockup 明確定案，走中庸路線不算一種
   「傾向」)。門檻/名稱直接照抄 mockup RISK_TIER_TITLE，比照 data/mastery.js
   委身特質同一種「累積N次同傾向→解鎖」機制，一併掛進 flow/achievements.js
   的成就展示(TITLE_TIER_BY_LABEL)——tier 用 RARE/ELITE，跟其餘稱號共用
   同一套稀有度分層/終局計分權重，不要另開一套規則。cond 是成就展示藏
   名稱那層(RARE)要顯示的觸發條件文字，故意寫得跟隱晦線索一樣模糊，不
   直接寫出門檻次數(呼應「不該讓玩家一眼看穿門檻數字」的定案)。
   使用者定案：這四個稱號不該只是好看的標籤，要真的疊加對應那一檔的
   成功率——一路選穩健，之後選穩健會更容易成功；一路選冒進，之後選
   冒進也更容易成功，呼應「這已經是你的風格了，做起來更順手」。
   successBonusPct 是解鎖後永久疊加在 RISK_TIERS[tierKey].successPct 上的
   百分點，TIER1/TIER2 各 +5，兩個都拿到疊加成 +10(見 flow/shared.js
   effectiveRiskSuccessPct)。只加在「這個稱號對應的那一檔」，不會讓
   SAFE 的稱號也去加成 AGGRESSIVE。 */
export const RISK_TIER_TITLE = {
  SAFE: {
    TIER1: { label: '小心翼翼', tier: 'RARE', cond: '訓練/機會選項一路都選最穩的那條路', threshold: 8, successBonusPct: 5 },
    TIER2: { label: '零風險主義者', tier: 'ELITE', cond: '訓練/機會選項幾乎從不冒險', threshold: 16, successBonusPct: 5 },
  },
  AGGRESSIVE: {
    TIER1: { label: '走在鋼索上的男人', tier: 'RARE', cond: '訓練/機會選項一路都選最猛的那條路', threshold: 8, successBonusPct: 5 },
    TIER2: { label: '孤注一擲的傳奇', tier: 'ELITE', cond: '訓練/機會選項幾乎每次都全力衝刺', threshold: 16, successBonusPct: 5 },
  },
};
