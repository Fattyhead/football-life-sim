/* ---------- 年度選項：訓練／機會／社交 ---------- */
/* 對照原版棒球「季初特訓擲三顆骰」的年度選擇機制，但拆成三個大方向，各自
   管一塊、不重疊，玩家一年只能選一個大方向、一個具體選項——時間有限，
   選了訓練就沒空社交，這是刻意的資源分配張力。三個方向各有主/副效果：

     訓練選項 — 主：能力值成長。副：這季受傷機率(練得凶副作用也大)。
     機會選項 — 主：生涯籌碼(轉會曝光度/合約談判力/海外機會門路)，
       不動能力值本身。副：象徵性小幅能力值(見到球探總會學到一招半式，
       但不是重點，跟訓練選項的成長量級差一截)。
     社交選項 — 主：人氣值成長。副：人氣值反過來影響場外收入
       (yearOutsideIncome)這件事本身。戀愛進展(求婚/生小孩/出軌，見
       data/love.js/flow/romance.js)狀態驅動、每季自動判定，不看選了
       什麼類別——DEEPEN_RELATIONSHIP/DATE_NIGHT 是依戀愛狀態演化的
       加成器(提高求婚機率、降低出軌誘惑機率)，不是這些事件本身的開關。
       「認識新對象」這個起點也是自動觸發(使用者定案，統一戀愛線/訓練
       線的觸發模式，見 flow/romance.js 開頭的稽核說明)：單身/離婚狀態
       下，狗仔事件每季都有機率自動命中，玩家選承認或否認，完全不用
       選社交——但狗仔只會送上基本款對象(髮小/網紅)，高端對象(女星/
       演員/歌手/Model/舞孃)跟隱藏王子路線一律要靠 MEET_NEW_PEOPLE/
       SECRET_ENCOUNTER 主動追求，這是這個起點唯一還跟「選了社交」
       綁在一起的部分。

   人氣值(popularity)是新概念，刻意跟轉會買氣(transferBuzz)分開算：
   transferBuzz 是「球探/俱樂部怎麼看你」，決定晉級/租借機會，屬於機會選項
   的地盤；popularity 是「大眾怎麼看你」，決定代言收入，屬於社交選項的地盤。
   兩個曝光管道來源不同、用途不同，不能合併成同一個數字。

   每個子選項都標了 stage(適用生涯階段，見 flow/context.js careerStage())，
   跟選擇性的 calendar(只在特定世界盃日曆窗口才開放)。機制還是「一年三選一」
   不變——變的是同一個類別底下，當季實際開放哪幾個子選項，不是多加一層選擇。
   EARLY 早期以基礎/出國機會/戀愛初期為主，LATE 生涯末年換成人脈/退休準備，
   PRE_WC_YEAR/WC_YEAR 是世界盃日曆特有的選項，平常不會出現。

   選擇性的 cost(存款門檻)是同一套篩選機制的第三個軸：存款不夠，砸錢版的
   選項就不會出現在候選池裡，跟 stage/calendar 篩選是同一段邏輯(見
   flow/yearlyChoice.js availableOptions())。這是金錢在這個遊戲裡唯一的
   用途——存款本來只出不進(已修)、修完只出不進之後又變成「賺了但沒地方花」，
   現在三個類別各給一個砸錢版，效果比免費版更強，錢真的能買到更好的結果。

   金錢刻意不當第四個獨立選項：訓練/機會/社交搶的是「今年時間花在哪」，
   砸錢版不是另一個時間去處，是讓「已經選好的那件事」做得更好(私人教練
   還是在訓練，只是比自主訓練更有效率)。金錢是放大器，不是跟三選項平行
   的第四個範疇，這是討論過方案A(獨立金錢選項) vs 方案B(現在這版)後
   定案的方向。UI 呈現約定：任何 def.cost 存在的子選項，介面上要加 💰
   標記凸顯「這是砸錢版」，不用另外設一個 paid 旗標，cost 本身就是判斷依據。

   headless/demo 環境下用隨機挑選模擬玩家選擇，真正的 UI 要讓玩家自己選，
   邏輯本身跟有沒有 UI 無關(跟 loan.js 的設計原則一樣)，實際判定/成長公式
   留給 flow/yearlyChoice.js。 */

import { FAME_HONOR } from './fame.js';

export const TRAINING_OPTION = {
  BALANCED: {
    label: '均衡訓練',
    desc: '全能力值朝潛力天花板平均成長，零額外風險。',
    stage: ['ANY'],
    growthMode: 'all',
    injuryChanceMult: 1.0,
  },
  FOCUSED: {
    label: '專項特訓',
    desc: '集中鎖定一項主攻能力練，但過度操練提高這季受傷機率。早期打底階段最划算。',
    stage: ['EARLY', 'PRIME'],
    growthMode: 'single',
    injuryChanceMult: 1.3,
  },
  CONDITIONING: {
    label: '體能強化',
    desc: '主攻體力/對抗(GK 則是體力/反應)成長，並降低這季受傷機率。年紀越大越該顧身體。',
    stage: ['PRIME', 'LATE'],
    growthMode: 'physical',
    injuryChanceMult: 0.7,
  },
  /* 世界盃年限定：保留體力備戰國家隊，代價是這季完全不練俱樂部能力——
     這是明確的取捨(保留體力打國家隊 vs 全力出擊)，不是額外的步驟，
     只是這年訓練選項裡多了一個平常不會出現的選項。 */
  WC_TAPER: {
    label: '保留體力備戰世界盃',
    desc: '這季不做俱樂部訓練，把體力留給國家隊，大幅提高世界盃入選/晉級機率。',
    stage: ['ANY'],
    calendar: ['WC_YEAR'],
    growthMode: null,
    wcReadinessGain: 0.15,
  },
  /* 砸錢版特訓：跟 FOCUSED 練的是同一個目標(pickFocusTarget 鎖定的主攻項)，
     花錢買到的不是「練更快」(稽核抓出來的斷點：growthBoostMult 這個欄位
     在骰子/風險層拆分成兩套機制之後已經沒有任何地方在讀，desc 原本還在
     講「成長大幅提升」是騙人的舊文案，已經拿掉，不要再加回來)——真正
     買到的是「有效率的訓練」：沒有 FOCUSED 那種「操過頭提高受傷機率」的
     副作用，錢是拿來買安全，不是買更快的成長。 */
  PRIVATE_CAMP: {
    label: '私人訓練營',
    desc: '砸錢請頂級教練團隊特訓，一樣主攻鎖定的能力，但沒有專項特訓的額外受傷風險。',
    stage: ['ANY'],
    cost: 500000, // 歐元化重新校準(見 data/contract.js 開頭的稽核說明)，下同
    growthMode: 'single',
    injuryChanceMult: 1.0,
  },
  /* 生涯末年限定：跟 CONDITIONING 同一個能力集合(體能/對抗)、LATE 階段
     兩者同時開放，份量感刻意不一樣——CONDITIONING 是「還在往上練」的
     積極保養，這個是老將特有的「用經驗換取節奏」。稽核抓出來的斷點：
     這句「成長量刻意壓得比CONDITIONING更保守」以前只是註解裡的說法，
     沒有任何機制在實現——骰子/風險層拆成大頭/小頭之後，選項本身完全
     不影響風險層的成長量(量級只看玩家自己選的穩健/平衡/冒進)，等於
     LATE 階段 CONDITIONING 的受傷風險(0.7)全面輸給這個(0.5)、成長量
     卻沒有任何劣勢，變成一個純劣勢的廢按鈕。補上 growthDeltaMult(見
     flow/yearlyChoice.js 讀取這個欄位的地方)讓「用經驗換取節奏」這句
     文案真的有機制在背書：成長打六折換受傷風險腰斬多一點，是真的
     取捨，不是換皮的同一個選項。 */
  VETERAN_WISDOM: {
    label: '老將的節奏',
    desc: '不追求爆發性的成長，用身經百戰的節奏管理身體——體能/對抗成長比體能強化更保守，但受傷風險壓到全隊最低，這是只有老將才懂的訓練哲學。',
    stage: ['LATE'],
    growthMode: 'physical',
    injuryChanceMult: 0.5,
    growthDeltaMult: 0.6,
  },
};

/* 機會選項不碰能力值成長(那是訓練選項的地盤)，動的是「生涯籌碼」——
   轉會市場曝光度、合約談判力、海外門路，三個子選項對應三種不同籌碼。
   abilityNudge 是統一的小幅副效果(象徵性，不是重點)。 */
export const OPPORTUNITY_OPTION = {
  SCOUT_MEETING: {
    label: '遇見球探',
    desc: '主：增加轉會買氣(transferBuzz)，提高晉級/租借邀約機率。副：小幅能力值。',
    stage: ['EARLY', 'PRIME'],
    transferBuzzGain: 0.15,
    abilityNudge: 1,
  },
  EXEC_NETWORKING: {
    label: '結識球隊高層',
    desc: '主：疊加小幅永久薪資溢價+降低合約到期被放棄的風險，是跟俱樂部高層搏感情換來的長期籌碼。副：小幅能力值。',
    stage: ['PRIME', 'LATE'],
    wagePremiumGain: 0.03,
    // 跟高層搏感情，本來就該是玩家能主動採取、緩解「合約危機」(見
    // flow/transfer.js releaseRiskChance)這個風險的手段——不然這個新
    // 風險系統對玩家選擇完全沒有回應，只有年紀/能力這種玩家改變不了的
    // 被動因素在決定生死。
    releaseRiskDiscountGain: 0.04,
    abilityNudge: 1,
  },
  STUDY_ABROAD: {
    label: '出國交流',
    desc: '主：建立海外人脈，大幅提高這季收到租借邀約的機率。副：小幅能力值。早期最適合走這條路。',
    stage: ['EARLY', 'PRIME'],
    loanOfferBonusMult: 2.0,
    abilityNudge: 1,
  },
  /* 國家隊資歷限定：呼應使用者提出的「選項要跟情境(國家隊)對得上」——
     之前所有跟國家隊相關的選項(WC_AUDITION/SQUAD_BONDING/WC_TAPER)都是
     「爭取入選」的準備動作，一旦真的累積出資歷(至少代表國家隊出賽5次)，
     卻沒有任何選項回應「你已經是有份量的國腳」這件事。用 requiresCaps
     (見 flow/yearlyChoice.js availableOptions() 的對應篩選)當開放條件，
     跟 EXEC_NETWORKING 同一種「拿既有籌碼換薪資溢價」的邏輯，籌碼來源
     換成國家隊資歷而不是俱樂部高層關係。稽核抓出來的斷點：原本
     wagePremiumGain 只有 0.02，比誰都能選、完全沒有門檻的 EXEC_NETWORKING
     (0.03 + 額外的釋出風險折扣0.04)還弱——花5場國際賽資歷換來的選項，
     結果比免費選項還差，違反「有門檻的內容該獎勵玩家」的原則。調整為
     0.04(高於EXEC_NETWORKING的0.03)，再疊加一點EXEC_NETWORKING沒有的
     人氣值(國際賽場的知名度，跟俱樂部高層人脈是不同性質的籌碼，兩者
     刻意保持不同形狀，不是單純把數字調大)，讓兩個選項各自有不可取代的
     理由，不是其中一個純粹比較差。 */
  NATIONAL_TEAM_STATUS: {
    label: '國家隊資歷變現',
    desc: '代表國家隊出賽的次數累積到一定程度，這份資歷本身就是跟俱樂部談判時的籌碼——主：疊加永久薪資溢價，國際賽場的知名度也帶來一點人氣。副：小幅能力值。',
    stage: ['PRIME', 'LATE'],
    requiresCaps: 5,
    wagePremiumGain: 0.04,
    popularityGain: 2,
    abilityNudge: 1,
  },
  /* 生涯末年限定：不是為了現役表現，是替退休後鋪路——用薪資溢價代表
     「累積的老將籌碼/形象資產」，跟 EXEC_NETWORKING 的差異是敘事上
     明確指向「退休後」而不是「還在踢的這幾年」。 */
  RETIREMENT_PREP: {
    label: '考取教練/球評資格',
    desc: '為退休後的人生鋪路，累積場外形象資產，小幅疊加薪資溢價(老將籌碼)。',
    stage: ['LATE'],
    wagePremiumGain: 0.02,
    popularityGain: 1,
  },
  /* 世界盃前一年限定：入選前哨戰，提高下一屆世界盃的入選機率。 */
  WC_AUDITION: {
    label: '國家隊入選前哨戰',
    desc: '積極在教練組面前刷存在感，提高明年世界盃的入選機率。',
    stage: ['ANY'],
    calendar: ['PRE_WC_YEAR'],
    wcReadinessGain: 0.08,
    abilityNudge: 1,
  },
  /* 砸錢版機會：買通經紀公司/公關團隊，轉會買氣效果比免費版(SCOUT_MEETING)
     高一倍以上——錢在這裡買的是「曝光的效率」，比自己去認人快得多。 */
  PR_FIRM: {
    label: '聘請頂級經紀團隊',
    desc: '砸錢請專業經紀/公關團隊操盤，轉會買氣大幅提升，效果遠勝自己跑關係。',
    stage: ['ANY'],
    cost: 400000,
    transferBuzzGain: 0.35,
  },
  /* 投資：真的有下檔風險的選項，不是另一個穩賺的付費版——存款動一部分
     去賭，可能賺可能賠(見 data/wealth.js INVESTMENT_TIER)，是「機會」
     類別裡第一個不保證正效果的選項，避免整個類別變成「有錢就無腦點」。 */
  INVEST_CONSERVATIVE: {
    label: '保守理財',
    desc: '把部分存款交給穩健的理財工具，小賺小賠，波動不大。',
    stage: ['ANY'],
    investTier: 'CONSERVATIVE',
  },
  INVEST_AGGRESSIVE: {
    label: '積極操盤',
    desc: '拿一大筆存款下重注，可能翻倍，也可能大賠一筆，賭性堅強才適合。',
    stage: ['PRIME', 'LATE'],
    investTier: 'AGGRESSIVE',
  },
  /* TOP5 生涯後期的終極選項：砸下畢生積蓄成為球隊老闆。門檻遠高於其他
     任何花費，換來的是真正的機制效果，不只是一句 flavor text——買下之後
     不會再被降級、不會再被豪門挖角(見 flow/transfer.js 的 S.ownsClub
     守衛)，是用錢買回「玩家對轉會完全沒有主導權」這個缺口的終局出口。
     單向門，買下之後不會再出現在選單裡(見 flow/yearlyChoice.js
     availableOptions 的特例排除)。 */
  /* 稽核抓出來的斷點修正：原本只要求 tier:TOP5，沒有要求豪門(ELITE)等級
     ——使用者定案收緊：買下球隊要真的在豪門才有機會，不是隨便一支TOP5
     球隊都能買。cost 已經是這輪能存到的生涯存款上限(見下面的稽核計算)，
     持有球隊股份(BUY_CLUB_SHARES)可以打折，見 flow/yearlyChoice.js
     applyYearlyChoice 的 BUY_CLUB 分支。 */
  BUY_CLUB: {
    label: '買下球隊',
    desc: '砸下畢生積蓄成為球隊老闆——從此不會再被降級或被豪門挖角，餘生都留在這支球隊。',
    stage: ['LATE'],
    tier: ['TOP5'],
    requiresClubPrestige: 'ELITE',
    cost: 150000000,
    clubOwnership: true,
  },
  /* 投資球隊股份：機會線(經紀人)的專屬解鎖，見 flow/agentLine.js 開頭的
     稽核說明——買下球隊(BUY_CLUB)本身的天文數字門檻太高，這個是中間的
     台階，靠經紀人的商業人脈才摸得到，先入股，之後真的要買斷球隊也會
     打折(反映「已經是股東」的談判優勢)。requiresClubPrestige/
     requiresPopularity/requiresWage/requiresAgent 都是新增的篩選軸，見
     flow/yearlyChoice.js availableOptions() 的對應判斷——「靠經紀人牽線」
     跟「靠自己紅到頂」是兩條擇一路徑，篩選引擎只支援 AND，所以拆成
     BUY_CLUB_SHARES_FAME(靠自己)/BUY_CLUB_SHARES_AGENT(靠經紀人)兩個
     選項項目，效果完全一樣，只是門檻不同，UI 上顯示成同一件事的兩種
     達成方式。 */
  BUY_CLUB_SHARES_FAME: {
    label: '入股球隊（憑自身聲勢）',
    desc: '你的人氣跟身價已經到了球隊願意主動找你談入股的地步——買下一部分股份，成為小股東，之後真的要買斷球隊也會打折。',
    stage: ['LATE'],
    tier: ['TOP5'],
    requiresClubPrestige: 'ELITE',
    requiresPopularity: 80,
    requiresWage: 15000000,
    cost: 10000000,
    clubShares: true,
  },
  BUY_CLUB_SHARES_AGENT: {
    label: '入股球隊（憑經紀人牽線）',
    desc: '經紀人多年的商業人脈牽成了這筆交易——買下一部分股份，成為小股東，之後真的要買斷球隊也會打折。',
    stage: ['LATE'],
    tier: ['TOP5'],
    requiresClubPrestige: 'ELITE',
    requiresAgentBond: true,
    cost: 10000000,
    clubShares: true,
  },
  /* 人氣線的終局選項：對照財富線的 BUY_CLUB，同樣是生涯後期限定的單向
     終局出口，差別在門檻不是花錢，是「紅到一個程度」——要求已經拿到場外
     最高層的全球偶像稱號(見 data/fame.js)。跟球隊老闆的敘事邏輯呼應：
     你的場外身分已經大到不需要再靠踢球維生，繼續留在球場反而變成附屬。
     用 requiresHonor 而不是 tier/cost 篩選，是這個選項第一次用「已解鎖的
     稱號」當開放條件，跟既有的 stage/calendar/tier/cost 四個篩選軸平行，
     見 flow/yearlyChoice.js availableOptions() 的對應判斷。 */
  PIVOT_TO_CELEBRITY: {
    label: '轉戰演藝圈',
    desc: '你的名氣早就大過球場本身——全職經營個人品牌/演藝事業，掛靴，去過另一種鎂光燈下的人生。',
    stage: ['LATE'],
    requiresHonor: FAME_HONOR.GLOBAL_ICON.label,
    celebrityPivot: true,
  },
};

/* 社交選項不碰生涯籌碼(那是機會選項的地盤)，只管戀愛進展跟人氣值——
   人氣值是新欄位(見 core/state.js popularity)，決定場外代言收入。
   ROMANCE 標 ANY 而不限制在早期：已經開始的婚姻/小孩進展不能因為過了
   早期就被鎖住，早期只是「敘事上比較常看到開始交往」的自然結果，
   不是機制上的硬限制。 */
export const SOCIAL_OPTION = {
  /* 稽核抓出來的斷點：舊版 ROMANCE 是「戀愛系統的唯一入口」，選了才會有
     交往/求婚/生小孩/出軌這些事發生——查證原版 wiki 後改掉了，戀愛系統
     現在每季自動判定(見 flow/romance.js runRomanceAmbient)，不看選了什麼
     類別。ROMANCE 這個選項因此拿掉，社交類別改成依戀愛狀態演化出三個
     不同的選項(使用者的話：「社交也有人生的路徑」)，不是砍掉戀愛內容，
     是把「經營感情」從「戀愛系統本身的開關」變成「主動加碼投入」的選項。 */
  MEET_NEW_PEOPLE: {
    label: '認識新朋友',
    desc: '主：單身時，主動出擊追求對象——涵蓋所有類型(含女星/演員等高端對象)，機率比等狗仔自動送上門更高。副：已有對象時，社交場合的邂逅機會增加，也讓出軌誘惑更容易找上你。',
    stage: ['ANY'],
    loveDatingChanceGain: 0.1,
    loveAffairOpportunityGain: 0.05,
    popularityGain: 1,
  },
  /* 使用者定案：隱藏王子路線(見 data/love.js HIDDEN_PARTNER)原本完全是
     被動隨機——單身狀態下每次開始交往才有 3% 機率骰到，玩家沒有任何
     主動追求的手段，玩十輪都不一定遇得到一次。這裡補一個主動管道：
     生涯早期、單身或離婚狀態才會出現，選了之後保證「下一段開始的戀情」
     就是這條隱藏線——不是保證馬上開始交往，這段感情還是要等下一次真的
     「認識新對象」的時刻才會落地(可能是狗仔自動觸發，也可能是玩家自己
     選社交主動追求，見 flow/romance.js pickBasicPartner()/pickPartner()
     都會優先讀這個旗標)，這裡只保證一旦開始了，對象是誰不再是意外。
     文案刻意含蓄，不直接寫出「王子」
     兩個字——呼應這條線
     本來就是「隱晦→玩家自己在生涯裡摸索出來」的份量感，選項存在本身
     已經是給想走這條路的玩家一個明確的信號，細節留給後續劇情自己展開。
     跟隨機邂逅(HIDDEN_UNLOCK_CHANCE)並存，不是取代——不特別找這個
     選項的玩家，還是保留原本「意外邂逅」的稀有驚喜；特別想走這條路的
     玩家，現在有真正能主動選的路。 */
  SECRET_ENCOUNTER: {
    label: '一次特別的邀約',
    desc: '訓練場外，有個人似乎對你抱著超乎尋常的興趣，邀你私下見一面——你的直覺告訴你，這次不太一樣。',
    stage: ['EARLY'],
    requiresLoveStatus: ['single', 'divorced'],
    forceNextPartnerHidden: true,
  },
  /* 只在交往中開放(見 flow/yearlyChoice.js availableOptions 的
     requiresLoveStatus 篩選)——提高下季求婚機率，也緩解「拖著不求婚」
     累積的分手風險(S.love.waitStreak，見 flow/romance.js)。 */
  DEEPEN_RELATIONSHIP: {
    label: '經營感情',
    desc: '主：積極投入這段感情，提高求婚機率，也降低這段感情因為遲遲沒有進展而分手的風險。',
    stage: ['ANY'],
    requiresLoveStatus: ['dating'],
    loveProposeChanceGain: 0.1,
    loveWaitStreakRelief: 0.5,
  },
  /* 只在已婚後開放——鞏固婚姻，順帶降低出軌誘惑找上門的機率，是「戀愛」
     選項退場後，已婚玩家主動經營婚姻生活的位置。 */
  DATE_NIGHT: {
    label: '約會之夜',
    desc: '主：安排一次夫妻倆的專屬時光，這季 seasonForm 小幅加成。副：降低出軌誘惑找上門的機率。',
    stage: ['ANY'],
    requiresLoveStatus: ['married'],
    seasonFormBonus: 1,
    loveAffairResistanceGain: 0.03,
  },
  MEDIA_APPEARANCE: {
    label: '媒體通告',
    desc: '主：上通告/接受採訪，直接增加人氣值。副：曝光多了緋聞風險也跟著小幅提高。要有點知名度才有通告找上門。',
    stage: ['PRIME', 'LATE'],
    popularityGain: 3,
    scandalRiskAdd: 0.02,
  },
  TEAMMATE_BONDING: {
    label: '隊友聚會',
    desc: '主：經營更衣室情誼，這季 seasonForm 小幅加成。副：氣氛好，這季受傷機率略降。',
    stage: ['ANY'],
    seasonFormBonus: 1,
    injuryChanceMult: 0.9,
  },
  /* 世界盃前一年限定：跟未來可能同場的國家隊隊友培養默契，一樣疊加
     wcReadinessGain(跟 WC_AUDITION 同一個機制，來源不同：一個是刷存在感
     給教練看，一個是跟隊友培養默契)，不是無關的兩件事各自算。 */
  SQUAD_BONDING: {
    label: '跟集訓隊友培養默契',
    desc: '國家隊集訓期間跟隊友搏感情，提高明年世界盃的默契/晉級機率。',
    stage: ['ANY'],
    calendar: ['PRE_WC_YEAR'],
    wcReadinessGain: 0.08,
    seasonFormBonus: 1,
  },
  /* 砸錢版社交：砸重金請頂級公關包裝形象，人氣效果是 MEDIA_APPEARANCE 的
     兩倍——錢在這裡買的是「大眾印象的操盤能力」，不是感情本身(認識新
     對象要真的選社交類別才會發生，見 MEET_NEW_PEOPLE；求婚/出軌等後續
     大事件是常駐自動判定，見 flow/romance.js，DEEPEN_RELATIONSHIP/
     DATE_NIGHT 只能加成機率，錢買不到愛情，只能買名氣)。 */
  IMAGE_MANAGEMENT: {
    label: '砸重金維護公眾形象',
    desc: '花錢請頂級公關團隊包裝，人氣大幅提升，比自己上通告有效率得多。',
    stage: ['ANY'],
    cost: 300000,
    popularityGain: 6,
  },
  /* TOP5 生涯限定的高調消費：花錢買曝光度換人氣，順便疊加出軌觸發機率
     的來源(S.popularity，見 flow/romance.js AFFAIR.popularityFactor)——
     兩個系統不用另外接線，玩家選了這條高調路線，連帶讓「花名在外」那條
     線更容易觸發，是刻意的因果串接，不是巧合。 */
  LUXURY_LIFESTYLE: {
    label: '添購豪宅／私人生活',
    desc: '砸錢升級生活品質，曝光度大幅提升，比一般的公關操作更有話題性。',
    stage: ['PRIME', 'LATE'],
    tier: ['TOP5'],
    cost: 2000000,
    popularityGain: 8,
  },
  SPACE_TOURISM: {
    label: '一圓太空夢',
    desc: '花大錢圓一次上太空的夢，全世界都在看，這是能吹一輩子的談資。',
    stage: ['LATE'],
    tier: ['TOP5'],
    cost: 20000000,
    popularityGain: 15,
  },
  /* 一擲千金：故意把存款歸零換一次性大爆發人氣，是主動選擇的窮困結局，
     不是意外欠債——legacy.js 的 wealthText 新增了「一無所有」級距
     (0 ≤ savings < 10)專門承接這個結局，跟意外欠債(savings<0)分開講。
     不限 tier/存款門檻，任何階段、任何財力都能爽一次，窮得徹底也是一種
     故事。 */
  BLOW_IT_ALL: {
    label: '一擲千金',
    desc: '把存款花到一毛不剩，博一次瘋狂的話題性——爽一次，帳戶歸零。',
    stage: ['ANY'],
    blowSavings: true,
    popularityGain: 10,
  },
};
