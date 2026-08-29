/* ---------- 機會線：經紀人 ---------- */
/* 架構完全比照訓練夥伴線(data/trainingPartner.js/flow/trainingRivalry.js)，
   這是這輪設計討論定案的三條並列側線裡的第三條——起點/類型/CROSSROADS/
   離開/高潮事件，跟訓練夥伴線逐項對照過(見稽核記錄)，只有一個刻意的
   結構性差異：

   起點門檻卡在「真的轉正式之後」——業餘球員不會有經紀人主動找上門，這點
   跟戀愛線/訓練夥伴線(青訓期就有)不一樣，是使用者明確確認過的方向。
   因此這條線完全不碰 flow/youthChoice.js/flow/careerStart.js，青訓期
   沒有經紀人這回事，不是漏做。

   其餘全部對齊訓練夥伴線：
     起點(認識經紀人) — 完全自動，不看這季選了什麼類別，玩家選接受或
       婉拒(見 flow/agentLine.js evaluateAgentEncounter)。
     CROSSROADS(大膽操作/穩紮穩打) — 只有這季真的選了機會類別才會評估，
       不是 ambient，呼應「你要持續投入機會類別，經紀人才有事情跟你談」，
       跟訓練線「有訓練才能繼續走下去」同一個道理。
     離開(經紀人主動離開，轉去代理更大牌的球星) — ambient，依合作年數
       分級敘事。
     高潮事件(世紀交易) — 合作滿一定年數，這季選了機會類別才會評估，
       自動判定(不是玩家選擇)，真的有輸有贏，效果留在機會線自己的地盤
       (薪資溢價/合約風險折扣)，不用像訓練線那樣借用別的系統。 */

export const AGENT_NAME_POOL = [
  '陳志豪',
  '林嘉文',
  '黃俊傑',
  '吳建宏',
  '張凱倫',
  '劉子謙',
  '許明哲',
  '蔡宗翰',
  '鄭偉倫',
  '賴俊安',
  '謝承恩',
  '楊子睿',
];

/* 野心家經紀人：話術一流，敢幫你要天價合約、敢主動聯繫豪門，大膽操作
   效果比穩健型更好，但摩擦事件(frictionMult)也更容易發生——跟俱樂部
   的關係比較容易起摩擦，鎂光燈焦點型經紀人，處不好會真的傷關係。
   穩健經紀人：把長期利益放第一，穩紮穩打效果比野心家型更好，摩擦機率
   低很多，是相對省心的合作關係。兩者都不是「必須選對邊」的正確答案，
   呼應訓練夥伴線 RIVAL/COMRADE 的「兩種不同的機制風格」設計語言。 */
export const AGENT_TYPE = {
  AMBITIOUS: {
    label: '野心家經紀人',
    frictionMult: 1.4,
    boldBuzzBonus: 0.05, // 疊加在 BOLD_MOVE_TRANSFER_BUZZ_GAIN 上的額外量
    flavorTitles: [
      '話術一流的談判高手',
      '敢幫你要天價合約的人',
      '永遠嫌你賺得不夠多的經紀人',
      '三句話不離「你值得更好的」的那種人',
      '手機24小時開機、隨時在談判的人',
      '把你的每一次露面都當成談判籌碼的人',
    ],
  },
  STEADY: {
    label: '穩健經紀人',
    frictionMult: 0.6,
    steadyDiscountBonus: 0.02, // 疊加在 STEADY_MOVE_RISK_DISCOUNT_GAIN 上的額外量
    flavorTitles: [
      '把你的長期利益放第一位的人',
      '合約細節看得比誰都仔細的人',
      '從不亂開空頭支票的經紀人',
      '總是提醒你「穩一點比較好」的人',
      '寧可少賺也不讓你簽壞合約的人',
      '每份合約都要親自逐條看過才放心的人',
    ],
  },
};

/* CROSSROADS(大膽操作/穩紮穩打)累積選了幾次的稱號——比照
   data/trainingPartner.js RIVALRY_TIER_TITLE 同一個形狀(兩條平行賽道，
   各自 TIER1/TIER2 兩階，只到 RARE 為止不加 ELITE，這個專案「累積選了
   幾次」型的稱號一律是這個形狀，不發明新的)。TIER2 的 effect 疊加在
   flow/agentLine.js 對應的薪資溢價/風險折扣增量上，形成越投入越強化
   的正回饋，跟 RIVALRY_TIER_TITLE.TIER2 同一種 permanent-bonus-on-
   unlock 寫法。 */
export const AGENT_CROSSROADS_TITLE = {
  BOLD: {
    TIER1: {
      label: '敢賭的性格',
      tier: 'COMMON',
      threshold: 4,
      cond: '生涯累積在經紀人的抉擇裡選擇「大膽操作」達 4 次以上',
      effect: { popularityBonus: 2 },
    },
    TIER2: {
      label: '豪賭成癮',
      tier: 'RARE',
      threshold: 9,
      cond: '生涯累積在經紀人的抉擇裡選擇「大膽操作」達 9 次以上',
      effect: { transferBuzzFlatBonus: 0.03 },
    },
  },
  STEADY: {
    TIER1: {
      label: '穩紮穩打的信條',
      tier: 'COMMON',
      threshold: 4,
      cond: '生涯累積在經紀人的抉擇裡選擇「穩紮穩打」達 4 次以上',
      effect: { popularityBonus: 2 },
    },
    TIER2: {
      label: '合約談判的定心丸',
      tier: 'RARE',
      threshold: 9,
      cond: '生涯累積在經紀人的抉擇裡選擇「穩紮穩打」達 9 次以上',
      effect: { releaseRiskDiscountFlatBonus: 0.02 },
    },
  },
};

/* 世紀交易：合作滿一定年數後自動評估一次的高潮事件，比照
   data/trainingPartner.js BOND_MOMENT_HONOR 的雙軌設計(RARE tier，不到
   ELITE，跟這條線其餘稱號維持一致)。effect 疊加在機會線自己的地盤——
   薪資溢價(wagePremiumBonus)/合約風險折扣(releaseRiskDiscount)，不用
   像訓練線那樣借用別的系統的機率池，因為機會線本來就有自己的資源可以
   花。失敗時 flow/agentLine.js 直接拿這組數字除以2當懲罰(不另外定義一
   組失敗數值)，懲罰刻意只有成功的一半，向上流動不卡關。稱號命名比照
   《實況野球》風格的短稱謂(見 [[feedback_honor_naming_convention]])——
   單次事件觸發型稱號用這種風格，跟上面 AGENT_CROSSROADS_TITLE 的長句
   敘事型刻意做出區隔。 */
export const AGENT_BOND_YEARS_THRESHOLD = 6;
export const AGENT_BOND_SUCCESS_CHANCE = 0.65;
export const AGENT_BOND_HONOR = {
  AMBITIOUS: {
    label: '操盤手',
    tier: 'RARE',
    cond: '跟同一位經紀人合作滿 6 年後，談成一筆世紀交易',
    effect: { wagePremium: 0.05, releaseRiskDiscount: 0.03 },
  },
  STEADY: {
    label: '軍師',
    tier: 'RARE',
    cond: '跟同一位經紀人合作滿 6 年後，談成一筆世紀交易',
    effect: { wagePremium: 0.05, releaseRiskDiscount: 0.03 },
  },
};
