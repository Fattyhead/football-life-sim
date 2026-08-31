import { ABL, POSN, REGION, PATHS, describeOpening } from '../engine.js';
import { useT } from '../i18n/localize.js';

export default function GradeScreen({ S, grade, onContinue }) {
  const { flavorLine, abilityHintTemplate } = describeOpening(grade);
  const abilityHint = abilityHintTemplate.replace('{ability}', ABL[grade.topAbility]);
  const t = useT();

  return (
    <div className="app-shell">
      <h1 className="screen-title">{t('開局評價')}</h1>
      <div className="card">
        <p className="eyebrow">
          {t(REGION[S.region].name)} · {t(POSN[S.pos])} · {t(PATHS[S.path].label)}
        </p>
        <p className="frame-text">{t(flavorLine)}</p>
        <p className="frame-text" style={{ marginTop: 8 }}>
          {t(abilityHint)}
        </p>
      </div>
      <button className="primary-btn" onClick={onContinue}>
        {t('開始青訓')}
      </button>
    </div>
  );
}
