/* ---------- 場外稱號：人氣值本身的里程碑 ---------- */
/* 稽核時發現場外稱號只有花名在外的球星/商業頭腦兩個，太單薄——這裡補上
   跟人氣值(S.popularity)直接掛勾的三個稱號，內部也分常見/精英兩級，
   讓「非球技」的生涯敘事有自己完整的難度階梯，不是只有戀愛/財富兩條
   孤立的線。人氣值累積速度已經在 yearlyOptions.js 的社交/機會選項裡
   定案，這裡不重新設計成長速度，只是在既有的累積路徑上插旗標記里程碑。 */
/* 門檻經 3000 種子實測人氣值分布校準：中位數35、70%ile 44、85%ile 52、
   95%ile 62、99%ile 74——原本 10/30/50 的門檻分別落在分布的極低端(幾乎
   全員達標，LOCAL_CELEBRITY 實測 96.85%)，形同虛設，這裡下修成貼著
   70%/85%/99%ile 的水準，才對得起「常見/常見/精英」該有的區隔。 */
export const FAME_HONOR = {
  LOCAL_CELEBRITY: {
    label: '小有名氣',
    tier: 'OFFPITCH_COMMON',
    popularityThreshold: 45,
    cond: '人氣值累積達45',
    effect: { outsideIncomeMultBonus: 0.05 },
  },
  MEDIA_DARLING: {
    label: '社群寵兒',
    tier: 'OFFPITCH_COMMON',
    popularityThreshold: 58,
    cond: '人氣值累積達58',
    effect: { outsideIncomeMultBonus: 0.1 },
  },
  /* 精英層額外疊加「已解鎖至少2個其他稱號」——單純人氣衝高不夠格拿到
   　場外最高層，要跟其他生涯成就疊在一起，才對得起「全球偶像」這個份量。 */
  GLOBAL_ICON: {
    label: '全球偶像',
    tier: 'OFFPITCH_ELITE',
    popularityThreshold: 70,
    otherHonorsRequired: 2,
    cond: '人氣值累積達70 + 已解鎖至少2個其他稱號',
    effect: { outsideIncomeMultBonus: 0.2 },
  },
};
