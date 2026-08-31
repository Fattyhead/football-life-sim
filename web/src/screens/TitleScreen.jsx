import { useState } from 'react';
import { hasCareerSave } from '../saveStore.js';
import { useT } from '../i18n/localize.js';
import { useLocale } from '../i18n/LocaleContext.jsx';

function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

/* 稽核修正(使用者委託：繁中/簡中雙語，英文先不做)：語言切換鈕放在
   標題畫面——玩家最先看到、狀態最單純的畫面，不用擔心切換當下有正在
   跑的抉擇卡片被打斷。locale 本身是全域 Context(見 i18n/LocaleContext.jsx)，
   切了之後整個 App 樹都會重新用新語言渲染，不用特別處理「切換當下」
   還在玩的那一局——玩家隨時可以回標題畫面切換，遊戲進度(存檔)完全
   不受影響，語言只影響「怎麼印出來」。
   兩個按鈕本身的 label 故意不透過 t()——「繁體中文」/「简体中文」这
   两个字本身就是在告訴玩家「按下去會變成這個樣子」，简体那顆按鈕的
   label 本來就該長簡體字，不是引擎轉換出來的結果。 */
export default function TitleScreen({ onStart, onContinue, onCollection, onHelp }) {
  const [seed, setSeed] = useState(randomSeed());
  const t = useT();
  const { locale, setLocale } = useLocale();
  // 每次進標題畫面才查一次有沒有存檔——不用 state/effect 追蹤，這個畫面
  // 本身每次掛載都是「剛結束一局或剛開起網站」的乾淨起點，直接讀一次
  // localStorage 就夠了，不需要跟著存檔動態更新。
  const canContinue = hasCareerSave();

  return (
    <div className="app-shell">
      <div className="locale-switch-row">
        <button className={`locale-btn${locale === 'zh-Hant' ? ' active' : ''}`} onClick={() => setLocale('zh-Hant')}>
          繁體中文
        </button>
        <button className={`locale-btn${locale === 'zh-Hans' ? ' active' : ''}`} onClick={() => setLocale('zh-Hans')}>
          简体中文
        </button>
      </div>
      <h1 className="screen-title">{t('足球人生模擬器')}</h1>
      <div className="card">
        <p className="frame-text">
          {t('從青訓到掛靴，走一段完全屬於你的足球人生——同一顆種子，同一個命運；換一顆種子，換一段全新的旅程。')}
        </p>
        {canContinue && (
          <button className="primary-btn" style={{ marginBottom: 14, width: '100%' }} onClick={onContinue}>
            {t('繼續生涯')}
          </button>
        )}
        <div className="field-row">
          <label htmlFor="seed">{t('種子（想重現同一段人生，記下這串代碼）')}</label>
          <input id="seed" type="text" value={seed} onChange={(e) => setSeed(e.target.value)} />
        </div>
        <button className="primary-btn" onClick={() => onStart(seed || randomSeed())}>
          {t('開始新生涯')}
        </button>
        {canContinue && (
          <p className="ec-share-status" style={{ marginTop: 8 }}>
            {t('開新生涯會覆蓋掉現有的存檔進度。')}
          </p>
        )}
      </div>

      <div className="title-links-row">
        <button className="secondary-btn" onClick={onCollection}>
          {t('成就典藏')}
        </button>
        <button className="secondary-btn" onClick={onHelp}>
          {t('怎麼玩')}
        </button>
      </div>
    </div>
  );
}
