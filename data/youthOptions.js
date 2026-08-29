/* ---------- 青訓期年度選項：訓練／機會／社交 ---------- */
/* 稽核抓出來的缺口：青訓三年(runYouthToDebut 的 stageYr 1→3)之前是純被動
   自動成長(youthYearTick 直接朝潛力天花板加，玩家零介入)，跟職業生涯
   「每一年都是你的選擇」這個核心賣點完全不一致——這三年剛好還是生涯最
   前段、最該建立角色雛形的階段。這裡補上跟 yearlyOptions.js 同一種
   「訓練／機會／社交，一年三選一」的結構，方向對照職業生涯版本延續：

     訓練選項 — 主：能力值成長方向(均衡 vs 主攻優勢項目)。
     機會選項 — 主：轉正式淘汰率(呼應「向上機會」——玩家主動爭取表現，
       不是純看骰子)。副：象徵性小幅能力值，跟職業版機會選項同一種份量。
     社交選項 — 主：三個不同的青訓期專屬效果(隊友默契/提前累積人氣/
       家人陪伴降低出道傷病風險)，刻意不做「全能力值加成」這種會
       跟訓練選項搶地盤的效果——跟職業版「機會/社交選項不動能力值本身」
       的分工原則一致。

   青訓期還沒有俱樂部/薪水，所以不像職業版那樣有 stage/calendar/cost
   三個篩選軸——三年都一樣開放全部選項，不用另外分階段，範圍小沒必要
   疊加篩選邏輯。判定/成長公式在 flow/youthChoice.js，這裡只定靜態表。 */

export const YOUTH_TRAINING_OPTION = {
  BALANCED: {
    label: '均衡訓練',
    desc: '全能力值平均朝潛力天花板成長，穩紮穩打。',
    growthMode: 'all',
  },
  /* 對照職業版 FOCUSED：鎖定潛力天花板最高的一項，這裡的風險層(±1/2/3)
     只打在這一項上。稽核抓出來的兩個舊文案斷點，這輪一併修掉：
     1. growthBoostMult 這個欄位在骰子/風險層拆成兩套機制之後已經沒有
        任何地方在讀，「成長大幅提升」是對照那個死欄位寫的舊文案，拿掉。
     2. 「其他能力這年完全不練」在骰子(大頭)還跟這個選項綁在一起時是真的，
        現在季初骰子已經拆成獨立步驟(見 flow/seasonOpener.js)，每年開始
        就先由玩家自由分配掉了，不受這裡選了哪個子選項影響——選
        FOCUSED 現在只代表「風險層這一小筆點數鎖定打在哪」，不代表整年
        其他能力完全停滯，文案改成準確描述這一層的效果。 */
  FOCUSED: {
    label: '主攻優勢項目',
    desc: '風險層集中鎖定潛力天花板最高的一項來練。',
    growthMode: 'single',
  },
  /* 對照職業版 CONDITIONING/VETERAN_WISDOM 的體能/對抗集合，青訓期版本：
     還沒定型主攻方向的球員，先把「地基型」的體能/對抗練起來，出道後
     比較不會因為身體條件輸在起跑點——跟 BALANCED(全能力平均)/
     FOCUSED(單項衝刺)刻意錯開，補上「先打底子，方向以後再說」這個
     選擇，也是很多真實球員青訓期真的會走的路。 */
  PHYSICAL_BASE: {
    label: '打底體能',
    desc: '把重心放在體能/對抗這種地基型能力上，不急著定型主攻方向，先讓身體條件跟上。',
    growthMode: 'physical',
  },
};

/* 機會選項不碰能力值成長(那是訓練選項的地盤)，動的是「轉正式淘汰率」——
   呼應「向上機會」：玩家主動爭取被看見，不是完全交給骰子。cutRateMult
   疊乘在 PATHS 原本的 cutRate 上(見 flow/careerStart.js resolveDebut)，
   跟 YOUTH_WC_CUT_RATE_MULT(入選青年世界盃的淘汰率折扣)是同一個機制、
   同一個欄位語意，可以疊加。 */
export const YOUTH_OPPORTUNITY_OPTION = {
  SHOWCASE_MATCH: {
    label: '參加公開選拔賽',
    desc: '主：在球探面前公開露臉的機會，降低轉正式淘汰率。副：小幅能力值。',
    cutRateMult: 0.92,
    abilityNudge: 1,
  },
  SCOUT_VISIT: {
    label: '邀請球探到場觀察',
    desc: '主：直接請球探來看訓練，淘汰率降幅比公開選拔賽更大，但沒有額外能力值。',
    cutRateMult: 0.85,
  },
  /* 效果量級刻意卡在 SHOWCASE_MATCH 跟 SCOUT_VISIT 之間，多一種取捨——
     不是每年都要選同一顆最大降幅的按鈕，讓青訓期的機會選項也有真正的
     選擇空間，不只是「哪個數字比較大就選哪個」。 */
  POSITION_VERSATILITY: {
    label: '嘗試多個位置',
    desc: '主：讓教練組看到你適應不同戰術角色的可能性，轉正式淘汰率小幅下降。副：小幅能力值。',
    cutRateMult: 0.95,
    abilityNudge: 1,
  },
};

/* 社交選項青訓期沒有戀愛/代言可以經營(還沒出道，沒有俱樂部/人氣基礎)，
   三個子選項各自連到不同的跨系統效果，刻意不重疊訓練/機會選項的地盤：
     TEAM_BONDING — 跟機會選項的 abilityNudge 同一種份量的小幅能力值，
       不是全能力值加成(那樣會變成另一個訓練選項)。
     LOCAL_FAME — 提前埋 S.popularity 種子，出道那一刻職業生涯的代言
       收入(見 flow/proSeason.js)就已經有基礎，不是從零開始。
     FAMILY_SUPPORT — 疊乘 S.debutInjuryMult，只在出道後「第一次」骰
       新傷時生效一次就歸1(見 flow/proSeason.js rollInjury)，代表身心
       底子打得穩，出道適應期比較不容易受傷。 */
export const YOUTH_SOCIAL_OPTION = {
  TEAM_BONDING: {
    label: '融入隊友',
    desc: '主：跟隊友一起訓練培養默契，小幅能力值。',
    abilityNudge: 1,
  },
  LOCAL_FAME: {
    label: '打出地方知名度',
    desc: '主：在地方媒體/球迷間先闖出點名號，出道時就帶著基礎人氣，職業生涯一開局就有代言收入。',
    popularitySeed: 2,
  },
  FAMILY_SUPPORT: {
    label: '家人陪伴',
    desc: '主：家人陪著撐過選拔壓力最大的幾年，出道後第一季受傷機率降低。',
    debutInjuryMult: 0.7,
  },
  /* 跟 LOCAL_FAME(人氣種子)是同一個效果家族但份量更輕、疊加能力值——
     LOCAL_FAME 是「已經闖出點名號」的結果，這個是「提前學會怎麼面對
     鏡頭」的準備動作，兩者可以並存(不同季分別選)，人氣種子疊加。 */
  MEDIA_TRAINING: {
    label: '接受媒體應對訓練',
    desc: '主：提前學會面對鏡頭，出道後場外話題的處理更成熟，疊加小幅人氣種子。副：小幅能力值。',
    popularitySeed: 1,
    abilityNudge: 1,
  },
};
