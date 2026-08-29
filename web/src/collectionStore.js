/* ---------- 成就典藏：跨局累積，localStorage ---------- */
/* 使用者定案：跟存讀檔(saveStore.js)是不同時間尺度的兩件事——存讀檔是
   「這一局生涯」的暫停/繼續，典藏是「玩家這輩子玩過的所有局」累積解鎖
   過什麼，兩者不衝突並存(見對話記錄)：結局畫面既有的成就格子牆繼續
   維持「這一局拿到了什麼」(flow/achievements.js buildAchievementGallery)，
   典藏頁是額外疊加的第二層，讀 buildLifetimeGallery()。

   徽章用「歷史上有沒有拿過」(S.everHadPlaystyle)而不是「現在還有沒有」
   (S.traits.playstyle)——跟 flow/legacy.js 終局評分讀的是同一個欄位、
   同一種語意，典藏頁沒理由用更嚴格的標準，見 flow/achievements.js
   buildLifetimeGallery 的稽核說明。

   匯出/匯入備份(使用者定案，不用帳號登入)：匯出包成一個小 JSON 檔案讓
   玩家自己保管，匯入用「合併」不是「覆蓋」——兩邊的紀錄取聯集/取較高值，
   不會因為匯入一份舊備份反而把這段時間新拿到的紀錄洗掉，呼應這個遊戲
   一貫「向上流動、不會平白倒退」的原則。 */

const COLLECTION_KEY = 'flsim:collection:v1';

// 由低到高，跟 flow/legacy.js LEGACY_TIER 的五個標籤完全對應——用來判斷
// 匯入/合併時「哪個 tier 比較高」，不是另外定義一套新的分級。
const TIER_RANK = ['普通球員', '稱職球員', '主力球星', '巨星', '傳奇'];

function emptyCollection() {
  return { badgeKeys: [], honorLabels: [], careersPlayed: 0, bestLegendPercent: 0, bestTier: '' };
}

function unionArr(a, b) {
  return Array.from(new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]));
}

function betterTier(a, b) {
  const ra = TIER_RANK.indexOf(a);
  const rb = TIER_RANK.indexOf(b);
  if (rb > ra) return b;
  return a || b || '';
}

export function loadCollection() {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    if (!raw) return emptyCollection();
    const parsed = JSON.parse(raw);
    return { ...emptyCollection(), ...parsed };
  } catch {
    return emptyCollection();
  }
}

function persistCollection(c) {
  try {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(c));
    return true;
  } catch {
    return false;
  }
}

/* 入口：每局進到結局畫面那一刻呼叫一次(見 web/src/App.jsx evaluateLegacy
   呼叫的同一個位置)——只在生涯真正結算完才併入，半途放棄/還沒退休的
   生涯不算數，跟 buildAchievementGallery 只在終局才被呼叫是同一個時機。 */
export function mergeCareerIntoCollection(S, legacy) {
  const current = loadCollection();
  const merged = {
    badgeKeys: unionArr(current.badgeKeys, S.everHadPlaystyle),
    honorLabels: unionArr(current.honorLabels, S.honors),
    careersPlayed: current.careersPlayed + 1,
    bestLegendPercent: Math.max(current.bestLegendPercent, legacy.legendPercent),
    bestTier: betterTier(current.bestTier, legacy.tier),
  };
  persistCollection(merged);
  return merged;
}

/* 匯出：包一層 envelope(kind/version)方便匯入時辨識這是不是這個遊戲的
   備份檔，不是隨便一個 JSON 檔案都能匯進來。 */
export function exportCollectionBackup() {
  const data = loadCollection();
  return JSON.stringify({ kind: 'football-life-sim-collection', version: 1, data }, null, 2);
}

/* 匯入：合併不是覆蓋，見檔頭稽核說明。丟出的錯誤(格式不對/不是這個
   遊戲的備份檔)交給呼叫端(CollectionScreen.jsx)決定怎麼提示玩家，這裡
   只管資料層的合併邏輯。 */
export function importCollectionBackup(jsonText) {
  const parsed = JSON.parse(jsonText);
  const incoming = parsed && typeof parsed === 'object' && parsed.data ? parsed.data : parsed;
  if (!incoming || typeof incoming !== 'object') {
    throw new Error('備份檔格式不正確');
  }
  const current = loadCollection();
  const merged = {
    badgeKeys: unionArr(current.badgeKeys, incoming.badgeKeys),
    honorLabels: unionArr(current.honorLabels, incoming.honorLabels),
    careersPlayed: Math.max(current.careersPlayed, incoming.careersPlayed || 0),
    bestLegendPercent: Math.max(current.bestLegendPercent, incoming.bestLegendPercent || 0),
    bestTier: betterTier(current.bestTier, incoming.bestTier),
  };
  persistCollection(merged);
  return merged;
}
