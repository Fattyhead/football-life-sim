import ChoiceMenu from '../components/ChoiceMenu.jsx';
import PlayerHeader from '../components/PlayerHeader.jsx';
import PlayerDetail from '../components/PlayerDetail.jsx';
import SeasonOpener from '../components/SeasonOpener.jsx';
import LoveChoice from '../components/LoveChoice.jsx';
import TrainingRivalry from '../components/TrainingRivalry.jsx';
import { YOUTH_TRAINING_OPTION, YOUTH_OPPORTUNITY_OPTION, YOUTH_SOCIAL_OPTION } from '../engine.js';
import { tierAccentKey } from '../playerCardUtils.js';
import { useResetScrollOnMode } from '../useResetScrollOnMode.js';

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
  // 同一套左中右分流(見 ProScreen.jsx 對應那段稽核說明)：青訓沒有職業版
  // 那種逐季累積的生涯軌跡清單，左欄改放「青訓三年」進度小清單——反正
  // 桌面版空著也是浪費，這份資料(yearIndex)本來就有，順手給個位置。
  const youthSteps = [1, 2, 3];
  // 稽核修正(使用者反饋：季初特訓卡片不會自動回到面板頂部)：見
  // useResetScrollOnMode.js 的稽核說明，跟 ProScreen.jsx 同一套。
  const { bodyRef, contentRef, panelRef } = useResetScrollOnMode(mode);
  return (
    <div className="game-shell" data-tier={tierAccentKey(S)}>
      <PlayerHeader S={S} />

      <div className="game-body" ref={bodyRef}>
        <div className="game-rail">
          <div className="card youth-progress-card">
            <p className="eyebrow">青訓進度</p>
            {youthSteps.map((y) => (
              <p key={y} className={`youth-step${y === yearIndex ? ' current' : ''}${y < yearIndex ? ' done' : ''}`}>
                {y < yearIndex ? '✓' : y === yearIndex ? '●' : '○'}　青訓第 {y} 年
              </p>
            ))}
          </div>
        </div>

        <div className="game-content" ref={contentRef}>
          <h1 className="screen-title" style={{ fontSize: 'clamp(22px, 5vw, 30px)' }}>
            青訓第 {yearIndex} 年
          </h1>
          <PlayerDetail S={S} />

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

        <div className="game-panel" ref={panelRef}>
          {mode === 'allocate' && <SeasonOpener S={S} opener={opener} onConfirm={onAllocationConfirm} />}

          {mode === 'loveChoice' && <LoveChoice S={S} pending={lovePending} onPick={onLoveChoicePick} />}

          {mode === 'trainingChoice' && <TrainingRivalry S={S} pending={trainingPending} onPick={onTrainingRivalryPick} />}
        </div>
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
