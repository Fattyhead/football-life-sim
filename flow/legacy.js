/* ---------- 終局評價 ---------- */
/* 對照原版棒球的名人堂級距邏輯：20 年的選擇需要收斂成一個「你是傳奇還是
   平庸」的結算，不然玩家投入的時間沒有一個有份量的收尾。
   分數只加總「已經存在的生涯紀錄」(honors/traits/caps/peakRAT/踢過的最高
   層級)，不引入新的隱藏數值——這是把整局遊戲的成果讀出來，不是另一套
   要重新調校的系統。 */

import { REGION } from '../data/regions.js';
import { POSN, DPN } from '../data/abilities.js';
import { WC_ROUND_LABEL, WC_HONOR } from '../data/national.js';
import { WEALTH_HONOR } from '../data/wealth.js';
import { TRAINING_HONOR } from '../data/mastery.js';
import { clubPrestigeOf } from './shared.js';
import { buildAchievementGallery, tierOfHonor } from './achievements.js';

/* 稽核抓出來的斷點：原本 honorsScore 是 S.honors.length * 15，不管稱號
   稀有度一律同分——「小有名氣」(20%機率就拿得到)跟「買下球隊」(0.2%
   機率)加的分數一樣多，普通/稀有/精英這套難度分層在終局評價這裡完全
   沒有反映出來，只在成就展示頁面有意義。這裡依 tier 給不同權重，
   精英層的份量要真的對得起它的稀有度。 */
const TIER_SCORE_WEIGHT = {
  COMMON: 8,
  OFFPITCH_COMMON: 8,
  RARE: 15,
  OFFPITCH_RARE: 15,
  ELITE: 30,
  OFFPITCH_ELITE: 30,
};

function weightedHonorsScore(S) {
  return S.honors.reduce((sum, label) => sum + (TIER_SCORE_WEIGHT[tierOfHonor(label)] ?? 15), 0);
}

/* 使用者定案：終局評價要換算成 0-100% 封頂的「傳奇度」，越接近100%
   代表這段人生成色越高(比照棒球名人堂投票%的精神，但不套用「名人堂」
   這個框架——足球圈沒有對應的真實機構，見稽核記錄，「傳奇度」是這個
   遊戲自己的原創評價系統)。LEGACY_TIER 的 min 門檻改成百分比(原本是
   0-473+ 的開放式原始分數，score 本身現在只當內部計算用，不直接顯示
   給玩家)，標籤沿用原本已經在用的五個(沒有改名的必要，只是換算分母)。
   門檻數字實測校準：4000種子跑完整生涯(headless隨機選擇，代表「沒有
   刻意規劃」的生涯下限)，原始分數中位217、90%分位321、99%分位406、
   最高473——LEGACY_CEILING_SCORE(下面)抓550，讓純隨機生涯的中位數落在
   「主力球星」跟「稱職球員」之間、極端幸運的隨機生涯頂多摸到「巨星」
   下緣，真正的「傳奇」(90%+)留給刻意優化、追稱號、拚巔峰評分的生涯，
   跟「向上流動不卡關」一致：不是不可能，是要真的花心思才到得了。 */
export const LEGACY_TIER = [
  { min: 90, label: '傳奇', desc: '球史留名的那種名字，多年後仍會被人提起。' },
  { min: 70, label: '巨星', desc: '生涯高峰時是聯賽等級的焦點人物。' },
  { min: 50, label: '主力球星', desc: '長年穩坐先發，是球隊倚重的核心。' },
  { min: 25, label: '稱職球員', desc: '踢完了一份體面的職業生涯。' },
  { min: 0, label: '普通球員', desc: '生涯平淡，但你走完了屬於自己的旅程。' },
];

// 傳奇度%的分母，見上面 LEGACY_TIER 的稽核說明——之後如果實測發現分佈
// 跑掉(比如玩家反映刻意優化的生涯還是摸不到高分)，只要調這一個數字。
const LEGACY_CEILING_SCORE = 550;

/* 踢過的最高層級給一次性加成(不分踢了幾季)，對照原版名人堂邏輯裡
   「有沒有站上過大聯盟等級的舞台」這種一次性門檻加分。
   TOP5 內部再細分：待過 ELITE(豪門)等級球隊額外加分——TOP5 是大多數
   成功生涯真正會停留、累積紀錄的地方(見 flow/transfer.js checkLateralMove
   的豪門階梯設計)，終局分數要看得出「在 TOP5 裡面爬到多高」，不能只看
   「有沒有踢過 TOP5」這個單一門檻。 */
function tierReachedBonus(S) {
  if (S.clubTally.TOP5 && Object.keys(S.clubTally.TOP5).length > 0) {
    const playedElite = Object.keys(S.clubTally.TOP5).some((name) => clubPrestigeOf(name) === 'ELITE');
    return playedElite ? 28 : 20;
  }
  if (S.clubTally.FEEDER && Object.keys(S.clubTally.FEEDER).length > 0) return 8;
  return 0;
}

/* 生涯待過幾支不同俱樂部，橫跨三個層級——lastClub 之前寫了三處卻沒人讀
   (實測稽核抓出來的斷點)，終局用這個數字呈現轉會生涯的廣度，比單獨
   印一個「上一支球隊」更有意義(玩家關心的是整個轉會軌跡，不是只有
   退休前那一次)。 */
function clubsPlayedCount(S) {
  let count = 0;
  for (const tier of ['LOCAL', 'FEEDER', 'TOP5']) {
    count += Object.keys(S.clubTally[tier] || {}).length;
  }
  return count;
}

/* S.stats 每季都在存(見 proSeason.js generateSeasonStats)，但實測稽核發現
   從沒被加總讀取過——20 年的進球/助攻數字寫進去就沒人再看，終局畫面應該要
   把這個攤開來講，不然玩家不會知道自己這輩子到底踢進幾球。 */
/* 稽核抓出來的斷點(使用者提出：「後衛跟門將不參與進攻的呢?」)：這裡
   以前只加總 APP/GLS/AST——對守門員來說 GLS/AST 整季都是 0(見
   flow/proSeason.js generateSeasonStats 的守門員分支，根本不寫這兩個
   欄位)，對純防守型後衛來說也小到沒有代表性，等於「生涯數據」這張
   終局比較卡片對防守型球員完全沒有意義的數字可看。守門員/外場球員的
   stat 物件其實一直都有 SV(撲救)/GA(失球)/CS(零封)/TKL(抢断)這些欄位
   (兩個分支都會初始化，不是只有其中一種位置才有，見同一個函式)，只是
   終局比較卡片以前完全沒讀——這裡補上，不分位置全部加總，讀取端(story.js/
   EndingScreen.jsx)再依 S.pos 決定要凸顯哪一組數字。 */
function careerTotals(S) {
  let APP = 0,
    GLS = 0,
    AST = 0,
    TKL = 0,
    CS = 0,
    SV = 0,
    GA = 0;
  for (const tier of ['LOCAL', 'FEEDER', 'TOP5']) {
    for (const s of S.stats[tier] || []) {
      APP += s.APP || 0;
      GLS += s.GLS || 0;
      AST += s.AST || 0;
      TKL += s.TKL || 0;
      CS += s.CS || 0;
      SV += s.SV || 0;
      GA += s.GA || 0;
    }
  }
  return { APP, GLS, AST, TKL, CS, SV, GA };
}

/* clubTally 同樣只寫沒讀——挑出待最久的那支球隊，給「效力最久的俱樂部」
   這種忠誠度敘事，不然轉了好幾次會的紀錄完全沒有收斂點。 */
function mostPlayedClub(S) {
  let best = null;
  let bestCount = 0;
  for (const tier of ['LOCAL', 'FEEDER', 'TOP5']) {
    for (const [club, count] of Object.entries(S.clubTally[tier] || {})) {
      if (count > bestCount) {
        best = club;
        bestCount = count;
      }
    }
  }
  return best;
}

/* 地區印象：稽核抓出來的缺口——出身地區只在青訓開局(startBonus)跟世界盃
   資格影響生涯，轉正式之後的 20 年幾乎感覺不到差異，這麼多心力做的
   地區差異化，長期回報偏低。這裡把地區重新拉回終局敘事：用
   region.squadCeiling(已經在用的「這個地區足球資源多寡」代理)分兩種
   敘事基調——資源薄弱的地區踢出頭本身就是戲劇性(寒門出貴子)，資源
   雄厚的地區(歐洲/南美)換一種「延續血統/沒有辜負傳統」的敘事，同樣是
   驕傲，但份量感來源不同。只在生涯真的有成就(踢進豪門或捧過盃)時才
   觸發，平淡的生涯沒有這種「衣錦還鄉」的重量，硬要講反而突兀。 */
function reachedEliteClub(S) {
  return Object.keys(S.clubTally.TOP5 || {}).some((name) => clubPrestigeOf(name) === 'ELITE');
}

const UNDERDOG_LINES = (region, elite) => [
  elite
    ? `在${region.name}，很少有人相信這條路走得通，你卻一路踢進了豪門——${region.name}第一批征戰過歐洲豪門球隊的名字裡，有你。`
    : `在${region.name}，很少有人相信這條路走得通，你是少數走出來的例外。`,
  `家鄉的足球資源不多，但你用生涯證明了出身不是天花板。`,
  `退休後，你回到${region.name}，蓋了一所足球學校——讓下一個像你一樣的孩子，機會不用靠運氣。`,
];

const ESTABLISHED_LINES = (region) => [
  `${region.name}的足球傳統深厚，你沒有辜負這片土壤養出來的名字。`,
  `踢出這樣的生涯，總算對得起${region.name}的足球血統，不讓家鄉丟臉。`,
];

const MID_LINES = (region) => [`從${region.name}一路走到今天，這段路你走得不算輕鬆，但值得。`];

function regionLegacyClause(S, region, ri) {
  const madeIt = S.everWonClubTitle || reachedEliteClub(S) || S.ownsClub;
  if (!madeIt) return '';

  const lines = region.squadCeiling < 30 ? UNDERDOG_LINES(region, reachedEliteClub(S)) : region.squadCeiling >= 60 ? ESTABLISHED_LINES(region) : MID_LINES(region);
  return lines[ri(0, lines.length - 1)];
}

/* 「走錯路的投資家」：稽核時發現財富線(投資複利)現在完全跟球技脫鉤——
   一個從沒在場上真正站穩過的球員，靠反覆賭投資照樣能變有錢。與其把
   這個組合當漏洞去堵，使用者定案把它寫成一個獨立的生涯原型：球場上
   沒能證明自己，但在數字遊戲裡找到了真正的天賦。判定用
   S.traits.playingStyle(稀有/精英層的球技定位標籤)是不是空的當「球場上
   有沒有真正亮眼過」的代理，不是看踢到哪個層級——TOP5 板凳球員一樣算
   數，因為 BUY_CLUB 本來就要求先站上 TOP5，用「踢過的最高層級」判斷會
   讓「買下球隊的逆襲」這條線變得不可能發生。
   買下球隊是這個原型的終極版本：當不成球星，最後卻成了球隊老闆，這是
   比一般精英稱號更有戲劇性的敘事回馬槍，優先顯示。 */
const WC_ACHIEVEMENT_LABELS = new Set([WC_HONOR.WC_STAR.label, WC_HONOR.ETERNAL_CAPTAIN.label, WC_HONOR.WORLD_CHAMPION.label]);

function investorArchetypeClause(S) {
  // retiredAsCelebrity(全球偶像轉戰演藝圈，見 flow/yearlyChoice.js)是另一條
  // 「場上沒發光，但在別的地方發光」的終局，已經有自己專屬的 championText
  // 收尾句——這裡要排除，不然同一份摘要會出現兩句意思重複的「你雖然球踢
  // 得不怎樣，但...」，一句講人氣一句講存款，讀起來像同一件事講兩次。
  if (S.retiredAsCelebrity) return '';
  // S.traits.playingStyle 只涵蓋俱樂部級的精英/稀有定位標籤，沒吃到國家隊
  // 這條完全獨立的軸線(WC_STAR/永遠的隊長/世界冠軍，見 data/national.js)——
  // 實測抓出來的真實矛盾：一個捧過世界盃冠軍的球員，只要沒剛好也解鎖過
  // 俱樂部級的精英標籤，舊版判定會誤判成「場上算不上出色」，緊接在
  // 「捧著世界盃冠軍獎盃掛靴」那句後面，讀起來自相矛盾。國家隊成就本來
  // 就是「球場上真的亮眼過」最直接的證據，這裡一起排除。
  const noPitchHonors = S.traits.playingStyle.length === 0 && !S.honors.some((h) => WC_ACHIEVEMENT_LABELS.has(h));
  const wealthy = S.savings >= 50000000 || S.honors.includes(WEALTH_HONOR.SHREWD_INVESTOR.label) || S.ownsClub; // 門檻歐元化(見 data/contract.js 開頭的稽核說明)
  if (!noPitchHonors || !wealthy) return '';

  if (S.ownsClub) {
    return `你從沒能在場上證明自己，但現在，你是老闆——這支球隊，現在聽你的。這也是一種逆襲。`;
  }
  return `球場上你算不上出色，但你在數字遊戲裡找到了真正的天賦——退休時的存款，比很多踢得比你好的人都厚。`;
}

/* 訓練線的專屬謝幕：對照 investorArchetypeClause(財富線)/royalLegacyClause
   (戀愛線)，補齊訓練線之前完全沒有的終局敘事(見 data/mastery.js
   TRAINING_HONOR 開頭的稽核說明——機會/社交線都有專屬謝幕，訓練線是
   三條線裡唯一空心的)。門檻掛在 TRAINING_HONOR 的精英層(血肉之驅的
   極限)，代表這不是隨便什麼生涯都觸發的通用句，是真的把天生潛力硬
   練過去的那種罕見成就——跟 investorArchetypeClause 剛好是相反的兩種
   敘事(一個是「場上沒天賦，別的地方找到出路」，這個是「天賦普通，
   硬是靠意志力練出頭」)，兩者判定條件天然互斥(投資家線要求
   noPitchHonors，這條線通常伴隨真的球技投入)，不用額外互斥判斷，但
   優先序上還是明確排在 investorClause 之後、regionClause 之前——地區
   印象(出身)是「你從哪裡來」，這條是「你靠什麼練出來的」，兩個軸線
   不同，不用互搶，這裡只是決定同一份摘要裡哪一句先出現。 */
function trainingArchetypeClause(S) {
  if (!S.honors.includes(TRAINING_HONOR.LIMIT_BREAKER.label)) return '';
  return `天賦從來不是你最出色的地方，但你硬是把自己的身體練成了想要的樣子——這輩子沒有一項本事是白來的。`;
}

/* 平實但溫暖：低分結局之前是同一套模板套小數字，讀起來像隨便結束，
   不是「這也是一種人生」。使用者定案不要挖苦(玩家可能已經很努力，只是
   運氣差)，也不用刻意加碼到跟傳奇同等份量——維持平實，但給一點溫度。 */
const MEDIOCRE_LINES = [
  '沒有留下什麼豐功偉業，但你確實把一整個生涯踢完了——多數人連這個機會都沒有。',
  '不是每個人都能成為傳奇，但你走完了屬於自己的這一趟，這已經夠了。',
  '生涯平淡，沒有太多人記得你的名字，但你自己記得每一場踢過的比賽。',
];
function mediocreLegacyClause(tierLabel, ri) {
  if (tierLabel !== '普通球員' && tierLabel !== '稱職球員') return '';
  return MEDIOCRE_LINES[ri(0, MEDIOCRE_LINES.length - 1)];
}

/* 「主力球星」這一級(25-50分)之前完全沒有額外收尾句：投資家/地區印象兩句
   都要求「真的拿過獎盃/待過豪門/買下球隊」才會觸發，平實但溫暖那句又只
   保留給墊底兩級(<25分)——中間這一大塊「踢了一輩子球、長年先發、但沒有
   捧過決定性獎盃」的生涯(實測稽核：headless抽樣裡這是最大宗的終局分佈)，
   結算時反而是三句都拿不到，只剩最乾的基礎摘要，跟傳奇/巨星拿好幾句、
   墊底也有溫暖收尾比起來，主力球星這級的收尾份量明顯最單薄。這裡補上
   對稱的第三種收尾：不是投資家式的自嘲、也不是墊底的安慰，是老老實實
   肯定「穩定輸出」本身的價值——長年占據先發位置這件事，本身就值得被
   講一句。 */
const SOLID_CAREER_LINES = [
  '沒有捧起任何獎盃，但長年占據先發位置這件事本身，就是對實力最直接的肯定。',
  '生涯沒有太多鎂光燈時刻，但更衣室裡的隊友都知道，球隊少了你會不一樣。',
  '沒有轟轟烈烈的冠軍時刻，但這幾年穩定的輸出，才是職業球員最難得的本事。',
];
function solidCareerClause(tierLabel, ri) {
  if (tierLabel !== '主力球星') return '';
  return SOLID_CAREER_LINES[ri(0, SOLID_CAREER_LINES.length - 1)];
}

/* 隱藏王子路線的專屬收尾：這條線份量很重(見 data/love.js HIDDEN_PARTNER 的
   設計註解)，之前退休時卻跟一般感情狀態共用同一句 familyText，完全沒被
   特別交代過。跟投資家/地區印象那組「三選一」互斥的稱號成就類不同，這是
   完全獨立的私人領域敘事，不搶 extraClause 的位置，是額外附加的一句——
   只有真的觸發過這條隱藏線(royalRomanceExposed/royalRomanceStable，見
   flow/romance.js 的生涯累積旗標)才會出現，多數生涯完全不會提到。
   三種收尾各自對應不同的故事弧線：曝光後仍在一起(最有重量) > 曾曝光(不論
   後續) > 從沒曝光、安穩撐過保密期(安靜的圓滿)。 */
function royalLegacyClause(S) {
  if (!S.royalRomanceExposed && !S.royalRomanceStable) return '';
  const stillTogether = S.love.partner && S.love.partner.hidden && (S.love.st === 'married' || S.love.st === 'dating');
  if (S.royalRomanceExposed && stillTogether) {
    return `多年前，那段戀情被迫攤在陽光下，質疑跟頭條鋪天蓋地而來——如今你們依然在一起，這才是真正的答案。`;
  }
  if (S.royalRomanceExposed) {
    return `那年，一段瞞不住的戀情登上了所有版面。多年後回頭看，你從沒後悔讓它被世界看見。`;
  }
  return `有些故事，你選擇讓它只留在更衣室裡——沒有人知道全部真相，但撐過那幾年提心吊膽的日子，你們都知道，那是真的。`;
}

export function evaluateLegacy(S, ri) {
  const honorsScore = weightedHonorsScore(S);
  // 用 everHadPlaystyle(歷史紀錄，只增不減)不是 S.traits.playstyle(動態，
  // 會隨衰退收回)——終局評價要看「這輩子有沒有達到過巔峰」，不是「退休
  // 當下還在不在狀態」，一個 35 歲衰退掉「疾風」的老將，不該因為這樣
  // 抹去他 20 歲到 34 歲那 15 年的巔峰速度(見 flow/badges.js 的歷史紀錄)。
  const traitsScore = S.everHadPlaystyle.length * 5;
  const capsScore = S.national.caps * 2;
  // 數字跟著 RAT 公式重算校準(見 flow/proSeason.js generateSeasonStats 的
  // 稽核說明)：舊公式巔峰評分常態卡在10分，新公式壓縮到約6.0-9.3的
  // 真實區間，乘數從8調到10，讓這個分數項在新的巔峰評分區間裡還能有
  // 差不多的區辨力，不會因為分子變小就整項失去份量。
  const ratScore = Math.max(0, S.peakRAT - 6) * 10;
  const tierScore = tierReachedBonus(S);
  const score = Math.round(honorsScore + traitsScore + capsScore + ratScore + tierScore);
  // 傳奇度：封頂在100%、顯示到小數第一位(使用者定案「要有差異性，不然
  // 大家都99分」)——用 Math.min 先封頂再四捨五入到小數點後一位，不是
  // 反過來，避免超過理論滿分的極端生涯全部擠在同一個顯示值。
  const legendPercent = Math.round(Math.min(100, (score / LEGACY_CEILING_SCORE) * 100) * 10) / 10;

  const tier = LEGACY_TIER.find((t) => legendPercent >= t.min);

  const region = REGION[S.region];
  const posText = S.pos === 'GK' ? POSN.GK : DPN[S.subPosition] || POSN[S.pos];
  const familyText =
    S.love.st === 'married'
      ? `婚姻美滿${S.love.kids > 0 ? `，育有${S.love.kids}個孩子` : ''}`
      : S.love.st === 'divorced'
        ? '感情路走得坎坷，離過婚'
        : S.love.datedTimes > 0
          ? '感情生活多采多姿'
          : '把一生都獻給了足球';
  const honorsText = S.honors.length ? `生涯拿下「${S.honors.join('」「')}」的稱號` : '沒有留下特別的稱號';
  // national.goals/assists 之前宣告了欄位卻沒被寫入(見 flow/worldCup.js
  // personalTournamentStats 補上的那次修正)，這裡才有東西可以講。
  const wcStatsText = S.national.goals + S.national.assists > 0 ? `，貢獻${S.national.goals}球${S.national.assists}助攻` : '';
  const intlText = S.national.bestTournament
    ? `(最佳戰績打進世界盃${WC_ROUND_LABEL[S.national.bestTournament.round]}${wcStatsText})`
    : '';
  // 存款是實測補上的欄位(見 flow/proSeason.js 的收入累積修正)，終局也該講一句，
  // 不然「離婚會扣錢、踢一輩子球卻不會變有錢」這個漏洞補了引擎卻沒補到敘事。
  // 「一無所有」是專門給 BLOW_IT_ALL(見 data/yearlyOptions.js)這種主動選擇
  // 敗光家產的結局用的級距，跟意外欠債(savings<0)/普通(收支尚可)分開講——
  // 玩家刻意賭上這個結局，終局要講得出來，不能被「收支普通」這種平淡措辭吃掉。
  // 門檻歐元化(見 data/contract.js 開頭的稽核說明)，等比例展開原本的
  // 200/50/10/0 四級，維持同一組相對級距關係。
  const wealthText =
    S.savings >= 30000000
      ? '家財萬貫'
      : S.savings >= 5000000
        ? '衣食無憂'
        : S.savings >= 500000
          ? '收支普通'
          : S.savings >= 0
            ? '一無所有'
            : '欠了一屁股債';

  const totals = careerTotals(S);
  const loyalClub = mostPlayedClub(S);
  const clubCount = clubsPlayedCount(S);
  const statsText = `生涯累積出賽${totals.APP}場、攻進${totals.GLS}球、送出${totals.AST}次助攻`;
  const loyalText = loyalClub ? `，效力最久的是${loyalClub}(生涯共待過${clubCount}支球隊)` : '';
  // wonTitleWithCurrentClub 之前宣告了卻沒人寫入(見 flow/clubCup.js CHAMPION
  // 才會設 true，換東家會歸零)，退休時如果還留著這個紀錄，代表是「捧著獎盃
  // 掛靴」，敘事上值得專門講一句，不是隨手塞進 statsText 裡。三條「終局選擇」
  // 互斥(S.retired 一生只會被設一次，見 flow/proSeason.js/yearlyChoice.js)：
  // 買下球隊(財富線)/世界盃封頂退休(球技線)/轉戰演藝圈(人氣線)，優先序純粹
  // 是敘事份量排序，不是判斷邏輯上的互搶。
  const championText = S.ownsClub
    ? `，以${S.club}老闆的身分掛靴`
    : S.retiredAsChampion
      ? `，捧著世界盃冠軍獎盃，在生涯最高點選擇掛靴`
      : S.retiredAsCelebrity
        ? `，帶著全球偶像的身分，轉身走進另一種鎂光燈`
        : S.wonTitleWithCurrentClub
          ? `，以${S.club}衛冕冠軍的身分掛靴`
          : '';

  // 五選一，優先序：走錯路的投資家(最特殊、最有戲劇性的組合) > 苦練出頭
  // 的訓練線(天賦普通、硬練出頭的罕見成就，見 trainingArchetypeClause) >
  // 地區印象(有成就時才有的「衣錦還鄉」重量) > 主力球星的穩定輸出(中段
  // 分數的補位，見 solidCareerClause 註解) > 平實但溫暖(低分結局的收尾)
  // ——五個互斥，同一個結局最多加一句，不會疊在一起變得囉唆。
  const investorClause = investorArchetypeClause(S);
  const trainingClause = investorClause ? '' : trainingArchetypeClause(S);
  const regionClause = investorClause || trainingClause ? '' : regionLegacyClause(S, region, ri);
  const solidClause = investorClause || trainingClause || regionClause ? '' : solidCareerClause(tier.label, ri);
  const mediocreClause = investorClause || trainingClause || regionClause || solidClause ? '' : mediocreLegacyClause(tier.label, ri);
  const extraClause = investorClause || trainingClause || regionClause || solidClause || mediocreClause;
  // 隱藏王子路線的收尾是獨立領域(私人感情)，不跟上面那組互斥三選一搶位置，
  // 兩句可以同時出現在同一份終局摘要裡。
  const royalClause = royalLegacyClause(S);

  const summary =
    `一名出身${region.name}的${posText}，${honorsText}，代表國家隊出賽${S.national.caps}次${intlText}。` +
    `${statsText}${loyalText}${championText}。場外，${familyText}，退休時${wealthText}。${S.age}歲那年，你掛靴了。` +
    `${royalClause ? ` ${royalClause}` : ''}` +
    `${extraClause ? ` ${extraClause}` : ''}`;

  // 成就展示：全部稱號/徽章攤開來看，拿到的亮著、沒拿到的依難度層級決定
  // 藏多少(見 flow/achievements.js)——不做跨輪次累積，每次都是全新種子，
  // 這份清單只反映「這一輪」拿到了什麼，目的是給玩家「還有什麼可以追」
  // 的提示，變成重玩的誘因。
  const achievements = buildAchievementGallery(S);

  return {
    score,
    legendPercent,
    tier: tier.label,
    tierDesc: tier.desc,
    summary,
    achievements,
    // 終局可比較數據(使用者定案)：生涯薪資總額(毛額，見 flow/proSeason.js
    // 的稽核說明)/存款(淨資產)/生涯累積進球助攻出賽，都攤平在這裡給
    // 呼叫端(EndingScreen.jsx)直接讀，不用重算一次。
    careerWageTotal: S.careerWageTotal || 0,
    savings: S.savings,
    careerTotals: totals,
    // 可分享終局卡片(web/src/components/EndingCard.jsx)要用：clubCount/
    // loyalClub 上面已經算過(見 statsText/loyalText)，直接一併回傳，
    // 不用呼叫端重算一次；clubJourney 直接讀 S 上的原始生涯轉會軌跡
    // (見 core/state.js 的稽核說明)，這裡只是為了同一個回傳物件裡拿得到，
    // 不重新複製一份資料形狀。
    clubCount,
    loyalClub,
    clubJourney: S.clubJourney,
  };
}
