/* ---------- 訓練夥伴/對手 ---------- */
/* 以戀愛線(data/love.js/flow/romance.js)為模板，套進訓練線。目前定案
   (使用者兩輪校正後的最終版本，完整說明見 flow/trainingRivalry.js
   開頭)：
     起點(認識新對手/夥伴) — 年度自動觸發，不看這季選了什麼類別，青訓/
       職業生涯都適用(見 flow/trainingRivalry.js evaluateTrainingEncounter)。
     後續(CROSSROADS：較勁 vs 合作) — 只有這季真的選了訓練類別才會
       評估，不是 ambient(見 flow/trainingRivalry.js
       evaluateTrainingRivalryMoment)——使用者原話：「你要持續訓練才會
       有互動...所以才是有訓練才能繼續走下去」，這點跟戀愛線的求婚/
       出軌誘惑(不看類別，純 ambient)不一樣，不要套用同一個假設。

   跟球隊綁定，不是跟球員綁定：換東家(flow/transfer.js/loan.js 既有的
   S.squadChemistry 重置點)舊夥伴自然收尾，新東家要重新遇到人才會有
   新的(起點還是自動觸發，不用玩家主動選訓練，只是「還沒遇到」而已)。

   羈絆時刻(BOND_MOMENT_HONOR)：這條線標準審視(見 flow/trainingRivalry.js
   稽核紀錄)抓出來的缺口——CROSSROADS(較勁/合作)是唯一機制，可以無限
   重複，沒有戀愛線求婚/婚禮那種「一次性、有份量」的高潮節點。使用者
   定案：夥伴關係滿一定年數後，自動評估一次(不是玩家選擇，命運安排的
   高潮時刻)，真的有輸有贏(不像 CROSSROADS 保證成功)，效果不落在個人
   能力/隊伍核心力上，而是疊加在「所在球隊拿下杯賽/世界盃的機率」這兩
   個既有機率池上(見 flow/trainingRivalry.js checkTrainingBondMoment、
   flow/proSeason.js/flow/worldCup.js 的疊加點)——玩家真的能感覺到這個
   稱號「讓球隊變強了」，不是純敘事裝飾。 */

export const TRAINING_PARTNER_NAME_POOL = [
  '子安',
  '柏宏',
  '彥廷',
  '書豪',
  '致遠',
  '晉宇',
  '亮宇',
  '威廷',
  '俊傑',
  '奕安',
  '祐維',
  '柏毅',
  '子軒',
  '冠佑',
  '睿恩',
  '彥霖',
  '振宇',
  '嘉良',
];

/* RIVAL(競爭對手)：良性較勁，選「較勁」時個人成長效果比 COMRADE 更好，
   但摩擦事件(frictionMult)也更容易發生——鎂光燈焦點型隊友，處不好會
   真的傷感情。COMRADE(訓練夥伴)：合作取向，選「合作」時隊伍核心力
   效果比 RIVAL 更好，摩擦機率低很多，是相對省心的關係。兩者都不是
   「必須選對邊」的正確答案，是兩種不同的敘事/機制風格，呼應戀愛線
   PARTNER_TYPE 的「光鮮亮麗高風險 vs 平淡踏實低風險」設計語言。 */
export const TRAINING_PARTNER_TYPE = {
  RIVAL: {
    label: '競爭對手',
    frictionMult: 1.4,
    competeGrowthBonus: 1, // 疊加在 COMPETE_GROWTH_POINTS 上的額外點數
    // 稽核抓出來的密度落差：原本只有 3 句，對照戀愛線 7 種對象各自的
    // 文案密度明顯單薄——擴充到 6 句，用 ri() 真隨機挑，降低重複感。
    flavorTitles: [
      '同位置的頭號競爭者',
      '一心想搶你位置的新秀',
      '教練嘴裡常拿來比較的那個人',
      '賽前總愛放狠話的傢伙',
      '跟你搶了好幾季先發位置的人',
      '教練最愛拿來刺激你進步的那把尺',
    ],
  },
  COMRADE: {
    label: '訓練夥伴',
    frictionMult: 0.6,
    cooperateChemistryBonus: 3, // 疊加在 COOPERATE_CHEMISTRY_BONUS 上的額外量
    flavorTitles: [
      '固定一起加練的搭檔',
      '更衣室裡最聊得來的隊友',
      '總是陪你留到最後的那個人',
      '低潮時第一個找你聊聊的人',
      '訓練菜單總會順手幫你抄一份的人',
      '更衣室氣氛的定海神針',
    ],
  },
};

/* CROSSROADS(較勁/合作)累積選了幾次的稱號——這輪計畫明確排除、這次補齊
   的第二項。比照 data/growth.js RISK_TIER_TITLE 的形狀(兩條平行賽道，
   各自 TIER1/TIER2 兩階)：這個專案裡「累積選了某個選項幾次」的稱號
   一律是這個形狀(RISK_TIER_TITLE/TRAINING_MASTERY/OPPORTUNITY_MASTERY/
   SOCIAL_MASTERY 都是)，這裡延續同一個慣例，不發明新的三階/單軌形狀。
   只到 TIER2(RARE)為止，不加 ELITE——這個系統裡「累積選了幾次」類型的
   稱號從來沒有到 ELITE 過，維持一致。TIER2 的 effect 疊加在
   flow/trainingRivalry.js 對應的成長/隊伍核心力增量上，形成越投入越
   強化的正回饋，跟 TRAINING_MASTERY.TIER2/RISK_TIER_TITLE 的 permanent-
   bonus-on-unlock 寫法一致。 */
export const RIVALRY_TIER_TITLE = {
  COMPETE: {
    TIER1: {
      label: '不服輸的性格',
      tier: 'COMMON',
      threshold: 4,
      cond: '生涯累積在訓練夥伴/對手的抉擇裡選擇「較勁」達 4 次以上',
      effect: { popularityBonus: 2 },
    },
    TIER2: {
      label: '較勁成癮',
      tier: 'RARE',
      threshold: 9,
      cond: '生涯累積在訓練夥伴/對手的抉擇裡選擇「較勁」達 9 次以上',
      effect: { competeGrowthFlatBonus: 1 },
    },
  },
  COOPERATE: {
    TIER1: {
      label: '好隊友',
      tier: 'COMMON',
      threshold: 4,
      cond: '生涯累積在訓練夥伴/對手的抉擇裡選擇「合作」達 4 次以上',
      effect: { popularityBonus: 2 },
    },
    TIER2: {
      label: '更衣室的黏著劑',
      tier: 'RARE',
      threshold: 9,
      cond: '生涯累積在訓練夥伴/對手的抉擇裡選擇「合作」達 9 次以上',
      effect: { cooperateChemistryFlatBonus: 2 },
    },
  },
};

/* 羈絆時刻：夥伴關係滿一定年數後自動評估一次的高潮事件(見上面檔案開頭
   的稽核說明)。RARE tier，不到 ELITE——跟 RIVALRY_TIER_TITLE 同一個
   理由，這個生涯線的稱號從來沒有到 ELITE 過，維持一致。effect 的兩個
   數字是同一組(cupBoost/wcBoost 都是 +0.03)，疊加在 flow/proSeason.js
   的俱樂部杯賽 buzzBoost、flow/worldCup.js 的世界盃 readinessBoost 上；
   失敗時 flow/trainingRivalry.js 直接拿這組數字除以 2 當懲罰(不另外定義
   一組失敗數值)，懲罰刻意只有成功的一半，向上流動不卡關——downside
   不該跟 upside 一樣重。

   命名：原本的「勝負手」「團結球隊」是使用者隨口定案的名字，這次改版
   換掉，改參考《實況野球》系列特殊能力/二つ名的命名慣例——短(3-4字)、
   直接用「這種人叫什麼」的稱謂型態(勝負師/精神支柱都是原版遊戲裡真的
   會用的措辭)，跟這個專案原本「累積選了幾次」那批稱號(不服輸的性格/
   較勁成癮等，偏敘事性的完整短句)刻意做出風格區隔——見
   [[feedback_honor_naming_convention]] 的完整規則：機制觸發型的稱號
   (單次事件解鎖，強調「這個人在那個當下展現了什麼」)用實況野球式的
   短稱謂，累積型/人生敘事型的稱號維持原本的長句風格，不要混用同一套
   命名邏輯套所有稱號。 */
export const BOND_MOMENT_YEARS_THRESHOLD = 6;
export const BOND_MOMENT_SUCCESS_CHANCE = 0.65;
export const BOND_MOMENT_HONOR = {
  RIVAL: {
    label: '勝負師',
    tier: 'RARE',
    cond: '跟同一位訓練對手保持關係滿 6 年後，迎來一場公開對決並勝出',
    effect: { cupBoost: 0.03, wcBoost: 0.03 },
  },
  COMRADE: {
    label: '精神支柱',
    tier: 'RARE',
    cond: '跟同一位訓練夥伴保持關係滿 6 年後，迎來一次團結時刻並成功',
    effect: { cupBoost: 0.03, wcBoost: 0.03 },
  },
};
