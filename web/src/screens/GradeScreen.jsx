import { ABL, POSN, REGION, PATHS, describeOpening } from '../engine.js';

export default function GradeScreen({ S, grade, onContinue }) {
  const { flavorLine, abilityHintTemplate } = describeOpening(grade);
  const abilityHint = abilityHintTemplate.replace('{ability}', ABL[grade.topAbility]);

  return (
    <div className="app-shell">
      <h1 className="screen-title">開局評價</h1>
      <div className="card">
        <p className="eyebrow">
          {REGION[S.region].name} · {POSN[S.pos]} · {PATHS[S.path].label}
        </p>
        <p className="frame-text">{flavorLine}</p>
        <p className="frame-text" style={{ marginTop: 8 }}>
          {abilityHint}
        </p>
      </div>
      <button className="primary-btn" onClick={onContinue}>
        開始青訓
      </button>
    </div>
  );
}
