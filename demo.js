/* ---------- 資料結構驗證 demo ---------- */
/* 不是遊戲本體，是拿現有的資料結構跑一次「開局生一個角色 → 跑完青訓三年 →
   轉正式判定」，驗證串得起來。之後球季推進迴圈(轉會窗/賽季/衰退/傷病)
   還沒碰，這裡只驗證到職業起步這一段。 */

import { setSeed, ri, chance } from './core/rng.js';
import { newState, playerName, stageLabel } from './core/state.js';
import { REGION, PATHS, LV } from './data/regions.js';
import { POSN, ABL, DPN } from './data/abilities.js';
import { runYouthToDebut, calcOVR } from './flow/careerStart.js';
import { proSeasonTick } from './flow/proSeason.js';

const seed = process.argv[2] || 'demo0001';
setSeed(seed);
console.log(`種子：${seed}\n`);

const regionCodes = Object.keys(REGION);
const regionCode = regionCodes[ri(0, regionCodes.length - 1)];
const region = REGION[regionCode];

const posCodes = Object.keys(POSN);
const pos = posCodes[ri(0, posCodes.length - 1)];

const pathCodes = Object.keys(PATHS);
const pathCode = pathCodes[ri(0, pathCodes.length - 1)];

const S = newState('測試球員', ri(1, 99), pos, regionCode, ri);
S.path = pathCode;

console.log(`${playerName(S)}　${POSN[pos]}　出身：${region.name}`);
console.log(`起步路徑：${PATHS[pathCode].label}（淘汰率 ${(PATHS[pathCode].cutRate * 100).toFixed(0)}%）`);
console.log(`\n[青訓期開局] 能力值：`);
for (const [k, v] of Object.entries(S.ab)) {
  console.log(`  ${ABL[k]}(${k})：${v}　潛力：${S.pot[k]}`);
}

const result = runYouthToDebut(S, ri, chance);

console.log(`\n[青訓三年選擇]`);
for (const yLog of result.youthLog) {
  const parts = [`第${yLog.year}年`];
  if (yLog.seasonOpener) {
    const o = yLog.seasonOpener;
    parts.push(`季初🎲${o.dice.join(',')}=${o.pool}${o.target ? `→${o.target}${o.gain >= 0 ? '+' : ''}${o.gain}` : ''}`);
  }
  parts.push(`[${yLog.category}:${yLog.option}]`);
  if (yLog.riskTier) parts.push(`${yLog.riskTier}${yLog.riskSuccess ? '成功' : '失敗'}`);
  if (yLog.growthGain) parts.push(`成長${yLog.growthGain >= 0 ? '+' : ''}${yLog.growthGain}${yLog.focusedKey ? `(${yLog.focusedKey})` : ''}`);
  if (yLog.abilityNudgeGain) parts.push(`能力${yLog.abilityNudgeGain >= 0 ? '+' : ''}${yLog.abilityNudgeGain}`);
  if (yLog.popularityGain) parts.push(`人氣+${yLog.popularityGain}`);
  if (yLog.debutInjuryMultApplied) parts.push(`出道傷病折扣已疊加`);
  console.log(`  ${parts.join('　')}`);
}
console.log(`  累積淘汰率折扣：×${(S.youthCutRateMult ?? 1).toFixed(3)}`);

console.log(`\n[青訓三年後] 能力值：`);
for (const [k, v] of Object.entries(S.ab)) {
  console.log(`  ${ABL[k]}(${k})：${v}　潛力：${S.pot[k]}`);
}
console.log(`綜合 OVR：${calcOVR(S)}`);

if (result.youthWC) {
  console.log(`\n[青年世界盃] 入選！戰績：${result.youthWC.round}　人氣：${result.youthWC.fame.toFixed(2)}`);
}

console.log(`\n[轉正式判定] ${result.passed ? '通過' : '未通過，退回業餘'}`);
if (result.passed) {
  console.log(`  層級：${LV[result.tier].label}（${result.tier}）`);
  if (S.subPosition) console.log(`  細分守位：${DPN[S.subPosition]}（${S.subPosition}）`);
  console.log(`  俱樂部：${S.club}`);
  console.log(`  年薪指數：${result.wage}　合約年限：${result.years} 年`);

  console.log(`\n[職業生涯球季推進]`);
  let seasonCount = 0;
  while (!S.retired && seasonCount < 25) {
    const log = proSeasonTick(S, ri, chance);
    seasonCount += 1;
    const parts = [`${log.year} 歲${S.age}`];
    if (log.seasonOpener) {
      const o = log.seasonOpener;
      parts.push(`季初🎲${o.dice.join(',')}=${o.pool}${o.target ? `→${o.target}${o.gain >= 0 ? '+' : ''}${o.gain}` : ''}`);
    }
    parts.push(`APP${log.stat.APP}/GLS${log.stat.GLS}/AST${log.stat.AST}/TKL${log.stat.TKL}/RAT${log.stat.RAT}`);
    // 戀愛系統改成每季自動判定之後，事件搬到獨立的 log.love(見
    // flow/romance.js 的稽核說明)，這裡合併兩者，下面逐行判斷 c.xxx 的
    // 除錯輸出不用整批改路徑。
    const c = { ...log.yearlyChoice, ...(log.love || {}) };
    // 💰 標記約定見 yearlyOptions.js：任何 def.cost 存在的子選項都要標，
    // 這裡先在文字輸出上做出雛形，之後真的做UI直接照這個規則套用。
    let choiceStr = `[${c.category}:${c.moneySpent ? '💰' : ''}${c.option}]`;
    if (c.riskTier) choiceStr += `${c.riskTier}${c.riskSuccess ? '成功' : '失敗'}`;
    if (c.growthGain) choiceStr += `成長${c.growthGain >= 0 ? '+' : ''}${c.growthGain}`;
    if (c.abilityNudgeGain) choiceStr += `能力${c.abilityNudgeGain >= 0 ? '+' : ''}${c.abilityNudgeGain}`;
    if (c.transferBuzzGain) choiceStr += `買氣+${c.transferBuzzGain}`;
    if (c.wagePremiumGain) choiceStr += `薪資溢價+${c.wagePremiumGain}`;
    if (c.releaseRiskDiscountGain) choiceStr += `合約危機風險-${c.releaseRiskDiscountGain}`;
    if (c.popularityGain) choiceStr += `人氣+${c.popularityGain}`;
    if (c.moneySpent) choiceStr += `花費${c.moneySpent}`;
    if (c.mediaScandal) choiceStr += `公關翻車`;
    if (c.startedDating) choiceStr += `開始交往:${c.startedDating.type}${c.startedDating.hidden ? '(隱藏!)' : ''}`;
    if (c.brokeUp) choiceStr += `分手`;
    if (c.proposalDelayed) choiceStr += `求婚機會:再等等`;
    if (c.married) choiceStr += `結婚:${c.married}`;
    if (c.declinedAffair) choiceStr += `出軌誘惑:拒絕`;
    if (c.newKid) choiceStr += `生小孩(第${c.newKid}胎)`;
    if (c.scandal) choiceStr += `緋聞`;
    if (c.divorced) choiceStr += `離婚`;
    if (c.secretExposed) choiceStr += `王子戀情曝光!`;
    if (c.stableSecretBonus) choiceStr += `隱瞞多年關係穩定`;
    if (c.affairHidden) choiceStr += `出軌(未被發現)`;
    if (c.affairDiscovered) choiceStr += `出軌被抓包!`;
    if (c.unlockedPlayboyStar) choiceStr += `解鎖稱號:花名在外的球星`;
    if (c.invest) choiceStr += `投資(押${c.invest.staked}×${c.invest.mult}=${c.invest.result})`;
    if (c.unlockedShrewdInvestor) choiceStr += `解鎖稱號:商業頭腦`;
    if (c.boughtClub) choiceStr += `買下球隊!`;
    if (c.blewItAll) choiceStr += `一擲千金花光${c.moneySpent}`;
    if (c.unlockedFamilyFirst) choiceStr += `解鎖稱號:顧家好男人/好女人`;
    if (c.unlockedRedeemed) choiceStr += `解鎖稱號:洗心革面`;
    parts.push(choiceStr);
    if (log.unlockedRagsToRiches) parts.push(`解鎖稱號:破產傳奇`);
    if (log.unlockedFame) parts.push(`解鎖場外稱號:${log.unlockedFame.join(',')}`);
    if (log.subPositionChanged) parts.push(`轉位置:${log.subPositionChanged.from}→${log.subPositionChanged.to}`);
    if (log.injuryEscalated) parts.push(`帶傷上陣惡化:${log.injuryEscalated.from}→${log.injuryEscalated.to}`);
    if (log.newInjury) parts.push(`受傷:${log.newInjury}`);
    if (log.recovered) parts.push(`傷癒:${log.recovered}`);
    if (log.declineLoss) parts.push(`衰退:-${log.declineLoss}`);
    if (log.unlockedPlaystyle) parts.push(`解鎖徽章:${log.unlockedPlaystyle.join(',')}`);
    if (log.lostPlaystyle) parts.push(`失去徽章:${log.lostPlaystyle.join(',')}`);
    if (log.unlockedPlayingStyle) parts.push(`生涯定位:${log.unlockedPlayingStyle.join(',')}`);
    if (log.loanedTo) parts.push(`租借:${log.loanedTo}`);
    if (log.loanResult) parts.push(log.loanResult.stayed ? `租借後轉正式:${log.loanResult.tier}(薪資${log.loanResult.wage})` : `租借表現不佳:回原隊`);
    if (log.clubCup) parts.push(`杯賽:${log.clubCup.cup}${log.clubCup.round ? '(' + log.clubCup.round + ')' : '(資格賽出局)'}`);
    if (log.worldCup) parts.push(`世界盃:${log.worldCup.round}(${log.worldCup.goals}球${log.worldCup.assists}助攻/人氣+${log.worldCup.fame.toFixed(2)})${log.worldCup.honors.length ? ' 稱號:' + log.worldCup.honors.join(',') : ''}`);
    if (log.promotion) parts.push(`晉級:${log.promotion.from}→${log.promotion.to}(薪資${log.promotion.wage})`);
    if (log.lateralMove) parts.push(`豪門挖角:${log.lateralMove.from}→${log.lateralMove.to}(薪資${log.lateralMove.wage})`);
    if (log.demotion) parts.push(`降級:${log.demotion.from}→${log.demotion.to}(薪資${log.demotion.wage})`);
    if (log.contractRenewed) parts.push(`續約(${log.contractRenewed.years}年/薪資${log.contractRenewed.wage})`);
    if (log.contractCrisis) {
      const c = log.contractCrisis;
      if (c.type === 'retired') parts.push(`合約危機:被迫引退`);
      else if (c.type === 'dropped') parts.push(`合約危機:降級留隊 ${c.from}→${c.to}(薪資${c.wage})`);
      else if (c.type === 'paycut') parts.push(`合約危機:降薪續約(薪資${c.wage})`);
    }
    // 三條終局選擇(買下球隊/世界盃封頂退休/轉戰演藝圈)都會搶在自然衰老退休
    // 判定前設 S.retired，proSeasonTick 結尾的 !S.retired 守衛會擋掉
    // log.retired，這裡要另外檢查各自的旗標才看得到是哪個分支的退休。
    // retiredAsChampion 設在 proSeasonTick 頂層 log(跟 log.retired 同層)，
    // retiredAsOwner/retiredAsCelebrity 設在 c=log.yearlyChoice 裡
    // (applyYearlyChoice 觸發的分支)。
    if (log.retired) parts.push(`引退`);
    else if (log.retiredAsChampion) parts.push(`引退(捧起世界盃冠軍，封頂收尾)`);
    else if (c.retiredAsOwner) parts.push(`引退(買下球隊，封頂收尾)`);
    else if (c.retiredAsCelebrity) parts.push(`引退(轉戰演藝圈，封頂收尾)`);
    console.log('  ' + parts.join('　'));
  }
  console.log(`\n生涯總長：${seasonCount} 季　最終 OVR：${calcOVR(S)}　永久殘留debuff：${S.permanentResidual}`);
  console.log(`已解鎖特質徽章：${S.traits.playstyle.length ? S.traits.playstyle.join(', ') : '無'}`);
  console.log(`生涯稱號：${S.honors.length ? S.honors.join(', ') : '無'}`);
  console.log(`國家隊：出場${S.national.caps}次　最佳戰績：${S.national.bestTournament ? S.national.bestTournament.round : '無'}`);
  console.log(
    `感情狀態：${S.love.st}　交往過${S.love.datedTimes}次　小孩${S.love.kids}個　人氣值：${S.popularity}　累計場外收入：${S.outsideIncome.toFixed(2)}　存款：${S.savings.toFixed(2)}`,
  );
} else {
  console.log(`  階段：${S.stage}`);
}
