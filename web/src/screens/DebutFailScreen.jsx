import { useT } from '../i18n/localize.js';

export default function DebutFailScreen({ onRestart }) {
  const t = useT();
  return (
    <div className="app-shell">
      <h1 className="screen-title">{t('完')}</h1>
      <div className="card">
        <p className="narrate-line">{t('三年青訓過去，俱樂部沒有跟你續約的打算。你的職業球員夢，還沒開始就結束了。')}</p>
      </div>
      <button className="primary-btn" onClick={onRestart}>
        {t('再試一次')}
      </button>
    </div>
  );
}
