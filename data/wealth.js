/* ---------- 資產：場外財富的主動玩法 ---------- */
/* 稽核抓出來的缺口：存款(S.savings)修完「只出不進」的漏洞後，變成穩定
   累積但沒地方主動花的數字——三個類別的付費選項(PRIVATE_CAMP/PR_FIRM/
   IMAGE_MANAGEMENT)存款夠了幾乎必點，玩法上退化成「有錢就無腦點」。
   這裡補一組真正有主動玩法、有真實代價的財富分支，呼應「向上流動」延伸
   到球場外——不是加一堆穩賺不賠的選項，而是真的能賭、能一擲千金、
   能買下球隊翻轉「玩家對轉會完全沒有主導權」這個既有缺口的終局路線。

   分兩塊：
     投資(INVESTMENT_TIER)——真的有下檔風險，不是穩賺，避免重蹈「付費
       選項永遠碾壓免費版」的覆轍(見 flow/yearlyChoice.js 稽核記錄)。
     買下球隊(見 flow/transfer.js checkDemotion/evaluateLateralMoveOffer
       的 S.ownsClub 守衛)——單向門，一旦買下就不會再被降級/挖角，
       是用錢買回生涯主導權的終局路線，不只是一句 flavor text。 */

/* portion：這次投資動用「目前存款」的比例(不是固定金額，存款越多賭注
   越大，跟人生階段自然接軌)。outcomeRange：結果乘數的骰值範圍，
   [min,max] 都是真數字，min<1 代表真的會虧錢，不是包裝過的穩賺。
   CONSERVATIVE 範圍窄、稍微偏正——小賺小賠；AGGRESSIVE 範圍寬、
   期望值更高但下檔也更深——大賺大賠，賭性堅強才適合。 */
export const INVESTMENT_TIER = {
  CONSERVATIVE: { label: '保守理財', portion: 0.35, outcomeRange: [0.85, 1.3] },
  AGGRESSIVE: { label: '積極操盤', portion: 0.5, outcomeRange: [0.4, 2.2] },
};

/* 對照 love.js LOVE_HONOR/national.js WC_HONOR 的份量感設計：門檻是生涯
   累積的投資淨賺次數，不是單次事件，玩家長期選擇累積出來的結果才拿得到。
   跟 PLAYBOY_STAR 是同一種「第三條生涯定位軸線」設計——球技/感情/財富
   三條線並存，終局的 honors 不會全部服務同一種「你多會踢球」的敘事。 */
export const WEALTH_HONOR = {
  SHREWD_INVESTOR: {
    label: '商業頭腦',
    tier: 'OFFPITCH_RARE',
    cond: '生涯投資淨賺次數達 5 次以上',
    effect: { popularityBonus: 4 },
  },
  /* 破產傳奇：曾經一擲千金歸零(見 yearlyOptions.js BLOW_IT_ALL/
     S.everBlewItAll)，之後又靠薪資/投資把存款重新累積回去——逆轉話題性，
     跟 SHREWD_INVESTOR 同一個場外稀有層，但敘事上是「跌到谷底又爬回來」，
     不是「一路穩健」，兩個稱號不衝突，可以同時拿到。門檻經實測校準：
     BLOW_IT_ALL 幾乎沒有 stage/tier 限制，玩了就有很高機率至少爽一次，
     原本 100 的回血門檻只是分布中位數，八成的人隨便打工都能跨過，形同
     虛設(實測 45.54%)——下修到需要真的重新累積出一筆可觀財富(300)，
     才對得起「傳奇」這兩個字。 */
  RAGS_TO_RICHES: {
    label: '破產傳奇',
    tier: 'OFFPITCH_RARE',
    recoverySavingsThreshold: 20000000, // 歐元化重新校準(見 data/contract.js 開頭的稽核說明)
    cond: '曾一擲千金歸零，之後又累積回存款2000萬以上',
    effect: { popularityBonus: 6 },
  },
  /* 球隊老闆：BUY_CLUB(見 data/yearlyOptions.js)原本只設了 S.ownsClub
     旗標(給 flow/transfer.js 擋降級/挖角用)，沒有正式推進 S.honors——
     這裡補上，讓「買下球隊」這個場外精英層的終極結局在生涯稱號清單裡
     看得到，不只是機制上生效。 */
  /* 小股東：買下球隊(CLUB_OWNER)前的台階，見 data/yearlyOptions.js
     BUY_CLUB_SHARES_FAME/AGENT 的稽核說明——機會線(經紀人)專屬解鎖，
     入股之後買斷球隊會打折。純象徵性的中繼稱號，不到 CLUB_OWNER
     (OFFPITCH_ELITE)那個等級，維持 RARE。 */
  CLUB_SHAREHOLDER: {
    label: '小股東',
    tier: 'OFFPITCH_RARE',
    cond: '入股球隊(BUY_CLUB_SHARES_FAME/BUY_CLUB_SHARES_AGENT)',
    effect: { popularityBonus: 5 },
  },
  CLUB_OWNER: {
    label: '球隊老闆',
    tier: 'OFFPITCH_ELITE',
    cond: '買下球隊(BUY_CLUB)',
    effect: { popularityBonus: 10 },
  },
  /* 梅老闆：使用者定案的財富巔峰稱號，觸發條件刻意選「場外收入這季超過
     球場薪水」——不用抽象的歐元門檻，玩家自己一看數字超車就懂，比任何
     金額數字都直觀(見 flow/wealthPeak.js checkBossMilestone 的稽核說明)。
     不限路徑：任何管道只要讓場外收入(人氣線的產出)超過薪水都算數，不
     特別要求走機會線——這點跟機會線/球王刻意收窄的範圍不同，是使用者
     明確定案要保持開放的。純象徵性的頂級榮耀，效果只給人氣加成，不加
     實質能力(使用者定案：「這些都是象徵性的頂級榮耀，不太需要加實質
     能力，頂多能夠維持狀態或是人氣增加」)。 */
  BOSS: {
    label: '梅老闆',
    tier: 'OFFPITCH_ELITE',
    cond: '單季場外收入超過球場薪水',
    effect: { popularityBonus: 12 },
  },
};
