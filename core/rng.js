/* ---------- 種子亂數引擎 ---------- */
/* 對照原版棒球 core/rng.js 的介面：SEED/setSeed/seedInit + R/ri/chance/clamp。
   首頁講的「相同種子＋相同選擇＝相同人生」全靠這裡——同一個種子字串
   每次都要生出同一串亂數，所以不能用 Math.random()，要用種子可控的 PRNG。
   實作選 mulberry32：夠快、夠隨機、程式碼短到能整個看懂，
   不需要真正密碼學等級的隨機性(這是遊戲骰子，不是安全系統)。 */

export let SEED = null;
let _state = 0;

/* 字串種子先雜湊成 32-bit 整數，再餵給 mulberry32。cyrb53 的簡化版，
   夠用、避免同義字種子(如 "abc" vs "abd")撞到太相近的初始狀態。 */
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32() {
  _state |= 0;
  _state = (_state + 0x6d2b79f5) | 0;
  let t = Math.imul(_state ^ (_state >>> 15), 1 | _state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function setSeed(seedStr) {
  SEED = seedStr;
  _state = hashSeed(seedStr);
}

/* 沒有指定種子時隨機生一個好記的種子碼，對照首頁「世界種子」欄位那種
   8 碼英數字，方便玩家念出來/分享給朋友輸入同一個種子。 */
export function seedInit() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  const bootstrapState = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  let x = bootstrapState;
  for (let i = 0; i < 8; i++) {
    x = (x + 0x6d2b79f5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    s += chars[Math.floor(r * chars.length)];
  }
  setSeed(s);
  return s;
}

/* R(): [0,1) 均勻分布，是其他所有亂數函式的唯一底層來源。 */
export function R() {
  if (SEED === null) seedInit();
  return mulberry32();
}

/* ri(min,max): 閉區間整數亂數，對照原版介面，state.js 的 newState() 直接依賴這個。 */
export function ri(min, max) {
  return Math.floor(R() * (max - min + 1)) + min;
}

/* chance(p): p 機率回傳 true，是所有「骰子判定」(青訓淘汰率/惡化機率/緋聞機率…)
   的共用介面，讓 flow 層不用每個地方各自寫 R() < p。 */
export function chance(p) {
  return R() < p;
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
