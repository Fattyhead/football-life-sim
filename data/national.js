/* ---------- 國家隊事件線：只做世界盃 ---------- */
/* 對照原版棒球「國際賽」：不跟著俱樂部球季走，是另一條平行時間軸，但刻意
   簡化成「小插曲，不是主旋律」——只做世界盃，四年一次窗口，沒選上/沒晉級
   不扣分，純粹是意外之喜。原本設計還有青年盃/洲際盃兩層，拿掉了，
   不需要維護一整條平行的國際賽事曆，世界盃這一個節點就夠撐起敘事重量。
   地區本身直接當簡化版國家隊實體使用（見 regions.js 的 talentPoolDepth/squadCeiling），
   不另外拆一層「國家」。 */

export const WORLD_CUP_CYCLE_YEARS = 4;

/* 入選國家隊本身就有加成，不用等踢出好成績——代表國家出賽，跟世界級對手/隊友
   同場競技，本身就是一種歷練。全能力值小幅永久加成，跟戰績好壞(WC_ROUND_FAME/
   WC_HONOR)分開算：這是「有機會就有成長」，戰績只決定人氣/稱號拿多少。 */
export const NATIONAL_CAP_ABILITY_BONUS = 1;

/* ---------- 青年世界盃：青訓期的提升機會 ---------- */
/* 青訓三年只有一次窗口判定(不像成人賽每季/每窗口都能再挑戰)，是「青訓期的意外之喜」，
   不是常態機制。入選/晉級判定沿用跟成人賽同一套公式(region talentPoolDepth/squadCeiling)，
   不另外發明一組青年版參數——差別在獎勵規模跟成人版不同量級，且獎勵直接連動
   還沒發生的青訓淘汰判定：提前被球探看到，淘汰率打折，這是它跟成人世界盃
   最大的不同——成人世界盃獎勵是「轉會買氣」，青年世界盃獎勵是「活下來的機率」。 */
export const YOUTH_WC_FAME = 0.15; // 基礎人氣值，比成人賽(見 WC_ROUND_FAME)低一截，畢竟只是青年賽
export const YOUTH_WC_CUT_RATE_MULT = 0.5; // 入選青年世界盃國家隊，青訓淘汰率打對折

/* 淘汰輪次，用陣列順序表示晉級深度，engine 層(flow/worldCup.js)逐輪骰是否晉級。 */
export const WC_ROUND_ORDER = ['GROUP', 'R16', 'QF', 'SF', 'FINAL', 'CHAMPION'];
export const WC_ROUND_LABEL = {
  GROUP: '小組賽',
  R16: '16強',
  QF: '八強',
  SF: '四強',
  FINAL: '決賽',
  CHAMPION: '冠軍',
};

/* 晉級到這輪為止大約踢了幾場——給 flow/worldCup.js 算個人進球/助攻用
   (S.national.goals/assists 之前宣告了欄位卻沒被寫入的斷點，這裡補上場次
   基準)。小組賽固定3場，之後每晉級一輪+1場，決賽/冠軍場次相同(都是踢進
   決賽這一場，差別只在贏不贏)。 */
export const WC_ROUND_MATCHES = {
  GROUP: 3,
  R16: 4,
  QF: 5,
  SF: 6,
  FINAL: 7,
  CHAMPION: 7,
};

/* 打進每一輪的基礎人氣值，之後在 engine 層乘上「小國加成」跟「冷門位置加成」
   才是實際拿到的人氣——這裡只定「踢到這輪本身值多少」的基準。 */
export const WC_ROUND_FAME = {
  GROUP: 0.05,
  R16: 0.15,
  QF: 0.3,
  SF: 0.5,
  FINAL: 0.7,
  CHAMPION: 1.0,
};

/* 入選/晉級判定要吃的地區參數（來自 regions.js）：
     talentPoolDepth — 入隊難度：值越高，需要的 OVR 相對門檻越高（競爭者多）
     squadCeiling     — 隊伍上限：值越高，同樣打進大賽後晉級/奪冠機率越高，
       但也代表「打進大賽」本身沒那麼稀奇——所以人氣加成刻意跟 squadCeiling
       反著算(2 - squadCeiling/100)：強權隊打進世界盃是常態，加成小；
       小國打進世界盃本身就是新聞，加成大。
   位置加成不另開新表，直接借用 abilities.js 的 POS_MARKET 算 (1 - POS_MARKET[位置])：
   市場關注度越低的位置(GK/CB/DM)平常越沒人注意，世界盃一戰成名時反差越大，
   加成就越高；市場關注度本來就高的位置(ST/AM/WG)進球是「應該的」，加成小。
   實際判定/加成公式在 flow/worldCup.js，這裡只定基準表。 */

/* ---------- 世界盃特殊稱號 ---------- */
/* 對照 traits.js 的雙層設計：世界盃之星是單屆大賽的高光稱號(這屆踢瘋了)，
   永遠的隊長是跨屆生涯累積的傳奇稱號(你就是這個國家足球史的代名詞)，
   份量不一樣，門檻也差一個數量級，效果直接沿用 traits.js PLAYING_STYLE
   已經在用的 wagePremium/retireCapDelay 欄位語意，不重新發明一套。
   刻意不用「永遠的十號」——十號背後綁死攻擊組織核心的敘事身分，GK/CB 這種
   位置拿十號不合理；隊長不分位置，現實中很多國家隊隊長本來就是後衛/門將，
   跟這個稱號要「不分位置都適用」的設計意圖更吻合。 */
export const WC_HONOR = {
  WC_STAR: {
    label: '世界盃之星',
    tier: 'RARE', // 跟 PLAYING_STYLE 同一個量級，難度校準時一起看
    cond: '單屆打進四強(SF)以上',
    effect: { ability: 2, fameBonus: 0.3 }, // 小幅永久能力加成(大賽經驗) + 額外人氣加成
  },
  ETERNAL_CAPTAIN: {
    label: '永遠的隊長',
    tier: 'ELITE', // 跨屆生涯級成就，跟 GRANDMASTER/CLUB_LEGEND 同一層
    cond: '至少代表國家隊踢過 2 屆世界盃，且生涯最佳戰績達八強(QF)以上',
    effect: { wagePremium: 0.15, retireCapDelay: 2 }, // 疊加在薪資溢價 + decline.js 引退上限
  },
  /* 世界冠軍：球技線的終極巔峰，比 WC_STAR(四強即算)高一個量級——真的捧起
     金盃是完全不同的敘事重量。對照財富線的球隊老闆(CLUB_OWNER)/場外的
     全球偶像(GLOBAL_ICON)：三條線各自有自己的終極稱號，份量要對得起
     「這是這條線能拿到的最高榮譽」。跟 WC_STAR 不衝突，奪冠當屆兩個都會拿到
     (奪冠必然打進四強以上)，是疊加關係不是取代。 */
  WORLD_CHAMPION: {
    label: '世界冠軍',
    tier: 'ELITE',
    cond: '單屆奪得世界盃冠軍',
    effect: { ability: 3, fameBonus: 0.5 },
  },
};
