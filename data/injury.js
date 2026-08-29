/* ---------- 傷病系統（四階＋debuff） ---------- */
/* 對照棒球版：湯米約翰手術是投手專屬的單一大傷敘事。足球版傷病更泛用，
   不分位置給同一套四階分級，位置差異(誰比較容易受傷)留給 engine/injury.js 的
   發生機率去處理，這裡只定「傷了之後會怎樣」的靜態表。

   傷病本質是 debuff：statDebuff 直接扣在受傷期間的能力分上，跟 decline.js 的
   衰退是永久性不同，傷病debuff 是暫時性的，隨恢復或時間結束就消失
   （除了大傷可能留永久殘留，見下）。

   惡化不是傷勢自己隨機變重，是玩家「帶傷上陣」選擇賭出來的：
   休養 = 照表訂時間全恢復，零惡化風險；帶傷上陣 = 不損失出賽時間，
   但每次都有機率惡化到下一階。這樣「機率變成更嚴重的傷勢」有清楚的因果，
   不是純隨機倒楣，是一個可以理解、可以後悔的賭注。 */

export const INJURY_TIER_ORDER = ['MINOR', 'SMALL', 'MEDIUM', 'MAJOR'];

export const INJURY_TIER = {
  MINOR: {
    label: '輕微傷',
    statDebuff: -3,
    restWeeks: [1, 2],
    playThrough: { escalateTo: 'SMALL', escalateChance: 0.15 },
  },
  SMALL: {
    label: '小傷',
    statDebuff: -6,
    restWeeks: [3, 5],
    playThrough: { escalateTo: 'MEDIUM', escalateChance: 0.20 },
  },
  MEDIUM: {
    label: '中傷',
    statDebuff: -10,
    restWeeks: [6, 12],
    playThrough: { escalateTo: 'MAJOR', escalateChance: 0.25 },
  },
  MAJOR: {
    label: '大傷',
    statDebuff: -16,
    surgeryRequired: true, // 沒有「帶傷上陣」選項，一定要開刀，只能選復健節奏
    rehab: {
      /* 保守復健：時間長但幾乎不會二次受傷 */
      conservative: { restWeeks: [24, 36], relapseChance: 0.05 },
      /* 積極趕進度：提早回歸，但有機率復發——復發直接打回 MAJOR 重新計時，
         而且這次不再開放選項，強制走保守復健(現實中球員/球隊在二次受傷後
         通常不會再冒險趕進度)。 */
      aggressive: { restWeeks: [16, 24], relapseChance: 0.30 },
    },
    /* 完全康復後仍有機率留下永久痕跡，扣在 decline.js 的衰退基準之外，
       是額外的固定永久 debuff，不會隨時間淡化。這是「大傷」跟「中傷」在
       生涯尾聲意義不同的地方——中傷痊癒後跟沒受傷一樣，大傷不一定。 */
    permanentResidual: { chance: 0.25, debuff: -3 },
  },
};

/* 恢復/惡化的實際觸發（每季判定一次 or 特定事件觸發、發生機率是否吃位置/年齡）
   留給 engine/injury.js，這裡只定四階的靜態數值表，跟其他 data/ 檔案同一個分工原則。 */
