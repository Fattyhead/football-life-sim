/* ---------- 戀愛系統 ---------- */
/* 對照原版棒球 core/state.js 的 love 物件：{st,partner,kids,caught,affairs,exes,dyrs,datedTimes}。
   結構沿用，但足球版讓交往對象類型「真的影響其他系統」，不只是換稱謂：
   知名度高的對象拉高場外代言收入(outsideIncome)，同時拉高緋聞風險；
   髮小知名度零、代言沒加成，但穩定度最高、緋聞風險最低——這是刻意的
   風險/報酬對照組，跟 traits.js 的常態徽章vs稀有標籤是同一種設計語言：
   「光鮮亮麗高風險」vs「平淡踏實低風險」，玩家自己選要哪種生涯敘事。 */

/* 狀態機刻意做成兩種不同成本的迴圈：
     SINGLE ⇄ DATING：自由更換，幾乎零代價——玩家想換對象、想體驗不同
       PARTNER_TYPE 的敘事線，隨時分手隨時換，這層存在的目的就是給玩家
       新鮮感/選擇自由，不是要模擬嚴肅的感情經營。分手對象丟進 exes[]，
       datedTimes 累加，沒有其他懲罰(見下 BREAKUP_EFFECT)。
     DATING → MARRIED → DIVORCED → 回到 SINGLE(可以再交往/再婚)：
       結婚要付出「婚禮季懲罰」，離婚要付出「精算代價」(見 DIVORCE_EFFECT)，
       這樣結婚才是一個有重量的決定，不會被玩家當成交往的同義詞隨便按。
       DIVORCED 只是過渡態，下一步立刻能回到 SINGLE 一樣自由交往，
       不是卡死的終局狀態——可以離了再交往、再婚，迴圈可以無限跑。 */
/* 交往對象的虛構姓名池，跟 flavorTitles 配對顯示(例如「頂流影后・小美」)——
   之前只有頭銜沒有名字(NPC講起來像個職稱不像個人)，UI 端要秀「配偶名字」
   才補上。純虛構名字，不分性別限定，跟哪個 PARTNER_TYPE 配對純隨機。 */
export const PARTNER_NAME_POOL = [
  '小美',
  '雨萱',
  '詩涵',
  '曉彤',
  '子墨',
  '承翰',
  '柏宇',
  '家瑋',
  '語安',
  '思穎',
  '奕辰',
  '欣妍',
  '品睿',
  '心妤',
  '冠廷',
  '芷若',
  '亭萱',
  '哲宇',
];

export const LOVE_STATUS = {
  SINGLE: 'single',
  DATING: 'dating',
  MARRIED: 'married',
  DIVORCED: 'divorced',
};

/* 交往中分手：低成本，這層迴圈存在的目的就是給玩家自由換對象的新鮮感。 */
export const BREAKUP_EFFECT = {
  seasonFormPenalty: 0,
  cost: 0,
};

/* fame: 0-3 知名度級距，用來決定緋聞被狗仔捕捉的基礎機率(留給 flow/events.js)。
   outsideIncomeMult: 疊加在 core/state.js 的 yearOutsideIncome 上的倍率。
   scandalRiskMult: 緋聞/被抓包事件的機率倍率，基準 1.0。
   stabilityBonus: 疊加在 seasonForm 基準上的小幅修正，穩定關係帶來的心理面加成，
     負值代表「光鮮亮麗但分心」，正值代表「平淡但安心」。 */
/* flavorTitles：生成 NPC 交往對象時隨機挑一個當稱謂，刻意用純描述性頭銜
   (好萊塢頂流、告示牌冠軍歌手...)而不是「改個諧音影射真人」的做法——
   這個系統本身有劈腿/被抓包/離婚/贍養費這些具體情節，把一個可辨識的
   真實公眾人物程序化套進捏造的出軌/離婚劇情，已經不是致敬式的諷刺，
   比較接近會惹上肖像權/名譽權爭議的用法。純描述性頭銜一樣有「感覺很真實」
   的味道，但沒有對應到具體人，配上完全虛構的姓名。 */
export const PARTNER_TYPE = {
  ACTRESS: {
    label: '演藝女星',
    fame: 3,
    outsideIncomeMult: 1.3,
    scandalRiskMult: 1.5,
    stabilityBonus: -1,
    flavorTitles: ['好萊塢新生代花旦', '奧斯卡影后候補', '串流影集女主角'],
  },
  ACTOR: {
    label: '演員',
    fame: 3,
    outsideIncomeMult: 1.3,
    scandalRiskMult: 1.5,
    stabilityBonus: -1,
    flavorTitles: ['好萊塢動作巨星', '奧斯卡影帝候補', '漫改電影主角'],
  },
  SINGER: {
    label: '歌手',
    fame: 3,
    outsideIncomeMult: 1.25,
    scandalRiskMult: 1.4,
    stabilityBonus: -1,
    flavorTitles: ['告示牌冠軍歌手', '格萊美常勝軍', '巡迴演唱會天后'],
  },
  INFLUENCER: {
    label: '網紅',
    fame: 2,
    outsideIncomeMult: 1.4,
    scandalRiskMult: 1.3,
    stabilityBonus: 0,
    flavorTitles: ['千萬粉絲網紅', '短影音帶貨女王', '直播界頂流'],
  },
  MODEL: {
    label: 'Model',
    fame: 3,
    outsideIncomeMult: 1.35,
    scandalRiskMult: 1.4,
    stabilityBonus: -1,
    flavorTitles: ['國際精品代言超模', '時尚雜誌封面常客', '伸展台常客名模'],
  },
  /* 跟演藝圈系列刻意拉開差異：知名度是「圈內/同城知名」而非主流家喻戶曉，
     所以 fame 給 2 不給 3；主流品牌代言不會找這個行業合作，outsideIncomeMult
     刻意壓最低；但正因為是反差配對，八卦媒體話題性最高，scandalRiskMult
     全對象類型裡最高；夜生活作息跟球員訓練節奏衝突大，stabilityBonus 也最低。 */
  DANCER: {
    label: '夜店紅牌舞孃',
    fame: 2,
    outsideIncomeMult: 1.05,
    scandalRiskMult: 1.6,
    stabilityBonus: -2,
    flavorTitles: ['夜店頭牌舞孃', '同城最紅艷舞紅牌', '夜生活圈知名人物'],
  },
  /* 髮小刻意設計成跟玩家同地區出身(REGION)，是「成名前就認識」的敘事錨點，
     知名度0、代言沒加成，但穩定度最高、緋聞風險最低——平淡但踏實的對照組。 */
  CHILDHOOD_FRIEND: {
    label: '髮小',
    fame: 0,
    outsideIncomeMult: 1.0,
    scandalRiskMult: 0.3,
    stabilityBonus: 2,
    flavorTitles: ['家鄉開早餐店的青梅竹馬', '大學同校的老朋友', '從小一起長大的鄰居'],
  },
};

/* 交往對象類型依知名度加權：稽核抓出來的缺口——PARTNER_TYPE 本來就設計了
   「髮小(fame:0) vs 演藝圈/網紅(fame:2-3)」的對照組，但 pickPartner() 之前
   是均勻隨機選，完全沒吃到這個區分，青訓剛出道跟紅到發紫的球星遇到的對象
   類型機率一樣，等於白設計了這個梯度。使用者定案：青訓/剛出道該多半是
   髮小，紅了之後該多半是明星/網紅。門檻沿用 data/fame.js FAME_HONOR 已經
   用 3000 種子校準過的人氣值分佈刻度(45/58/70)，不是另外發明一組新數字——
   同一個「人氣值」欄位，兩邊用同一把尺，玩家/我們之後調整都只用改一個
   地方就好。權重是這輪先上線的估計值，之後會用種子掃描驗證「青訓期髮小
   佔比/高人氣期明星佔比」是否真的呈現使用者要的階段轉變曲線，數字還會
   微調，不是這輪就要一次到位的最終版。 */
export const PARTNER_WEIGHT_BANDS = [
  { max: 20, weights: { CHILDHOOD_FRIEND: 60, INFLUENCER: 10, DANCER: 10, ACTRESS: 5, ACTOR: 5, SINGER: 5, MODEL: 5 } },
  { max: 45, weights: { CHILDHOOD_FRIEND: 35, INFLUENCER: 15, DANCER: 10, ACTRESS: 10, ACTOR: 10, SINGER: 10, MODEL: 10 } },
  { max: 58, weights: { CHILDHOOD_FRIEND: 15, INFLUENCER: 15, DANCER: 10, ACTRESS: 15, ACTOR: 15, SINGER: 15, MODEL: 15 } },
  { max: 70, weights: { CHILDHOOD_FRIEND: 8, INFLUENCER: 12, DANCER: 8, ACTRESS: 18, ACTOR: 18, SINGER: 18, MODEL: 18 } },
  { max: Infinity, weights: { CHILDHOOD_FRIEND: 4, INFLUENCER: 10, DANCER: 6, ACTRESS: 20, ACTOR: 20, SINGER: 20, MODEL: 20 } },
];

/* ---------- 隱藏角色：虛構小國王子(同性戀路線) ---------- */
/* 不放進 PARTNER_TYPE 選單，是要透過稀有隱藏事件觸發的內容(判定邏輯留給
   flow/romance.js)，跟 traits.js 的稀有 PLAYING_STYLE 是同一種「份量感」設計。
   使用者定案：純隨機觸發(單身狀態下每次開始交往 3% 機率)對想主動追求
   這條線的玩家不公平，玩十輪都不一定遇得到——補上 data/yearlyOptions.js
   SOCIAL_OPTION.SECRET_ENCOUNTER，生涯早期單身狀態下可以主動選，保證
   下一段開始的戀情就是這條線(見 flow/romance.js pickPartner())。這條
   主動管道文案刻意含蓄(不直接寫「王子」)，跟隨機邂逅並存不取代——選項
   本身是給想走這條路的玩家的明確信號，細節還是留給生涯自己展開。

   國名/王室完全虛構，刻意不對應任何現實王室——這比其他 PARTNER_TYPE 都
   更需要小心：全世界的王室是極少數、極容易對號入座的一小群真實個人，
   不像「女星/model」這種泛稱底下有成千上萬個真人可以套。虛構「某個
   可辨識真實人物是同性戀」這種對真人性向的臆測，風險比虛構「某女星劈腿」
   高得多，所以連國家本身都編了一個不存在的名字，角色純架空。

   機制上做成雙面刃，跟遊戲其他系統的設計語言一致(高風險高回報，不是無痛
   純加分)：必須保密的壓力給全對象類型裡最重的懲罰(scandalRiskMult/
   secretExposurePenalty)，但撐過去、關係穩定下來(隊友知情且接納)反而有
   隊內情感支持的正向加成(stableSecretBonus)——呼應真實足球圈的討論：
   出櫃球員在職業足壇仍然極少，更衣室文化常被引用為最大壓力來源之一，
   但也有球隊文化逐漸包容、隊友力挺出櫃球員的真實案例。 */
export const HIDDEN_PARTNER = {
  ROYAL_PRINCE: {
    label: '王子',
    country: '瓦爾登堡王國', // 虛構國名，不對應任何現實王室
    fame: 2,
    outsideIncomeMult: 1.1,
    scandalRiskMult: 2.0, // 全類型最高：同性戀情+王室身分雙重話題性
    stabilityBonus: -3, // 必須保密的壓力，全類型最重
    // 曝光後果：比一般緋聞更嚴重的懲罰，反映球隊/贊助商/保守市場的真實壓力
    secretExposurePenalty: { seasonFormPenalty: -4, wagePremiumPenalty: -0.05 },
    // 撐過保密期、關係穩定(隊友知情且接納)之後的正向回饋——不是無痛加分，
    // 是撐過高風險期才拿得到的回報，呼應「更衣室氣氛」變成助力而非壓力
    stableSecretBonus: { seasonFormBonus: 2 },
    flavorTitles: ['歐洲小國王室成員', '低調的王位第二順位繼承人'],
    unlockCond: '稀有隱藏事件觸發，不在開局選單，判定邏輯留給 flow/events.js',
  },
};

/* ---------- 結婚／生子：短期陣痛 + 長期加成 ---------- */
/* 對照原版棒球「結婚生子影響成績表現」——但不是單純「成家=一路加分」，
   拆成兩段更真實：那一季有明顯的生活步調被打亂懲罰(籌備婚禮/新生兒睡眠不足)，
   之後轉為長期穩定度加成。這樣「成家」在敘事上才有重量，不是無痛的純利多。 */
export const MARRIAGE_EFFECT = {
  weddingSeasonPenalty: -1, // 婚禮那季 seasonForm 懲罰
  marriedStabilityBonus: 1, // 併入 STABILITY_MOMENT 判定的穩定度分量，見下方稽核說明
};

/* 稽核抓出來的斷點(使用者定案)：PARTNER_TYPE.stabilityBonus/
   marriedStabilityBonus/FAMILY_FIRST.effect 這三個以前是「只要還在交往/
   已婚狀態，每季無條件疊加進 seasonForm(→RAT)」——完全不用選 SOCIAL
   類別、不用花任何一次選擇，戀愛線就能免費墊高主線的比賽表現，等於是
   「用戀愛線抄能力線的捷徑」，跟訓練夥伴線的能力加成要靠真的選訓練
   類別換到是不同待遇(見平衡度稽核紀錄)。改成機率判定：三個來源的分量
   全部併成 stabilityPool，只決定「這季有沒有一次甜蜜/溫馨時刻」的機率，
   不是保底疊加——命中才加分，沒命中就是平常的一季，跟戀愛線其他事件
   (生小孩/緋聞/隱藏線曝光)同一種「有機率，不是必然」的語言一致。 */
export const STABILITY_MOMENT_BASE_CHANCE = 0.35;
export const STABILITY_MOMENT_CHANCE_PER_POINT = 0.08; // stabilityPool 每1點，機率±這麼多
export const STABILITY_MOMENT_BONUS = 1; // 命中時 seasonForm 加成，跟 DATE_NIGHT 的+1同量級，不加碼

/* 離婚：跟交往期分手不同，這裡才是真的有代價的退出——結婚不是交往的同義詞。
   settlementCostMult 疊乘在薪資/存款上算一次性贍養費(基準留給engine層決定)；
   有小孩的話代價再加重(withKidsExtraCostMult)；scandalRiskMult 直接複用
   前配偶的 PARTNER_TYPE.fame——嫁娶演藝圈對象離婚容易上新聞，髮小離婚則低調得多。 */
export const DIVORCE_EFFECT = {
  settlementCostMult: 0.3,
  withKidsExtraCostMult: 0.15,
  seasonFormPenalty: -2,
};

/* 每個小孩獨立計算，累加但遞減：第一胎的「當爸媽」衝擊最大，後面漸緩。
   maturityBonus 疊加在 seasonForm，injuryEscalateChanceMult 疊乘在
   injury.js 帶傷上陣的惡化機率上——「有小孩後更不敢賭身體硬撐」，
   是成家系統唯一直接連動別的機制表的地方，不只是加 seasonForm 數字。
   兩者都有上限，避免小孩越生越多變成無限堆疊。 */
export const KIDS_EFFECT = {
  // 稽核查證原版 wiki 後修正：生小孩的機率不是固定值，是隨已有小孩數遞減
  // (頭胎最容易，越生越少)——index 用 love.kids(目前已有幾個)去查，
  // 超過陣列長度沿用最後一檔，不會無限遞減到0。原本的固定 chance(0.2)
  // 是這輪稽核前的簡化版，沒有查證過原版就先上線的數字。
  //
  // 第一輪上線用的是 wiki 查到的原始數字(65/45/30/20%)，8000種子實測後
  // 發現這是誤讀——原版這個機率是「兩層」的：先骰一個「這季家庭事件要不
  // 要發生」(已婚無小孩40%/已婚有小孩30%)，發生了才骰「這次是不是生小孩」
  // (65/45/30/20%)。這裡的機制是每季直接骰一次，等於把兩層合成一層卻用
  // 了內層的原始數字，實測平均每個「曾生小孩」的球員生了4.16個小孩，
  // 明顯偏多。修正成兩層合成後的複合機率(外層×內層)：
  // 0.40×0.65≈0.26／0.30×0.45≈0.135／0.30×0.30≈0.09／0.30×0.20≈0.06。
  chanceByExistingKids: [0.26, 0.135, 0.09, 0.06],
  newbornSeasonPenalty: -2, // 新生兒那一季 seasonForm 懲罰
  perKid: [
    { maturityBonus: 1.5, injuryEscalateChanceMult: 0.9 }, // 第一胎
    { maturityBonus: 1.0, injuryEscalateChanceMult: 0.95 }, // 第二胎
    { maturityBonus: 0.5, injuryEscalateChanceMult: 1.0 }, // 第三胎起
  ],
  maxStackedKids: 3, // 超過第三胎的小孩沿用第三胎的加成，不再遞增
};

/* ---------- 出軌／外遇：玩家主動的婚內出軌，跟上面的「緋聞曝光」分開算 ---------- */
/* 上面 PARTNER_TYPE.scandalRiskMult 觸發的是「對象的知名度招來狗仔」，賭的是
   對象是誰；曝光的可能只是被拍到約會，不必然是劈腿。這裡是完全獨立的一條線：
   玩家自己主動出軌，賭注是玩家自己的人氣(S.popularity，見 flow/romance.js)——
   越紅、社交場合接觸的人越多，機會越多，跟當下配偶是誰無關。兩條線各自骰、
   互不影響，同一季理論上可以都不中、都中、或只中一條。

   沒被抓到：靜默累加 love.affairs，不留痕跡、不扣分——這是「藏得住」的部分，
   跟隱藏王子路線撐過保密期的邏輯呼應：風險是賭運氣，不是必然出事。
   被抓到(discoverChance)：懲罰比上面一般緋聞曝光重得多、離婚機率也比 0.4 高
   ——這是玩家自己主動選擇的風險，跟「單純被狗仔拍到跟對象吃飯」不是同一個
   量級的代價，對照現實：伴侶主動出軌被抓，比八卦媒體報導緋聞嚴重得多。 */
/* 稽核校準：triggerBaseChance/popularityFactor 原本是「戀愛系統只在選了
   社交→戀愛才會動」那個年代校準的數字(實測當時大約只有5-8%的季度會真的
   骰到)——戀愛系統改成每季自動判定(見 flow/romance.js)之後，出軌誘惑的
   評估頻率暴增到已婚就是100%，8000種子實測平均人氣~59分時，舊數字算出
   的觸發機率高達~15%/季，拉出生涯平均1.23次出軌、PLAYBOY_STAR(3次以上)
   命中率13.25%——遠超「稀有」稱號該有的水準。下修成觸發機率大約是舊數字
   的1/3，讓稀有度重新貼近 OFFPITCH_RARE 這個難度層級該有的樣子。 */
/* 使用者定案：出軌誘惑的觸發機率該跟「緋聞話題度」(UI 標籤這輪改名，
   見 web/src/playerCardUtils.js romanceBuzzLabel 的稽核說明，量表本身沒
   變)這個已經存在的量表(S.love.affairs 累積次數，也是 PLAYBOY_STAR 稱號
   的門檻同一個欄位)掛勾——原本只吃人氣值，代表
   「越紅、社交場合接觸的人越多，機會越多」，但跟玩家自己過去做過什麼
   完全無關，兩個曾經出軌3次跟從沒出軌過的球員，只要人氣一樣，下一次
   誘惑找上門的機率也一樣，花心稱號變成只是「已經發生過的事」的紀錄
   牌，沒有「越陷越深」的敘事張力。repeatFactor 疊加在既有的人氣係數上，
   讓每一次出軌都真的讓下一次誘惑更容易上門——這不是雙重懲罰(discover
   ChanceMultBonus 影響的是「被抓機率」，這裡影響的是「誘惑觸發機率」，
   兩個是不同的量，一個是「東窗事發的風險」，一個是「意志力還撐不撐得
   住」，疊加合理)。 */
export const AFFAIR = {
  triggerBaseChance: 0.009, // 基礎機率下限
  popularityFactor: 0.0011, // 每 1 點 S.popularity 疊加的機率
  repeatFactor: 0.025, // 每 1 次過去出軌次數(S.love.affairs)疊加的機率
  maxTriggerChance: 0.25, // 觸發機率封頂，避免人氣爆表後變成年年出軌
  discoverChance: 0.35, // 出軌後被抓包的機率，比一般緋聞曝光(0.05*scandalRiskMult)高得多
  discoveredPenalty: { seasonFormPenalty: -6, divorceChance: 0.65 }, // 比一般緋聞曝光離婚後果(-2/0.4)重
};

/* ---------- 出軌稱號：生涯累積到一定量，後期的雙面刃稱號 ---------- */
/* 對照 national.js WC_HONOR/traits.js PLAYING_STYLE 的份量感設計：門檻是
   「生涯累積」而非單一事件，玩家長期選擇累積出來的結果才拿得到。雙面刃：
   話題性換人氣，但往後更容易被盯上(疊乘在 S.affairDiscoverChanceMult 上，
   永久生效)——高調版的風險/報酬，跟隱藏王子路線「保密版」的雙面刃是同一種
   設計語言，兩種出軌/戀愛的高風險敘事各自對應各自的稱號。 */
export const LOVE_HONOR = {
  PLAYBOY_STAR: {
    label: '花名在外的球星',
    tier: 'OFFPITCH_RARE',
    cond: '生涯出軌次數(love.affairs)達 3 次以上',
    effect: { popularityBonus: 5, discoverChanceMultBonus: 0.3 }, // 人氣一次性加成 + 之後每次出軌曝光機率永久+0.3倍
  },
  /* 稽核抓出來的缺口：隱藏王子路線一直有機制(S.royalRomanceExposed/
     royalRomanceStable，見 flow/romance.js)、有終局謝幕文案(flow/legacy.js
     royalLegacyClause)，卻從沒有進過稱號清單——「畢竟是隱藏結局」，理當
     要有自己的稱號。使用者定案份量分配：曝光才是這條線真正的大爆點，給
     精英層；沒曝光、安穩撐過保密期反而是「沒有故事的故事」，份量刻意
     壓低一階，給稀有層就好，不用跟曝光同等重(這也呼應精英層在成就展示
     完全不給提示、稀有層還會顯示觸發條件的既有設計——「安穩」本來就不
     該像「爆炸性緋聞」那樣被大肆張揚)。兩個稱號不互斥，理論上可以都拿到
     (先曝光、後來又用另一段感情撐過保密期，或反過來)，稱號反映的是
     「這輩子發生過」的歷史紀錄，不是互斥的單選結局。 */
  ROYAL_SCANDAL: {
    label: '皇室緋聞',
    tier: 'OFFPITCH_ELITE',
    cond: '與隱藏王室對象的戀情曝光',
    effect: { popularityBonus: 8 },
  },
  QUIETLY_ROYAL: {
    label: '深藏不露',
    tier: 'OFFPITCH_RARE',
    cond: '與隱藏王室對象結婚後，撐過保密期從未曝光',
    effect: { popularityBonus: 2 },
  },
};

/* ---------- 場外常見／精英：家庭穩定度稱號 ---------- */
/* 兩個稱號共用同一個累積計數 S.stableMarriageStreak(見 flow/romance.js)——
   已婚、這季沒緋聞沒出軌就累加，離婚/緋聞/出軌被抓就歸零。FAMILY_FIRST
   是「一路穩定」的正面敘事，門檻不高，場外常見層；REDEEMED 是稱號系統
   裡唯一的可逆稱號，專門承接 PLAYBOY_STAR 這種帶爭議性的稱號——已經拿過
   花名在外的球星，之後撐過同樣的穩定期，才是「洗心革面」，跟從頭就穩定
   的 FAMILY_FIRST 是不同的故事弧線，門檻疊加「已有 PLAYBOY_STAR」這個
   額外條件，放在場外精英層。REDEEMED 解鎖後 PLAYBOY_STAR 本身不會被移除
   (稱號=已經發生過的事，不會因為後來的事消失)，但 REDEEMED 的效果會
   抵銷 PLAYBOY_STAR 疊加的曝光機率懲罰，敘事上是「污名還在，但你已經
   翻篇了」。 */
export const FAMILY_FIRST = {
  label: '顧家好男人/好女人',
  tier: 'OFFPITCH_COMMON',
  cond: '已婚+有小孩+連續9季零緋聞零出軌',
  effect: { seasonFormBonus: 1 },
};

export const REDEEMED = {
  label: '洗心革面',
  tier: 'OFFPITCH_ELITE',
  cond: '已有「花名在外的球星」+ 之後連續9季已婚零出軌',
  effect: { popularityBonus: 3, clearDiscoverChanceMultBonus: true }, // 抵銷 PLAYBOY_STAR 疊加的曝光機率懲罰
};

// 稽核校準：戀愛系統改成每季自動判定之後，「連續N季零緋聞零出軌」比舊制
// 容易累積得多(以前不選社交那季根本不會骰，等於白算進連續紀錄；現在
// 每季都真的骰一次)——8000種子實測門檻=5時 FAMILY_FIRST 命中率高達
// 79.2%，「常見層」稱號變成幾乎人人有份，失去成就感。門檻先拉高到9
// (命中率62.84%，還是偏高)，再拉高到12才落到39.59%這個貼近其他
// OFFPITCH_COMMON稱號(如LOCAL_CELEBRITY約30%)的水準，對應調整
// REDEEMED(見上，一樣是這個計數的門檻)。
export const STABLE_MARRIAGE_STREAK_TARGET = 12;

/* 交往/婚姻進程與緋聞後果的實際判定(骰子機率、事件文本)在 flow/romance.js，
   這裡只定靜態表。緋聞事件的後果方向：短期 seasonForm 懲罰(分心)、
   可能連動 contract.js 的形象/談判籌碼(留給 engine 層具體設計)。 */
