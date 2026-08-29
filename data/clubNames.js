/* ---------- 五大聯賽俱樂部具名 ---------- */
/* 對照 PES 系列早期沒拿到官方授權時的做法：用「城市/地區 + 主色/綽號」
   組合出辨識度極高但不是官方商標的隊名(曼徹斯特藍軍/紅魔、米蘭紅黑軍這種)。
   這比之前討論真人肖像(演藝圈/王室)風險低得多——球隊是商業品牌，不是
   私人，組合出來的名字本身也是功能性的地理+顏色描述，不是精確複製商標。

   之前晉級/轉會永遠印出「五大聯賽俱樂部」這種通用詞，完全沒有帶入感，
   這裡補上實際隊名池，轉會的時候隨機挑一個。地區/跳板聯賽(FEEDER)的
   具體俱樂部名先不做——那需要每個地區各自建一份隊名池，內容量大很多，
   先集中補最常被看到的 TOP5 這一層。

   prestige：TOP5 內部的「豪門階梯」——實測稽核發現大多數成功生涯最後都
   會停在 TOP5，如果 TOP5 是終點站，機會選項(SCOUT_MEETING/STUDY_ABROAD/
   PR_FIRM)攢的 transferBuzz 在這裡就變成無處可去的空轉數字。加這個欄位
   把「向上流動」延伸進 TOP5 內部：CONTENDER(檔次)球隊之後還有 ELITE
   (豪門)可以挖角，跟 LOCAL→FEEDER→TOP5 是同一種階梯設計，只是換一個
   維度，讓 TOP5 生涯不是「爬到了就沒事幹」。ELITE 特意只給 5/13，維持
   稀缺感——挑全球公認長年最具代表性的幾支，跟其他俱樂部拉開差距，
   實際判定邏輯見 flow/transfer.js 的 checkLateralMove。 */

export const TOP5_CLUBS = [
  { name: '曼徹斯特藍軍', league: '英超', prestige: 'ELITE' },
  { name: '曼徹斯特紅魔', league: '英超', prestige: 'CONTENDER' },
  { name: '倫敦紅軍', league: '英超', prestige: 'CONTENDER' },
  { name: '默西賽德紅軍', league: '英超', prestige: 'CONTENDER' },
  { name: '馬德里白衣軍團', league: '西甲', prestige: 'ELITE' },
  { name: '加泰紅藍軍', league: '西甲', prestige: 'ELITE' },
  { name: '馬德里紅白軍', league: '西甲', prestige: 'CONTENDER' },
  { name: '米蘭紅黑軍', league: '義甲', prestige: 'CONTENDER' },
  { name: '米蘭藍黑軍', league: '義甲', prestige: 'CONTENDER' },
  { name: '都靈斑馬軍', league: '義甲', prestige: 'CONTENDER' },
  { name: '巴伐利亞紅軍', league: '德甲', prestige: 'ELITE' },
  { name: '魯爾黃蜂軍', league: '德甲', prestige: 'CONTENDER' },
  { name: '巴黎紅藍軍', league: '法甲', prestige: 'ELITE' },
];
