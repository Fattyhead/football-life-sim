/* ---------- 玩家視角預覽：一年一句話，5分鐘讀完一段人生 ---------- */
/* 跟 demo.js 不同：demo.js 是給我們自己debug用的，把每個欄位都印出來；
   這個是真正接近玩家會看到的東西——narrate.js 從 log 裡挑一句話講，
   平淡的年份一筆帶過，戲劇性的年份才多一點份量，最後用 legacy.js 收尾。 */

import { setSeed, ri, chance } from './core/rng.js';
import { newState, playerName } from './core/state.js';
import { REGION, PATHS, LV } from './data/regions.js';
import { POSN, DPN } from './data/abilities.js';
import { runYouthToDebut, calcOVR } from './flow/careerStart.js';
import { proSeasonTick } from './flow/proSeason.js';
import { narrateSeason, narrateYouthSeason, narrateDebut } from './flow/narrate.js';
import { evaluateLegacy } from './flow/legacy.js';
import { gradeOpening } from './flow/gradeOpening.js';
import { frameChoice } from './flow/frameChoice.js';
import { ABL } from './data/abilities.js';
import { WC_ROUND_LABEL } from './data/national.js';

const seed = process.argv[2] || 'story0001';
setSeed(seed);

const regionCodes = Object.keys(REGION);
const regionCode = regionCodes[ri(0, regionCodes.length - 1)];
const region = REGION[regionCode];

const posCodes = Object.keys(POSN);
const pos = posCodes[ri(0, posCodes.length - 1)];

const pathCodes = Object.keys(PATHS);
const pathCode = pathCodes[ri(0, pathCodes.length - 1)];

const S = newState('無名小將', ri(1, 99), pos, regionCode, ri);
S.path = pathCode;

console.log(`═══ ${playerName(S)}的故事 ═══`);
console.log(`出身${region.name}，選擇了${POSN[pos]}這條路——${PATHS[pathCode].label}。`);

const opening = gradeOpening(S);
console.log(
  `\n[開局評價] 【${opening.grade}】(${opening.score}分)　天賦頂點：${ABL[opening.topAbility]}潛力${opening.topPot}`,
);
console.log(`適合路線：${opening.suggestedStyles.length ? opening.suggestedStyles.join('、') : '尚未看出明顯強項，穩紮穩打路線'}\n`);

const result = runYouthToDebut(S, ri, chance);

console.log(`═══ 青訓歲月 ═══`);
result.youthLog.forEach((yLog, idx) => {
  console.log(`\n青訓第${idx + 1}年`);
  for (const l of narrateYouthSeason(S, yLog, ri)) console.log(`　→ ${l}`);
  if (idx === 0 && result.youthWC) {
    console.log(`　→ 你意外入選了青年世界盃，戰績打進${WC_ROUND_LABEL[result.youthWC.round]}，球探開始注意到你！`);
  }
});
console.log('');

if (!result.passed) {
  console.log(`三年青訓過去，俱樂部沒有跟你續約的打算。你的職業球員夢，還沒開始就結束了。`);
  console.log(`\n═══ 完 ═══`);
  process.exit(0);
}

const posLabel = S.pos === 'GK' ? POSN.GK : DPN[S.subPosition];
console.log(`熬過青訓，${S.club}跟你簽下第一份職業合約，你以${posLabel}的身分正式出道。`);
const debutLine = narrateDebut(S);
if (debutLine) console.log(debutLine);
console.log('');

let seasonCount = 0;
let prevLog = null;
while (!S.retired && seasonCount < 30) {
  const frame = frameChoice(S, prevLog, ri);
  const log = proSeasonTick(S, ri, chance);
  seasonCount += 1;
  console.log(`\n${log.year}年（${S.age}歲）${frame}`);
  for (const l of narrateSeason(S, log, ri)) console.log(`　→ ${l}`);
  prevLog = log;
}

const legacy = evaluateLegacy(S, ri);
console.log(`\n═══ 掛靴 ═══`);
console.log(legacy.summary);
console.log(`\n傳奇度 ${legacy.legendPercent.toFixed(1)}%　【${legacy.tier}】－ ${legacy.tierDesc}`);
// 稽核修正：守門員/後衛不靠進球助攻吃飯，生涯數據那行改依位置凸顯不同
// 數字(見 flow/legacy.js careerTotals 的稽核說明)——守門員秀撲救/零封/
// 失球，外場球員維持進球/助攻，額外補上抢断/零封讓防守型球員也有數字可看。
const t = legacy.careerTotals;
const statLine =
  S.pos === 'GK'
    ? `出賽${t.APP}場・撲救${t.SV}次・零封${t.CS}場・失球${t.GA}球`
    : `出賽${t.APP}場・進球${t.GLS}・助攻${t.AST}・抢断${t.TKL}・零封${t.CS}場`;
console.log(`生涯數據：${statLine}　生涯薪資總額€${legacy.careerWageTotal.toLocaleString()}　存款€${legacy.savings.toLocaleString()}`);

// 成就展示：拿到的亮著，沒拿到的依難度層級藏名稱/條件/連分類都不給——
// 不做跨輪次累積(每次都是全新種子)，這份清單只反映這一輪拿到了什麼，
// 目的是讓玩家看到「原來還有這些」，變成重玩的誘因。
const TIER_GROUPS = [
  { label: '普通・徽章', match: (t) => t === 'COMMON' },
  { label: '稀有・稱號', match: (t) => t === 'RARE' },
  { label: '精英・稱號', match: (t) => t === 'ELITE' },
  { label: '場外・稱號', match: (t) => t.startsWith('OFFPITCH') },
];
const gotCount = legacy.achievements.filter((a) => a.reveal === 'obtained').length;
console.log(`\n═══ 生涯成就（${gotCount} / ${legacy.achievements.length}） ═══`);
for (const group of TIER_GROUPS) {
  const items = legacy.achievements.filter((a) => group.match(a.tier));
  console.log(`\n【${group.label}】`);
  for (const item of items) {
    const mark = item.reveal === 'obtained' ? '✓' : '·';
    console.log(`  ${mark} ${item.display}`);
  }
}
