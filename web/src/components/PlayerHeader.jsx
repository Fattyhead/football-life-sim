import { LV, playerName, stageLabel, calcOVR } from '../engine.js';
import { posLabel } from '../playerCardUtils.js';

/* 固定在畫面最上方、不隨內容捲動的球員識別條——對照原版畫面「上半部球員資料」
   那塊：背號/姓名/位置一列，年齡/年份/OVR/存款這種隨時該看到但不用細看的
   數字一列。真正要細看的能力值/生涯數據/稱號是「詳細訊息」，交給
   PlayerDetail.jsx 放在會捲動的中段內容區，這裡故意保持精簡，不放會
   讓這塊長高的東西。 */
export default function PlayerHeader({ S }) {
  const ovr = calcOVR(S);
  return (
    <div className="game-header">
      <div className="player-header-row">
        <strong>{playerName(S)}</strong>
        <span className="tier-badge">OVR {ovr}</span>
      </div>
      <div className="stat-strip">
        <span>
          <strong>{S.year}</strong>年
        </span>
        <span>
          <strong>{S.age}</strong>歲
        </span>
        {S.club && <span>{S.club}</span>}
        <span>
          {(S.tier ? LV[S.tier].label : stageLabel(S))} · {posLabel(S)}
        </span>
        {/* 金額一律加 € 符號(使用者定案)——S.wage/S.savings 本質還是
            data/contract.js 說明過的抽象指數，不是真的換算過的歐元金額，
            € 只是給數字一個貨幣感的視覺標記(足球本來就是歐元計價的
            世界)，不是宣稱這裡做了真實經濟量級的換算，之後不要誤會成
            要重新設計薪資/存款的量級。 */}
        {S.wage > 0 && <span>薪資指數 €{S.wage}</span>}
        <span>存款 €{S.savings.toFixed(0)}</span>
        {S.national.caps > 0 && <span>國家隊 {S.national.caps} 次</span>}
      </div>
    </div>
  );
}
