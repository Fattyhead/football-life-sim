import { useState } from 'react';
import { LV, POSN, REGION, clubPrestigeOf, playerName } from '../engine.js';
import { renderEndingCardImage } from '../shareCardImage.js';

/* 可分享的掛靴卡——直接照抄這個 session 稍早定案的「掛靴卡」概念稿版面
   (見專案記憶 2026-08-26 那份 artifact：hero/身分/敘事/數據/生涯軌跡/
   稱號/成就格子/分享列七段)，差別是這裡吃的是真正結算出來的 S/legacy，
   不是手寫的範例種子。

   generateJourney：flow/legacy.js 回傳的 legacy.clubJourney 是依時間順序
   的 { tier, club } 清單(見 core/state.js 的稽核說明)，這裡只負責決定
   每一步要不要標成「豪門」(elite 樣式，金色發光點)——豪門判定用
   clubPrestigeOf(club)==='ELITE'，跟 flow/transfer.js 豪門挖角判定同一個
   函式，不重新發明一套。 */
function buildGalleryCells(achievements) {
  return achievements.map((a) => {
    if (a.reveal === 'obtained') return 'obtained';
    if (a.tier === 'RARE' || a.tier === 'OFFPITCH_RARE') return 'hint';
    if (a.tier === 'ELITE' || a.tier === 'OFFPITCH_ELITE') return 'locked';
    return 'dim';
  });
}

export default function EndingCard({ S, legacy, seed }) {
  const [shareStatus, setShareStatus] = useState('');

  const posText = S.pos === 'GK' ? POSN.GK : POSN[S.pos];
  const cells = buildGalleryCells(legacy.achievements);
  const obtainedCount = cells.filter((c) => c === 'obtained').length;

  async function handleSaveImage() {
    setShareStatus('產生圖片中…');
    try {
      const dataUrl = await renderEndingCardImage({
        S,
        legacy,
        seed,
        posText,
        regionName: REGION[S.region].name,
        nameText: playerName(S),
        cells,
        obtainedCount,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${playerName(S)}-掛靴卡.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setShareStatus('圖片已下載，可以直接分享出去了。');
    } catch (e) {
      setShareStatus('圖片產生失敗，你的瀏覽器可能不支援——可以改用截圖分享這張卡片。');
    }
  }

  return (
    <div className="ec-card">
      <div className="ec-hero">
        <div className="ec-glow" />
        <span className="ec-tier-pill">★ {legacy.tier.toUpperCase()}</span>
        <h1 className="ec-tier-name">{legacy.tier}</h1>
        <p className="ec-tier-desc">{legacy.tierDesc}</p>
        <div className="ec-score-row">
          <span className="ec-score-num">{legacy.legendPercent.toFixed(1)}%</span>
          <span className="ec-score-lbl">傳奇度</span>
        </div>
      </div>

      <div className="ec-identity">
        <div className="ec-crest">{S.pos}</div>
        <div className="ec-who">
          <div className="ec-name">{playerName(S)}</div>
          <div className="ec-sub">
            出身{REGION[S.region].name} · {posText} · {S.age} 歲掛靴
          </div>
        </div>
      </div>

      <div className="ec-narrative">
        <span className="ec-quote">"</span>
        {legacy.summary}
      </div>

      <div className="ec-stats">
        <div className="ec-stat">
          <div className="ec-num">{legacy.careerTotals.APP}</div>
          <div className="ec-lbl">出賽場次</div>
        </div>
        <div className="ec-stat">
          <div className="ec-num">{legacy.clubCount}</div>
          <div className="ec-lbl">待過的球隊</div>
        </div>
        <div className="ec-stat">
          <div className="ec-num">{S.national.caps}</div>
          <div className="ec-lbl">國家隊出賽</div>
        </div>
      </div>

      {legacy.clubJourney?.length > 0 && (
        <div className="ec-journey">
          <div className="ec-section-h">生涯軌跡</div>
          <div className="ec-journey-track">
            {legacy.clubJourney.map((step, i) => {
              const elite = clubPrestigeOf(step.club) === 'ELITE';
              return (
                <div key={i} style={{ display: 'contents' }}>
                  {i > 0 && <div className="ec-journey-line" />}
                  <div className={`ec-journey-step${elite ? ' elite' : ''}`}>
                    <div className="ec-dot" />
                    <div className="ec-lv">{LV[step.tier]?.label || step.tier}</div>
                    <div className="ec-club">{step.club}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {S.honors.length > 0 && (
        <div className="ec-honors">
          <div className="ec-section-h">生涯稱號</div>
          <div className="ec-honor-chips">
            {S.honors.map((h, i) => (
              <span className="ec-honor-chip" key={i}>
                {h}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="ec-gallery">
        <div className="ec-h-row">
          <span className="ec-section-h" style={{ margin: 0 }}>
            生涯成就
          </span>
          <span className="ec-count">
            {obtainedCount} / {cells.length}
          </span>
        </div>
        <div className="ec-gallery-grid">
          {cells.map((c, i) => (
            <div key={i} className={`ec-gallery-cell ${c === 'dim' ? '' : c}`} />
          ))}
        </div>
        {cells.length - obtainedCount > 0 && <p className="ec-tip">亮起的是你拿到的，還有 {cells.length - obtainedCount} 個等你下一輪解鎖</p>}
      </div>

      <div className="ec-share-footer">
        <span className="ec-seed">
          種子 <b>{seed || '—'}</b>
        </span>
        <button className="ec-share-btn" onClick={handleSaveImage}>
          儲存圖片分享 ↓
        </button>
      </div>
      {shareStatus && <p className="ec-share-status">{shareStatus}</p>}
    </div>
  );
}
