/* ---------- 一句話敘事產生器 ---------- */
/* 對照原版棒球一年一句話帶過的節奏：proSeasonTick 的 log 物件欄位很多
   (受傷/晉級/特質/世界盃/戀愛/續約...)，但玩家一年只該看到一件事，
   不是全部疊出來讀。這裡按「戲劇性」排優先序，挑第一個命中的講，
   平淡的年份給一句依這季選擇類別而定的通用帶過句。

   重複性是實測抓出來的真問題：續約優先權比填充句高，只要那年剛好續約
   (合約 3-5 年一次，機率不低)，不管有沒有選社交/機會，都會講同一句
   「合約到期...」，一輪生涯能重複到 6-8 次。修正兩件事：
     1. 續約不再單獨佔一個優先權，跟該季選項類別的填充句合併成同一個候選池，
        「平淡年份」不分是不是續約年，統一從池子裡隨機挑一句，續約只是
        眾多可能句子裡的其中幾種措辭，不會每次撞上就一定講它。
     2. 填充句池從每類 2 句擴到 5-6 句，且用真的亂數(ri)隨機挑，不是
        year%length 這種固定規律(固定規律在池子小的時候等於還是每兩年重複)。

   稽核抓出來的更大斷點(這輪改版)：原本是「命中第一個條件就 return，
   其餘同一季發生的事全部靜默吃掉」——戀愛線/成就解鎖/訓練夥伴等多條
   常駐事件線同時存在之後，這個「一季只印一句」的限制變成真的會漏掉
   東西(不是視覺上互搶，是玩家真的看不到那件事發生過)。使用者定案：
   改成疊加式——這季觸發了幾件事，就印幾段，只要不重複敘述同一件事就
   好。退休四條路徑維持提早 return(生涯最後一季，不管還發生了什麼其他
   事，這件事本身就蓋過一切，語意不變)，其餘所有分支從「return 第一個
   命中」改成「push 進陣列，繼續往下一個條件走」，函式最後回傳整個
   陣列；真的什麼都沒觸發(lines.length===0)才落到 quietPool 隨機填充句。
   呼叫端(web/src/App.jsx、demo.js、story.js)要跟著把回傳值當陣列處理，
   不是單一字串。 */

import { ABL, DPN, POSN } from '../data/abilities.js';
import { LV } from '../data/regions.js';
import { WC_ROUND_LABEL } from '../data/national.js';
import { INJURY_TIER } from '../data/injury.js';
import { CUP_ROUND_LABEL } from '../data/competitions.js';
import { GENIUS } from '../data/mastery.js';
import { clubPrestigeOf } from './shared.js';

const CUP_DEEP_RUN = ['SF', 'FINAL', 'CHAMPION']; // 只有打進四強以上才值得專門講一句，資格賽/32強不夠戲劇性

function posLabel(S) {
  return S.pos === 'GK' ? POSN.GK : DPN[S.subPosition] || POSN[S.pos];
}

/* 平淡年份的候選句池，依這季選的類別決定用哪一組，續約的措辭混在同一組裡
   (contractRenewed 為 true 才會被抽到，用函式包起來延後判斷)。 */
function quietPool(S, log, category) {
  const contract = log.contractRenewed
    ? [
        `合約到期，${S.club}開出新的續約條件，你簽了下去。`,
        `${S.club}主動找上門續約，你們談妥了新的一份合約。`,
        `經紀人幫你談成續約，薪水數字比上一份合約好看一些。`,
      ]
    : [];

  const byCategory = {
    TRAINING: [
      '這一年你把時間都花在訓練場上，一點一滴累積實力。',
      '沒有戲劇性的事發生，只有日復一日的苦練。',
      `${S.age}歲的你，還是每天第一個到球場、最後一個離開。`,
      '進步不明顯，但你知道累積是這樣一回事。',
      '教練在訓練後單獨稱讚了你幾句，僅此而已。',
    ],
    OPPORTUNITY: [
      '你利用空檔到處交際、打探消息，替未來鋪路。',
      '這年沒什麼大新聞，但你悄悄為下一步鋪好了路。',
      `你花了不少時間認識${S.club}的圈內人脈。`,
      '沒什麼具體成果，但至少多認識了幾張臉。',
      '球探跟經紀人的飯局排了一場又一場，話說得很多，能落地的還不多。',
      '你開始留意自己在轉會市場上的位置，盤算著下一步。',
    ],
    SOCIAL: [
      '這一年感情生活平淡，日子照常過。',
      '沒有轟轟烈烈的事，你把時間留給了場外的自己。',
      '這季你把重心放在球場外的生活，低調過了一年。',
      '沒什麼新鮮事，但日子過得踏實。',
      '這一年你把更多心力放在球場外的自己身上，不趕著證明什麼。',
      '沒有大新聞，但生活過得比想像中充實。',
    ],
  };

  return [...contract, ...(byCategory[category] || byCategory.TRAINING)];
}

/* 入口：一季的 log(+這季選的 category) 攤成一個段落陣列。除了退休四條
   路徑(蓋過一切，直接回傳單元素陣列)，其餘每個條件命中都往陣列裡加
   一段，不會因為前面已經命中別的條件就跳過——同一季發生的每件事都該
   被看到。真的什麼都沒發生(陣列還是空的)才落到 quietPool 隨機抽一句。
   ri 是種子亂數，跟遊戲其他判定用同一份，保證同種子重跑結果一致。 */
/* 自然引退(年齡到頂，不是合約危機被迫、也不是封頂式的終局選擇)的專屬收尾句。
   實測稽核抓出來的大洞：這是全部退休路徑裡唯一沒有任何專屬敘事的一種——
   合約危機被迫引退/買下球隊/世界盃封頂/轉戰演藝圈都各自有自己的收尾句，
   自然引退(這是所有結局裡最常見的一種)卻完全沒被特別交代過，退休那一季
   的敘事只會落到 quietPool 隨機抽一句跟平常年份沒兩樣的話，玩家生涯裡
   最後、也最重的一句沒有得到該有的份量。門檻不需要判斷，用一組池子
   降低單一句子被重覆讀到的機率(生涯只會觸發一次，理論上不會重複，
   但跨輪次重玩會反覆看到，所以還是要有變化)。 */
const NATURAL_RETIREMENT_LINES = [
  '身體終究還是先撐不住了，你脫下球衣，結束這段旅程。',
  '沒有戲劇性的告別儀式，你只是在球季結束後，靜靜地決定不再踢下去了。',
  '這是你能踢的最後一季，你知道，也接受了。',
  '更衣室裡的年輕面孔越來越多，你明白，是時候把位置讓出來了。',
  '沒有人逼你退休，但你自己心裡清楚，這條路走到這裡了。',
];

export function narrateSeason(S, log, ri) {
  // 戀愛系統改成每季自動判定之後(見 flow/romance.js 的稽核說明)，事件不再
  // 掛在 log.yearlyChoice 底下，搬到獨立的 log.love——這裡合併兩者，下面
  // 逐句判斷 c.xxx 的地方不用整批改路徑(兩邊欄位名稱沒有重複，合併安全)。
  // log.training 是訓練夥伴/對手的常駐事件+CROSSROADS 結果(見
  // flow/trainingRivalry.js/proSeason.js prepareTrainingChoice)，同一種
  // 合併寫法；trainingPartnerAssigned 是唯一例外，掛在 log.yearlyChoice
  // 底下(在 TRAINING 分支裡指派，見 flow/yearlyChoice.js)，一樣安全合併。
  // log.nationalRivalCrossroads 是國家隊隱藏對手線 PRE_WC_YEAR 才會有的
  // CROSSROADS 結果(見 flow/nationalRival.js)，同一種合併寫法。
  const c = {
    ...(log.yearlyChoice || {}),
    ...(log.love || {}),
    ...(log.training || {}),
    ...(log.trainingCrossroads || {}),
    ...(log.agent || {}),
    ...(log.agentCrossroads || {}),
    ...(log.nationalRivalCrossroads || {}),
  };

  // 退休優先序：生涯的最後一季，不管這季還發生了什麼其他事，退休這件事
  // 本身就是最重的新聞——四條路徑互斥(見 flow/proSeason.js/yearlyChoice.js)，
  // 各自維持自己的口吻，不套同一個模板。買下球隊(c.boughtClub)已經在
  // 下面有自己的句子，本身就隱含了退休的意味，不需要疊加。這四條是
  // 唯一維持「提早回傳、蓋過其餘所有段落」的例外，其餘全部改成疊加。
  if (log.contractCrisis?.type === 'retired') {
    return [`合約到期，沒有球隊再為你開出續約條件，你知道是時候了——你選擇就此掛靴。`];
  }
  if (log.retiredAsChampion) {
    return [`捧著世界盃冠軍獎盃，你當場做了決定——不用等到狀態下滑，這就是最好的告別方式。`];
  }
  if (c.retiredAsCelebrity) {
    return [`全球偶像的身分早就大過球場本身，你在這季正式宣布：不踢了，全職做自己的事業。`];
  }
  // 梅老闆封頂退休(見 flow/wealthPeak.js)——跟世界盃封頂同一種「引擎
  // 觸發+真正的選擇」架構，選了退休才會設這個旗標，跟其餘幾條「明確
  // 終局選擇」退休路徑並列，維持早退區塊蓋過其餘敘事的語意。
  if (log.retiredAsBoss) {
    return [`你的場外事業早就大過你的球員身分——這次，你決定不演了，直接掛靴，全職經營你的商業帝國。`];
  }
  if (log.retired) {
    return [NATURAL_RETIREMENT_LINES[ri(0, NATURAL_RETIREMENT_LINES.length - 1)]];
  }
  // 買下球隊(見 flow/yearlyChoice.js def.clubOwnership)是使用者定案的第五條
  // 「明確終局選擇」退休路徑，跟上面四條一樣是S.retired=true——500種子
  // 崩潰掃描抓出這條漏網之魚：疊加式改版剛上線時它還混在下面可疊加的
  // 區塊裡，導致買球隊退休那季偶爾會混進其他事件的段落，蓋過「這是退休」
  // 這個語意。log.boughtClub 跟 log.retiredAsOwner 在 yearlyChoice.js 裡
  // 永遠同時設定，這裡直接併入早退區塊。
  if (c.retiredAsOwner) {
    return [`你砸下畢生積蓄，買下了${S.club}——從球員變成老闆，這是屬於你的球隊了。`];
  }

  const lines = [];

  if (c.secretExposed) {
    lines.push(
      `狗仔拍到${S.age}歲的你跟私下交往的王室成員合照，一夕之間全世界都在談論你的感情生活——「皇室緋聞」這四個字，從此跟你的名字綁在一起。`,
    );
  }
  if (c.unlockedPlayboyStar) {
    lines.push(`一次又一次的緋聞傳聞疊加起來，媒體給你封了個稱號——「花名在外的球星」。`);
  }
  // 稽核抓出來的斷點：跟隱藏王室對象的婚禮份量遠比一般結婚重(見下面
  // c.married 的通用版本)，之前兩者共用同一句「你在OO年結婚了」，導致
  // 這個罕見劇情的婚禮實測常常被更高優先序的事件(世界盃/踢法定型等)蓋過，
  // 讀起來就像什麼都沒發生——這裡換一句對得起這條線份量的專屬文案，
  // 換成疊加式之後這句不會再被別的段落擠掉，但還是保留專屬文案，不用
  // 通用版(份量不一樣，措辭不該一樣)。
  if (c.married && S.love.partner?.hidden) {
    lines.push(`你在${S.year}年，跟這位一直保密的對象完成了婚禮——這段感情終於有了名分，儘管全世界都還不知道真相。`);
  }
  if (c.unlockedShrewdInvestor) {
    lines.push(`場外操盤屢屢賺錢，媒體開始叫你「商業頭腦」，這是球場外的另一個身分。`);
  }
  // 入股球隊(見 data/yearlyOptions.js BUY_CLUB_SHARES_FAME/AGENT)——不是
  // 終局選擇，不觸發退休，需要自己的疊加段落(跟直接買斷球隊不同，那個
  // 折進早退區塊的 c.retiredAsOwner 專屬句裡了)。
  if (c.boughtClubShares) {
    lines.push(`你買下了${S.club}的一部分股份，成為球隊的小股東——這是走向真正老闆之路的第一步。`);
  }
  if (c.unlockedRedeemed) {
    lines.push(`花名在外的過去沒有被抹去，但你用這幾年的穩定證明了自己已經翻篇——媒體開始叫你「洗心革面」。`);
  }
  if (c.unlockedFamilyFirst) {
    lines.push(`穩定的家庭生活成了你最踏實的後盾，圈內人都說你是「顧家好男人/好女人」的代表。`);
  }
  if (log.unlockedRagsToRiches) {
    lines.push(`曾經一擲千金花到一毛不剩，如今又靠自己重新累積起一筆財富——媒體稱你為「破產傳奇」。`);
  }
  // 梅老闆稱號解鎖(見 flow/wealthPeak.js)——這裡只處理「拿到稱號但沒有
  // 選擇退休」的情況，選了退休會被上面的早退區塊(log.retiredAsBoss)
  // 蓋過，不會兩句都印。
  if (log.unlockedWealthHonor === 'BOSS' && !log.retiredAsBoss) {
    lines.push(`你的場外收入這季正式超過了球場薪水——媒體開始叫你「梅老闆」，副業比本業還賺。`);
  }
  if (log.worldCup?.honors?.includes('WORLD_CHAMPION')) {
    lines.push(`${S.year}年，你們捧起了世界盃冠軍獎盃——這是足球場上最高的榮耀，你親手拿到了。`);
  }
  // 國家隊隱藏對手線的收尾：疊加在奪冠段落之後，不取代它(見
  // flow/nationalRival.js nationalRivalClimax 的稽核說明)。只在真的有
  // 對手(入選過國家隊)時才會有內容，dominant 看整個對抗史的走向決定
  // 收尾口吻——多半領先 vs 多半在追趕，是完全不同的份量感。
  if (log.worldCup?.rivalClimax) {
    const { name, dominant, fromClub } = log.worldCup.rivalClimax;
    // fromClub：這個對手當初是俱樂部訓練夥伴線交叉過來的同一個人(見
    // flow/nationalRival.js assignNationalRivalIfFirstCap 的稽核說明)，
    // 收尾句換一組點出「從俱樂部到國家隊」這段完整弧線的措辭，不用跟
    // 隨機分配的陌生對手共用同一句話——這是這條交叉線唯一的專屬收尾，
    // 值得對得起它的份量。
    if (fromClub) {
      lines.push(
        dominant === 'ahead'
          ? `從俱樂部訓練場一路較勁到國家隊，你們的故事在這裡畫下句點——這些年多半是你領先，但這座獎盃，你們是並肩捧起來的。`
          : `從俱樂部訓練場一路較勁到國家隊，你一直在追趕${name}的腳步——直到今天，你終於站上了他一直領先的位置。`,
      );
    } else {
      lines.push(
        dominant === 'ahead'
          ? `這些年跟${name}的較量，你多半都是領先的那一個——但這座獎盃，是你們一起捧起來的。`
          : `這些年，你一直在追趕${name}的腳步——直到這一刻，你終於站到了他一直領先的地方。`,
      );
    }
  }
  if (log.worldCup?.honors?.includes('SELFISH_CROWN')) {
    lines.push(`你當初選擇了證明自己，賭上了團隊的整備——結果賭對了，媒體給了你一個稱號：「孤高的王者」。`);
  }
  if (log.unlockedPlayingStyle?.includes('BALLON_DOR')) {
    lines.push(`個人生涯代表作疊上球隊捧盃的同一季，這一年屬於你——媒體把「金球獎得主」的稱號頒給了你。`);
  } else if (log.unlockedPlayingStyle?.includes('BALLON_DOR_REPEAT')) {
    // 累積計數(見 core/state.js S.trophyCount)每次符合條件都會增加，但
    // 稱號本身只有第一次才有完整敘事——這裡補一句較輕量的「又一座」，
    // 呼應現實梅西/C羅式的金球獎累積敘事，不會每次都重講一次完整版。
    lines.push(`又一年金球獎級的表現加上球隊捧盃——你的金球獎座數，繼續往上疊。`);
  }
  if (log.unlockedPlayingStyle?.includes('GOLDEN_BOOT')) {
    lines.push(`這季的進球數，全聯賽沒人比你多——媒體把「金靴獎」頒給了你。`);
  } else if (log.unlockedPlayingStyle?.includes('GOLDEN_BOOT_REPEAT')) {
    lines.push(`又一季射手榜封王——金靴獎，你已經不是第一次拿了。`);
  }
  if (log.unlockedPlayingStyle?.includes('GOAT')) {
    lines.push(`金球獎、金靴獎、俱樂部冠軍、世界盃冠軍——一座座疊起來，媒體不再爭論了，直接封你為「球王」。`);
  }
  if (log.unlockedPlayingStyle?.includes('GRANDMASTER')) {
    lines.push(`豪門履歷加上捧過的獎盃，加上場上早已立起來的招牌，你被封為「一代宗師」。`);
  }
  if (c.unlockedLateBloomGenius) {
    lines.push(`沒有人在你小時候發現你的天賦——但這幾年，訓練場上展現出來的東西，開始讓人重新談論你這個名字，媒體給了你一個稱號：「埋沒的天才」。`);
  }
  if (c.unlockedMastery?.length) {
    const MASTERY_LINE = {
      埋頭苦練的性格: `年復一年泡在訓練場上，教練都說，很少看過這麼拚的球員——你成了大家口中「埋頭苦練的性格」。`,
      特訓成癮: `除了訓練還是訓練，場外的你幾乎是個謎——隊友都說，你這已經是「特訓成癮」了。`,
      廣結善緣的性格: `轉會市場上，大家都知道找你打聽消息準沒錯——圈內都說你是「廣結善緣的性格」。`,
      精算成癮: `每一步都算得很精，合約、轉會、退路，你從沒讓自己陷入被動——大家都說你這是「精算成癮」。`,
      樂於交際的性格: `不管走到哪裡都有人認得你、想跟你合照——朋友都說，你天生就是「樂於交際的性格」。`,
      社交成癮: `派對、豪宅、鎂光燈，你的生活比賽場上的新聞還多——媒體乾脆封你「社交成癮」。`,
    };
    lines.push(MASTERY_LINE[c.unlockedMastery[0]] || `這幾年下來的習慣，終於變成了外界對你的印象。`);
  }
  // 風險層(穩健/冒進)累積傾向解鎖的稱號，跟委身特質同一種「習慣變成外界
  // 印象」的敘事份量，跟上面 unlockedMastery 分開判斷(兩條累積線互不
  // 干擾，見 data/growth.js RISK_TIER_TITLE)。
  if (c.unlockedRiskTierTitle?.length) {
    const RISK_TITLE_LINE = {
      小心翼翼: `一次又一次選了最穩的那條路，隊友開始用「小心翼翼」來形容你的風格。`,
      零風險主義者: `幾乎從不冒險的選擇疊加了這麼多年，媒體給你貼上了「零風險主義者」的標籤。`,
      走在鋼索上的男人: `一次次的放手一搏疊起來，隊友開始叫你「走在鋼索上的男人」。`,
      孤注一擲的傳奇: `幾乎每次都全力衝刺的紀錄傳開了，你成了圈內公認的「孤注一擲的傳奇」。`,
    };
    lines.push(RISK_TITLE_LINE[c.unlockedRiskTierTitle[0]] || `這種選擇風格，終於變成了外界對你的印象。`);
  }
  if (log.unlockedPlayingStyle?.includes('CLUB_LEGEND')) {
    lines.push(`在${S.club}待了這麼多年，還捧過盃，你早就不只是球員，是「隊史傳奇」。`);
  }
  if (log.worldCup?.honors?.includes('WC_STAR')) {
    lines.push(`${S.year}年世界盃，你踢出生涯代表作，媒體封你為「世界盃之星」。`);
  }
  if (log.worldCup?.honors?.includes('ETERNAL_CAPTAIN')) {
    lines.push(`連續多屆代表國家出征，隊友跟球迷都叫你「永遠的隊長」。`);
  }
  if (log.unlockedFame?.length) {
    const fameLabel = { LOCAL_CELEBRITY: '小有名氣', MEDIA_DARLING: '社群寵兒', GLOBAL_ICON: '全球偶像' };
    lines.push(`人氣值一路累積，如今你已經是外界口中的「${fameLabel[log.unlockedFame[0]] || '公眾人物'}」。`);
  }
  // 訓練線專屬稱號(苦練出頭/自我突破/血肉之驅的極限，見 flow/trainingHonors.js)
  // ——稽核抓出來的漏網之魚：這三個稱號原本只會推進 S.honors、進終局的成就
  // 展示，卻從來沒有在敘事層被講出來過，玩家在生涯過程中完全不會被告知
  // 「這個稱號剛剛解鎖了」，只有到終局才會在成就清單裡看到。
  if (log.unlockedTraining?.length) {
    const trainingHonorLabel = { BREAKTHROUGH: '苦練出頭', SELF_TRANSCENDENCE: '自我突破', LIMIT_BREAKER: '血肉之驅的極限' };
    lines.push(`一次又一次練到超出自己潛力天花板的等級，你成了圈內公認的「${trainingHonorLabel[log.unlockedTraining[0]] || '苦練者'}」。`);
  }
  // CROSSROADS(較勁/合作)累積稱號，見 data/trainingPartner.js RIVALRY_TIER_TITLE。
  if (log.unlockedRivalryHonor?.length) {
    const rivalryHonorLabel = {
      COMPETE_TIER1: '不服輸的性格',
      COMPETE_TIER2: '較勁成癮',
      COOPERATE_TIER1: '好隊友',
      COOPERATE_TIER2: '更衣室的黏著劑',
    };
    lines.push(`訓練場上一次又一次的選擇疊起來，隊友都看得出來——你成了大家口中的「${rivalryHonorLabel[log.unlockedRivalryHonor[0]] || '訓練場常客'}」。`);
  }
  if (log.injuryEscalated) {
    lines.push(`你選擇帶傷硬撐，結果傷勢從${INJURY_TIER[log.injuryEscalated.from].label}惡化成${INJURY_TIER[log.injuryEscalated.to].label}。`);
  }
  if (log.newInjury === 'MAJOR') {
    lines.push(`一次不留神的對抗，${INJURY_TIER.MAJOR.label}讓你缺席了大半個賽季。`);
  }
  // 從豪門(ELITE)摔下來的降級/放棄續約，跟一般降級的份量感不該一樣——
  // 實測讀story.js輸出抓到的問題：一個從皇馬等級豪門被放棄續約、一路
  // 掉到below-TOP5聯賽的傳奇球星，跟一個從普通聯賽被踢到更低層級的
  // 一般球員，原本用的是同一句「你只能降格加盟...」，讀起來完全沒有
  // 「從神壇跌落」的情緒張力。這裡用 S.lastClub(離開前那支球隊)的
  // prestige 分開處理，只有豪門出身才觸發這組更重的措辭。
  const fellFromElite = clubPrestigeOf(S.lastClub) === 'ELITE';
  if (log.demotion) {
    if (fellFromElite) {
      const eliteFallPool = [
        `從${S.lastClub}到${S.club}，這一路摔得不輕——昨天還是豪門主力，今天已經要重新證明自己。`,
        `${S.lastClub}不再需要你了。從世界頂級舞台跌到${LV[log.demotion.to].label}，落差比外界想像的更大。`,
        `豪門的聚光燈說熄就熄——你告別${S.lastClub}，降回${LV[log.demotion.to].label}，加盟${S.club}。`,
      ];
      lines.push(eliteFallPool[ri(0, eliteFallPool.length - 1)]);
    } else {
      lines.push(`表現連續低迷，${S.lastClub}決定把你降回${LV[log.demotion.to].label}，加盟${S.club}。`);
    }
  }
  if (log.contractCrisis?.type === 'dropped') {
    if (fellFromElite) {
      const eliteDropPool = [
        `${S.lastClub}沒有跟你續約——曾經的豪門主力，如今得從${S.club}重新開始。`,
        `合約到期，豪門選擇了放手。你收拾行李，加盟${S.club}，昔日的鎂光燈已經是過去式。`,
        `從${S.lastClub}到${S.club}，這不是你想像過的生涯下半場，但你還是簽了字，繼續踢下去。`,
      ];
      lines.push(eliteDropPool[ri(0, eliteDropPool.length - 1)]);
    } else {
      lines.push(`合約到期，${S.lastClub}沒有續留你的打算，你只能降格加盟${S.club}，繼續留在足球場上。`);
    }
  }
  if (log.contractCrisis?.type === 'paycut') {
    lines.push(`合約到期，球隊只願意用一份縮水的短約留你——你嚥下這口氣，簽了字，決心用下一季證明自己。`);
  }
  if (log.worldCup) {
    const roundLabel = WC_ROUND_LABEL[log.worldCup.round];
    // 首次入選才是真的「這輩子最大的舞台」——實測讀story.js輸出抓到的
    // 問題：這句話原本不分第幾次入選都一字不改，生涯第二、第三次入選
    // 還在講「這輩子最大的舞台」，份量感沒有隨次數/戰績調整。第一次維持
    // 原本的框架，之後改用「再次入選」的口吻，不重複消費同一句話。
    if (S.national.caps === 1) {
      lines.push(`世界盃${roundLabel}，你穿著國家隊球衣站上這輩子最大的舞台之一。`);
    } else {
      const repeatPool = [
        `再次代表國家隊出征世界盃，這次踢到了${roundLabel}。`,
        `世界盃${roundLabel}——這已經不是你第一次站上這個舞台了。`,
        `又一屆世界盃，你的名字再次出現在國家隊名單上，這次戰績是${roundLabel}。`,
      ];
      lines.push(repeatPool[ri(0, repeatPool.length - 1)]);
    }
    // 訓練夥伴線交叉(COMRADE 版，見 flow/nationalRival.js
    // checkTrainingComradeSelected 的稽核說明)：跟對手指派是完全獨立的
    //兩件事(一個溫馨一個競爭)，理論上不會同一季衝突(對手指派只在
    // caps===1 那次，COMRADE 交叉任何一屆都可能發生)，這裡疊加放在
    // 入選句之後、對手相關句之前，順序上先講「誰跟你一起去」再講「誰
    // 是你的對手」，讀起來比較自然。
    if (log.worldCup.partnerAlsoSelected) {
      const partnerPool = [
        `更讓人安心的是，${log.worldCup.partnerAlsoSelected.name}也一起入選了——老搭檔的默契，這次要帶到國家隊的舞台上。`,
        `${log.worldCup.partnerAlsoSelected.name}這次也拿到了徵召名單——熟悉的臉孔在身邊，整備起來踏實不少。`,
      ];
      lines.push(partnerPool[ri(0, partnerPool.length - 1)]);
    }
    if (log.worldCup.rivalAssigned) {
      // fromClub：這個對手是俱樂部訓練夥伴線交叉過來的同一個人(見
      // flow/nationalRival.js assignNationalRivalIfFirstCap 的稽核說明)，
      // 換一句點出「這段較勁從俱樂部延續過來」的專屬文案，不跟隨機分配
      // 陌生對手共用同一句話。
      lines.push(
        log.worldCup.rivalAssigned.fromClub
          ? `更衣室裡熟悉的那張臉，這次穿著同一件國家隊球衣站到你身邊——${log.worldCup.rivalAssigned.name}，你們的較勁從俱樂部一路延續到了國家隊。`
          : `隊上有個人跟你一樣年輕氣盛——${log.worldCup.rivalAssigned.name}，你們倆很快就被拿來比較。`,
      );
    } else if (log.worldCup.rivalComparison === 'ahead') {
      // 只在不是剛指派對手的那季才顯示比較句(跟指派句擠在一起顯得多餘，
      // 見 flow/nationalRival.js compareToRival 的稽核說明)。
      const aheadPool = [
        `這屆賽事，你的表現明顯蓋過了${S.nationalRival?.name || '他'}。`,
        `跟${S.nationalRival?.name || '他'}比起來，這次你才是鎂光燈的焦點。`,
      ];
      lines.push(aheadPool[ri(0, aheadPool.length - 1)]);
    } else if (log.worldCup.rivalComparison === 'behind') {
      const behindPool = [
        `這屆賽事，${S.nationalRival?.name || '他'}的風頭明顯蓋過了你。`,
        `媒體這次聊得更多的是${S.nationalRival?.name || '他'}，不是你。`,
      ];
      lines.push(behindPool[ri(0, behindPool.length - 1)]);
    }
  }
  if (log.unlockedPlayingStyle?.length) {
    lines.push(`你的踢法終於定型，球評開始用專屬的稱號稱呼你這名${posLabel(S)}。`);
  }
  if (c.proposalRejected) {
    lines.push(`你鼓起勇氣求婚，卻沒能等到你想要的答案——這段感情還在，但這一季，氣氛有點尷尬。`);
  }
  if (c.affairDiscovered) {
    lines.push(c.divorced ? `婚外情曝光，紙包不住火——婚姻在這年劃下句點。` : `一場婚外情差點被抓包，這季家裡氣氛降到冰點，但你們撐了過去。`);
  }
  if (c.divorced && !c.affairDiscovered) {
    // affairDiscovered 分支已經把離婚講進去了(同一件事，措辭已經對得起
    // 出軌曝光那個因果)，這裡只在「非出軌導致的離婚」(比如緋聞曝光路線)
    // 才另外講一句通用版，避免同一季講兩次離婚。
    lines.push(`婚姻走到了盡頭，離婚協議在這年簽了字。`);
  }
  if (c.married && !S.love.partner?.hidden) {
    // 隱藏王室對象的結婚已經在上面用專屬文案講過了，這裡只處理一般對象，
    // 避免同一季結婚被講兩次。
    lines.push(`你在${S.year}年結婚了，人生翻開新的一頁。`);
  }
  if (c.newKid) {
    lines.push(`家裡多了一個小生命——第${c.newKid}個孩子誕生了。`);
  }
  if (log.promotion) {
    lines.push(`轉會傳出——你告別${S.lastClub}，加盟${S.club}，從${LV[log.promotion.from].label}一步跳到${LV[log.promotion.to].label}。`);
  }
  if (log.lateralMove) {
    lines.push(`豪門主動開價——你告別${log.lateralMove.from}，加盟${S.club}，這是生涯的重要一步。`);
  }
  if (log.clubCup?.round && CUP_DEEP_RUN.includes(log.clubCup.round)) {
    lines.push(`跟著球隊在${log.clubCup.cup}一路踢進${CUP_ROUND_LABEL[log.clubCup.round]}，這是隊史級的一季。`);
  }
  if (log.loanResult?.stayed) {
    lines.push(`租借期間打出身價，${S.club}決定買斷你的合約，留你下來。`);
  }
  if (log.loanedTo) {
    lines.push(`你被外借到${LV[log.loanedTo].label}，一個證明自己的機會。`);
  }
  if (log.unlockedPlaystyle?.length) {
    lines.push(`苦練終於有成，你在${posLabel(S)}這個位置上多了一項拿手絕活。`);
  }
  if (log.lostPlaystyle?.length) {
    lines.push(`歲月不饒人，過去引以為傲的招牌能力，如今已經不再是巔峰水準。`);
  }
  if (log.subPositionChanged) {
    lines.push(`教練把你從${DPN[log.subPositionChanged.from] || log.subPositionChanged.from}改踢${DPN[log.subPositionChanged.to] || log.subPositionChanged.to}，新角色等著你適應。`);
  }
  // 稽核抓出來的斷點：交往中分手(見 flow/romance.js runRomanceAmbient
  // 的 breakupChance 骰)一直沒有專屬敘事——已婚的離婚(c.divorced)有
  // 專屬句子，但交往階段的分手完全靜默，玩家只能從戀愛狀態面板自己
  // 發現。這條線現在觸發頻率比改版前更高(狗仔自動觸發讓交往開始得更
  // 頻繁，分手自然也跟著變多)，該補上。順序刻意排在 c.startedDating
  // 之前：分手判定(ambient)在同一季的時間軸上本來就早於狗仔認識新對象
  // (evaluate)，同一季兩件事都命中時，先講分手、再講認識新對象才是
  // 正確的時間順序，不會讀起來像「先在一起又馬上分手」。
  if (c.brokeUp) {
    const breakupPool = [
      '這段感情走不下去了，你們分手了。',
      '你們的關係還是散了，這季你又回到單身。',
      '感情淡了，這段關係在這季畫下句點。',
    ];
    lines.push(breakupPool[ri(0, breakupPool.length - 1)]);
  }
  if (c.startedDating) {
    const title = c.startedDating.title;
    lines.push(c.startedDating.hidden ? `你開始跟一位${title}秘密交往，這段關係注定要藏起來。` : `你開始跟一位${title}交往，生活多了不一樣的色彩。`);
  } else if (c.paparazziDenied) {
    // 狗仔自動觸發事件選了「否認」——見 flow/romance.js
    // evaluateLoveChoiceMoment 的 PAPARAZZI 分支，基本款專屬，不用選社交
    // 就可能遇到。否認零代價，純粹是玩家這次不想開始，下季還可能再遇到
    // 同一種事件(不一定是同一個人)，這句只是帶過，不用太重的措辭。
    const deniedPool = [
      '有狗仔想把你跟某人湊成一對，你笑笑否認了，這事就這樣過去。',
      '緋聞傳得煞有其事，但你選擇不承認——至少現在還不是時候。',
      '媒體又在瞎猜你的感情生活，你這次沒打算讓它成真。',
    ];
    lines.push(deniedPool[ri(0, deniedPool.length - 1)]);
  }
  // 訓練夥伴/對手(見 data/trainingPartner.js/flow/trainingRivalry.js)——
  // 同一套「起點卡類別、後續常駐」的疊加寫法，跟戀愛線並列不衝突(兩條
  // 線各自的段落，疊加式敘事本來就是為了讓這種情況不用互搶位置)。
  // 順序刻意讓 c.trainingPartnerLeft 排在 c.trainingPartnerAssigned/
  // c.trainingEncounterIgnored 之前：跟戀愛線的 brokeUp/startedDating
  // 同一個稽核發現——prepareTrainingChoice() 裡 runTrainingRivalryAmbient
  // (舊夥伴離隊，可能在這裡把 S.trainingPartner 清空)一定先於
  // evaluateTrainingEncounter(新夥伴的起點事件)執行，同一季兩件事都命中
  // 時，先講離隊、再講認識新人才是正確的時間順序。
  const TRAINING_PARTNER_LABEL = { RIVAL: '對手', COMRADE: '訓練夥伴' };
  // 稽核抓出來的份量落差：離隊原本不分相處多久都是同一句話，長期夥伴
  // (比如剛好在羈絆時刻門檻附近)離隊跟認識沒多久就走的人讀起來一樣輕，
  // 對不上戀愛線離婚等級的份量感——依 p.years 分三級，長期關係才配得上
  // 專屬的重文案。
  if (c.trainingPartnerLeft) {
    const p = c.trainingPartnerLeft;
    const years = p.years || 0;
    let pool;
    if (years >= 5) {
      pool =
        p.type === 'RIVAL'
          ? [
              `${p.name}離隊那天，你們沒有多說什麼，只是隔著訓練場看了對方一眼——這麼多年的較勁，早就變成了一種默契，不需要言語。`,
              `這麼多年的頭號競爭者說走就走，${p.name}離開球隊的那一刻，你才發現自己已經把他當成生涯的一部分。`,
            ]
          : [
              `${p.name}離隊那天，整個更衣室都沉默了——這麼多年並肩作戰的搭檔，不是一句「保重」就能真的說再見的。`,
              `從菜鳥練到現在，${p.name}是陪你走最久的那個人——他走的這一年，訓練場感覺空了一大塊。`,
            ];
    } else if (years >= 2) {
      pool =
        p.type === 'RIVAL'
          ? [`${p.name}轉隊離開，這幾年較勁出來的默契，一時間找不到人能延續。`, `跟${p.name}拚了這幾年，他這次真的走了——訓練場上少了個能逼你進步的人。`]
          : [`${p.name}轉隊離開，這幾年並肩訓練的日子，就這樣告一段落。`, `跟${p.name}搭檔了這幾年，他走的那天，更衣室氣氛明顯低了一截。`];
    } else {
      pool =
        p.type === 'RIVAL'
          ? [`${p.name}轉隊離開了，你們之間那股較勁的氣氛，一時間還真有點不習慣。`, `認識沒多久，${p.name}就轉隊了——這股競爭的張力，說消失就消失。`]
          : [`${p.name}離開了球隊，訓練場上少了個固定搭檔。`, `才剛熟悉起來，${p.name}就轉隊了，訓練場上突然安靜不少。`];
    }
    lines.push(pool[ri(0, pool.length - 1)]);
  }
  if (c.trainingPartnerAssigned) {
    const p = c.trainingPartnerAssigned;
    lines.push(
      p.type === 'RIVAL'
        ? `隊上來了一位${p.title}——${p.name}，教練組看得出來，你們倆已經開始互相較勁了。`
        : `你跟${p.title}${p.name}變得熟稔起來，訓練場上多了個能一起拚的人。`,
    );
  } else if (c.trainingEncounterIgnored) {
    // 年度自動觸發事件選了「不予理會」——見 flow/trainingRivalry.js
    // resolveTrainingEncounter，跟戀愛線的 c.paparazziDenied 同一種零
    // 代價寫法，之後還可能再遇到人(不一定是同一個)。
    const ignoredPool = [
      `${c.trainingEncounterIgnored.name}想找你較量/搭話，你這次沒接這個茬。`,
      '訓練場邊有人主動靠近，你這次選擇專心練自己的，沒多搭理。',
      '有人想跟你套近乎，你禮貌地維持距離，這事就這樣過去了。',
    ];
    lines.push(ignoredPool[ri(0, ignoredPool.length - 1)]);
  }
  if (c.trainingCompete) {
    const p = c.trainingCompete.partner;
    lines.push(`你跟${p.name}在訓練場上正面較勁，${ABL[c.trainingCompete.target]}明顯練出了效果——但隊上的氣氛也跟著繃緊了一點。`);
  }
  if (c.trainingCooperate) {
    const p = c.trainingCooperate.partner;
    lines.push(`你跟${p.name}選擇互相扶持，帶著整個更衣室的氣氛都跟著融洽起來。`);
  }
  // 羈絆時刻(見 data/trainingPartner.js BOND_MOMENT_HONOR/
  // flow/trainingRivalry.js checkTrainingBondMoment 的稽核說明)——這條線
  // 唯一的一次性高潮節點，跟 CROSSROADS 是獨立判定，不衝突。不印百分比
  // (跟這個專案「氛圍不給數字」的既定慣例一致)，只在成功時點名解鎖的
  // 稱號，讓玩家知道這是一件值得記住的事。
  if (c.bondMoment) {
    const { type, success, partner } = c.bondMoment;
    if (type === 'RIVAL') {
      lines.push(
        success
          ? `跟${partner.name}多年的較勁終於迎來攤牌的一刻——這場公開對決，你贏了。媒體給了你一個稱號：「勝負師」，球隊上下都感覺得到，你們的氣勢不一樣了。`
          : `跟${partner.name}多年的較勁終於迎來攤牌的一刻，這場公開對決，你們誰都沒能真正壓過誰——這一次，你沒能抓住這個機會。`,
      );
    } else {
      lines.push(
        success
          ? `跟${partner.name}並肩訓練這麼多年，這一季，你們一起扛過了球隊最難熬的低潮——隊友都說，這就是「精神支柱」該有的樣子。`
          : `跟${partner.name}並肩訓練這麼多年，這一季球隊陷入低潮，你們試著撐住，但這一次沒能真正扭轉局面。`,
      );
    }
  }
  // 經紀人線(見 data/agent.js/flow/agentLine.js)——完全比照訓練夥伴線
  // 上面那一整段的疊加寫法跟順序邏輯(離開排在起點事件之前，同一個
  // 「ambient先於evaluate執行」的時間軸理由)。PRO-only，青訓期敘事
  // (narrateYouthSeason)不需要對應分支。
  if (c.agentLeft) {
    const a = c.agentLeft;
    const years = a.years || 0;
    let pool;
    if (years >= 5) {
      pool =
        a.type === 'AMBITIOUS'
          ? [
              `合作這麼多年的經紀人，這次真的要離開了——他去代理更大牌的球星，你們沒有撕破臉，只是各自的路走到了分岔口。`,
              `${a.name}離開的那天，你才意識到這麼多年的每一筆合約，背後都有他的影子。`,
            ]
          : [
              `${a.name}離開的那天，你們沒有多說什麼——這麼多年的信任，不是一句「合作愉快」能概括的。`,
              `從菜鳥時期就跟著你的經紀人，這次真的要說再見了——這份信任關係，是這幾年最踏實的後盾之一。`,
            ];
    } else if (years >= 2) {
      pool =
        a.type === 'AMBITIOUS'
          ? [`${a.name}離開去代理別的球星了，這幾年談成的那幾筆交易，你不會忘記。`, `跟${a.name}合作了這幾年，他這次真的走了——談判桌上少了個敢衝的人。`]
          : [`${a.name}離開了，這幾年穩紮穩打的合作關係，就這樣告一段落。`, `跟${a.name}合作了這幾年，他走的這天，你少了個信得過的人幫你把關合約。`];
    } else {
      pool =
        a.type === 'AMBITIOUS'
          ? [`合作沒多久，${a.name}就轉去代理別的球星了，這段關係說結束就結束。`, `認識沒多久，${a.name}就離開了——這段經紀關係還沒真的展開就畫下句點。`]
          : [`${a.name}結束了跟你的合作，你的經紀事務暫時又回到自己打理。`, `才剛開始合作，${a.name}就離開了，這段關係還沒來得及深入。`];
    }
    lines.push(pool[ri(0, pool.length - 1)]);
  }
  if (c.agentAssigned) {
    const a = c.agentAssigned;
    lines.push(
      a.type === 'AMBITIOUS'
        ? `一位經紀人主動聯繫你——${a.title}${a.name}，他看好你的潛力，想成為你的代理人。`
        : `你簽下了${a.title}${a.name}當你的經紀人，感覺是個能長期信任的人。`,
    );
  } else if (c.agentEncounterIgnored) {
    const ignoredPool = [
      `${c.agentEncounterIgnored.name}主動聯繫想當你的經紀人，你這次沒有回應。`,
      '有經紀人想簽下你，你這次選擇繼續自己打理，沒有點頭。',
      '一通經紀邀約的電話，你這次沒有接。',
    ];
    lines.push(ignoredPool[ri(0, ignoredPool.length - 1)]);
  }
  if (c.agentBold) {
    const a = c.agentBold.agent;
    lines.push(`你聽從${a.name}的建議，這次選擇大膽操作，轉會市場上的曝光度明顯拉高——但跟俱樂部的關係也跟著繃緊了一點。`);
  }
  if (c.agentSteady) {
    const a = c.agentSteady.agent;
    lines.push(`你聽從${a.name}的建議，這次選擇穩紮穩打，跟俱樂部的關係更穩固了，薪資談判也多了一點籌碼。`);
  }
  // 世紀交易(見 data/agent.js AGENT_BOND_HONOR 的稽核說明)——這條線唯一
  // 的一次性高潮節點，跟 CROSSROADS 是獨立判定，不衝突。不印百分比，
  // 只在成功時點名解鎖的稱號。
  if (c.agentBondMoment) {
    const { type, success, agent } = c.agentBondMoment;
    if (type === 'AMBITIOUS') {
      lines.push(
        success
          ? `跟${agent.name}合作這麼多年，這一次，他談成了一筆生涯最重要的交易——媒體給了他一個稱號：「操盤手」，你們兩個的名字，這次一起上了新聞。`
          : `跟${agent.name}合作這麼多年，這一次，他賭上信譽談了一筆生涯級的交易——最後沒能談成，這次沒能抓住這個機會。`,
      );
    } else {
      lines.push(
        success
          ? `跟${agent.name}合作這麼多年，這一次，他用最穩健的方式談成了一筆分量十足的合約——隊友都說，這才是「軍師」該有的水準。`
          : `跟${agent.name}合作這麼多年，這一次他想談一筆重要的合約，最後沒能談成，但你們之間的信任沒有因此動搖。`,
      );
    }
  }
  if (log.unlockedAgentHonor?.length) {
    const agentHonorLabel = {
      BOLD_TIER1: '敢賭的性格',
      BOLD_TIER2: '豪賭成癮',
      STEADY_TIER1: '穩紮穩打的信條',
      STEADY_TIER2: '合約談判的定心丸',
    };
    lines.push(`跟經紀人一次又一次的抉擇疊起來，圈內人都看得出來——你成了大家口中的「${agentHonorLabel[log.unlockedAgentHonor[0]] || '談判場常客'}」。`);
  }
  // 國家隊隱藏對手線的 CROSSROADS 結果，見 flow/nationalRival.js
  // resolveRivalCrossroads——只在真正的世界盃年、有對手時才會出現，跟
  // 俱樂部訓練線的較勁/合作是完全獨立的兩件事，不會同一季衝突。真正的
  // 效果(個人數據臨時加成/隊伍晉級機率)要等這季稍後 checkWorldCupWindow
  // 判定完賽果才會反映在後面的世界盃段落裡，這裡先講「你選了什麼」。
  if (c.rivalCompete) {
    lines.push(`世界盃備戰期間，你選擇在${c.rivalCompete.name}面前證明自己，把這屆賽事當成個人的舞台。`);
  }
  if (c.rivalTeamFocus) {
    lines.push(`世界盃備戰期間，你選擇跟${c.rivalTeamFocus.name}一起把心力放在整支球隊的備戰上，沒有搶著出風頭。`);
  }
  if (c.scandal && !c.secretExposed) {
    // secretExposed 是這條 scandal 骰的隱藏線分支，已經用專屬文案講過，
    // 這裡只處理一般對象的緋聞，避免同一季講兩次。
    lines.push(`一則緋聞悄悄流出，這季你多了點場外話題。`);
  }
  if (c.affairHidden) {
    lines.push(`這年你有一段瞞著另一半的關係，沒有人發現——至少現在還沒有。`);
  }
  if (c.mediaScandal) {
    lines.push(`一場通告說錯話，被媒體斷章取義炒了一輪，人氣不減反跌。`);
  }
  if (c.blewItAll) {
    lines.push(`你把存款花到一毛不剩，全網都在討論你這次瘋狂的消費——爽了一次，帳戶歸零。`);
  }
  if (c.invest) {
    if (c.invest.staked <= 0) {
      lines.push(`存款還太薄，這年沒什麼好拿去投資的。`);
    } else {
      lines.push(
        c.invest.result >= c.invest.staked
          ? `你把一部分存款拿去操盤，這次賺了一筆，存款又厚了一些。`
          : `你把一部分存款拿去操盤，這次判斷失準，賠了一筆。`,
      );
    }
  }
  if (c.moneySpent) {
    // 每個付費選項原本只有一句固定措辭，一輪生涯裡砸錢選項常常會連續選好
    // 幾次(存款夠了就幾乎必點，見 data/yearlyOptions.js 的設計背景)，
    // 同一句話逐字重複的機率很高(實測讀story.js輸出真的撞到過同一句
    // 出現兩次)——每個選項擴成小池子，降低重複感。
    const spendPool = {
      PRIVATE_CAMP: ['砸錢請了整個私人教練團隊特訓', '你把錢投進最頂級的訓練資源裡', '私人教練團隊進駐，訓練強度直接拉高一個檔次'],
      PR_FIRM: ['花錢聘請頂級經紀團隊替你操盤', '你換了一組更專業的經紀團隊，轉會市場上的曝光度明顯不同', '頂級經紀公司開始替你鋪路，話題度跟著水漲船高'],
      IMAGE_MANAGEMENT: ['砸重金請公關公司包裝形象', '你花錢請專業團隊重新包裝了自己的公眾形象', '公關團隊進場後，媒體對你的報導風向明顯轉好'],
      LUXURY_LIFESTYLE: ['添購了豪宅，升級了生活品質', '你買下一棟夢想中的豪宅，生活排場跟著升級', '私人生活的排場拉高了，鎂光燈也跟著多了起來'],
      SPACE_TOURISM: ['花大錢圓了一次上太空的夢', '你成了圈內第一個上過太空的球員，這話題夠聊一輩子', '砸下重金換來的太空之旅，成了這輩子最瘋狂的一頁'],
    };
    const pool = spendPool[c.option] || ['你花了一筆錢投資自己'];
    lines.push(`💰 ${pool[ri(0, pool.length - 1)]}，存款少了${c.moneySpent}，但換來明顯的效果。`);
  }

  // 「主攻優勢項目」現在會記連續投入季數(見 flow/yearlyChoice.js)——
  // 第一次選定目標跟已經磨了好幾年是完全不同的故事份量，前後連貫感
  // 是使用者明確要求的方向：同一個目標練越久，語氣應該從「立志」變成
  // 「累積」，不是每次都當成全新開始講。
  if (c.focusedKey) {
    const label = ABL[c.focusedKey];
    if ((c.focusStreak || 1) <= 1) {
      lines.push(`你把訓練重心放在${label}上，準備從這裡建立自己的招牌。`);
    } else {
      const streakPool = [
        `你繼續死磕${label}，這已經是連續投入這項能力的第${c.focusStreak}個賽季了。`,
        `${label}還是這幾年訓練的主旋律，你沒有換過方向。`,
        `一年一年疊上去，你還在同一條路上磨${label}這項能力。`,
      ];
      lines.push(streakPool[ri(0, streakPool.length - 1)]);
    }
  }

  // 豪門巔峰期的「平淡球季」也不該讀起來跟一般聯賽球員一樣普通——實測讀
  // story.js輸出抓到的落差：待在豪門的那幾年份量本該是全篇最重的段落，
  // 卻常常落在跟其他球隊球員共用的同一組通用填充句裡(甚至被砸錢選項
  // 佔滿)，讀不出「這是世界頂級舞台」的份量。只在真的踢出水準
  // (RAT>=6.5，數字跟著 RAT 公式重算校準，反推舊門檻7.5對應的
  // effOVR≈40換算等值新門檻，見 flow/proSeason.js generateSeasonStats
  // 的稽核說明)時觸發，避免板凳球員也被套上不符合現況的鎂光燈敘事——
  // 這句話取代的是「普通平淡年份」的填充句，不取代已經有自己專屬敘事
  // 的砸錢/投資/戀愛等主動選擇。這裡維持「取代填充句」的語意：只有
  // lines 目前還是空的(沒有其他事發生)才加這句或退到 quietPool，不然
  // 一個踢出頂級水準又同時買豪宅的球季，會同時印「頂級舞台」+「買豪宅」
  // 兩段，反而失焦。
  if (lines.length === 0) {
    const atElite = S.tier === 'TOP5' && clubPrestigeOf(S.club) === 'ELITE';
    if (atElite && (log.stat?.RAT || 0) >= 6.5) {
      const eliteQuietPool = [
        `這一年你在${S.club}踢得穩紮穩打，聯賽媒體開始把你的名字跟隊史前輩相提並論。`,
        `身在世界頂級舞台，你早就習慣了每場比賽都有滿場鎂光燈盯著你。`,
        `這季你在${S.club}的先發位置穩如泰山，教練沒有理由把你換下場。`,
        `踢豪門球隊的比賽，壓力比別人想像的大得多，但你早就學會怎麼在鎂光燈下保持冷靜。`,
        `這一年，你只是做好分內的事——但在${S.club}，「分內的事」的標準本來就比別人高。`,
      ];
      lines.push(eliteQuietPool[ri(0, eliteQuietPool.length - 1)]);
    } else {
      const pool = quietPool(S, log, c.category);
      lines.push(pool[ri(0, pool.length - 1)]);
    }
  }

  return lines;
}

/* ---------- 青訓三年的一句話敘事 ---------- */
/* 對照 narrateSeason 的優先序精神，但青訓期 log 欄位少很多(見
   flow/youthChoice.js applyYouthChoice 的回傳形狀)，用不到同一套龐大的
   優先序清單，寫一個精簡版。稽核抓出來青訓期原本完全沒有逐年敘事，
   只有開局/結局兩句話——現在每年都有選擇了，敘事也要跟上。跟
   narrateSeason 同一套疊加式規則，回傳陣列——目前青訓期分支彼此互斥
   居多(一年通常只命中一種)，但介面維持跟 narrateSeason 一致，呼叫端
   不用分兩套處理方式，之後真的出現同季多重觸發也不用再改一次型別。 */
const YOUTH_QUIET_POOL = {
  TRAINING: [
    '這一年泡在訓練場上，一點一滴打底子。',
    '青訓教練盯得很緊，每個細節都要求到位。',
    '沒有戲劇性的事，只有反覆的基本功練習。',
    '身體還在發育，教練刻意控制訓練強度。',
  ],
  OPPORTUNITY: [
    '球隊安排了幾場對抗賽，你把握機會表現自己。',
    '教練組在觀察名單上，你想辦法讓自己被看見。',
    '這年沒什麼大新聞，但你悄悄替自己爭取機會。',
  ],
  SOCIAL: [
    '跟隊友的感情越來越好，更衣室氣氛很融洽。',
    '訓練之餘，你花時間跟同齡的隊友培養默契。',
    '這一年沒什麼特別的，日子過得平淡踏實。',
  ],
};

export function narrateYouthSeason(S, log, ri) {
  const lines = [];
  if (log.unlockedRiskTierTitle?.length) {
    const RISK_TITLE_LINE = {
      小心翼翼: `青訓教練都說，你選路的風格特別穩——隊友開始叫你「小心翼翼」。`,
      走在鋼索上的男人: `你這幾年的選擇一次比一次大膽，隊友給你封了個稱號：「走在鋼索上的男人」。`,
    };
    lines.push(RISK_TITLE_LINE[log.unlockedRiskTierTitle[0]] || `這種選擇風格，已經變成隊友對你的印象。`);
  }
  if (log.focusedKey) {
    lines.push(`這一年你把重心全押在${ABL[log.focusedKey]}上，其他能力暫時停滯不前。`);
  }
  if (log.debutInjuryMultApplied) {
    lines.push(`家人一路陪著你撐過選拔壓力最大的這幾年。`);
  }
  if (log.popularityGain) {
    // 原本是單一固定句，青訓期只有3年，同一句在3年裡出現兩次的機率不低
    // (實測讀story.js輸出真的撞到過)，改成小池子降低逐字重複的機率。
    const pool = [
      '地方媒體開始注意到你這個小小新星。',
      '球探圈子裡開始流傳你的名字。',
      '青訓隊友都說，你遲早會被大家記住。',
    ];
    lines.push(pool[ri(0, pool.length - 1)]);
  }
  // 訓練夥伴/對手：起點(認識)是年度自動觸發，青訓期也適用(見
  // flow/careerStart.js runYouthToDebut 的常駐階段)，措辭改成青訓期的
  // 口吻；CROSSROADS(較勁/合作)則要選了訓練類別才會評估(見
  // flow/youthChoice.js applyYouthChoice)，跟職業版同一套機制、不同措辭。
  // 順序(離隊排在認識新人之前)跟職業版 narrateSeason 同一個稽核發現，
  // 理由同上——ambient 離隊一定先於 encounter 起點事件執行。
  if (log.trainingPartnerLeft) {
    // 稽核抓出來的落差：原本不分類型都是同一句，補上跟職業版一致的
    // RIVAL/COMRADE 區分(青訓期只有3年，relatedYears 頂多到2，用不到
    // 職業版的長期重文案那一級，維持兩段式就夠)。
    const p = log.trainingPartnerLeft;
    const pool =
      p.type === 'RIVAL'
        ? [`${p.name}離開了青訓隊，那股較勁的氣氛一時間還真有點不習慣。`, `認識沒多久，${p.name}就離開了青訓隊——這股競爭的張力，說消失就消失。`]
        : [`${p.name}離開了青訓隊，這段緣分就這樣斷了。`, `才剛熟悉起來，${p.name}就離開了青訓隊，訓練場上突然安靜不少。`];
    lines.push(pool[ri(0, pool.length - 1)]);
  }
  if (log.trainingPartnerAssigned) {
    const p = log.trainingPartnerAssigned;
    lines.push(
      p.type === 'RIVAL'
        ? `青訓隊裡來了一位${p.title}——${p.name}，教練組已經開始拿你們倆比較。`
        : `你跟${p.title}${p.name}變得熟稔起來，青訓路上多了個能一起拚的人。`,
    );
  } else if (log.trainingEncounterIgnored) {
    lines.push(`${log.trainingEncounterIgnored.name}想找你較量/搭話，你這次沒接這個茬。`);
  }
  if (log.trainingCompete) {
    lines.push(`你跟${log.trainingCompete.partner.name}在訓練場上正面較勁，${ABL[log.trainingCompete.target]}明顯練出了效果。`);
  }
  if (log.trainingCooperate) {
    lines.push(`你跟${log.trainingCooperate.partner.name}選擇互相扶持，青訓隊裡的氣氛更融洽了。`);
  }
  // 羈絆時刻：跟職業版同一套(見 narrateSeason 的 c.bondMoment 分支)，
  // 實務上青訓三年內門檻(6年)永遠不會真的觸發，這裡只是保持兩邊敘事
  // 介面一致，之後門檻若調整也不用回頭補。
  if (log.bondMoment) {
    const { type, success, partner } = log.bondMoment;
    if (type === 'RIVAL') {
      lines.push(
        success
          ? `跟${partner.name}的較勁迎來攤牌的一刻——這場對決，你贏了，青訓隊裡都在傳你這個稱號：「勝負師」。`
          : `跟${partner.name}的較勁迎來攤牌的一刻，這一次，你沒能抓住這個機會。`,
      );
    } else {
      lines.push(
        success
          ? `跟${partner.name}並肩練了這麼久，這次你們一起扛過了隊上的低潮——大家都說，這就是「精神支柱」該有的樣子。`
          : `跟${partner.name}並肩練了這麼久，這次隊上陷入低潮，你們試著撐住，但沒能真正扭轉局面。`,
      );
    }
  }
  // 戀愛線：起點(狗仔自動觸發，基本款專屬)青訓期也適用，見
  // flow/romance.js evaluateLoveChoiceMoment 的 SINGLE/DIVORCED 分支。
  // 分手判定順序刻意排在認識新對象之前——同一個時間軸上分手(ambient)
  // 本來就早於狗仔認識新對象(evaluate)，同一季兩件事都命中時，這樣排
  // 才不會讀起來像「先在一起又馬上分手」(跟職業版 narrateSeason 同一個
  // 稽核發現)。
  if (log.brokeUp) {
    lines.push('這段感情走不下去，你們分手了，青訓路上又只剩你自己。');
  }
  if (log.startedDating) {
    const title = log.startedDating.title;
    lines.push(log.startedDating.hidden ? `你開始跟一位${title}秘密交往，這段關係注定要藏起來。` : `你開始跟一位${title}交往，青訓生活多了不一樣的色彩。`);
  } else if (log.paparazziDenied) {
    lines.push('有狗仔想把你跟某人湊成一對，你笑笑否認了，這事就這樣過去。');
  }
  if (log.married) {
    lines.push(`你在青訓期就結婚了，人生翻開新的一頁——這在同齡球員裡並不常見。`);
  }
  if (lines.length === 0) {
    const pool = YOUTH_QUIET_POOL[log.category] || YOUTH_QUIET_POOL.TRAINING;
    lines.push(pool[ri(0, pool.length - 1)]);
  }
  return lines;
}

/* 天才判定(見 flow/careerStart.js resolveDebut)是在轉正式那一刻才確定的，
   不屬於任何一個 proSeasonTick 的 log，青訓期敘事(narrateYouthSeason)
   逐年印，也接不上這個「三年跑完才知道」的結果——獨立一個小函式，呼叫端
   (story.js/未來 UI)在印出轉正式那句話之後接著呼叫，回傳 null 代表沒有
   要額外講的話，不強塞一句空話進去。 */
export function narrateDebut(S) {
  if (S.honors.includes(GENIUS.label)) {
    return '青訓期間，教練組私下都在傳：這孩子是真正的天才。';
  }
  return null;
}
