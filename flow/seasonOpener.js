/* ---------- 季初特訓：骰子成長(大頭)的獨立步驟 ---------- */
/* 查證過 yakyolife.com 原版 wiki 後確認：骰子成長是「季初」自動發生一次
   的獨立步驟，不看玩家選了訓練/機會/社交哪個類別，點數由玩家自己分配
   到想強化的能力上——原本(見 flow/yearlyChoice.js rollTrainingDice()/
   flow/youthChoice.js rollYouthDice())把這個機制黏死在 TRAINING 類別的
   growthMode 分支裡，只有選了 TRAINING 才骰、點數還是引擎自動依
   growthMode 分配，這裡拆出來變成青訓/職業共用的獨立模組，呼叫端
   (flow/careerStart.js/flow/proSeason.js/headless story.js/demo.js/
   React UI)在 prepareSeasonChoice()(職業)或每個青訓年度開始時，各自
   多跑一次「rollSeasonOpener → 玩家分配 → applySeasonAllocation」，
   分配完才進原本的類別/子選項選擇。 */

import { DECLINE_START } from '../data/decline.js';
import { TRAINING_MULT } from '../data/career.js';
import { GENIUS, LATE_BLOOM_GENIUS } from '../data/mastery.js';
import { positionKey, rollDiceCount, rollDie, addAbilityPoints, squadChemistryMult, applyMasteryEffect } from './shared.js';

/* 擲骰：3-6顆(權重見 data/growth.js DICE_COUNT_TABLE)，每顆1-6點，
   天才/埋頭苦練的性格的保底(S.diceFloorBonus)套在每一顆骰子上。stage==='PRO' 才吃
   聯賽層級倍率(TRAINING_MULT)/隊伍默契(squadChemistryMult)——這兩個是
   職業生涯限定的概念，青訓期還沒有俱樂部/聯賽層級，維持原本
   rollYouthDice() 的簡單版(骰子總和直接就是點數池，不疊乘數)。委身
   特質的成長速度懲罰(growthSpeedMult)使用者定案改成只咬風險層(小頭，
   ±1/2/3)的成功幅度，這裡(大頭)不再吃這個乘數，見 flow/shared.js
   resolveRiskTier()。職業版沿用衰退期停練判斷(照抄原本
   rollTrainingDice() 的門檻)：進入衰退期就不再有季初分配，回傳空結果，
   呼叫端(UI)看到 dice.length===0 直接跳過整張季初分配卡片。 */
export function rollSeasonOpener(S, ri, stage) {
  if (stage === 'PRO') {
    const key = positionKey(S);
    if (S.age >= DECLINE_START[key] + (S.declineStartBonus || 0)) return { dice: [], pool: 0, sixes: 0 };
  }
  const floor = S.diceFloorBonus || 1;
  const diceCount = rollDiceCount(ri);
  const dice = [];
  for (let i = 0; i < diceCount; i++) dice.push(rollDie(ri, floor));
  const rawPool = dice.reduce((a, b) => a + b, 0);
  const mult = stage === 'PRO' ? (TRAINING_MULT[S.onLoan ? S.loanTier : S.tier] ?? 1.0) * squadChemistryMult(S) : 1;
  // 玩家分配介面是整數點數的 +/- 按鈕(比照 mockup)，池子先四捨五入成整數——
  // 聯賽層級的乘數本來就會讓 rawPool*mult 變成小數，四捨五入一次在這裡
  // 做掉，UI 不用處理「剩餘可分配」永遠碰不到剛好0的浮點數問題，
  // addAbilityPoints() 本身雖然支援小數點數，但這裡不需要——分配這步是
  // 玩家直接决定要花在哪，跟訓練/機會小幅加成那種小數蓄力槽的場景不同。
  const pool = Math.round(rawPool * mult);
  const sixes = dice.filter((d) => d === 6).length;
  return { dice, pool, sixes };
}

/* 套用玩家(或 headless 自動策略)決定的分配結果：allocations 是
   { 能力key: 點數 } 的稀疏物件，逐項呼叫 addAbilityPoints——玩家分配
   出來的點數一定是正數(UI 的 +/- 只會在 remaining>0 時允許加)，這裡
   還是用 `points > 0` 守一次，避免呼叫端誤傳負數或0污染 abProgress。
   回傳實際跳了幾級，方便呼叫端記 log/顯示。 */
export function applySeasonAllocation(S, allocations) {
  const isGK = S.pos === 'GK';
  let gain = 0;
  for (const [key, points] of Object.entries(allocations)) {
    if (points > 0) gain += addAbilityPoints(S, key, points, isGK);
  }
  return gain;
}

/* 骰出的「6」餵進天才(青訓限定)/埋沒的天才(職業生涯19-22歲限定)的累積
   計數器——這兩個窗口互斥，也互相排斥彼此(拿過其中一個就不用再判另一
   個)。青訓版只負責累加 S.youthSixes，達標判定留在 flow/careerStart.js
   resolveDebut()(3年跑完才一次判定，不用每年都檢查)；職業版當場判定，
   達門檻直接推進榮譽+套用效果，跟原本在 yearlyChoice.js TRAINING 分支
   裡的邏輯一致，只是搬來這裡集中管理。 */
export function trackSeasonSixes(S, sixes, stage, log = {}) {
  if (sixes <= 0) return log;
  if (stage === 'YOUTH') {
    S.youthSixes = (S.youthSixes || 0) + sixes;
  } else if (stage === 'PRO') {
    if (S.age >= 19 && S.age <= 22 && !S.honors.includes(GENIUS.label) && !S.honors.includes(LATE_BLOOM_GENIUS.label)) {
      S.lateBloomSixes = (S.lateBloomSixes || 0) + sixes;
      if (S.lateBloomSixes >= LATE_BLOOM_GENIUS.threshold) {
        S.honors.push(LATE_BLOOM_GENIUS.label);
        applyMasteryEffect(S, LATE_BLOOM_GENIUS.effect);
        log.unlockedLateBloomGenius = true;
      }
    }
  }
  return log;
}
