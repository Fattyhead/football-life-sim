import EndingCard from '../components/EndingCard.jsx';
import { useT } from '../i18n/localize.js';

/* 分組邏輯照抄 story.js 現有的 TIER_GROUPS(見那邊的稽核註解)，兩邊
   共用同一份 legacy.achievements 資料形狀，不重新設計一套分類。 */
const TIER_GROUPS = [
  { label: '普通・徽章', match: (tier) => tier === 'COMMON' },
  { label: '稀有・稱號', match: (tier) => tier === 'RARE' },
  { label: '精英・稱號', match: (tier) => tier === 'ELITE' },
  { label: '場外・稱號', match: (tier) => tier.startsWith('OFFPITCH') },
];

export default function EndingScreen({ S, legacy, seed, onRestart }) {
  const gotCount = legacy.achievements.filter((a) => a.reveal === 'obtained').length;
  // 稽核修正：守門員/後衛不靠進球助攻吃飯，這裡改依位置凸顯不同數字
  // (見 flow/legacy.js careerTotals 的稽核說明、story.js 同一處修正)。
  // 稽核修正(使用者委託：繁中/簡中雙語)：這裡原本把 legacy.careerTotals
  // 簡寫成區域變數 t，跟 useT() 的慣用命名撞了——改叫 ct(career totals)，
  // t 這個名字整個專案統一保留給翻譯函式，不要在單一檔案裡有兩種意思。
  const ct = legacy.careerTotals;
  const t = useT();
  const statLine =
    S.pos === 'GK'
      ? `撲救 ${ct.SV} 次・零封 ${ct.CS} 場・失球 ${ct.GA} 球`
      : `進球 ${ct.GLS}・助攻 ${ct.AST}・抢断 ${ct.TKL}・零封 ${ct.CS} 場`;

  return (
    <div className="app-shell">
      <h1 className="screen-title">{t('掛靴')}</h1>

      {/* 可分享的掛靴卡(見 web/src/components/EndingCard.jsx)——這輪新增，
          取代原本只有純文字摘要的呈現，玩家可以直接存成圖片分享出去。 */}
      <EndingCard S={S} legacy={legacy} seed={seed} />

      <div className="card">
        <p className="eyebrow">{t('生涯數據')}</p>
        <p className="frame-text" style={{ margin: '4px 0' }}>
          {t('出賽')} {ct.APP} {t('場')}・{t(statLine)}
        </p>
        <p className="frame-text" style={{ margin: '4px 0' }}>
          {t('生涯薪資總額')} €{legacy.careerWageTotal.toLocaleString()}　{t('存款')} €{legacy.savings.toLocaleString()}
        </p>
      </div>

      <div className="card">
        <p className="eyebrow">
          {t('生涯成就')}（{gotCount} / {legacy.achievements.length}）
        </p>
        {TIER_GROUPS.map((group) => {
          const items = legacy.achievements.filter((a) => group.match(a.tier));
          return (
            <div key={group.label} className="achv-group">
              <h4>{t(group.label)}</h4>
              {items.map((item, i) => (
                <p key={i} className={`achv-item ${item.reveal === 'obtained' ? 'obtained' : 'locked'}`}>
                  {item.reveal === 'obtained' ? '✓ ' : '· '}
                  {t(item.display)}
                </p>
              ))}
            </div>
          );
        })}
      </div>

      <button className="primary-btn" onClick={onRestart}>
        {t('開始新的人生')}
      </button>
    </div>
  );
}
