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

  // 稽核修正(使用者反饋：桌面版三欄佈局)：中段拆成三塊獨立的區塊——
  // .game-rail 放生涯軌跡(唯讀、只會愈積愈多，跟「這一季」無關)，
  // .game-content 放球員詳細資料+這一季的唯讀敘事(frameText/result)，
  // .game-panel 放真的需要玩家點擊的東西(季初分配/戀愛抉擇/訓練夥伴/
  // 經紀人/國家隊對手/引擎重大決定六選一)。mode 同一時間只會命中其中
  // 一個分支，.game-content 跟 .game-panel 不會同時有東西，這點跟改版
  // 前完全一樣——只是原本擠在同一條直排清單裡的內容，現在依照「讀」跟
  // 「操作」的性質分流到兩個容器，寬螢幕才能左右並排展示(見 index.css
  // .game-body 的 grid 版面)，窄螢幕則靠 CSS order 疊回原本的視覺順序。
  return (
    <div className="game-shell">
      <PlayerHeader S={S} />

      <div className="game-body">
        <div className="game-rail">
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

        <div className="game-content">
          <PlayerDetail S={S} />

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
        </div>

        <div className="game-panel">
          {mode === 'allocate' && <SeasonOpener S={S} opener={opener} onConfirm={onAllocationConfirm} />}

          {mode === 'loveChoice' && <LoveChoice S={S} pending={lovePending} onPick={onLoveChoicePick} />}

          {mode === 'trainingChoice' && <TrainingRivalry S={S} pending={trainingPending} onPick={onTrainingRivalryPick} />}

          {mode === 'agentChoice' && <AgentLine S={S} pending={agentPending} onPick={onAgentPick} />}

          {mode === 'rivalChoice' && <NationalRivalChoice S={S} onPick={onRivalChoicePick} />}

          {mode === 'seasonOffer' && <SeasonOffer pending={seasonOfferPending} onPick={onSeasonOfferPick} />}
        </div>
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
