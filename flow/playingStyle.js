/* ---------- 生涯定位標籤判定 ---------- */
/* traits.js PLAYING_STYLE 的 cond 寫的是「聯賽排名」(射手榜前3/助攻王之類)，
   但這個專案沒有模擬一整個聯賽的 NPC 球員，排不出真正的名次。改用 stat 數值
   門檻當代理指標(跟 transfer.js 用 RAT 代理「聯賽表現」是同一招)：門檻抓在
   「這個數字在目前的球季數據生成公式下已經算頂尖」的水準，不是精確排名，
   堪用但不精確——之後真的要做排名比較，換掉這個函式，呼叫端不用動。
   streak 型(需要連續N季)吃 core/state.js 的 S.milestoneStreak 累計，
   single-season 型/threshold 型當季達標就直接解鎖。 */

import { PLAYING_STYLE } from '../data/traits.js';
import { positionKey } from './shared.js';
import { clamp } from '../core/rng.js';

const STREAK_TARGET = { FOX_IN_THE_BOX: 3, ANCHOR_MAN: 2, ROCK_AT_THE_BACK: 2 };

/* 各代理條件是否「這季達標」，不含 streak 計數本身(那是外層累計)。
   hadMajorInjury 是這季有沒有發生新的大傷，ANCHOR_MAN/ROCK_AT_THE_BACK
   的「無重大失誤」用這個代理——嚴格說「失誤」跟「受傷」是兩件事，
   但沒有做「失誤」這個數據維度，借用「這季有沒有大傷」當保守的代理。 */
/* 門檻經過實跑抽樣校準——這次稽核用 6000 個種子重新量過，發現「主攻優勢
   項目」(TRAINING:FOCUSED)原本因為沒有記憶性(每季重算「離潛力最遠」)，
   導致連續選很多次也在練不同能力，力量被打散，全部球員生涯結束時能力
   最高值只有 36 分左右，連 65 分這種「單一能力」門檻都摸不到，更別說
   WING_WIZARD/BOX_TO_BOX 這種要求「多項能力同時達標」的門檻。這個
   結構性 bug 已經在 flow/shared.js 的 pickFocusTarget() 修掉(目標會鎖定，
   不會每季重算)，但即使修完，多項同時達標的組合難度還是遠高於單項——
   下修這裡的門檻是配合修完的成長機制，不是另一個獨立問題。 */
function meetsThisSeason(key, S, stat, hadMajorInjury) {
  switch (key) {
    case 'FOX_IN_THE_BOX':
      return stat.GLS >= 10;
    case 'CREATIVE_PLAYMAKER':
      return stat.AST >= 6;
    case 'ANCHOR_MAN':
      return stat.TKL >= 24 && !hadMajorInjury;
    case 'WING_WIZARD':
      return S.ab.PAC >= 58 && S.ab.DRI >= 58;
    case 'ROCK_AT_THE_BACK':
      return stat.TKL >= 22 && !hadMajorInjury;
    case 'BOX_TO_BOX':
      return S.ab.STA >= 42 && S.ab.DEF >= 42 && S.ab.PAS >= 42 && S.ab.SHO >= 42;
    case 'LEGENDARY_KEEPER':
      return stat.CS >= 10;
    case 'COMEBACK_KING':
      return S.bigInjCount > 0 && S.preInjuryPeakRAT != null && stat.RAT > S.preInjuryPeakRAT;
    default:
      return false;
  }
}

/* 套用 PLAYING_STYLE 的 effect：跟 flow/worldCup.js 套用 WC_HONOR.effect 是同一套
   欄位語意(ability/wagePremium/retireCapDelay)，這裡多兩種新欄位——
   declineStartDelay 疊到 S.declineStartBonus(decline.js DECLINE_START 查表時加上)，
   injuryEscalateChanceMult 疊到 S.injuryEscalateMult，真的接進 tickExistingInjury()
   的帶傷上陣惡化判定(見 proSeason.js)——原本這裡誤接到 S.injuryChanceMult
   (控制「這季會不會受新傷」，不是「帶傷上陣會不會惡化」)，是補 E 項(帶傷上陣
   機制)時新引入的斷點，這次稽核抓出來改正，字面效果現在跟實際判定對得上了。 */
function applyEffect(S, effect) {
  if (effect.ability) {
    for (const [k, v] of Object.entries(effect.ability)) {
      if (S.ab[k] !== undefined) S.ab[k] = clamp(S.ab[k] + v, 1, 85);
    }
  }
  if (effect.wagePremium) S.wagePremiumBonus += effect.wagePremium;
  if (effect.retireCapDelay) S.retireCapBonus += effect.retireCapDelay;
  if (effect.declineStartDelay) S.declineStartBonus += effect.declineStartDelay;
  if (effect.injuryEscalateChanceMult) S.injuryEscalateMult *= effect.injuryEscalateChanceMult;
  if (effect.clearPermanentResidual) S.permanentResidual = 0;
}

/* 入口：proSeasonTick 每季呼叫一次。hadMajorInjury 是這季 rollInjury() 的結果。 */
export function checkPlayingStyleUnlocks(S, stat, hadMajorInjury) {
  const unlocked = [];
  const posKey = positionKey(S);

  for (const [key, def] of Object.entries(PLAYING_STYLE)) {
    if (S.traits.playingStyle.includes(key)) continue;
    if (def.positions && !def.positions.includes(posKey)) continue;

    const metThisSeason = meetsThisSeason(key, S, stat, hadMajorInjury);
    const target = STREAK_TARGET[key];

    if (target) {
      // streak 型：達標累計，沒達標歸零
      S.milestoneStreak[key] = metThisSeason ? (S.milestoneStreak[key] || 0) + 1 : 0;
      if (S.milestoneStreak[key] < target) continue;
    } else if (!metThisSeason) {
      continue;
    }

    S.traits.playingStyle.push(key);
    S.honors.push(def.label);
    applyEffect(S, def.effect);
    unlocked.push(key);
  }

  return unlocked;
}
