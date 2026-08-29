/* ---------- flow 層共用小工具 ---------- */
/* calcOVR/positionKey/signContract 原本在 careerStart.js/proSeason.js 各寫一份，
   三個地方公式一旦要調整(比如換掉 OVR 簡化公式)就要三處同步改，抽成這裡共用。 */

import { POS_MARKET } from '../data/abilities.js';
import { WAGE_BASE, CLUB_PRESTIGE_WAGE_MULT, CONTRACT_LENGTH, RELEASE_CLAUSE_MULT_RANGE } from '../data/contract.js';
import { DECLINE_START } from '../data/decline.js';
import { TOP5_CLUBS } from '../data/clubNames.js';
import { LOCAL_CLUBS, FEEDER_CLUBS } from '../data/localClubNames.js';
import { REGION } from '../data/regions.js';
import { DICE_COUNT_TABLE, GROWTH_COST_TABLE, ABILITY_HARD_CAP, overPotentialMultiplier, RISK_TIERS, RISK_TIER_TITLE } from '../data/growth.js';
import { SQUAD_CHEMISTRY } from '../data/career.js';
import { withPlaystyleBonus } from './badges.js';

/* TOP5 層級的具體俱樂部名，取代原本「五大聯賽俱樂部」這種通用詞——
   轉正式/晉級/租借買斷，任何時候要指派一個 TOP5 俱樂部都呼叫這個，
   不要各處自己寫字串，不然改隊名池要改好幾個地方。
   prestige 選填：只在 CONTENDER→ELITE 的豪門挖角(見 transfer.js
   checkLateralMove)才會傳，其他呼叫端不用管，維持原本呼叫方式不變。 */
export function pickTop5Club(ri, prestige = null) {
  const pool = prestige ? TOP5_CLUBS.filter((c) => c.prestige === prestige) : TOP5_CLUBS;
  return pool[ri(0, pool.length - 1)].name;
}

/* 反查一支 TOP5 俱樂部的豪門等級，給 checkLateralMove 判斷「現在這支
   球隊是不是已經是豪門」用。名字在 TOP5_CLUBS 裡唯一，直接查表即可，
   不用另外在 S 上存一份 prestige 欄位跟著球員走。 */
export function clubPrestigeOf(clubName) {
  const club = TOP5_CLUBS.find((c) => c.name === clubName);
  return club ? club.prestige : null;
}

/* LOCAL/FEEDER 層級的具體俱樂部名，取代原本直接印聯賽全名代稱球隊的做法。
   LOCAL 用地區自己的 local.code 查表；FEEDER 用 feeder.code 查表(不是地區碼，
   因為好幾個地區共用同一個跳板聯賽國家，照國家分池才不會混淆)。
   歐洲地區(EUR)沒有 feeder，呼叫端要自己先判斷 REGION[region].feeder 存不存在。 */
export function pickLocalClub(ri, regionCode) {
  const pool = LOCAL_CLUBS[REGION[regionCode].local.code];
  return pool[ri(0, pool.length - 1)];
}

export function pickFeederClub(ri, regionCode) {
  const pool = FEEDER_CLUBS[REGION[regionCode].feeder.code];
  return pool[ri(0, pool.length - 1)];
}

/* OVR 簡化版：能力平均值。吃 withPlaystyleBonus() 疊加過常態徽章加成的
   有效能力值，不是原始 S.ab——徽章代表「現在真的更強」，位置判定/薪資/
   晉級/國家隊選拔這些下游判定都該吃得到，不然徽章只是好看的裝飾。
   真正的守位判定要用 DP_TH 的加權公式(留給 engine/position.js)，這裡先用
   平均值當粗略代理，之後換掉這個函式即可，呼叫端(careerStart/proSeason/
   transfer)不用動。 */
export function calcOVR(S) {
  const boosted = withPlaystyleBonus(S);
  // permanentResidual(大傷康復後的永久殘留debuff，見 data/injury.js)之前
  // 宣告了卻沒有任何計算真的讀它(實測稽核抓出來的斷點)——追蹤了、也能被
  // COMEBACK_KING 清零，但從沒扣過任何能力值，等於是純裝飾數字。這裡補上。
  const residual = S.permanentResidual || 0;
  const vals = Object.values(boosted).map((v) => Math.min(85, Math.max(1, v + residual)));
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/* 隊伍核心力對訓練成長池的小幅修正(見 data/career.js SQUAD_CHEMISTRY)——
   低於磨合門檻打折、高於熟稔門檻加成，中間區間不調整。乘在 yearlyChoice.js
   rollTrainingDice() 的 pool 上，跟 growthSpeedMult 同一個位置、同一種
   「疊乘在骰子總和上」的寫法，不是另外開一條路徑。 */
export function squadChemistryMult(S) {
  const v = S.squadChemistry || 0;
  if (v < SQUAD_CHEMISTRY.lowThreshold) return SQUAD_CHEMISTRY.lowMult;
  if (v >= SQUAD_CHEMISTRY.highThreshold) return SQUAD_CHEMISTRY.highMult;
  return 1;
}

/* 位置查表用的統一 key：GK 用 'GK'，外場用細分守位代碼。
   decline.js(DECLINE_START/RETIRE_CAP)、abilities.js(POS_MARKET/POS_ADJ/DP_RANK)
   都用這組 key，避免每個檔案各自寫一次 GK 三元判斷。 */
export function positionKey(S) {
  return S.pos === 'GK' ? 'GK' : S.subPosition;
}

/* 「主攻優勢項目」鎖定的目標能力：稽核抓出來的斷點——原本每次都重算
   「離潛力天花板最遠的一項」，導致連續選很多次也在練不同能力，力量被
   打散，沒有一項真的衝得上任何徽章/稱號門檻。這裡改成有記憶性：已經有
   目標、且目標還沒練滿(離潛力天花板還有空間)就沿用同一個；沒有目標或
   舊目標已經練滿，才挑一個新的——選「潛力天花板最高」的那項(不是缺口
   最大的那項)，這樣目標一旦選定就會穩定鎖住，不會因為其他能力的缺口
   暫時變得比較大就换目標。青訓期(flow/youthChoice.js)也共用這個函式，
   選定的目標會延續到職業生涯，不會出道就重置。 */
export function pickFocusTarget(S) {
  // 稽核抓出來的斷點：這裡原本用 S.ab[k] < S.pot[k] 判斷「還能不能練」，
  // 潛力其實是軟上限(超過還能練，只是變貴，見 flow/shared.js
  // addAbilityPoints)，真正練不動的門檻是 ABILITY_HARD_CAP——這裡改用
  // 那個，鎖定目標才不會在超過潛力(但還沒到80)時被誤判成「已經封頂」
  // 而提前放棄鎖定。
  if (S.focusTarget && S.ab[S.focusTarget] !== undefined && S.ab[S.focusTarget] < ABILITY_HARD_CAP) {
    return S.focusTarget;
  }
  const keys = Object.keys(S.ab).filter((k) => S.ab[k] < ABILITY_HARD_CAP);
  if (keys.length === 0) return null;
  keys.sort((a, b) => S.pot[b] - S.pot[a]);
  S.focusTarget = keys[0];
  return S.focusTarget;
}

/* ---------- 骰子成長系統 ---------- */
/* 對照 data/growth.js 的靜態表，這裡是實際判定邏輯。青訓/職業生涯共用
   同一套(比照 pickFocusTarget/calcOVR 已經是共用函式的既有模式)，不要
   兩處各寫一份。 */

/* 每季擲幾顆骰：ri(1,100) 對照 DICE_COUNT_TABLE 的累積機率分段。 */
export function rollDiceCount(ri) {
  const roll = ri(1, 100);
  for (const tier of DICE_COUNT_TABLE) {
    if (roll <= tier.cumPct) return tier.count;
  }
  return DICE_COUNT_TABLE[DICE_COUNT_TABLE.length - 1].count;
}

/* 單顆骰：1-6點，floor 是天才(4)/埋頭苦練的性格(4)疊加後取 Math.max 算出來的保底，
   一般情況 floor=1(沒有特殊保底)。 */
export function rollDie(ri, floor = 1) {
  return Math.max(floor, ri(1, 6));
}

/* 查表得到「這一級要花多少點」——ability >= pot(已經超過這項能力自己
   抽到的潛力軟上限)時，這一格本來的成本要再乘上 overPotentialMultiplier()
   查出來的倍率(超過越多、倍率越重，階梯式，見 data/growth.js 的稽核
   說明)，不是另開一個固定數字：現值70、潛力只有55的人，超過潛力後還是
   落在70-74這個級距，付的是「70-74本來的成本」×倍率，不是憑空一個
   新數字。 */
// discountMult：特訓成癮(TRAINING_MASTERY.TIER2，見 data/mastery.js)解鎖後
// 疊乘在超過潛力的加倍成本上，預設1不影響沒拿到這個稱號的玩家。呼叫端
// (addAbilityPoints/previewAbilityLevel)一律傳 S.overPotentialDiscountMult，
// 不在這裡直接讀 S，維持這個函式本身不依賴完整 state 的純函式寫法。
function costPerLevel(ability, pot, isGK, discountMult = 1) {
  const table = isGK ? GROWTH_COST_TABLE.gk : GROWTH_COST_TABLE.outfield;
  const base = table.find((t) => ability < t.max).cost;
  if (ability >= pot) {
    return base * overPotentialMultiplier(ability - pot + 1, isGK) * discountMult;
  }
  return base;
}

/* 純預覽版的 addAbilityPoints：算「如果現在真的投入這些點數，這項能力
   會變成多少」，不寫回 S——給季初分配畫面(web/src/components/
   SeasonOpener.jsx)的 +/- 分配預覽用。UI 不能自己假設「1點數=1級」再
   拿 potential 當上限顯示，那是超過潛力機制上線之前的舊假設：一旦某項
   能力超過自己的潛力，同樣的點數換到的級數會變少(成本×3或×4)，UI 的
   預覽數字要跟真正判定用的同一套 costPerLevel，不要自己複寫一份簡化版
   容易兜不起來。 */
export function previewAbilityLevel(S, key, points, isGK) {
  if (S.ab[key] === undefined) return S.ab[key];
  const pot = S.pot[key];
  let ab = S.ab[key];
  let progress = (S.abProgress[key] || 0) + points;
  const discountMult = S.overPotentialDiscountMult ?? 1;
  while (ab < ABILITY_HARD_CAP && progress >= costPerLevel(ab, pot, isGK, discountMult)) {
    progress -= costPerLevel(ab, pot, isGK, discountMult);
    ab += 1;
  }
  return Math.min(ABILITY_HARD_CAP, ab);
}

/* 把「骰出來的點數」(或機會/社交小幅加成的點數，或風險層失敗時的負數
   倒扣，三邊共用同一套邏輯，見 flow/yearlyChoice.js applyAbilityNudge 的
   呼叫)累積進 S.abProgress，湊滿當前等級的成本就跳一級、用新等級重新
   查表，允許一次點數大到跨多級。points 可以是負數(風險層失敗的對稱
   倒扣，查證過原版是真的扣、沒有下限，只有 S.ab[key] 本身夾在
   [1, ABILITY_HARD_CAP])——退級時把退回去那一級的成本「還」回
   S.abProgress，可能連續退多級，跟升級的迴圈對稱，不是另外寫一套。
   稽核抓出來的斷點修正：這裡原本把「潛力」當成練不過去的硬牆，練到
   S.pot[key]就不再吃點數——重新查證原版 wiki 後發現潛力其實是「軟
   上限」，超過還能練，只是變貴(見上面 costPerLevel)，真正的硬牆是
   data/growth.js 的 ABILITY_HARD_CAP(80，不分位置/種子)。已經到通用
   硬上限(且這次是正數點數)才把進度歸零(避免練滿之後小數持續堆積卻用
   不到)；負數點數不會觸發這個歸零，不然剛好打到上限的退級會被誤判成
   「還在上限」而把倒扣的痕跡清掉。回傳這次實際跳了幾級(可能是負的)，
   方便呼叫端記 log。 */
export function addAbilityPoints(S, key, points, isGK) {
  if (S.ab[key] === undefined) return 0;
  const pot = S.pot[key];
  S.abProgress[key] = (S.abProgress[key] || 0) + points;
  const discountMult = S.overPotentialDiscountMult ?? 1;
  let levels = 0;
  while (S.ab[key] < ABILITY_HARD_CAP && S.abProgress[key] >= costPerLevel(S.ab[key], pot, isGK, discountMult)) {
    S.abProgress[key] -= costPerLevel(S.ab[key], pot, isGK, discountMult);
    S.ab[key] += 1;
    levels += 1;
    // 累積「這輩子總共練出過幾級超過潛力的能力」，給 TRAINING_HONOR(見
    // data/mastery.js/flow/disciplineHonors.js)當門檻——只增不減(這輩子
    // 發生過的事，跟 S.everBlewItAll/S.royalRomanceExposed 同一種歷史紀錄
    // 語意)，之後退級(風險層失敗倒扣)不會把這裡的累積扣掉。
    if (S.ab[key] > pot) S.overPotentialLevelsGained = (S.overPotentialLevelsGained || 0) + 1;
  }
  while (S.abProgress[key] < 0 && S.ab[key] > 1) {
    S.ab[key] -= 1;
    S.abProgress[key] += costPerLevel(S.ab[key], pot, isGK, discountMult);
    levels -= 1;
  }
  S.ab[key] = Math.max(1, Math.min(ABILITY_HARD_CAP, S.ab[key]));
  if (points > 0 && S.ab[key] >= ABILITY_HARD_CAP) S.abProgress[key] = 0;
  return levels;
}

/* 風險層稱號(見 data/growth.js RISK_TIER_TITLE)解鎖後永久疊加的成功率
   加成——只加在「這個稱號對應的那一檔」，TIER1/TIER2 各 +5，兩個都拿到
   疊加成 +10，不會讓 SAFE 的稱號去加成 AGGRESSIVE。給 resolveRiskTier()
   算真正擲骰用的機率、也給 UI(ChoiceMenu.jsx)顯示玩家實際會吃到的
   百分比，兩邊要讀同一個函式，不要顯示的數字跟真正在算的數字對不上。 */
export function effectiveRiskSuccessPct(S, tierKey) {
  const base = RISK_TIERS[tierKey].successPct;
  const table = RISK_TIER_TITLE[tierKey];
  if (!table) return base;
  let bonus = 0;
  if (S.honors.includes(table.TIER1.label)) bonus += table.TIER1.successBonusPct || 0;
  if (S.honors.includes(table.TIER2.label)) bonus += table.TIER2.successBonusPct || 0;
  return Math.min(100, base + bonus);
}

/* 選項的小整數風險層(訓練/機會選項底下再選穩健/平衡/冒進)：成功率的
   基準值直接照抄 data/growth.js RISK_TIERS 的絕對值(查證過 yakyolife.com
   原版 wiki，事件卡三檔就是這組數字，不是骰子系統的比例縮放)，實際擲骰
   用 effectiveRiskSuccessPct() 疊加稱號加成後的機率。回傳 { success, delta }，
   delta 已經帶正負號，呼叫端(flow/yearlyChoice.js/flow/youthChoice.js)
   直接拿去餵 addAbilityPoints，兩邊共用同一份機率判定，不要各寫一份。
   同時累加 S.riskTierPickCount[tierKey]——不分成功失敗，選了這一檔就算數
   (比照 categoryPickCount「選了哪個類別幾次」的語意，不是「成功幾次」)，
   稱號/隱晦線索(見 flow/streakFlavor.js)門檻讀這個累積數。
   S.growthSpeedMult(機會/社交深度委身的代價，見 data/mastery.js)這輪
   使用者定案改成只疊乘在風險層「成功」的幅度上，跟季初骰子池(大頭)
   無關(那邊已經拿掉這個乘數，見 flow/seasonOpener.js)——失敗的倒扣
   維持 tier.abilityDelta 全額，不被這個係數打折，這樣「委身代價」的
   痛感才是實打實的成長變慢，不是連帶讓失敗也變得比較不痛。 */
export function resolveRiskTier(S, chance, tierKey) {
  const tier = RISK_TIERS[tierKey];
  S.riskTierPickCount[tierKey] = (S.riskTierPickCount[tierKey] || 0) + 1;
  const successPct = effectiveRiskSuccessPct(S, tierKey);
  const success = chance(successPct / 100);
  const delta = success ? tier.abilityDelta * (S.growthSpeedMult ?? 1) : -tier.abilityDelta;
  return { success, delta };
}

/* 風險層累積次數達門檻(見 data/growth.js RISK_TIER_TITLE)就推進稱號——
   不分成功失敗，選了這一檔就算數，比照 yearlyChoice.js checkCategoryMastery
   同一種「未擁有才推進」守衛寫法。呼叫端(flow/yearlyChoice.js/
   flow/youthChoice.js)在 resolveRiskTier 之後立刻呼叫，log 用來給敘事層
   (flow/narrate.js)顯示解鎖句。 */
export function checkRiskTierTitle(S, tierKey, log) {
  const table = RISK_TIER_TITLE[tierKey];
  if (!table) return;
  const count = S.riskTierPickCount[tierKey] || 0;
  for (const t of ['TIER1', 'TIER2']) {
    const def = table[t];
    if (count >= def.threshold && !S.honors.includes(def.label)) {
      S.honors.push(def.label);
      log.unlockedRiskTierTitle = [...(log.unlockedRiskTierTitle || []), def.label];
    }
  }
}

/* 套用委身特質/天才類特質的 effect——欄位語意盡量重用既有的一次性加成
   寫法(跟 WEALTH_HONOR/WC_HONOR 同一套)，只有 diceFloor/transferBuzzFlatBonus/
   growthSpeedMult 三個是「解鎖後持續生效」的新語意，見 data/mastery.js
   開頭註解。原本是 yearlyChoice.js 裡沒 export 的私有函式，搬來這裡
   並 export——flow/seasonOpener.js 的天才/埋沒天才判定(diceFloor)也要用，
   避免兩個 flow 檔案互相 import 造成循環依賴。 */
export function applyMasteryEffect(S, effect) {
  if (effect.diceFloor) S.diceFloorBonus = Math.max(S.diceFloorBonus || 0, effect.diceFloor);
  if (effect.outsideIncomeMultBonus) S.outsideIncomeMultBonus = (S.outsideIncomeMultBonus || 0) + effect.outsideIncomeMultBonus;
  if (effect.transferBuzzFlatBonus) S.transferBuzzFlatBonus = (S.transferBuzzFlatBonus || 0) + effect.transferBuzzFlatBonus;
  if (effect.wagePremiumGain) S.wagePremiumBonus += effect.wagePremiumGain;
  if (effect.releaseRiskDiscountGain) S.releaseRiskDiscount = (S.releaseRiskDiscount || 0) + effect.releaseRiskDiscountGain;
  if (effect.growthSpeedMult) S.growthSpeedMult = (S.growthSpeedMult ?? 1) + effect.growthSpeedMult;
  if (effect.popularityBonus) S.popularity += effect.popularityBonus;
  // 特訓成癮(TRAINING_MASTERY.TIER2)專用：疊乘(不是相加)，跟 growthSpeedMult
  // 刻意分開的欄位，只影響超過潛力的加倍成本，不影響風險層的一般幅度。
  if (effect.overPotentialDiscountMult) S.overPotentialDiscountMult = (S.overPotentialDiscountMult ?? 1) * effect.overPotentialDiscountMult;
}

/* 解約金倍率：骰兩次取小(而不是均勻隨機)，刻意讓低倍率(容易被買走)出現
   機率明顯偏高——這是設計定案(見 contract.js 註解)：這個遊戲的核心是
   「向上流動」，不是把球員綁死在某個階段，高倍率(接近鎖死)還是有機會
   出現，但不該是常態。任何以後跟「轉會自由度」有關的機制都要延續這個
   偏向，不要反過來設計成卡關的東西。 */
function rollReleaseClause(ri) {
  const { min, max } = RELEASE_CLAUSE_MULT_RANGE;
  const span = max - min;
  const a = ri(0, 1000);
  const b = ri(0, 1000);
  const skewedLow = Math.min(a, b) / 1000;
  return Math.round((min + skewedLow * span) * 100) / 100;
}

/* 稽核抓出來的斷點(平衡度稽核，同一輪「副業不能贏過主業」原則的延伸——
   使用者原話：「有些加成應該是y/n不是一直累積上去的?」)：S.wagePremiumBonus
   完全沒有上限，而它的姊妹欄位 S.releaseRiskDiscount 在唯一的讀取點
   (flow/transfer.js networkDiscount)早就有 Math.min(0.3, …) 封頂——兩個
   欄位同樣來自 EXEC_NETWORKING 這個可以無限次重選的機會選項(PRIME/LATE
   隨便一季都能選，沒有冷卻)，releaseRiskDiscount 有防線、wagePremiumBonus
   卻沒有，是不一致，不是刻意的差別待遇。實測：刻意打法(20季一路選
   EXEC_NETWORKING/RETIREMENT_PREP+穩健風險層)能疊到 0.51，遠超過
   POS_MARKET(位置溢價本身的量級只有 -0.15~0.35，見 data/abilities.js)、
   也遠超過所有一次性稱號溢價全部疊滿的合理總和(ETERNAL_CAPTAIN 0.15+
   代表性 PLAYING_STYLE 0.10~0.15+經紀人羈絆 0.05+精算成癮 0.05≈0.35~0.40)
   ——等於「一直重選同一個便宜選項」比「真的拿到一堆精英稱號」還好賺，
   本末倒置。封頂訂在 0.35，貼齊 POS_MARKET 的量級上限、也大致等於一次性
   稱號全拿的合理總和，讓「重選同一個選項」不能超過「真的拿到稀有成就」
   的天花板。 */
const WAGE_PREMIUM_BONUS_CAP = 0.35;

/* 簽約公式，開局/續約/轉會晉級都共用同一份，只有 tier 不同。
   wage = WAGE_BASE[tier] × CLUB_PRESTIGE_WAGE_MULT[豪門等級] × (OVR/30) ×
   (1+POS_MARKET[位置])，合約年限依「是否過起衰年齡」在 preDecline/
   postDecline 兩個範圍裡骰。每次簽約都會重新骰一次解約金倍率(見
   rollReleaseClause)，跟著新合約走。
   稽核補上的豪門乘數(見 data/contract.js CLUB_PRESTIGE_WAGE_MULT 的
   稽核說明)：呼叫端(careerStart.js/transfer.js/loan.js)全部都在
   S.club 指派完成之後才呼叫這裡，clubPrestigeOf(S.club) 讀得到正確的
   目標俱樂部，不會讀到換東家前的舊值。LOCAL/FEEDER 沒有豪門等級概念，
   clubPrestigeOf 對這兩層一律回傳 null，套用表裡 null 對應的 1 倍，
   跟「沒有豪門加成」語意一致，不用另外判斷 tier。 */
/* wageMult 選填(預設1)：給 flow/transfer.js 的合約危機(checkContractCrisis)
   用——降薪續約/降級留隊都要簽一份比正常行情低的合約，不想另外寫一份
   簽約公式，加個乘數就能共用同一套邏輯，其餘呼叫端不用動。 */
export function signContract(S, ri, tier, wageMult = 1) {
  const ovr = calcOVR(S);
  const key = positionKey(S);
  const premium = POS_MARKET[key] + Math.min(WAGE_PREMIUM_BONUS_CAP, S.wagePremiumBonus || 0); // 稱號(如 ETERNAL_CAPTAIN)疊加的個人溢價，封頂見上方稽核說明
  const prestigeMult = CLUB_PRESTIGE_WAGE_MULT[clubPrestigeOf(S.club)] ?? 1;
  const wage = Math.round(WAGE_BASE[tier] * prestigeMult * (ovr / 30) * (1 + premium) * wageMult * 100) / 100;
  const range = S.age < DECLINE_START[key] ? CONTRACT_LENGTH.preDecline : CONTRACT_LENGTH.postDecline;
  const years = range.min + ri(0, range.max - range.min);
  S.contract = { wage, yearsLeft: years, releaseClause: rollReleaseClause(ri) };
  S.wage = wage;
  return { wage, years };
}
