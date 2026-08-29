import { computeProposeRiskFlavor, computeAffairRiskFlavor } from '../engine.js';

/* 求婚／出軌誘惑／狗仔自動觸發——戀愛常駐事件(見 flow/romance.js)裡
   真正的玩家抉擇，只有這季剛好命中才會出現(App.jsx enterLoveChoice()
   判斷)，跟季初特訓(SeasonOpener.jsx)一樣自成一張卡片、自帶按鈕，不走
   ChoiceMenu 那套類別→子選項的兩三步驟(這不是年度選項，是引擎主動丟
   出來的抉擇，跟 flow/transfer.js evaluateContractCrisis 同一種
   evaluate/resolve 兩階段架構)。
   pending: { type: 'PAPARAZZI'|'PROPOSE'|'AFFAIR', options, recommend,
   partner?, rejectChance?, discoverChance? }(prepareLoveChoice 回傳的
   那個)——PAPARAZZI 是使用者定案補上的新分支：單身/離婚狀態下不用選
   社交就可能自動觸發，只會遇到基本款對象(髮小/網紅)，玩家選承認(開始
   交往)或否認(這次算了)，沒有隱藏機率可以分桶提示(決定性的，不是
   骰出來的)，所以不像 PROPOSE/AFFAIR 那樣顯示氣氛提示句。rejectChance/
   discoverChance 是內部機率原始值，只拿去餵 computeProposeRiskFlavor/
   computeAffairRiskFlavor 分桶挑氣氛文字，畫面上不會直接印出數字(呼應
   風險層以外的戀愛系統整體「隱晦、不精算」的調性)。
   onPick(choiceKey)：choiceKey 要是 pending.options 裡開放的那個字串
   ('admit'/'deny'、'propose'/'wait' 或 'accept'/'decline')。 */
export default function LoveChoice({ S, pending, onPick }) {
  const partnerName = S.love.partner?.name || '對方';
  const partnerTitle = S.love.partner?.title || '';

  if (pending.type === 'PAPARAZZI') {
    return (
      <div className="card love-choice">
        <p className="eyebrow">人生的抉擇</p>
        <p className="frame-text">
          狗仔拍到你跟{pending.partner.name}
          {pending.partner.title ? `（${pending.partner.title}）` : ''}一起出遊的照片，追著問你要不要承認——這段關係，你想公開嗎？
        </p>
        <div className="option-grid">
          <button className="option-btn" onClick={() => onPick('admit')}>
            <span className="opt-label">承認</span>
            <span className="opt-desc">大方承認，你們正式開始交往。</span>
          </button>
          <button className="option-btn" onClick={() => onPick('deny')}>
            <span className="opt-label">否認</span>
            <span className="opt-desc">這次先算了，沒有任何代價，之後還可能遇到類似的機會。</span>
          </button>
        </div>
      </div>
    );
  }

  if (pending.type === 'PROPOSE') {
    const riskFlavor = computeProposeRiskFlavor(pending.rejectChance);
    return (
      <div className="card love-choice">
        <p className="eyebrow">人生的抉擇</p>
        <p className="frame-text">
          你看著身邊的{partnerName}
          {partnerTitle ? `（${partnerTitle}）` : ''}，忽然很確定——是不是該把這件事說出口了？
        </p>
        {riskFlavor && <p className="streak-flavor">{riskFlavor}</p>}
        <div className="option-grid">
          <button className="option-btn" onClick={() => onPick('propose')}>
            <span className="opt-label">求婚</span>
            <span className="opt-desc">說出口，但不是每次都會如你所願——對方也有可能拒絕。</span>
          </button>
          <button className="option-btn" onClick={() => onPick('wait')}>
            <span className="opt-label">再等等</span>
            <span className="opt-desc">關係繼續，但拖越久，這段感情因為遲遲沒有進展而分手的風險越高。</span>
          </button>
        </div>
      </div>
    );
  }

  const riskFlavor = computeAffairRiskFlavor(pending.discoverChance);
  return (
    <div className="card love-choice">
      <p className="eyebrow">人生的抉擇</p>
      <p className="frame-text">聚會上，有人若有似無地靠近，遞來一個心照不宣的眼神——這一步，要不要跨過去？</p>
      {riskFlavor && <p className="streak-flavor">{riskFlavor}</p>}
      <div className="option-grid">
        <button className="option-btn" onClick={() => onPick('accept')}>
          <span className="opt-label">接受</span>
          <span className="opt-desc">有機會藏得住，但也有可能被抓包，付出的代價會重得多。</span>
        </button>
        <button className="option-btn" onClick={() => onPick('decline')}>
          <span className="opt-label">拒絕</span>
          <span className="opt-desc">安全，不留下任何痕跡。</span>
        </button>
      </div>
    </div>
  );
}
