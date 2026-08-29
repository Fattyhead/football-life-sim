/* 經紀人線的兩個玩家抉擇，完全比照 TrainingRivalry.jsx 同一套卡片樣式、
   同一種 evaluate/resolve 兩階段架構，用 pending.type 分派：
     ENCOUNTER  — 年度自動觸發的「認識新經紀人」，不看這季選了什麼類別
                  (App.jsx enterAgentChoice() 判斷)，玩家選接受或婉拒，
                  接受才會真的簽下。PRO-only，青訓畫面不會用到這個元件。
     CROSSROADS — 已經有經紀人時的「大膽操作/穩紮穩打」，只有這季真的
                  選了機會類別才會評估(App.jsx handleProPick 裡的
                  CROSSROADS 檢查判斷)。
   兩者都沒有隱藏機率可以分桶提示(決定性的，不是骰出來的)。
   onPick(choiceKey)：ENCOUNTER 要是 'accept'/'ignore'，CROSSROADS 要是
   'bold'/'steady'。 */
export default function AgentLine({ S, pending, onPick }) {
  if (!pending) return null;

  if (pending.type === 'ENCOUNTER') {
    const c = pending.candidate;
    return (
      <div className="card love-choice">
        <p className="eyebrow">人生的抉擇</p>
        <p className="frame-text">
          一位經紀人主動聯繫你——{c.title}・{c.name}，他看好你的潛力，想成為你的代理人。你要接受，還是婉拒？
        </p>
        <div className="option-grid">
          <button className="option-btn" onClick={() => onPick('accept')}>
            <span className="opt-label">接受</span>
            <span className="opt-desc">簽下這位經紀人，之後生涯的談判/交易會有更多互動。</span>
          </button>
          <button className="option-btn" onClick={() => onPick('ignore')}>
            <span className="opt-label">婉拒</span>
            <span className="opt-desc">這次算了，沒有任何代價，之後還可能遇到類似的機會。</span>
          </button>
        </div>
      </div>
    );
  }

  const agent = S.agent;
  if (!agent) return null;

  return (
    <div className="card love-choice">
      <p className="eyebrow">人生的抉擇</p>
      <p className="frame-text">
        經紀人{agent.title}・{agent.name}捎來消息：有一筆更大膽的操作可以談，也可以照原本的節奏穩紮穩打——你怎麼決定？
      </p>
      <div className="option-grid">
        <button className="option-btn" onClick={() => onPick('bold')}>
          <span className="opt-label">大膽操作</span>
          <span className="opt-desc">轉會買氣立即拉高，但跟俱樂部的關係會跟著繃緊一點。</span>
        </button>
        <button className="option-btn" onClick={() => onPick('steady')}>
          <span className="opt-label">穩紮穩打</span>
          <span className="opt-desc">薪資溢價與合約風險折扣都往上疊，沒有額外曝光度。</span>
        </button>
      </div>
    </div>
  );
}
