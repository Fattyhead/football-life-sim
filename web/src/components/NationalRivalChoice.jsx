/* 國家隊隱藏對手線的 CROSSROADS(個人表現/團隊優先)——只有真正的世界盃年
   且已經有對手時才會出現(App.jsx enterRivalChoice() 判斷，系統隨機決定
   這年會不會遇到，跟出軌誘惑同一種節奏)，跟 LoveChoice.jsx/
   TrainingRivalry.jsx 同一套卡片樣式跟 evaluate/resolve 兩階段架構，見
   flow/nationalRival.js 的稽核說明。這個抉擇本身沒有隱藏機率可以分桶
   提示(個人表現/團隊優先的效果是決定性的，不是骰出來的)，所以不像
   LoveChoice 那樣顯示一句氣氛提示——兩個選項的描述本身已經講清楚取捨。
   onPick(choiceKey)：choiceKey 要是 'compete' 或 'teamFocus'。 */
export default function NationalRivalChoice({ S, onPick }) {
  const rival = S.nationalRival;
  if (!rival) return null;

  return (
    <div className="card love-choice">
      <p className="eyebrow">人生的抉擇</p>
      <p className="frame-text">世界盃在即，備戰營裡，你跟{rival.name}都想證明自己——這次，要把這屆賽事當成個人的舞台，還是把心力放在整支球隊身上？</p>
      <div className="option-grid">
        <button className="option-btn" onClick={() => onPick('compete')}>
          <span className="opt-label">個人表現</span>
          <span className="opt-desc">全力證明自己，這屆世界盃的個人數據會明顯提升，但不會幫到球隊的晉級機率。</span>
        </button>
        <button className="option-btn" onClick={() => onPick('teamFocus')}>
          <span className="opt-label">團隊優先</span>
          <span className="opt-desc">把心力放在整支球隊的備戰上，明顯提升這屆的晉級機率，沒有個人數據的額外加成。</span>
        </button>
      </div>
    </div>
  );
}
