import { computeRivalryRiskFlavor } from '../engine.js';

/* 訓練夥伴/對手線的兩個玩家抉擇，跟 LoveChoice.jsx 同一套卡片樣式、
   同一種 evaluate/resolve 兩階段架構，用 pending.type 分派：
     ENCOUNTER  — 年度自動觸發的「認識新對手/夥伴」，不看這季選了什麼
                  類別(App.jsx enterTrainingEncounter() 判斷)，玩家選
                  接受或不予理會，接受才會真的指派。
     CROSSROADS — 已經有夥伴時的「較勁/合作」，只有這季真的選了訓練
                  類別才會評估(App.jsx handleProPick/handleYouthPick 裡
                  的 CROSSROADS 檢查判斷)——使用者定案：起點自動、但
                  要持續投入訓練這條線才會繼續走下去。
   兩者都沒有隱藏機率可以分桶提示(決定性的，不是骰出來的)，
   computeRivalryRiskFlavor 只用在 CROSSROADS，依對手類型給氣氛提示。
   onPick(choiceKey)：ENCOUNTER 要是 'accept'/'ignore'，CROSSROADS 要是
   'compete'/'cooperate'。 */
export default function TrainingRivalry({ S, pending, onPick }) {
  if (!pending) return null;

  if (pending.type === 'ENCOUNTER') {
    const c = pending.candidate;
    const label = c.type === 'RIVAL' ? '一個看起來很想較量的人' : '一個主動搭話的人';
    return (
      <div className="card love-choice">
        <p className="eyebrow">人生的抉擇</p>
        <p className="frame-text">
          訓練場上，{label}——{c.title}・{c.name}走了過來
          {c.type === 'RIVAL' ? '，話裡話外都是挑釁的意思。' : '，看起來想跟你熟識一下。'}你要接受，還是不予理會？
        </p>
        <div className="option-grid">
          <button className="option-btn" onClick={() => onPick('accept')}>
            <span className="opt-label">接受</span>
            <span className="opt-desc">正式認識這個人，之後訓練場上會有更多互動。</span>
          </button>
          <button className="option-btn" onClick={() => onPick('ignore')}>
            <span className="opt-label">不予理會</span>
            <span className="opt-desc">這次算了，沒有任何代價，之後還可能遇到類似的機會。</span>
          </button>
        </div>
      </div>
    );
  }

  const partner = S.trainingPartner;
  if (!partner) return null;
  const partnerLabel = partner.type === 'RIVAL' ? '對手' : '訓練夥伴';
  const riskFlavor = computeRivalryRiskFlavor(S);

  return (
    <div className="card love-choice">
      <p className="eyebrow">人生的抉擇</p>
      <p className="frame-text">
        訓練場上，{partnerLabel}{partner.title}・{partner.name}朝你走了過來——這次，要拚出個高下，還是互相拉一把？
      </p>
      {riskFlavor && <p className="streak-flavor">{riskFlavor}</p>}
      <div className="option-grid">
        <button className="option-btn" onClick={() => onPick('compete')}>
          <span className="opt-label">較勁</span>
          <span className="opt-desc">正面對決，個人能力立即成長，但隊伍氣氛會跟著繃緊一點。</span>
        </button>
        <button className="option-btn" onClick={() => onPick('cooperate')}>
          <span className="opt-label">合作</span>
          <span className="opt-desc">互相扶持，隊伍核心力明顯提升，沒有個人能力的立即效果。</span>
        </button>
      </div>
    </div>
  );
}
