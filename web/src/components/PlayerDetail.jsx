import { useState } from 'react';
import { ABL, POS_AB } from '../engine.js';
import { careerTotals, partnerInfo, fidelityLabel, coachAttitudeLabel, speculationBuzzLabel, chemistryLabel } from '../playerCardUtils.js';

/* 「詳細訊息」——能力值/生涯數據/稱號，對照原版「只有點進細節才需要捲動」
   的設計，放在會捲動的中段內容區(不是固定頭部)，預設收合，不跟固定頭部
   搶版面。 */
export default function PlayerDetail({ S, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const abKeys = POS_AB[S.pos];
  const totals = careerTotals(S);

  return (
    <div className="card player-detail">
      <button className="player-detail-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="eyebrow" style={{ margin: 0 }}>
          球員詳細資料
        </span>
        <span className="toggle-caret">{open ? '收合 ▲' : '展開 ▼'}</span>
      </button>

      {open && (
        <div className="player-card-body">
          <p className="eyebrow">能力值</p>
          <div className="ability-grid">
            {abKeys.map((k) => {
              const cur = S.ab[k];
              const pot = S.pot[k];
              const pct = Math.max(0, Math.min(100, Math.round((cur / pot) * 100)));
              return (
                <div className="ability-row" key={k}>
                  <span className="ability-label">{ABL[k]}</span>
                  <div className="ability-bar-track">
                    <div className="ability-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="ability-value">
                    {cur}
                    <span className="ability-pot">/{pot}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <p className="eyebrow" style={{ marginTop: 14 }}>
            個人特質
          </p>
          <div className="fact-list">
            {S.club && (
              <div className="ability-row">
                <span className="ability-label">默契</span>
                <div className="ability-bar-track">
                  <div
                    className="ability-bar-fill"
                    style={{ width: `${Math.max(0, Math.min(100, S.squadChemistry || 0))}%` }}
                  />
                </div>
                <span className="ability-value" style={{ fontSize: 13 }}>
                  {chemistryLabel(S)}
                </span>
              </div>
            )}
            {S.club && <p className="frame-text fact-line">{coachAttitudeLabel(S)}</p>}
            <p className="frame-text fact-line">花心程度：{fidelityLabel(S)}</p>
            {partnerInfo(S) && <p className="frame-text fact-line">{partnerInfo(S)}</p>}
            <p className="frame-text fact-line">財經話題度：{speculationBuzzLabel(S)}</p>
          </div>

          {totals && (
            <>
              <p className="eyebrow" style={{ marginTop: 14 }}>
                生涯數據（{totals.seasons} 季）
              </p>
              <p className="frame-text" style={{ margin: 0 }}>
                {S.pos === 'GK'
                  ? `出賽 ${totals.APP} · 撲救 ${totals.SV} · 零封 ${totals.CS} · 失球 ${totals.GA} · 平均評分 ${totals.RAT}`
                  : `出賽 ${totals.APP} · 進球 ${totals.GLS} · 助攻 ${totals.AST} · 平均評分 ${totals.RAT}`}
              </p>
            </>
          )}

          <p className="eyebrow" style={{ marginTop: 14 }}>
            已獲得稱號
          </p>
          {S.honors.length > 0 ? (
            <div className="honor-chips">
              {S.honors.map((h, i) => (
                <span className="honor-chip" key={i}>
                  {h}
                </span>
              ))}
            </div>
          ) : (
            <p className="frame-text" style={{ margin: 0 }}>
              尚無稱號
            </p>
          )}
        </div>
      )}
    </div>
  );
}
