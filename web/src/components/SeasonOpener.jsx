import { useState } from 'react';
import { ABL, POS_AB, ABILITY_HARD_CAP, previewAbilityLevel, overPotentialMultiplier } from '../engine.js';

/* 季初特訓——骰子成長(大頭)的自由分配畫面，對照 season_screen_prototype.html
   mockup 已經定案、使用者驗收過的設計：每季開場先擲 3-6 顆骰(見
   flow/seasonOpener.js rollSeasonOpener)，點數池由玩家自己用 +/- 分配到
   想強化的能力上，不是引擎自動決定配到哪。這張卡片排在球季插曲/年度
   選擇之前，每季開始都會先出現(App.jsx 在 opener.dice.length===0 時
   —— 已經過了衰退起始年齡 —— 直接跳過這張卡片，不強塞一個沒有內容的
   分配畫面)。
   稽核抓出來的斷點修正：能力的「潛力」是軟上限，超過還能練、只是成本
   變貴(外場×3／守門員×4，見 flow/shared.js addAbilityPoints)，真正練不
   動的門檻是通用的 ABILITY_HARD_CAP(80)。這裡的預覽數字改用
   previewAbilityLevel()(跟引擎判定同一套 costPerLevel，不自己複寫一份
   假設「1點數=1級」的簡化版)，不然玩家在超過潛力的區間分配點數，畫面
   預覽的級數會比實際判定多，兩邊對不上。
   opener: { dice, pool, sixes }(rollSeasonOpener 的回傳值)。
   onConfirm(allocations)：allocations 是 { 能力key: 點數 } 的稀疏物件，
   只包含玩家真的分配過點數的鍵。 */
export default function SeasonOpener({ S, opener, onConfirm }) {
  const abKeys = POS_AB[S.pos];
  const isGK = S.pos === 'GK';
  const [spent, setSpent] = useState({});

  const totalSpent = Object.values(spent).reduce((a, b) => a + b, 0);
  const remaining = opener.pool - totalSpent;

  function adjust(key, delta) {
    setSpent((prev) => {
      const cur = prev[key] || 0;
      if (delta > 0 && (remaining <= 0 || previewAbilityLevel(S, key, cur, isGK) >= ABILITY_HARD_CAP)) return prev;
      if (delta < 0 && cur <= 0) return prev;
      return { ...prev, [key]: cur + delta };
    });
  }

  // 所有能力都已經到通用硬上限(徽章/世界盃這類效果可能把 ab 推到80，見
  // flow/eliteHonors.js/playingStyle.js/worldCup.js)，這筆點數池沒地方去——
  // 不強迫玩家卡在一個按不動的畫面，直接允許以空分配確認掉，池子作廢。
  const anyRoom = abKeys.some((k) => S.ab[k] < ABILITY_HARD_CAP);

  return (
    <div className="card season-opener">
      <p className="eyebrow">季初特訓</p>
      <p className="frame-text">教練組評估了你這個休賽期的狀態，這季有一筆自由訓練點數，你想怎麼分配？</p>
      <div className="dice-roll-row">
        🎲 {opener.dice.map((f, i) => (
          <span className="dice-face" key={i}>
            {f}
          </span>
        ))}
        <span>= {opener.pool} 點</span>
      </div>
      {anyRoom ? (
        <>
          <p className="allocation-pool-readout">
            剩餘可分配：<b>{remaining}</b> 點
          </p>
          <div className="allocation-rows">
            {abKeys.map((k) => {
              const spentHere = spent[k] || 0;
              const displayCur = previewAbilityLevel(S, k, spentHere, isGK);
              const overPotential = displayCur > S.pot[k];
              // 稽核修正(使用者實測回報)：光靠數字變金色暗示「這裡開始貴」
              // 對玩家來說不夠明確——花了9點、卻只看到數字漲一點點，會
              // 誤以為遊戲算錯了。改成直接把當下的成本倍率印出來，跟
              // flow/shared.js costPerLevel() 算的是同一個 overBy 公式，
              // 不用玩家自己去猜「貴多少」。
              // +1：跟 flow/shared.js costPerLevel() 的 overBy 算法對齊
              // (ability - pot + 1)，不然這裡顯示的倍率會跟實際判定差一階。
              const overMult = overPotential ? overPotentialMultiplier(displayCur - S.pot[k] + 1, isGK) : 1;
              const canAdd = remaining > 0 && displayCur < ABILITY_HARD_CAP;
              const canSub = spentHere > 0;
              return (
                <div className="allocation-row" key={k}>
                  <span className="allocation-label">{ABL[k]}</span>
                  <span className={`allocation-value${overPotential ? ' allocation-over-cap' : ''}`}>
                    {displayCur}
                    <span className="cell-unit">/{S.pot[k]}</span>
                  </span>
                  <div className="allocation-stepper">
                    <button className="stepper-btn" disabled={!canSub} onClick={() => adjust(k, -1)}>
                      −
                    </button>
                    <span className="allocation-spent">{spentHere > 0 ? `+${spentHere}` : '0'}</span>
                    <button className="stepper-btn" disabled={!canAdd} onClick={() => adjust(k, 1)}>
                      ＋
                    </button>
                  </div>
                  {overPotential && <span className="allocation-over-cap-tag">超過潛力・下一級要花 ×{overMult} 點才加1級</span>}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="frame-text">能力值全部已經到頂，這筆點數這季沒地方可以花。</p>
      )}
      <button className="primary-btn" disabled={anyRoom && remaining !== 0} onClick={() => onConfirm(spent)}>
        確認分配
      </button>
    </div>
  );
}
