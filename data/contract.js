/* ---------- 合約與轉會費結構 ---------- */
/* 棒球版核心是「球隊保留年限」(NPB/MLB式 reserve clause/arbitration)——
   球員被原球隊控制幾年，之後才進自由市場。足球沒有這個概念，換一套邏輯：
   合約就是固定年限，到期前想換東家要付轉會費，到期後免費轉隊(Bosman條款)。
   薪資疊加 abilities.js 的 POS_MARKET 位置溢價，合約年限疊加 decline.js 的
   起衰年齡——都是既有資料表的延伸，不重新發明一套獨立邏輯。 */

/* 薪資基準——使用者定案改用真實歐元年薪量級(原本是「不用真實貨幣單位，
   避免假精確」的抽象指數，這輪明確要求改成貼近現代足壇的數字，是刻意的
   方向反轉，不是疏忽)。單位：歐元/年。
   實際年薪 = WAGE_BASE[tier] × CLUB_PRESTIGE_WAGE_MULT[球隊豪門等級] ×
   (OVR/30) × (1 + POS_MARKET[細分守位] + 稱號溢價)，f(OVR) 曲線留在
   flow/shared.js signContract()，這裡只定跨聯賽/跨豪門等級的基準。

   稽核抓出來的真斷點：這組公式原本完全不看球隊的豪門等級(CONTENDER/
   ELITE，見 flow/shared.js clubPrestigeOf)，只看 S.tier(LOCAL/FEEDER/
   TOP5)——一個普通TOP5球隊板凳球員跟豪門巨星只要 OVR 一樣，薪資公式
   算出來完全相同，這跟現實差很多(豪門跟中游勁旅的薪資水準差好幾倍)。
   要支撐 CONTENDER/ELITE 兩個更高的薪資級距，必須先補上這個乘數，不然
   這兩級只是文件寫好看，機制上永遠碰不到——見下面新增的
   CLUB_PRESTIGE_WAGE_MULT。 */
export const WAGE_BASE = { LOCAL: 20000, FEEDER: 120000, TOP5: 500000 };

/* 球隊豪門等級的薪資乘數——clubPrestigeOf() 回傳 null(普通TOP5球隊)/
   CONTENDER/ELITE 三種，這裡對應一組乘數，豪門等級的薪資差距刻意拉大
   (5倍)，貼近現實(五大聯賽頂級豪門的薪資單跟中游球隊真的差這麼多)。
   LOCAL/FEEDER 沒有豪門等級概念(clubPrestigeOf 對這兩層一律回傳
   null)，套用 1 倍(這裡的 null key 同時服務「普通TOP5」跟「LOCAL/
   FEEDER」兩種情況，語意一致：沒有標記豪門等級就是基準倍率)。 */
export const CLUB_PRESTIGE_WAGE_MULT = { null: 1, CONTENDER: 2.2, ELITE: 5 };

/* 合約年限：起衰年齡前後給不同的談判範圍，對照棒球版「年輕球員長約、老將短約」
   的直覺，但足球版直接掛決定衰退的同一個年齡點(decline.js DECLINE_START)，
   不用另外維護一份年齡表。年輕未起衰 = 球隊願意壓長約鎖住未來增值；
   起衰後 = 球隊只敢給短約，避免壓在快速貶值的資產上。 */
export const CONTRACT_LENGTH = {
  preDecline: { min: 3, max: 5 },
  postDecline: { min: 1, max: 2 },
};

/* 轉會費隨「剩餘合約年限」遞減，到期＝0(Bosman條款免費轉隊)。
   這個遞減曲線本身就是敘事引擎：球隊在球員合約進入最後1-2年時面臨
   「現在賣掉拿轉會費，還是留到到期一毛錢拿不到」的抉擇，很適合做成事件節點。
   remainingYearsFactor 乘上 baseValue(OVR, tier)：
     4年以上 = 全額(1.0)
     3年 = 0.85
     2年 = 0.65
     1年 = 0.35
     到期(0年) = 0，直接自由轉隊 */
export const TRANSFER_FEE_FACTOR = {
  4: 1.0,
  3: 0.85,
  2: 0.65,
  1: 0.35,
  0: 0,
};

/* 解約金條款：簽新約時設定一個固定金額，任何俱樂部付這筆錢就能無視原球隊
   意願直接把人買走(不用走轉會談判)。用市場身價的倍率表示，倍率越高代表
   原球隊防守心態越強(越不想被輕易挖走)、球員越難動；倍率越低越容易被買走。
   低倍率(1.2-1.8x)：球隊願意放人，換取簽約時球員讓步(比如薪資)
   高倍率(2.5-4x)：球隊幾乎不想放人，形同軟性鎖死

   設計定案：這個遊戲的核心是「向上流動」，不是把球員綁死在某個階段——
   所以骰倍率的時候刻意偏低端(flow/shared.js rollReleaseClause 用「骰兩次
   取小」而不是均勻隨機)，高倍率(接近鎖死)還是有機會出現，但機率明顯壓低。
   這個原則之後任何跟「轉會自由度」有關的新機制都要延續，不要反過來設計
   成卡關/綁定玩家的東西。 */
export const RELEASE_CLAUSE_MULT_RANGE = { min: 1.2, max: 4.0 };
