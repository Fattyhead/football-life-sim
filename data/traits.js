/* ---------- 特質系統（兩層） ---------- */
/* 對照棒球版「22歲前擲6次骰子解鎖隱藏特質」——但那是單一稀有層，而且原版特質
   不只是好看的稱號，disc(自律狂)會讓衰退曲線延後2歲、oldGhost 會讓衰退減半，
   是真的會動到其他系統的機制效果。足球版延續這個原則：每個特質都要有 effect。

   拆兩層，參考 EA FC 的 PlayStyles 跟 eFootball 的 Player Skills/Playing Styles：

   PLAYSTYLE（常態徽章）— 參考 EA FC PlayStyles，數值到門檻自動解鎖，不用骰。
     effect 是小幅加成「觸發它的那項能力本身」(+2~4)，等於讓專精者突破 0-80
     的常規天花板——「因為你已經是這方面的專家，數值可以再往上一點」。
     cond 檢查的是加成前的基礎值，effect 疊加在後，不會互相干擾判定。

   PLAYING_STYLE（生涯定位標籤）— 參考 eFootball Playing Styles，
     一輩子通常只會定型一種，用累積型里程碑解鎖(連續N季xx數據聯賽最高之類)，
     對照原版「擲6次骰」的稀有解鎖感，保留骰子/機率成分，實際判定邏輯留給
     flow/events.js，這裡只定條件的結構描述。effect 給更重的份量：
     除了較大的能力加成，額外綁一個跨系統機制效果(呼應 decline.js/injury.js/
     decline RETIRE_CAP)，對得起「一輩子只定型一次」的重量感。 */

/* ---------- 常態徽章：數值到門檻自動解鎖 ---------- */
/* 單項門檻原本抓 75(0-80尺度接近頂格)，實測稽核抓出來的斷點：對「主力
   球星」以上(終局評價 score>=25)的一般 headless 生涯抽樣 3000 種子，
   生涯單項能力最高值中位數只有 44，95%ile 也才 63——75 的門檻等於只有
   極端運氣/極端專精的生涯摸得到，53.2% 的「已經是主力核心」生涯連一個
   普通徽章都拿不到，成就展示畫面對這些生涯來說形同「你這輩子什麼都沒
   拿到」，跟「普通・徽章」這層本該有的「大多數玩家都碰得到」的份量感
   矛盾(見 flow/achievements.js 揭露規則的設計意圖)。第一輪下修到58還是
   太保守(貼著85%ile，等於還是只有前1成多摸得到)，再下修到52(貼近
   70%ile的50)，讓「有認真練、但沒有 all-in 單一能力」的一般生涯也有
   實際機會拿到自己的招牌能力徽章，不是只保留給極端專精的玩法。 */
export const PLAYSTYLE = {
  // 外場球員
  RAPID: { label: '疾風', tier: 'COMMON', cond: { PAC: 52 }, effect: { PAC: 3 } },
  POWER_SHOT: { label: '重炮', tier: 'COMMON', cond: { SHO: 52 }, effect: { SHO: 3 } },
  INCISIVE_PASS: { label: '手術刀直塞', tier: 'COMMON', cond: { PAS: 52 }, effect: { PAS: 3 } },
  TRICKSTER: { label: '魔術腳', tier: 'COMMON', cond: { DRI: 52 }, effect: { DRI: 3 } },
  BRICK_WALL: { label: '鐵閘', tier: 'COMMON', cond: { DEF: 52 }, effect: { DEF: 3 } },
  BRUISER: { label: '悍將', tier: 'COMMON', cond: { PHY: 52 }, effect: { PHY: 3 } },
  ENGINE: { label: '不知疲倦', tier: 'COMMON', cond: { STA: 52 }, effect: { STA: 3 } },
  // 雙能力組合：門檻經實測校準下修過(見 flow/shared.js pickFocusTarget 的
  // 註解)——「主攻優勢項目」一次只能鎖定一項目標，要同時把兩項能力都推
  // 過門檻，結構上就是比單一門檻難，門檻本身不用再疊加額外的稀有度，
  // 兩項各自 60/55 已經夠有份量，加成拆給兩項。
  WHIPPED_PASS: { label: '弧線傳中', tier: 'COMMON', cond: { PAS: 60, DRI: 55 }, effect: { PAS: 2, DRI: 1 } },
  AERIAL_THREAT: { label: '頭槌炸彈', tier: 'COMMON', cond: { PHY: 60, SHO: 55 }, effect: { SHO: 2, PHY: 1 } },
  INTERCEPTOR: { label: '抄截專家', tier: 'COMMON', cond: { DEF: 60, PAC: 55 }, effect: { DEF: 2, PAC: 1 } },
  FIRST_TOUCH: { label: '第一腳觸球', tier: 'COMMON', cond: { DRI: 60, PAS: 55 }, effect: { DRI: 2, PAS: 1 } },
  // 守門員：同上，單項門檻一起下修到 52。
  SHOT_STOPPER: { label: '門線飛人', tier: 'COMMON', cond: { DIV: 52 }, effect: { DIV: 3 } },
  REFLEX_WALL: { label: '定海神針', tier: 'COMMON', cond: { REF: 52 }, effect: { REF: 3 } },
  COMMANDING: { label: '門線指揮官', tier: 'COMMON', cond: { HAN: 60, POS: 60 }, effect: { HAN: 2, POS: 1 } },
  SWEEPER_KEEPER: { label: '清道夫門將', tier: 'COMMON', cond: { KIC: 60, REF: 55 }, effect: { KIC: 2, REF: 1 } },
};

/* ---------- 生涯定位標籤：里程碑解鎖，稀有 ---------- */
/* cond 只描述「要達成什麼」，不是實際判定公式(那是 flow/events.js 的事)。
   milestoneType 標注這是「累積型」(連續N季)還是「事件型」(單一戲劇性節點)，
   方便之後 engine 層分別處理判定時機。
   刻意讓每個位置群都至少有一個對應標籤，避免某些位置永遠拿不到生涯定位的失落感。
   effect 除了較大的能力加成，多數還綁一個跨系統機制效果——這是這層真正的重量所在，
   跟 PLAYSTYLE 的差別不只是數字大小，是「會不會改寫其他系統怎麼對待你」。 */
export const PLAYING_STYLE = {
  FOX_IN_THE_BOX: {
    label: '禁區之狐',
    tier: 'RARE',
    positions: ['ST'],
    milestoneType: 'streak',
    cond: '連續 3 季聯賽射手榜前 3',
    effect: { ability: { SHO: 4 }, wagePremium: 0.10 }, // 個人身價加成，不動整體 POS_MARKET 表
  },
  /* 金靴獎：跟 FOX_IN_THE_BOX(連續3季前3的「常年高產」敘事)不同性質——
     這個是單季真的進球數封王，一輩子可以累積拿好幾次(見
     core/state.js S.trophyCount.goldenBoot)，對照現實金靴獎/梅西C羅式
     的「累積座數」比較，跟 BALLON_DOR 同一種「一次性稱號+背後累積計數」
     的雙軌寫法(見 flow/eliteHonors.js checkGoldenBoot)。門檻(單季18球)
     是先射的方向，待種子掃描校準。 */
  GOLDEN_BOOT: {
    label: '金靴獎',
    tier: 'RARE',
    positions: null,
    milestoneType: 'single_season_best',
    cond: '單季進球數達到聯賽頂級水準(10球以上)',
    effect: { ability: { SHO: 2 }, popularityBonus: 3 },
  },
  CREATIVE_PLAYMAKER: {
    label: '組織大師',
    tier: 'RARE',
    positions: ['AM', 'CM'],
    milestoneType: 'single_season_best',
    cond: '單季助攻數聯賽最高',
    effect: { ability: { PAS: 4 } },
  },
  ANCHOR_MAN: {
    label: '鐵血後腰',
    tier: 'RARE',
    positions: ['DM'],
    milestoneType: 'streak',
    cond: '連續 2 季抄截/攔截數據聯賽最高，且無重大失誤',
    effect: { ability: { DEF: 4 }, declineStartDelay: 1 }, // 對應 decline.js DECLINE_START +1 歲
  },
  WING_WIZARD: {
    label: '邊路快馬',
    tier: 'RARE',
    positions: ['WG'],
    milestoneType: 'single_season_best',
    cond: '單季過人成功率聯賽前列，且 PAC ≥ 52',
    effect: { ability: { PAC: 4 } },
  },
  ROCK_AT_THE_BACK: {
    label: '中流砥柱',
    tier: 'RARE',
    positions: ['CB'],
    milestoneType: 'streak',
    cond: '連續 2 季無重大失誤，且防守數據聯賽前段',
    effect: { ability: { DEF: 4 }, injuryEscalateChanceMult: 0.7 }, // 對應 injury.js 帶傷上陣惡化機率打七折
  },
  BOX_TO_BOX: {
    label: '全能戰士',
    tier: 'RARE',
    positions: ['CM', 'FB'],
    milestoneType: 'balanced_threshold',
    cond: 'STA/DEF/PAS/SHO 四項都達中高水準，沒有明顯短板',
    effect: { ability: { STA: 2, DEF: 2, PAS: 2, SHO: 2 } },
  },
  LEGENDARY_KEEPER: {
    label: '門神',
    tier: 'RARE',
    positions: ['GK'],
    milestoneType: 'single_season_best',
    cond: '單季零封場次聯賽最高',
    effect: { ability: { DIV: 4 }, retireCapDelay: 2 }, // 對應 decline.js RETIRE_CAP +2 歲
  },
  // 跟 injury.js 的 MAJOR 永久殘留機制對照：大傷康復後單季表現超越傷前巔峰，
  // 是刻意設計的敘事回馬槍——把「傷病是懲罰」的系統，翻成「逆風翻盤」的高光時刻。
  COMEBACK_KING: {
    label: '逆境重生',
    tier: 'RARE',
    positions: null, // 不限位置，任何人都能觸發
    milestoneType: 'redemption',
    cond: '經歷過大傷(MAJOR)，康復後單季核心數據超越傷前巔峰賽季',
    effect: { clearPermanentResidual: true, ability: { STA: 2 } }, // 直接抵銷大傷的永久殘留debuff
  },

  /* ---------- 精英層：生涯級複合事件，通常要疊多個條件 ---------- */
  /* 判定邏輯不在 flow/playingStyle.js(那個檔案只處理單季 stat 門檻)，
     這幾個要跨季讀取 S.clubTally/S.everWonClubTitle/S.traits 這些累積狀態，
     獨立放在 flow/eliteHonors.js。 */
  GRANDMASTER: {
    label: '一代宗師',
    tier: 'ELITE',
    positions: null,
    milestoneType: 'compound',
    cond: '待過豪門(ELITE)等級球隊 + 生涯捧過俱樂部冠軍 + 已解鎖至少1個稀有稱號',
    effect: { wagePremium: 0.15, retireCapDelay: 1 },
  },
  BALLON_DOR: {
    label: '金球獎得主',
    tier: 'ELITE',
    positions: null,
    milestoneType: 'single_season_best',
    cond: '單季個人數據達稀有稱號級門檻 + 同一季球隊捧盃',
    effect: { popularityBonus: 8 }, // 一次性能力加成另外在 flow/eliteHonors.js 算(當季最強項)，不寫死在這裡
  },
  /* 球王：使用者定案的封頂認證，對照現實中梅西/C羅式的「累積獎項比較」
     (見 core/state.js S.trophyCount 的稽核說明)——不是「有沒有拿過」，
     是「拿了幾座」，跟這個系統其餘「集合成員資格」型的稱號(拿過就封存)
     完全不同的判定邏輯，獨立欄位追蹤，不能沿用 S.honors.includes() 那套。
     門檻(10)是這輪先射的方向，還沒跑種子掃描校準，之後數字可能會調整。 */
  GOAT: {
    label: '球王',
    tier: 'ELITE',
    positions: null,
    milestoneType: 'compound',
    cond: '生涯累積金球獎+金靴獎+俱樂部冠軍+世界盃冠軍座數合計達 25 座以上',
    effect: { popularityBonus: 20 },
  },
  CLUB_LEGEND: {
    label: '隊史傳奇',
    tier: 'ELITE',
    positions: null,
    milestoneType: 'threshold',
    seasonsAtClubThreshold: 7, // 實測校準：headless隨機下常因晉級/挖角換東家，10季門檻幾乎摸不到
    cond: '同一家俱樂部效力7季以上 + 曾捧盃',
    effect: { retireCapDelay: 2, wagePremium: 0.10 },
  },
};
