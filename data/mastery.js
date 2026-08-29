/* ---------- 天賦與委身特質 ---------- */
/* 對照 traits.js PLAYING_STYLE 的份量感設計，但這組稱號的觸發邏輯不是
   單季 stat 門檻，是「骰子品質」(天才/埋沒的天才)或「生涯選擇習慣的
   長期累積」(三類別委身)，判定邏輯留給 flow/yearlyChoice.js/
   flow/youthChoice.js/flow/careerStart.js，這裡只定靜態表。

   天才／埋沒的天才：對照原版 YaKyoLife 查證過的機制(骰出夠多次「6」
   解鎖永久骰子保底)，但拆成兩個互斥的觸發窗口——天才只在青訓3年內
   看得到(「從小發現」)，錯過這個窗口，職業生涯早期(19-22歲)還有
   「埋沒的天才」這個第二次機會，兩者效果一樣、敘事不同。

   門檻第二次校準(這輪)：骰子成長系統從「只在選了訓練類別才骰」拆成
   獨立的「季初」步驟，每季固定發生一次(見 flow/seasonOpener.js)，不再
   看選了什麼類別——青訓3年/職業19-22歲(4季)骰子次數從原本「約1/3
   機率才骰」變成「每季必骰」，觸發率大幅上升，舊門檻(天才4次6/埋沒
   的天才5次6)在新頻率下會分別暴衝到約11%/約9%，稀有度完全跑掉。
   用純骰子蒙地卡羅(50萬次，跟遊戲主RNG無關，因為骰面數字本身不吃
   TRAINING_MULT/委身特質等乘數，只有點數池大小才吃，見 rollDie())
   重新算出「3季/4季累積擲出N次6」的完整分布，反推門檻：
     天才 6次6 → 實測0.89%(次高候選5次6是3.74%，超出目標區間更多，
       寧可稍微偏稀有也不要偏浮濫)。
     埋沒的天才 8次6 → 實測0.26%(次高候選7次6是1.09%，但這樣會比
       天才的0.89%還常見，違反「埋沒的天才該比正規路線更稀有」的
       設計意圖——8次6雖然比舊校準的0.46%錨點稀有一些，但正確維持了
       「比天才更難」的相對關係，這是比貼近舊錨點絕對值更重要的
       約束)。 */
export const GENIUS = {
  label: '天才',
  tier: 'ELITE',
  threshold: 6,
  cond: '青訓三年內，季初骰子累積擲出6次「6」',
  effect: { diceFloor: 4 },
};

export const LATE_BLOOM_GENIUS = {
  label: '埋沒的天才',
  tier: 'ELITE',
  threshold: 8,
  cond: '19-22歲期間，季初骰子累積擲出8次「6」(需先前沒拿過「天才」)',
  effect: { diceFloor: 4 },
};

/* 三類別委身：累積選了同一類別的次數(只算職業生涯，青訓3年太短不算)，
   8次/16次兩檔各解鎖一個特質。每條線的設計語言一致：第一檔是純益，
   第二檔的代價永遠指向「能力成長」這個大家共通的資源(訓練委身的代價
   反過來指向本業以外的場外收入)，讓三條線的取捨邏輯一致，玩家一眼
   看得懂「委身某條線，代價會出現在哪裡」。growthSpeedMult 是這裡新增
   的欄位語意——這輪改成只疊乘在風險層(±1/2/3)成功時的幅度上，跟季初
   骰子的池子(大頭)無關，見 flow/shared.js resolveRiskTier()。 */
/* effect 欄位盡量重用既有的一次性加成語意(跟 WEALTH_HONOR/WC_HONOR 同一種
   「解鎖當下疊加一次」寫法)，只有 diceFloor(骰子保底)/transferBuzzFlatBonus
   (每季持續生效的轉會買氣加成，因為 transferBuzz 本身會衰退，一次性加成
   意義不大)/growthSpeedMult(疊乘在風險層成功幅度上)這三個是真的需要
   「解鎖後持續生效」，其餘都是解鎖當下疊加一次到既有欄位就好。 */
/* 稽核抓出來的斷點(使用者提出「稱號取名要統一」)：這三條委身特質線
   跟 data/growth.js RISK_TIER_TITLE、data/trainingPartner.js
   RIVALRY_TIER_TITLE、data/agent.js AGENT_CROSSROADS_TITLE 是完全同一種
   機制形狀(累積選了同一件事 8/16 次、兩階解鎖)，後三者依
   [[feedback_honor_naming_convention]] 的「累積型用長句敘事風格」命名
   (不服輸的性格/較勁成癮/敢賭的性格/豪賭成癮…)，這三個委身特質卻是這個
   慣例定案「之前」命名的舊稱號(勤奮/特訓狂人/人脈玩家/精算人生/萬人迷/
   花天酒地)，維持著短稱謂風格——同一種機制、兩套命名邏輯，是真的沒
   統一，不是刻意的風格差異。改名對齊長句家族：TIER1 統一收在「X的性格」
   (跟不服輸的性格/敢賭的性格同一個模子)，TIER2 統一收在「X成癮」(跟
   較勁成癮/豪賭成癮同一個模子，也讓三條線的 TIER2 之間第一次真的讀得出
   同一個命名邏輯)。舊名稱只留在這則稽核紀錄跟 flow/narrate.js 的敘事句
   裡(改寫後的新句子)，程式邏輯只認 def.label，改名不影響任何判定。 */
export const TRAINING_MASTERY = {
  TIER1: {
    label: '埋頭苦練的性格',
    tier: 'RARE',
    threshold: 8,
    cond: '生涯累積選擇「訓練」類別達8次',
    // 保底跟天才(4點)拉齊，不是刻意做得比天才更強——使用者定案：
    // 「後天堅持追趕先天天賦」該是打平，不是反超，5點太多了。跟天才
    // 一樣用 Math.max 疊加(見 flow/shared.js applyMasteryEffect)，兩個都
    // 拿到也還是 4，不會疊加成更高。
    effect: { diceFloor: 4 },
  },
  TIER2: {
    label: '特訓成癮',
    tier: 'ELITE',
    threshold: 16,
    cond: '生涯累積選擇「訓練」類別達16次',
    // 稽核抓出來的斷點：這個檔位原本只有代價(outsideIncomeMultBonus)，
    // 沒有對應的好處——OPPORTUNITY_MASTERY/SOCIAL_MASTERY 的 TIER2 都是
    // 「一個好處+一個代價」成對出現，訓練這條線漏了那一半，變成「拿到
    // 稱號反而純粹變差」。使用者確認：單純加大風險層(小頭)那個小數字的
    // 加成是杯水車薪(真正決定終局能力值的是季初大頭骰子，跟選了哪個
    // 類別無關)，好處要接在真正有份量的地方——超過自己潛力軟上限之後
    // 的加倍成本(見 data/growth.js overPotentialMultiplier)打75折，直接
    // 影響「這輩子終局能拚到多高」，不是小幅疊加。跟 growthSpeedMult
    // 刻意分開一個欄位(不共用)，因為 growthSpeedMult 是機會/社交/風險層
    // 共用的通用成長速度係數，這個折扣只該對訓練類別的持有者生效，不能
    // 連帶讓機會選項的能力值副效果也跟著變便宜。
    effect: { outsideIncomeMultBonus: -0.08, overPotentialDiscountMult: 0.75 },
  },
};

/* 訓練線專屬稱號階梯，對照 data/wealth.js WEALTH_HONOR(投資/財富)、
   data/fame.js FAME_HONOR(人氣)——這輪稽核發現機會/社交線都各自有一條
   「專屬資源→稱號階梯→終局敘事」的完整生涯線，唯獨訓練線只有委身特質
   (TRAINING_MASTERY，看的是「選了幾次」)，沒有稱號階梯(看「練出了什麼
   成果」)，是三條線裡唯一「空心」的一條。門檻掛在 S.overPotentialLevelsGained
   (見 flow/shared.js addAbilityPoints)——這是刻意選的資源：不是看誰的
   能力值絕對值高(那是季初大頭骰子誰都拿得到，不特別代表「認真練」)，
   而是看「練出了多少級超過自己天生潛力軟上限的成長」，只有真的持續
   投入風險層/季初分配才會疊出這個數字，直接呼應「後天努力」的敘事，
   跟 PLAYSTYLE/PLAYING_STYLE(看「現在多強」)是不同性質的兩把尺。
   門檻經 6000 種子實測分佈校準(min0/max52/中位數14)，比照 FAME_HONOR
   「貼著70/90/99百分位」的校準手法：p70=21/p90=28/p99=37，達成率
   約30%/10%/1%，跟 FAME_HONOR 的稀有度曲線同一個形狀。 */
export const TRAINING_HONOR = {
  BREAKTHROUGH: {
    label: '苦練出頭',
    tier: 'COMMON',
    threshold: 21,
    cond: '生涯累積練出超過自己潛力的能力等級數達 21 級以上',
    effect: { popularityBonus: 3 },
  },
  SELF_TRANSCENDENCE: {
    label: '自我突破',
    tier: 'RARE',
    threshold: 28,
    cond: '生涯累積練出超過自己潛力的能力等級數達 28 級以上',
    // 疊乘在特訓成癮(TRAINING_MASTERY.TIER2)同一個欄位上：兩條門檻本來
    // 就高度相關(都是「持續投入訓練」的結果)，兩個都拿到會疊出更深的
    // 折扣(0.75×0.85≈0.64)，是「雙管齊下」的合理獎勵，不是無意義重複。
    effect: { overPotentialDiscountMult: 0.85 },
  },
  LIMIT_BREAKER: {
    label: '血肉之驅的極限',
    tier: 'ELITE',
    threshold: 37,
    cond: '生涯累積練出超過自己潛力的能力等級數達 37 級以上',
    effect: { outsideIncomeMultBonus: 0.15 },
  },
};

export const OPPORTUNITY_MASTERY = {
  TIER1: {
    label: '廣結善緣的性格',
    tier: 'RARE',
    threshold: 8,
    cond: '生涯累積選擇「機會」類別達8次',
    effect: { transferBuzzFlatBonus: 0.03 }, // 每季持續生效，見 core/state.js S.transferBuzzFlatBonus
  },
  TIER2: {
    label: '精算成癮',
    tier: 'ELITE',
    threshold: 16,
    cond: '生涯累積選擇「機會」類別達16次',
    effect: { wagePremiumGain: 0.05, releaseRiskDiscountGain: 0.05, growthSpeedMult: -0.1 }, // 前兩個一次性疊加到既有欄位(跟 EXEC_NETWORKING 同名效果共用欄位)
  },
};

export const SOCIAL_MASTERY = {
  TIER1: {
    label: '樂於交際的性格',
    tier: 'RARE',
    threshold: 8,
    cond: '生涯累積選擇「社交」類別達8次',
    effect: { popularityBonus: 3 }, // 一次性疊加到 S.popularity(跟其他稱號的 popularityBonus 同一種寫法)
  },
  TIER2: {
    label: '社交成癮',
    tier: 'ELITE',
    threshold: 16,
    cond: '生涯累積選擇「社交」類別達16次',
    effect: { outsideIncomeMultBonus: 0.15, growthSpeedMult: -0.1 },
  },
};
