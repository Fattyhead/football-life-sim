import EndingCard from '../components/EndingCard.jsx';

/* 分組邏輯照抄 story.js 現有的 TIER_GROUPS(見那邊的稽核註解)，兩邊
   共用同一份 legacy.achievements 資料形狀，不重新設計一套分類。 */
const TIER_GROUPS = [
  { label: '普通・徽章', match: (t) => t === 'COMMON' },
  { label: '稀有・稱號', match: (t) => t === 'RARE' },
  { label: '精英・稱號', match: (t) => t === 'ELITE' },
  { label: '場外・稱號', match: (t) => t.startsWith('OFFPITCH') },
];

export default function EndingScreen({ S, legacy, seed, onRestart }) {
  const gotCount = legacy.achievements.filter((a) => a.reveal === 'obtained').length;
  // 稽核修正：守門員/後衛不靠進球助攻吃飯，這裡改依位置凸顯不同數字
  // (見 flow/legacy.js careerTotals 的稽核說明、story.js 同一處修正)。
  const t = legacy.careerTotals;
  const statLine =
    S.pos === 'GK'
      ? `撲救 ${t.SV} 次・零封 ${t.CS} 場・失球 ${t.GA} 球`
      : `進球 ${t.GLS}・助攻 ${t.AST}・抢断 ${t.TKL}・零封 ${t.CS} 場`;

  return (
    <div className="app-shell">
      <h1 className="screen-title">掛靴</h1>

      {/* 可分享的掛靴卡(見 web/src/components/EndingCard.jsx)——這輪新增，
          取代原本只有純文字摘要的呈現，玩家可以直接存成圖片分享出去。 */}
      <EndingCard S={S} legacy={legacy} seed={seed} />

      <div className="card">
        <p className="eyebrow">生涯數據</p>
        <p className="frame-text" style={{ margin: '4px 0' }}>
          出賽 {t.APP} 場・{statLine}
        </p>
        <p className="frame-text" style={{ margin: '4px 0' }}>
          生涯薪資總額 €{legacy.careerWageTotal.toLocaleString()}　存款 €{legacy.savings.toLocaleString()}
        </p>
      </div>

      <div className="card">
        <p className="eyebrow">
          生涯成就（{gotCount} / {legacy.achievements.length}）
        </p>
        {TIER_GROUPS.map((group) => {
          const items = legacy.achievements.filter((a) => group.match(a.tier));
          return (
            <div key={group.label} className="achv-group">
              <h4>{group.label}</h4>
              {items.map((item, i) => (
                <p key={i} className={`achv-item ${item.reveal === 'obtained' ? 'obtained' : 'locked'}`}>
                  {item.reveal === 'obtained' ? '✓ ' : '· '}
                  {item.display}
                </p>
              ))}
            </div>
          );
        })}
      </div>

      <button className="primary-btn" onClick={onRestart}>
        開始新的人生
      </button>
    </div>
  );
}
