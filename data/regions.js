/* ---------- 出身地區資料 ---------- */
/* 棒球版是單一直線：高中 → 選秀 → CPBL → 旅日 NPB → 旅美 MLB。
   足球版改成「地區 × 生涯路徑」的交叉系統：
     起始地區決定初始屬性傾向 + 在地聯賽 + 跳板聯賽，
     地區本身直接當「簡化版國家隊實體」使用（不再另外拆一層國家），
     國家隊系統是跨地區的平行事件線（見 national.js），
     五大聯賽(TOP5)是所有地區共同的終點，不分出身。
   地區清單可擴充，目前開 15 個，架構上加新地區只要在 REGION 補一筆。 */

/* 起始屬性傾向刻意「歸因於青訓體系/足球文化資源」而非天生特質——
   跟原版聯盟門檻(CPBL/NPB/MLB 難度不同)是同一種設計語言：
   數字反映的是「這個地區的足球基礎建設把新秀往哪個方向推」，
   不是在講「這個地區的人天生比較怎樣」。西亞加分是因為石油資金砸學院技術訓練，
   中非扣分是因為基礎設施/教練資源有限導致技術養成起步晚，
   不是任何人種論——玩法上這個區分只是「起點難度曲線」，跟棒球版聯盟門檻
   （CPBL/NPB/MLB 難度不同）邏輯一致，不代表天花板不同（天花板完全看擲骰與後續養成）。
   能力鍵值對照 abilities.js 的 FIFA 六維：STA/PAC/SHO/PAS/DRI/DEF/PHY。 */

/* talentPoolDepth / squadCeiling 是「地區當簡化國家隊」用的兩個參數，
   刻意反著設計才有張力：
     talentPoolDepth（入隊難度，0–100）— 值越高代表這個地區競爭者越多，
       擠進「國家隊」名單越難；同時也代表這個地區的球星基數越大。
     squadCeiling（隊伍上限，0–100）— 值越高代表這支「國家隊」在大賽能走多遠。
   深度池地區（如南美）：入隊難、但隊伍實力強，一旦入選有機會衝冠。
   淺度池地區（如南亞）：入隊相對容易、但隊伍實力弱，很難在大賽走遠。
   實際的入選機率/晉級機率公式留給 engine/national.js，這裡只定地區參數。 */

export const REGION = {
  EAS: {
    name: '東亞',
    flavor: '體系化青訓，重視戰術紀律與跑動量，早期技術對抗經驗較少',
    local: { code: 'TPFL', name: '台灣企業甲級足球聯賽' },
    feeder: { code: 'J1', name: '日本 J1 聯賽' },
    startBonus: { STA: 3, DEF: 2, PAS: 1, PHY: -2 },
    talentPoolDepth: 40,
    squadCeiling: 45,
  },
  SEA: {
    name: '東南亞',
    flavor: '近年資金投入快速成長，速度與技術兼具，體系與抗壓性仍在建立',
    local: { code: 'THA', name: '泰國甲級聯賽' },
    feeder: { code: 'J2', name: '日本 J2 聯賽' },
    startBonus: { PAC: 2, DRI: 1, STA: -2 },
    talentPoolDepth: 20,
    squadCeiling: 20,
  },
  WAS: {
    name: '西亞',
    flavor: '資金雄厚的職業學院，技術訓練紮實但高強度實戰經驗偏少',
    local: { code: 'SPL', name: '沙烏地職業聯賽' },
    feeder: { code: 'TUR', name: '土耳其超級聯賽' },
    startBonus: { PAS: 2, DRI: 2, PHY: -2 },
    talentPoolDepth: 25,
    squadCeiling: 30,
  },
  CAS: {
    name: '中亞',
    flavor: '新興足球地區，體能與紀律基礎不錯，戰術體系仍在追趕',
    local: { code: 'UZB', name: '烏茲別克超級聯賽' },
    feeder: { code: 'RUS', name: '俄羅斯超級聯賽' },
    startBonus: { PHY: 1, STA: 1, PAS: -1 },
    talentPoolDepth: 15,
    squadCeiling: 15,
  },
  SAS: {
    name: '南亞',
    flavor: '板球文化壓過足球，人才池薄，但商業版圖近年對南亞市場有興趣，偶有球探機會',
    local: { code: 'ISL', name: '印度超級聯賽' },
    feeder: { code: 'ENG2', name: '英格蘭冠軍聯賽' },
    startBonus: { DRI: 1, PAC: 1, PHY: -2, DEF: -1 },
    talentPoolDepth: 10,
    squadCeiling: 10,
  },
  SAM: {
    name: '南美',
    flavor: '街頭足球文化，盤球與創造力起步就強，防守紀律需要後天磨',
    local: { code: 'BRA', name: '巴西甲級聯賽' },
    feeder: { code: 'POR', name: '葡萄牙超級聯賽' },
    startBonus: { DRI: 4, PAS: 2, DEF: -3 },
    talentPoolDepth: 90,
    squadCeiling: 90,
  },
  NAM: {
    name: '北美',
    flavor: '運動能力出色，足球專項技術傳統較淺',
    local: { code: 'MLS', name: '美國職業足球大聯盟' },
    feeder: { code: 'NED', name: '荷蘭甲級聯賽' },
    startBonus: { PHY: 3, PAC: 2, DRI: -2 },
    talentPoolDepth: 35,
    squadCeiling: 35,
  },
  CAR: {
    name: '加勒比海',
    flavor: '短跑基因型速度出色，基礎設施有限使技術養成較晚',
    local: { code: 'JAM', name: '牙買加超級聯賽' },
    feeder: { code: 'ENG2', name: '英格蘭冠軍聯賽' },
    startBonus: { PAC: 4, PHY: 1, PAS: -2, DEF: -1 },
    talentPoolDepth: 15,
    squadCeiling: 15,
  },
  EUR: {
    name: '歐洲',
    flavor: '青訓體系最完整，起步均衡但沒有極端長板',
    local: { code: 'EUR2', name: '各國職業聯賽二級' },
    feeder: null, // 可直接被五大聯賽球探發掘，不需要跳板聯賽
    startBonus: { STA: 1, PAC: 1, SHO: 1, PAS: 1, DRI: 1, DEF: 1, PHY: 1 },
    talentPoolDepth: 70,
    squadCeiling: 70,
    /* 特例備註：生在英/西/德/法/義這五個 TOP5 母國的球員，local 聯賽本身
       可能就是 TOP5（例如生在法國、青訓隊就是法甲俱樂部）。這種「含著金湯匙」的
       情況比一般歐洲球員更少見，建議用生涯開局的小機率事件處理，
       而不是整個地區另開一格——避免地區表過度碎片化。 */
  },
  WAF: {
    name: '西非',
    flavor: '非洲最大人才輸出地，身體素質與爆發力頂尖，技術養成受限於基礎設施起步較晚',
    local: { code: 'NGA', name: '奈及利亞職業聯賽' },
    feeder: { code: 'FRA2', name: '法國甲級聯賽' },
    startBonus: { PHY: 4, PAC: 3, PAS: -2, DEF: -1 },
    talentPoolDepth: 75,
    squadCeiling: 55,
  },
  CAF: {
    name: '中非',
    flavor: '身體素質出色，基礎設施相對有限，技術養成起步較晚',
    local: { code: 'COD', name: '剛果民主共和國聯賽' },
    feeder: { code: 'BEL', name: '比利時甲級聯賽' },
    startBonus: { PHY: 3, PAC: 2, PAS: -3, DEF: -2 },
    talentPoolDepth: 40,
    squadCeiling: 35,
  },
  EAF: {
    name: '東非',
    flavor: '田徑傳統強於足球，人才池薄但存在，續航力與耐力是強項',
    local: { code: 'KEN', name: '肯亞超級聯賽' },
    feeder: { code: 'EGY', name: '埃及超級聯賽' }, // 先跳板到非洲區域內強權，再轉往歐洲
    startBonus: { STA: 3, PAC: 1, SHO: -2, DEF: -1 },
    talentPoolDepth: 12,
    squadCeiling: 12,
  },
  NAF: {
    name: '北非',
    flavor: '速度與技術均有一定基礎，介於歐洲與撒哈拉以南之間',
    local: { code: 'MAR', name: '摩洛哥職業聯賽' },
    feeder: { code: 'FRA2', name: '法國甲級聯賽' },
    startBonus: { PAC: 2, DRI: 2, STA: -1 },
    talentPoolDepth: 50,
    squadCeiling: 55,
  },
  SAF: {
    name: '南非',
    flavor: '體能與紀律兼具，基礎建設優於中非但不如北非',
    local: { code: 'PSL', name: '南非超級聯賽' },
    feeder: { code: 'BEL', name: '比利時甲級聯賽' },
    startBonus: { PHY: 2, STA: 2, DRI: -1 },
    talentPoolDepth: 30,
    squadCeiling: 25,
  },
  OCE: {
    name: '大洋洲',
    flavor: '運動能力扎實，人才池小，長期依賴英倫足球體系輸送',
    local: { code: 'AUS', name: '澳洲職業足球聯賽' },
    feeder: { code: 'ENG2', name: '英格蘭冠軍聯賽' },
    startBonus: { PHY: 2, STA: 1, DRI: -1 },
    talentPoolDepth: 15,
    squadCeiling: 20,
  },
};

/* ---------- 起步路徑選擇 ---------- */
/* 網頁遊戲，判定盡量單次、簡單：青訓期結束時「一次」骰淘汰判定，不做多季適應機制。
   淘汰率隨目標門檻升高：本地青訓門檻最低，淘汰率也最低——多數人這關過得去，
   淘汰只是少數；跳板/TOP5 邀請門檻越高，淘汰率跟著升高，是清楚的高風險高回報選項。
   淘汰後果：回到（或留在）LOCAL 重新起步，沒有天花板懲罰，只是少走一段路。
   實際擲骰/事件文本留給 flow/events.js，這裡只定路徑結構與淘汰率。 */
export const PATHS = {
  LOCAL_ACADEMY: {
    label: '加入本地俱樂部青訓',
    desc: '從 REGION.local 聯賽起步，路線穩健。',
    cutRate: 0.12,
  },
  FEEDER_INVITE: {
    label: '跳板聯賽青訓邀請',
    desc: '跳過本地聯賽，直接加入 REGION.feeder 所在國家的俱樂部青訓體系。',
    cutRate: 0.25,
  },
  TOP5_INVITE: {
    label: '五大聯賽青訓邀請',
    desc: '極稀有機會，直接被 TOP5 俱樂部青訓部看中，跳過跳板聯賽。',
    cutRate: 0.45,
  },
};

/* ---------- 聯賽階段 ---------- */
/* 三層對照棒球 CPBL1 / NPB1 / MLB：
   LOCAL  — 地區在地聯賽（各地區用自己的 REGION.local）
   FEEDER — 跳板聯賽（各地區用自己的 REGION.feeder，歐洲沒有這一層）
   TOP5   — 五大聯賽（英超/西甲/意甲/德甲/法甲），所有地區共同終點，不分出身 */
export const LV = {
  LOCAL: { tier: 1, label: '地區聯賽' },
  FEEDER: { tier: 2, label: '跳板聯賽' },
  TOP5: { tier: 3, label: '五大聯賽' },
};

export const TOP5_LEAGUES = ['英超', '西甲', '意甲', '德甲', '法甲'];

/* 依地區代碼取得該地區的聯賽鏈（LOCAL → FEEDER → TOP5），
   歐洲地區的 feeder 為 null，流程判斷時要處理「直接從 LOCAL 跳 TOP5」的分支。 */
export function leagueChain(regionCode) {
  const r = REGION[regionCode];
  if (!r) return null;
  return {
    local: r.local,
    feeder: r.feeder, // 可能為 null（歐洲）
    top5: TOP5_LEAGUES,
  };
}
