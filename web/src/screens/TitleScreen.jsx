import { useState } from 'react';
import { hasCareerSave } from '../saveStore.js';

function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

export default function TitleScreen({ onStart, onContinue, onCollection, onHelp }) {
  const [seed, setSeed] = useState(randomSeed());
  // 每次進標題畫面才查一次有沒有存檔——不用 state/effect 追蹤，這個畫面
  // 本身每次掛載都是「剛結束一局或剛開起網站」的乾淨起點，直接讀一次
  // localStorage 就夠了，不需要跟著存檔動態更新。
  const canContinue = hasCareerSave();

  return (
    <div className="app-shell">
      <h1 className="screen-title">足球人生模擬器</h1>
      <div className="card">
        <p className="frame-text">
          從青訓到掛靴，走一段完全屬於你的足球人生——同一顆種子，同一個命運；換一顆種子，換一段全新的旅程。
        </p>
        {canContinue && (
          <button className="primary-btn" style={{ marginBottom: 14, width: '100%' }} onClick={onContinue}>
            繼續生涯
          </button>
        )}
        <div className="field-row">
          <label htmlFor="seed">種子（想重現同一段人生，記下這串代碼）</label>
          <input id="seed" type="text" value={seed} onChange={(e) => setSeed(e.target.value)} />
        </div>
        <button className="primary-btn" onClick={() => onStart(seed || randomSeed())}>
          開始新生涯
        </button>
        {canContinue && (
          <p className="ec-share-status" style={{ marginTop: 8 }}>
            開新生涯會覆蓋掉現有的存檔進度。
          </p>
        )}
      </div>

      <div className="title-links-row">
        <button className="secondary-btn" onClick={onCollection}>
          成就典藏
        </button>
        <button className="secondary-btn" onClick={onHelp}>
          怎麼玩
        </button>
      </div>
    </div>
  );
}
