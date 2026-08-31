import { useRef, useState } from 'react';
import { buildLifetimeGallery } from '../engine.js';
import { loadCollection, exportCollectionBackup, importCollectionBackup } from '../collectionStore.js';
import { useT } from '../i18n/localize.js';

/* 分組邏輯跟 EndingScreen.jsx 的 TIER_GROUPS 一模一樣(這輪拆出去放這裡，
   兩邊各自留一份小常數，不為了共用四行程式碼特地拉一個共用檔案)。 */
const TIER_GROUPS = [
  { label: '普通・徽章', match: (t) => t === 'COMMON' },
  { label: '稀有・稱號', match: (t) => t === 'RARE' },
  { label: '精英・稱號', match: (t) => t === 'ELITE' },
  { label: '場外・稱號', match: (t) => t.startsWith('OFFPITCH') },
];

export default function CollectionScreen({ onBack }) {
  const [collection, setCollection] = useState(() => loadCollection());
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef(null);
  const t = useT();

  const gallery = buildLifetimeGallery(collection.badgeKeys, collection.honorLabels);
  const gotCount = gallery.filter((a) => a.reveal === 'obtained').length;

  function handleExport() {
    const json = exportCollectionBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '足球人生模擬器-成就典藏備份.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允許連續匯入同一個檔案兩次也會觸發 onChange
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const merged = importCollectionBackup(String(reader.result));
        setCollection(merged);
        setImportStatus(t('備份已匯入並合併進現有紀錄，不會覆蓋掉這段時間新拿到的成就。'));
      } catch {
        setImportStatus(t('這個檔案看起來不是足球人生模擬器的備份檔，匯入失敗——你原本的紀錄沒有受影響。'));
      }
    };
    reader.onerror = () => setImportStatus(t('讀取檔案失敗，匯入沒有生效。'));
    reader.readAsText(file);
  }

  return (
    <div className="app-shell">
      <h1 className="screen-title">{t('成就典藏')}</h1>
      <div className="card">
        <p className="frame-text" style={{ margin: 0 }}>
          {t('這裡累積的是你玩過的')}<b>{t('每一局')}</b>{t('生涯——不管換過幾次種子，拿到過的徽章/稱號都會留在這裡，不會因為開新生涯而重置。')}
        </p>
      </div>

      <div className="card">
        <p className="eyebrow">{t('生涯總覽')}</p>
        <div className="collection-stats-row">
          <div className="collection-stat">
            <div className="collection-stat-num">{collection.careersPlayed}</div>
            <div className="collection-stat-lbl">{t('玩過幾局')}</div>
          </div>
          <div className="collection-stat">
            <div className="collection-stat-num">{collection.bestLegendPercent.toFixed(1)}%</div>
            <div className="collection-stat-lbl">{t('最高傳奇度')}</div>
          </div>
          <div className="collection-stat">
            <div className="collection-stat-num">{t(collection.bestTier) || '—'}</div>
            <div className="collection-stat-lbl">{t('最高段位')}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow">
          {t('歷年解鎖')}（{gotCount} / {gallery.length}）
        </p>
        {TIER_GROUPS.map((group) => {
          const items = gallery.filter((a) => group.match(a.tier));
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

      <div className="card">
        <p className="eyebrow">{t('備份')}</p>
        <p className="frame-text" style={{ margin: '0 0 12px' }}>
          {t('這份紀錄只存在這台裝置的這個瀏覽器裡，沒有帳號、不會自動同步。想換裝置或怕不小心清掉，先匯出一份備份檔存好；之後隨時可以匯入合併回來，不會蓋掉這段時間新拿到的紀錄。')}
        </p>
        <div className="collection-backup-row">
          <button className="secondary-btn" onClick={handleExport}>
            {t('匯出備份')} ↓
          </button>
          <button className="secondary-btn" onClick={handleImportClick}>
            {t('匯入備份')} ↑
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />
        </div>
        {importStatus && <p className="ec-share-status">{importStatus}</p>}
      </div>

      <button className="primary-btn" onClick={onBack}>
        {t('回到標題')}
      </button>
    </div>
  );
}
