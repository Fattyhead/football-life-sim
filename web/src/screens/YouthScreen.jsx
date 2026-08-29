import ChoiceMenu from '../components/ChoiceMenu.jsx';
import PlayerHeader from '../components/PlayerHeader.jsx';
import PlayerDetail from '../components/PlayerDetail.jsx';
import SeasonOpener from '../components/SeasonOpener.jsx';
import LoveChoice from '../components/LoveChoice.jsx';
import TrainingRivalry from '../components/TrainingRivalry.jsx';
import { YOUTH_TRAINING_OPTION, YOUTH_OPPORTUNITY_OPTION, YOUTH_SOCIAL_OPTION } from '../engine.js';

const categories = {
  TRAINING: { table: YOUTH_TRAINING_OPTION, keys: Object.keys(YOUTH_TRAINING_OPTION) },
  OPPORTUNITY: { table: YOUTH_OPPORTUNITY_OPTION, keys: Object.keys(YOUTH_OPPORTUNITY_OPTION) },
  SOCIAL: { table: YOUTH_SOCIAL_OPTION, keys: Object.keys(YOUTH_SOCIAL_OPTION) },
};

export default function YouthScreen({
  S,
  yearIndex,
  mode,
  opener,
  lovePending,
  trainingPending,
  lastLine,
  risk,
  onAllocationConfirm,
  onLoveChoicePick,
  onTrainingRivalryPick,
  onPick,
  onContinue,
}) {
  return (
    <div className="game-shell">
      <PlayerHeader S={S} />

      <div className="game-content">
        <h1 className="screen-title" style={{ fontSize: 'clamp(22px, 5vw, 30px)' }}>
          青訓第 {yearIndex} 年
        </h1>
        <PlayerDetail S={S} />

        {mode === 'allocate' && <SeasonOpener S={S} opener={opener} onConfirm={onAllocationConfirm} />}

        {mode === 'loveChoice' && <LoveChoice S={S} pending={lovePending} onPick={onLoveChoicePick} />}

        {mode === 'trainingChoice' && <TrainingRivalry S={S} pending={trainingPending} onPick={onTrainingRivalryPick} />}

        {mode === 'result' && (
          <div className="card">
            {risk.riskTag && (
              <span className={`risk-result-tag ${risk.riskTag.success ? 'success' : 'fail'}`}>
                {risk.riskTag.label}・{risk.riskTag.success ? '成功' : '失手'}（{risk.riskTag.pct}%）
              </span>
            )}
            {lastLine.map((l, i) => (
              <p key={i} className="narrate-line">
                {l}
              </p>
            ))}
            {risk.riskFlavor && <p className="streak-flavor">{risk.riskFlavor}</p>}
            {risk.titlesUnlocked.length > 0 && (
              <div className="title-unlock-banner">🏅 新稱號解鎖：{risk.titlesUnlocked.join('、')}</div>
            )}
          </div>
        )}
      </div>

      <div className="game-footer">
        {mode === 'choice' && <ChoiceMenu S={S} categories={categories} onPick={onPick} />}
        {mode === 'result' && (
          <button className="primary-btn" onClick={onContinue}>
            {yearIndex < 3 ? '繼續' : '準備轉正式'}
          </button>
        )}
      </div>
    </div>
  );
}
