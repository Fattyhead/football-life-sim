/* ---------- 生涯終局的成就展示 ---------- */
/* 使用者定案：不做跨輪次累積(每次都是全新的種子)，但終局清算時把全部
   稱號/徽章攤開來看(這輪加了 TRAINING_HONOR 三階之後共40個，數字會隨
   新內容增加，不用刻意維護一個寫死的總數)——拿到的亮著，沒拿到的按照
   難度層級決定要「藏多少」，直接給玩家「還有什麼可以追」的提示，變成
   重玩的誘因，不用另外做存檔/成就系統這種重量級的持久化機制。

   揭露規則跟稀有度分層直接對應(層級越高、藏得越深)：
     普通(COMMON/OFFPITCH_COMMON) — 完整顯示名稱，只是標成「未解鎖」，
       這層本來就是常態徽章，門檻/效果攤開來看沒關係，讓玩家知道遊戲裡
       有這些東西存在。
     稀有(RARE/OFFPITCH_RARE) — 藏名稱，顯示觸發條件，讓玩家自己猜「這個
       條件會換來什麼稱號」，帶一點解謎感。
     精英(ELITE/OFFPITCH_ELITE) — 連條件都不給，只顯示屬於哪一條生涯線
       (球技/國際/戀愛/財富/人氣)，保留最大懸念——這層本來就是要玩家自己
       去生涯裡摸索出來的隱藏內容。

   徽章(PLAYSTYLE)看「現在還有沒有」(S.traits.playstyle，動態的)，不是
   「這輩子有沒有擁有過」——呼應徽章跟稱號的根本差異：徽章反映當下狀態，
   稱號(其餘全部)反映已經發生過的事，看 S.honors 就好，不會因為後續
   狀態變化而消失。 */

import { PLAYSTYLE, PLAYING_STYLE } from '../data/traits.js';
import { WC_HONOR } from '../data/national.js';
import { RIVAL_HONOR } from '../data/nationalRival.js';
import { LOVE_HONOR, FAMILY_FIRST, REDEEMED } from '../data/love.js';
import { WEALTH_HONOR } from '../data/wealth.js';
import { FAME_HONOR } from '../data/fame.js';
import { GENIUS, LATE_BLOOM_GENIUS, TRAINING_MASTERY, OPPORTUNITY_MASTERY, SOCIAL_MASTERY, TRAINING_HONOR } from '../data/mastery.js';
import { RISK_TIER_TITLE } from '../data/growth.js';
import { RIVALRY_TIER_TITLE, BOND_MOMENT_HONOR } from '../data/trainingPartner.js';
import { AGENT_CROSSROADS_TITLE, AGENT_BOND_HONOR } from '../data/agent.js';

const DOMAIN_LABEL = {
  PLAYSTYLE: '球技',
  PLAYING_STYLE: '球技',
  WC_HONOR: '國際賽場',
  LOVE: '戀愛',
  WEALTH: '財富',
  FAME: '人氣',
  MASTERY: '性格', // 天才/埋沒的天才 + 三類別委身，看的是「這輩子怎麼選」的習慣，不是特定生涯線
  RISK_TIER: '性格', // 訓練/機會選項風險層(穩健/冒進)累積傾向，跟 MASTERY 同一條「習慣」線，不分開算
  TRAINING_HONOR: '特訓', // 練出超過潛力的等級數里程碑，看「練出了什麼成果」，跟 PLAYSTYLE(看「現在多強」)是不同的尺，故意分開一個獨立生涯線
};

function badgeEntries(obtainedBadgeKeys) {
  return Object.entries(PLAYSTYLE).map(([key, def]) => ({
    key,
    label: def.label,
    tier: def.tier,
    cond: def.cond,
    domain: DOMAIN_LABEL.PLAYSTYLE,
    obtained: obtainedBadgeKeys.includes(key),
  }));
}

function titleTable(table, domain, honors) {
  return Object.entries(table).map(([key, def]) => ({
    key,
    label: def.label,
    tier: def.tier,
    cond: def.cond,
    domain,
    obtained: honors.includes(def.label),
  }));
}

/* 稽核修正(可分享存讀檔/成就典藏功能新增)：這個函式本體以前直接綁定
   單一個 S(單局生涯)，只看「這局拿到了什麼」。成就典藏頁(web/src/
   screens/CollectionScreen.jsx)要看的是「玩家這輩子玩過的所有局，
   累積解鎖過什麼」，資料形狀一樣(同一份總表)，差別只在「拿到」的判斷
   來源——前者讀 S.traits.playstyle(徽章看當下)/S.honors(稱號看歷史，
   單局內)，後者讀跨局累積的持久化集合(見 web/src/collectionStore.js)。
   拆成 buildGallery(純函式，吃兩個陣列)+ 兩個各自組好參數的入口，兩邊
   共用同一份總表定義，不用維護兩份容易兜不起來的清單。 */
function buildGallery(obtainedBadgeKeys, obtainedHonorLabels) {
  const honors = obtainedHonorLabels;
  const all = [
    ...badgeEntries(obtainedBadgeKeys),
    ...titleTable(PLAYING_STYLE, DOMAIN_LABEL.PLAYING_STYLE, honors),
    ...titleTable(WC_HONOR, DOMAIN_LABEL.WC_HONOR, honors),
    ...titleTable(RIVAL_HONOR, DOMAIN_LABEL.WC_HONOR, honors),
    ...titleTable(
      {
        PLAYBOY_STAR: LOVE_HONOR.PLAYBOY_STAR,
        ROYAL_SCANDAL: LOVE_HONOR.ROYAL_SCANDAL,
        QUIETLY_ROYAL: LOVE_HONOR.QUIETLY_ROYAL,
        FAMILY_FIRST,
        REDEEMED,
      },
      DOMAIN_LABEL.LOVE,
      honors,
    ),
    ...titleTable(WEALTH_HONOR, DOMAIN_LABEL.WEALTH, honors),
    ...titleTable(FAME_HONOR, DOMAIN_LABEL.FAME, honors),
    ...titleTable(
      { GENIUS, LATE_BLOOM_GENIUS, TRAINING_TIER1: TRAINING_MASTERY.TIER1, TRAINING_TIER2: TRAINING_MASTERY.TIER2, OPPORTUNITY_TIER1: OPPORTUNITY_MASTERY.TIER1, OPPORTUNITY_TIER2: OPPORTUNITY_MASTERY.TIER2, SOCIAL_TIER1: SOCIAL_MASTERY.TIER1, SOCIAL_TIER2: SOCIAL_MASTERY.TIER2 },
      DOMAIN_LABEL.MASTERY,
      honors,
    ),
    ...titleTable(
      { SAFE_TIER1: RISK_TIER_TITLE.SAFE.TIER1, SAFE_TIER2: RISK_TIER_TITLE.SAFE.TIER2, AGGRESSIVE_TIER1: RISK_TIER_TITLE.AGGRESSIVE.TIER1, AGGRESSIVE_TIER2: RISK_TIER_TITLE.AGGRESSIVE.TIER2 },
      DOMAIN_LABEL.RISK_TIER,
      honors,
    ),
    ...titleTable(TRAINING_HONOR, DOMAIN_LABEL.TRAINING_HONOR, honors),
    ...titleTable(
      {
        COMPETE_TIER1: RIVALRY_TIER_TITLE.COMPETE.TIER1,
        COMPETE_TIER2: RIVALRY_TIER_TITLE.COMPETE.TIER2,
        COOPERATE_TIER1: RIVALRY_TIER_TITLE.COOPERATE.TIER1,
        COOPERATE_TIER2: RIVALRY_TIER_TITLE.COOPERATE.TIER2,
      },
      DOMAIN_LABEL.TRAINING_HONOR,
      honors,
    ),
    ...titleTable(
      { BOND_MOMENT_RIVAL: BOND_MOMENT_HONOR.RIVAL, BOND_MOMENT_COMRADE: BOND_MOMENT_HONOR.COMRADE },
      DOMAIN_LABEL.TRAINING_HONOR,
      honors,
    ),
    // 經紀人線稱號(見 data/agent.js)——掛在 DOMAIN_LABEL.WEALTH，跟
    // BUY_CLUB/INVEST_* 同一個 domain，兩者本來就是同一個機制分類
    // (OPPORTUNITY_OPTION)底下不同的敘事包裝，見這輪的稽核比對記錄。
    ...titleTable(
      {
        AGENT_BOLD_TIER1: AGENT_CROSSROADS_TITLE.BOLD.TIER1,
        AGENT_BOLD_TIER2: AGENT_CROSSROADS_TITLE.BOLD.TIER2,
        AGENT_STEADY_TIER1: AGENT_CROSSROADS_TITLE.STEADY.TIER1,
        AGENT_STEADY_TIER2: AGENT_CROSSROADS_TITLE.STEADY.TIER2,
        AGENT_BOND_AMBITIOUS: AGENT_BOND_HONOR.AMBITIOUS,
        AGENT_BOND_STEADY: AGENT_BOND_HONOR.STEADY,
      },
      DOMAIN_LABEL.WEALTH,
      honors,
    ),
  ];

  return all.map((item) => {
    if (item.obtained) {
      return { ...item, reveal: 'obtained', display: item.label };
    }
    if (item.tier === 'COMMON' || item.tier === 'OFFPITCH_COMMON') {
      return { ...item, reveal: 'dim', display: item.label };
    }
    if (item.tier === 'RARE' || item.tier === 'OFFPITCH_RARE') {
      return { ...item, reveal: 'hint', display: `？？？（${item.cond}）` };
    }
    return { ...item, reveal: 'locked', display: `未知的精英稱號（${item.domain}線）` };
  });
}

/* 入口一：flow/legacy.js evaluateLegacy() 呼叫一次，回傳這一局的揭露結果
   (數字會隨新內容增加，不用刻意維護一個寫死的總數)——徽章看當下狀態
   (S.traits.playstyle)、稱號看這局累積(S.honors)，跟改版前行為完全一樣，
   只是內部委派給 buildGallery()。 */
export function buildAchievementGallery(S) {
  return buildGallery(S.traits.playstyle, S.honors);
}

/* 入口二：成就典藏頁用——吃跨局持久化累積的「歷史上拿過的徽章 key／
   稱號 label」兩個陣列(見 web/src/collectionStore.js)，不吃單一個 S，
   因為典藏頁本來就沒有對應到任何一局正在進行的生涯。徽章這裡故意用
   「歷史上有沒有拿過」而不是「現在還有沒有」，跟 flow/legacy.js
   S.everHadPlaystyle 的既有語意一致(終局評分也是看這個，不是看
   S.traits.playstyle)——典藏頁沒有理由用一套更嚴格的標準。 */
export function buildLifetimeGallery(obtainedBadgeKeys, obtainedHonorLabels) {
  return buildGallery(obtainedBadgeKeys, obtainedHonorLabels);
}

/* label→tier 反查表，只涵蓋會進 S.honors 的「稱號」(不含徽章，徽章不會
   被推進 honors)——flow/legacy.js 的終局計分要依稀有度給不同權重，不能
   直接用 S.honors.length 打統一分數，不然「普通/稀有/精英」這套分層在
   真正決定生涯評價的分數裡就白做了。跟 buildAchievementGallery 共用
   同一批稱號表，不用另外維護一份。 */
const TITLE_TIER_BY_LABEL = new Map(
  [
    ...Object.values(PLAYING_STYLE),
    ...Object.values(WC_HONOR),
    ...Object.values(RIVAL_HONOR),
    LOVE_HONOR.PLAYBOY_STAR,
    LOVE_HONOR.ROYAL_SCANDAL,
    LOVE_HONOR.QUIETLY_ROYAL,
    FAMILY_FIRST,
    REDEEMED,
    ...Object.values(WEALTH_HONOR),
    ...Object.values(FAME_HONOR),
    GENIUS,
    LATE_BLOOM_GENIUS,
    ...Object.values(TRAINING_MASTERY),
    ...Object.values(OPPORTUNITY_MASTERY),
    ...Object.values(SOCIAL_MASTERY),
    ...Object.values(RISK_TIER_TITLE.SAFE),
    ...Object.values(RISK_TIER_TITLE.AGGRESSIVE),
    ...Object.values(TRAINING_HONOR),
    ...Object.values(RIVALRY_TIER_TITLE.COMPETE),
    ...Object.values(RIVALRY_TIER_TITLE.COOPERATE),
    ...Object.values(BOND_MOMENT_HONOR),
    ...Object.values(AGENT_CROSSROADS_TITLE.BOLD),
    ...Object.values(AGENT_CROSSROADS_TITLE.STEADY),
    ...Object.values(AGENT_BOND_HONOR),
  ].map((def) => [def.label, def.tier]),
);

export function tierOfHonor(label) {
  return TITLE_TIER_BY_LABEL.get(label) || null;
}
