/* ---------- 衰退曲線（依細分守位） ---------- */
/* 對照棒球版：32 歲起衰退、加速惡化(35歲後加重)、trait 可延後(disc -2歲)。
   足球版兩處不同：
     起衰年齡按 DPN 七個細分守位分開（不用粗的 DF/MF/FW，因為同是 MF 的 DM 跟 AM
       衰退速率明顯不同）——邊鋒/前鋒最早，中後衛最晚，守門員比誰都晚。
     哪個能力先掉不分位置，只看能力本身：速度衰退最快，技術/傳球衰退最慢，
       這是足球最典型的老將敘事「腿沒了但腦子還在」。刻意不做「位置×能力」交叉表，
       維持簡單——起衰年齡已經吃掉位置差異，能力衰退速率不需要再疊一層。
   GK 不在 DPN 裡，這裡另外補一筆，用自己的能力集合(DIV/HAN/KIC/REF/POS)。 */

export const DECLINE_START = {
  WG: 29,
  ST: 30,
  FB: 30,
  CM: 31,
  AM: 32,
  DM: 32,
  CB: 33,
  GK: 34,
};

/* 硬性引退上限，對照棒球版 age>=48 強制引退。足球體能消耗更早見底，
   且按位置分——邊鋒/前鋒最早被迫退場，守門員可以踢到最晚。
   trait 系統上線後可以比照棒球版 disc 特質做 ±2 歲級距的延後，這裡先不預設。 */
export const RETIRE_CAP = {
  WG: 36,
  ST: 36,
  FB: 37,
  CM: 37,
  AM: 38,
  DM: 38,
  CB: 39,
  GK: 42,
};

/* 能力衰退速率係數，不分位置，只看能力本身。基準 1.0，數字越大掉越快。
   PAC 掉最快(腿最先老)，PAS/DRI 掉最慢(技術/視野是經驗資產，衰退最後才碰到)。
   GK 的能力另外列，POS(站位判斷)是守門員最後才會掉的東西，跟外場 PAS/DRI 是同一種邏輯。 */
export const DECLINE_RATE = {
  // 外場球員
  PAC: 1.5,
  PHY: 1.2,
  STA: 1.0,
  DEF: 0.8,
  SHO: 0.7,
  PAS: 0.6,
  DRI: 0.6,
  // 守門員
  REF: 1.0,
  DIV: 0.9,
  HAN: 0.7,
  KIC: 0.6,
  POS: 0.5,
};

/* 基礎衰退量隨「過起衰年齡多久」加速，對照棒球版 declAge>=35 才加重的邏輯，
   簡化成三段：剛起衰慢慢掉、中期加快、晚期掉更快。
   實際套用：每項能力的年衰退量 = baseDecline(age, 該位置起衰年齡) × DECLINE_RATE[能力]，
   四捨五入。這個函式只是查表，不是完整引擎公式，跟 regions.js 的 leagueChain() 同等級。 */
export function baseDecline(age, startAge) {
  const yearsPast = age - startAge;
  if (yearsPast < 0) return 0;
  if (yearsPast <= 2) return 1;
  if (yearsPast <= 5) return 2;
  return 3;
}

/* 衰退掉到守位門檻(見 abilities.js 的 DP_TH/GK_BAR)以下，代表守不住原本的位置/聯賽層級，
   這是晚期生涯「被迫下放或轉型」敘事的觸發點，實際判定邏輯留給 flow/phases.js。 */
