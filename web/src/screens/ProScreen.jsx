import ChoiceMenu from '../components/ChoiceMenu.jsx';
import PlayerHeader from '../components/PlayerHeader.jsx';
import PlayerDetail from '../components/PlayerDetail.jsx';
import SeasonOpener from '../components/SeasonOpener.jsx';
import LoveChoice from '../components/LoveChoice.jsx';
import TrainingRivalry from '../components/TrainingRivalry.jsx';
import AgentLine from '../components/AgentLine.jsx';
import NationalRivalChoice from '../components/NationalRivalChoice.jsx';
import SeasonOffer from '../components/SeasonOffer.jsx';
import { TRAINING_OPTION, OPPORTUNITY_OPTION, SOCIAL_OPTION } from '../engine.js';

function seasonStatLine(S, stat) {
  return S.pos === 'GK'
    ? `本季　出賽 ${stat.APP} · 撲救 ${stat.SV} · 零封 ${stat.CS} · 失球 ${stat.GA} · 評分 ${stat.RAT}`
    : `本季　出賽 ${stat.APP} · 進球 ${stat.GLS} · 助攻 ${stat.AST} · 評分 ${stat.RAT}`;
}

export default function ProScreen({
  S,
  options,
  frameText,
  mode,
  opener,
  lovePending,
  trainingPending,
  agentPending,
  seasonOfferPending,
  lastLine,
  lastStat,
  risk,
  history,
  onAllocationConfirm,
  onLoveChoicePick,
  onTrainingRivalryPick,
  onAgentPick,
  onRivalChoicePick,
  onSeasonOfferPick,
  onPick,
  onContinue,
}) {
  const categories = {
    TRAINING: { table: TRAINING_OPTION, keys: options.TRAINING },
    OPPORTUNITY: { table: OPPORTUNITY_OPTION, keys: options.OPPORTUNITY },
    SOCIAL: { table: SOCIAL_OPTION, keys: options.SOCIAL },
  };

  return (
    <div className="game-shell">
      <PlayerHeader S={S} />

      <div className="game-content">
        <PlayerDetail S={S} />

        {mode === 'allocate' && <SeasonOpener S={S} opener={opener} onConfirm={onAllocationConfirm} />}

        {mode === 'loveChoice' && <LoveChoice S={S} pending={lovePending} onPick={onLoveChoicePick} />}

        {mode === 'trainingChoice' && <TrainingRivalry S={S} pending={trainingPending} onPick={onTrainingRivalryPick} />}

        {mode === 'agentChoice' && <AgentLine S={S} pending={agentPending} onPick={onAgentPick} />}

        {mode === 'rivalChoice' && <NationalRivalChoice S={S} onPick={onRivalChoicePick} />}

        {mode === 'seasonOffer' && <SeasonOffer pending={seasonOfferPending} onPick={onSeasonOfferPick} />}

        {mode === 'choice' && (
          <div className="card">
            <p className="frame-text" style={{ margin: 0 }}>
              {frameText}
            </p>
          </div>
        )}

        {mode === 'result' && (
          <div className="card">
            {lastStat && <p className="season-stat-line">{seasonStatLine(S, lastStat)}</p>}
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
            {risk.categoryFlavor && <p className="streak-flavor">{risk.categoryFlavor}</p>}
            {risk.investFlavor && <p className="streak-flavor">{risk.investFlavor}</p>}
            {risk.titlesUnlocked.length > 0 && (
              <div className="title-unlock-banner">🏅 新稱號解鎖：{risk.titlesUnlocked.join('、')}</div>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="card log-scroll">
            <p className="eyebrow">生涯軌跡</p>
            {history
              .slice()
              .reverse()
              .map((h, i) => (
                <p key={i} className="frame-text" style={{ margin: '6px 0' }}>
                  {h.year}年（{h.age}歲）{h.lines.join('　')}
                </p>
              ))}
          </div>
        )}
      </div>

      <div className="game-footer">
        {mode === 'choice' && <ChoiceMenu S={S} categories={categories} onPick={onPick} />}
        {mode === 'result' && (
          <button className="primary-btn" onClick={onContinue}>
            繼續
          </button>
        )}
      </div>
    </div>
  );
}
