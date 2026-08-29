/* ---------- 生涯狀態形狀 ---------- */
/* 對照原版棒球 core/state.js 的 newState()——這是把 data/ 目錄下九張表串起來
   的接著劑：一個生涯存檔實際長什麼樣子。直接參照原版實際欄位設計，能對應的
   位置全部沿用同樣思路，拿掉棒球專屬的部分(湯米約翰欄位、保留年限/服務年資
   的自由市場邏輯、打者/投手分軌統計)，換成足球專屬(轉會合約、租借、
   國家隊caps、細分守位年資累計)。

   newState() 依賴外部傳入的 ri(min,max) 亂數函式(對照原版 core/rng.js 的
   R()/ri())——這裡還沒有自己的 rng 引擎，先用介面寫，rng 補上就能直接跑，
   不影響這份形狀設計。

   戀愛系統對照原版 love 物件加回來了，交往對象類型(見 data/love.js PARTNER_TYPE)
   會疊加影響 yearOutsideIncome 跟 seasonForm，不是純裝飾。 */

import { POS_AB } from '../data/abilities.js';
import { POT_TIER } from '../data/potential.js';
import { LV } from '../data/regions.js';
import { LOVE_STATUS } from '../data/love.js';
import { SQUAD_CHEMISTRY } from '../data/career.js';

export function newState(name, jersey, pos, regionCode, ri) {
  const abKeys = POS_AB[pos];
  const ab = {};
  abKeys.forEach((k) => (ab[k] = ri(20, 32)));
  // 兩項「出道時最容易被球探注意到」的工具給一點起手加成，
  // 對照原版打者 con/pow、投手 vel/brk 的加成邏輯。
  if (pos === 'GK') {
    ab.DIV += ri(0, 6);
    ab.REF += ri(0, 4);
  } else {
    ab.PAC += ri(0, 6);
    ab.DRI += ri(0, 4);
  }

  // 潛力洗牌：對照原版 OOTP 式天花板分配
  const tiers = pos === 'GK' ? POT_TIER.GK : POT_TIER.OUTFIELD;
  const shuffled = [...abKeys];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(ri(0, i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const pot = {};
  shuffled.forEach((k, i) => {
    const t = tiers[Math.min(i, tiers.length - 1)];
    pot[k] = ri(t.min, t.max);
  });

  return {
    // ---------- 身份 ----------
    name,
    jersey,
    pos, // GK / DF / MF / FW
    region: regionCode, // 出身地區代碼，見 data/regions.js REGION
    age: 15,
    year: new Date().getFullYear(),
    stage: 'YOUTH', // YOUTH（青訓期）→ PRO（職業生涯）
    stageYr: 1, // 青訓期第幾年(1-3)

    // ---------- 能力與潛力 ----------
    ab, // 目前能力值
    pot, // 潛力天花板(每項能力)
    // 「主攻優勢項目」(TRAINING:FOCUSED，見 data/yearlyOptions.js / data/youthOptions.js)
    // 鎖定的目標能力——實測稽核抓出來的斷點：沒有這個欄位時，每次都重算
    // 「離潛力天花板最遠的一項」，導致連續選很多次也在練不同能力，力量被打散，
    // 沒有一項真的衝得上 PLAYSTYLE 徽章的門檻。有這個欄位後，選定目標就會
    // 一路練到練滿(達到潛力上限)才換下一個目標，青訓期選定的目標會延續到
    // 職業生涯，不會出道就重置。
    focusTarget: null,
    // 連續投入同一個 focusTarget 的季數，只有職業生涯的 FOCUSED 訓練會累加
    // (見 flow/yearlyChoice.js)，目標不變就+1，換了新目標就歸1重新算——
    // 給 flow/narrate.js 判斷「這是剛立志還是已經磨了好幾年」用，讓敘事
    // 讀起來前後連貫，不是每次都當成全新開始講。
    focusTargetStreak: 0,
    focusStreakKey: null,
    // 骰子成長系統(見 data/growth.js/flow/shared.js addAbilityPoints)：
    // 每項能力累積但還沒湊滿一級的小數進度，稀疏物件，只在真的有進度時
    // 才寫入對應鍵。
    abProgress: {},
    potSum0: Object.values(pot).reduce((a, b) => a + b, 0), // 初始潛力總和，球探報告用

    // ---------- 細分守位 ----------
    subPosition: null, // 目前主要細分守位(DPN)，對照原版 dpos
    subPositionYears: {}, // 各細分守位出賽年資累計，對照原版 dposYears——
    // 兼容幾個位置不用另訂規則，DP_TH 天然會篩掉守不住的位置

    // ---------- 生涯路徑與所屬 ----------
    path: null, // PATHS 選擇：LOCAL_ACADEMY / FEEDER_INVITE / TOP5_INVITE
    tier: null, // 目前所在聯賽層級：LOCAL / FEEDER / TOP5
    debutYear: null, // 轉正式那年，flow/context.js 用「進聯盟後第幾年」判斷生涯階段(比單純看年齡準——
    // LOCAL_ACADEMY 路線可能晚一點才轉正式，年紀不小但敘事上仍算「早期」)
    club: null,
    lastClub: null,
    // 隊伍核心力(見 data/career.js SQUAD_CHEMISTRY)：跟「現在這支球隊」綁定，
    // 換東家會被 flow/transfer.js/loan.js 的 S.club 變動處重置回基準值，
    // 疊加小幅訓練成長加成(見 flow/shared.js squadChemistryMult)。
    squadChemistry: SQUAD_CHEMISTRY.base,
    clubTally: { LOCAL: {}, FEEDER: {}, TOP5: {} }, // 各層級待過的俱樂部次數
    // 生涯轉會軌跡(依時間順序)：clubTally 只有「待過幾次」的次數，沒有
    // 「先後順序」——可分享終局卡片(web/src/components/EndingCard.jsx)
    // 要畫一條真正的生涯時間軸，需要按順序的球隊清單，不是次數統計。
    // 每次 S.club 真的換人(出道/晉級/豪門挖角/降級/合約危機降級/租借
    // 轉正式，見 flow/careerStart.js、flow/transfer.js、flow/loan.js 這
    // 六個既有的 S.club= 賦值點)就 push 一筆 { tier, club }，不記錄租借
    // 期間本身(S.loanClub 是暫時的，租借留隊轉正式才會真的算一筆)。
    clubJourney: [],
    // 訓練夥伴/對手(見 data/trainingPartner.js/flow/trainingRivalry.js)：
    // 跟「現在這支球隊」綁定，換東家會被 flow/transfer.js/loan.js 的
    // S.squadChemistry 重置點一併清空(舊夥伴收尾，不會跟著搬家)，要等
    // 玩家在新東家底下真的選了訓練類別才會指派新的——不是自動重新指派。
    trainingPartner: null, // { type: 'RIVAL'|'COMRADE', name, title, years }

    // 經紀人(見 data/agent.js/flow/agentLine.js)：跟球員本人綁定，不跟
    // 球隊綁定(不像訓練夥伴會因換東家清空)——經紀人不會因為你轉會就
    // 消失，這是跟訓練夥伴線刻意不同的地方。PRO-only，青訓期不會有這個
    // 欄位被寫入。
    agent: null, // { type: 'AMBITIOUS'|'STEADY', name, title, years, bondFired }
    agentPickCount: { bold: 0, steady: 0 },

    // ---------- 合約 ----------
    contract: { wage: 0, yearsLeft: 0, releaseClause: null },
    onLoan: false,
    loanClub: null,
    loanTier: null, // 租借期間的目的地層級，租借結束(續留/回原隊)後清空

    // ---------- 傷病 ----------
    injury: { tier: null, weeksRemaining: 0, rehabPlan: null }, // tier 對照 injury.js INJURY_TIER_ORDER
    permanentResidual: 0, // 大傷康復後的永久殘留debuff，COMEBACK_KING 特質可清零
    bigInjCount: 0, // 對照原版 bigInj
    injuryFreeStreak: 0, // 連續無傷病季數，對照原版 ironStreak
    poorFormStreak: 0, // 連續低迷季數(RAT<6.0)，flow/transfer.js checkDemotion() 讀這個判斷降級風險
    promotionFormStreak: 0, // 連續達到晉級門檻(RAT高標)的季數，flow/transfer.js updatePromotionFormStreak() 更新，晉級/豪門挖角要連續穩定表現才有機會被骰到，不是單季走運

    // ---------- 特質 ----------
    traits: { playstyle: [], playingStyle: [] },
    // 徽章的歷史紀錄：只增不減，跟 S.traits.playstyle(動態，會隨衰退收回)
    // 分開算——終局評價要看「這輩子有沒有達到過巔峰」，不是「退休當下
    // 還在不在狀態」，見 flow/legacy.js。
    everHadPlaystyle: [], // 分別對應 traits.js 的 PLAYSTYLE / PLAYING_STYLE key 陣列
    removedTraits: [], // 因轉位置等原因失去資格而被移除的特質，對照原版 removed
    milestoneStreak: {}, // 追蹤 PLAYING_STYLE 里程碑的連續季數進度，例如 { FOX_IN_THE_BOX: 2 }

    // ---------- 國家隊 ----------
    national: {
      caps: 0,
      goals: 0,
      assists: 0,
      tournamentsPlayed: [], // 對照 national.js 的 MAJOR_TOURNAMENT key
      bestTournament: null,
    },
    // 國家隊隱藏對手線(見 data/nationalRival.js/flow/nationalRival.js)：跟
    // 訓練夥伴/戀愛線同一種「起點卡真實投入」的設計，只有真的入選國家隊
    // (S.national.caps 從0變1)才會指派——沒入選過國家隊，這條線就不存在。
    // 不做隊長機制(使用者定案)，張力用「跟對手的戰績比較」當敘事骨架，
    // aheadCount/behindCount 是每屆世界盃的比較結果累積，供奪冠時的收尾
    // 段落判斷整個對抗史是「你多半領先」還是「你多半在追趕」。
    nationalRival: null, // { name, aheadCount, behindCount }
    // CROSSROADS(個人表現/團隊優先)的暫存選擇——季初常駐階段決定(見
    // flow/nationalRival.js resolveRivalCrossroads)，flow/worldCup.js
    // checkWorldCupWindow 這季稍後真正判定世界盃結果時讀取+清空，跟
    // S.debutInjuryMult 同一種「這季設定、下一步驟讀完就清空」用法。
    wcRivalChoice: null,

    // ---------- 訓練夥伴/對手(見 data/trainingPartner.js/flow/trainingRivalry.js) ----------
    // CROSSROADS(較勁/合作)累積選了幾次，比照 riskTierPickCount 的寫法——
    // RIVALRY_TIER_TITLE 的門檻判定用這個算。
    rivalryPickCount: { compete: 0, cooperate: 0 },
    competeGrowthFlatBonus: 0, // 較勁成癮(RIVALRY_TIER_TITLE.COMPETE.TIER2)疊加的固定成長點數加成
    cooperateChemistryFlatBonus: 0, // 更衣室的黏著劑(RIVALRY_TIER_TITLE.COOPERATE.TIER2)疊加的固定隊伍核心力加成
    // 羈絆時刻(見 data/trainingPartner.js BOND_MOMENT_HONOR/
    // flow/trainingRivalry.js checkTrainingBondMoment)疊加的永久機率
    // 加成——不像 S.wcReadinessBoost 打完就歸零，這兩個是生涯累積值，
    // 不隨換球隊重置(這是玩家個人歷練出來的能力，不是跟著球隊走的
    // 資源，跟 S.trainingPartner 換東家清空是不同性質)。
    trainingBondCupBoost: 0, // 疊加進 flow/proSeason.js 呼叫 checkClubCup 的 buzzBoost
    trainingBondWCBoost: 0, // 疊加進 flow/worldCup.js runTournament 的 readinessBoost

    // ---------- 球季數據 ----------
    stats: { LOCAL: null, FEEDER: null, TOP5: null }, // 各層級累積數據，見 blankSeasonStat()

    // ---------- 世界盃(見 national.js/flow/worldCup.js) ----------
    youthWCSelected: false, // 青訓期入選青年世界盃，resolveDebut() 讀這個旗標打折淘汰率
    // 世界盃備戰籌碼：來源是機會/社交選項的 WC_AUDITION/SQUAD_BONDING/WC_TAPER
    // (見 yearlyOptions.js)，checkWorldCupWindow() 判定入選/晉級時消耗掉，用過即歸零。
    wcReadinessBoost: 0,
    // 轉會買氣：「球探/俱樂部怎麼看你」，來源包含世界盃戰績跟機會選項(SCOUT_MEETING/
    // STUDY_ABROAD)，暫存加在下一次晉級/租借判定機率上，用過會衰減。
    // 跟下面的 popularity(「大眾怎麼看你」)是兩條不同的曝光管道，不要合併。
    transferBuzz: 0,
    wagePremiumBonus: 0, // ETERNAL_CAPTAIN 等稱號疊加的薪資溢價，跟 POS_MARKET 一起算進 signContract
    releaseRiskDiscount: 0, // EXEC_NETWORKING(結識球隊高層)累積，疊減 flow/transfer.js 的合約危機風險
    retireCapBonus: 0, // ETERNAL_CAPTAIN 等稱號疊加的引退年齡延後
    declineStartBonus: 0, // PLAYING_STYLE(如 ANCHOR_MAN) 疊加的起衰年齡延後
    injuryChanceMult: 1, // 季度「會不會受新傷」的基礎機率乘數(rollInjury 用)
    // ROCK_AT_THE_BACK 疊乘的是這個，不是上面那個——「帶傷上陣會不會惡化」
    // 是 tickExistingInjury() 判定的，跟「這季會不會受新傷」是不同的判定點，
    // 混在一起算會接錯線(實測稽核抓出來的斷點，見 flow/playingStyle.js)。
    injuryEscalateMult: 1,
    peakRAT: 0, // 生涯至今最佳球季 RAT，COMEBACK_KING 判定要用
    preInjuryPeakRAT: null, // 最近一次大傷發生當下的 peakRAT 快照，用來判定「康復後超越傷前巔峰」
    affairDiscoverChanceMult: 1, // PLAYBOY_STAR 稱號疊乘的出軌曝光機率，越花越容易被盯上(見 flow/romance.js)

    // ---------- 青訓期(見 data/youthOptions.js / flow/youthChoice.js) ----------
    youthCutRateMult: 1, // 機會選項疊乘的轉正式淘汰率折扣，跟 YOUTH_WC_CUT_RATE_MULT 疊加
    debutInjuryMult: 1, // 社交選項(FAMILY_SUPPORT)疊乘的出道後第一次受傷機率折扣，用過即歸1

    // ---------- 財務 ----------
    wage: 0,
    popularity: 0, // 大眾人氣值，來源是社交選項(見 yearlyOptions.js)+戀愛對象知名度，決定 outsideIncome
    outsideIncome: 0, // 代言/贊助等場外收入
    careerWageTotal: 0, // 生涯球場薪水毛額累積，終局可比較數據之一，見 flow/proSeason.js——跟 S.savings(淨資產)是不同概念，不要混用
    yearOutsideIncome: 0,
    savings: 0,

    // ---------- 戀愛 ----------
    love: {
      st: LOVE_STATUS.SINGLE,
      partner: null, // { type: PARTNER_TYPE key, name }
      kids: 0,
      caught: 0, // 被抓包次數
      affairs: 0, // 出軌次數
      exes: [], // 前任列表
      dyrs: 0, // 目前關係交往年數
      datedTimes: 0, // 累計交往過的對象數
      waitStreak: 0, // 求婚機會出現但選了「再等等」的連續次數，拖越久下季分手機率越高(見 flow/romance.js)
    },
    loveForceRoyalNext: false, // SECRET_ENCOUNTER(見 data/yearlyOptions.js)選了之後，下一段開始的戀情強制對象是隱藏王子路線，見 flow/romance.js pickPartner()
    // 戀愛選擇(社交選項 DEEPEN_RELATIONSHIP/DATE_NIGHT，見
    // data/yearlyOptions.js)疊加的暫存加成，都是「這季設定、下一次戀愛
    // 判定讀完就歸零」的用法，跟 S.debutInjuryMult 同一種寫法(見
    // flow/romance.js evaluateLoveChoiceMoment)。認識新對象(MEET_NEW_PEOPLE
    // 的 loveDatingChanceGain)改成當季直接生效，不再走暫存加成，見
    // flow/romance.js startDatingFromSocial。
    loveProposeChanceBonus: 0,
    loveWaitStreakReliefBonus: 0,
    loveAffairOpportunityBoost: 0,
    loveAffairResistanceBonus: 0,

    // ---------- 生涯紀錄 ----------
    honors: [], // 獎盃/個人獎項紀錄
    // 累積戰績計數——跟 honors(拿過一次就封存，不重複)是平行的另一套追蹤，
    // 專門給「球王」這種現實裡梅西/C羅式的「累積幾座」比較用(見
    // flow/eliteHonors.js checkGoatHonor 的稽核說明)。金球獎/世界盃冠軍
    // 本身還是維持一次性稱號(第一次才有完整敘事+效果)，但底層條件每次
    // 符合都會讓這裡的計數 +1，不受稱號是否已經拿過影響。
    trophyCount: { ballonDor: 0, goldenBoot: 0, clubTitles: 0, wcTitles: 0 },
    transferRefusalUsed: 0, // 拒絕轉會次數
    wonTitleWithCurrentClub: false, // 「跟現在這支球隊」綁定，換東家會歸零，見 flow/transfer.js/loan.js
    everWonClubTitle: false, // 生涯累積版，捧過一次盃就永久 true，不會因換東家歸零——GRANDMASTER/CLUB_LEGEND 稱號要用
    retiredAsChampion: false, // 捧起世界盃冠軍後選擇封頂退休，見 flow/proSeason.js
    retiredAsCelebrity: false, // 全球偶像後選擇轉戰演藝圈退休，見 data/yearlyOptions.js PIVOT_TO_CELEBRITY
    retiredAsBoss: false, // 梅老闆(場外收入超車薪水)後選擇退休，見 flow/wealthPeak.js
    royalRomanceExposed: false, // 隱藏王子路線曾經曝光過，見 flow/romance.js
    royalRomanceStable: false, // 隱藏王子路線曾撐過保密期、關係穩定過，見 flow/romance.js

    // ---------- 資產(見 data/wealth.js / flow/yearlyChoice.js) ----------
    investWins: 0, // 生涯投資淨賺次數，SHREWD_INVESTOR 稱號門檻
    investStreak: 0, // 積極操盤(INVEST_AGGRESSIVE)連續同方向(賺/賠)次數，正數=連賺、負數=連賠，隱晦線索用(見 flow/streakFlavor.js)
    ownsClub: false, // 買下球隊(BUY_CLUB)後的永久旗標，見 flow/transfer.js 的降級/豪門挖角守衛
    clubShares: false, // 入股球隊(BUY_CLUB_SHARES_FAME/AGENT)後的永久旗標，買斷球隊(BUY_CLUB)會打折，見 flow/yearlyChoice.js
    everBlewItAll: false, // 曾經一擲千金歸零過，RAGS_TO_RICHES 稱號要用
    outsideIncomeMultBonus: 0, // 場外人氣稱號(見 data/fame.js)疊加的場外收入係數加成
    stableMarriageStreak: 0, // 連續已婚+零緋聞零出軌的季數，FAMILY_FIRST/REDEEMED 稱號共用同一個計數
    familyStabilityBonus: 0, // FAMILY_FIRST 解鎖後疊加在 seasonForm 上的永久加成

    // ---------- 天賦與委身特質(見 data/mastery.js) ----------
    categoryPickCount: { TRAINING: 0, OPPORTUNITY: 0, SOCIAL: 0 }, // 職業生涯累積選了哪個類別幾次(青訓不算)，三類別委身特質的門檻
    youthSixes: 0, // 青訓三年訓練骰子累積擲出幾次「6」，天才特質判定用
    lateBloomSixes: 0, // 19-22歲訓練骰子累積擲出幾次「6」，埋沒的天才判定用
    diceFloorBonus: 0, // 天才(4)/埋頭苦練的性格(4，稽核順手訂正：原本這裡誤寫成5)疊加後 Math.max 出來的骰子保底，0代表沒有特殊保底
    // 訓練/機會選項底下風險層(穩健/平衡/冒進)累積選了幾次，比照
    // categoryPickCount 的寫法——稱號判定(小心翼翼/走在鋼索上的男人等)/
    // 隱晦線索(見 flow/streakFlavor.js)的門檻用這個算，見 data/growth.js
    // RISK_TIERS。
    riskTierPickCount: { SAFE: 0, BALANCED: 0, AGGRESSIVE: 0 },
    transferBuzzFlatBonus: 0, // 廣結善緣的性格(OPPORTUNITY_MASTERY.TIER1)疊加的每季固定轉會買氣加成(transferBuzz本身會衰退，一次性加成意義不大，這個要每季持續生效)
    growthSpeedMult: 1, // 機會/社交深度委身的代價：疊乘在 addAbilityPoints() 點數上的成長速度係數
    overPotentialDiscountMult: 1, // 特訓成癮(TRAINING_MASTERY.TIER2)解鎖的好處：疊乘在超過潛力後的加倍成本上，見 flow/shared.js costPerLevel()
    overPotentialLevelsGained: 0, // 這輩子累積練出過幾級超過自己潛力的能力，TRAINING_HONOR(見 data/mastery.js)的門檻資源
    // 當季狀態修正，直接加在 RAT 上的點數(不是原版 seasonFactor 那種乘數)，
    // 每季由 flow/romance.js 依戀愛/婚姻/小孩狀態重新算過，不用手動遞減。
    seasonForm: 0,

    // ---------- 系統 ----------
    retired: false, // 對照原版 done
  };
}

export function playerName(S) {
  return `${S.name} #${S.jersey}`;
}

/* 球季數據空白模板，對照原版 blankStat()。故意不分位置——GK 專屬欄位(SV/GA)
   對外場球員永遠是 0，反之亦然，跟原版統一放 PA/AB 跟 W/L/SV 是同一種簡化
   選擇：資料形狀保持單一，位置相關的顯示/隱藏留給顯示層決定。 */
export function blankSeasonStat() {
  return {
    yr: 0,
    APP: 0, // 出賽場次
    GLS: 0, // 進球
    AST: 0, // 助攻
    TKL: 0, // 抄截/解圍
    CS: 0, // 零封
    SV: 0, // 撲救(GK)
    GA: 0, // 失球
    YC: 0, // 黃牌
    RC: 0, // 紅牌
    RAT: 0, // 賽季平均評分
    DPG: {}, // 各細分守位出賽場次，對照原版 blankStat 的 DPG
  };
}

export function stageLabel(S) {
  if (S.stage === 'YOUTH') return '青訓' + ['一', '二', '三'][S.stageYr - 1];
  return S.tier ? LV[S.tier].label : '業餘';
}
