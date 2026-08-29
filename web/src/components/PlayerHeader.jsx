import { LV, playerName, stageLabel, calcOVR } from '../engine.js';
import { posLabel, formatMoney } from '../playerCardUtils.js';

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
          {/* 聯賽層級標籤跟著 .game-shell[data-tier] 那組 accent 走(見
              index.css 的稽核說明)，這裡直接吃 CSS 變數繼承，不用另外
              判斷——.game-shell 上的 data-tier 屬性哪裡設就從哪裡生效。 */}
          <span className="league-label">{S.tier ? LV[S.tier].label : stageLabel(S)}</span> · {posLabel(S)}
        </span>
        {/* 金額一律加 € 符號——S.wage/S.savings 這輪貨幣重新校準之後已經是
            真的歐元年薪/存款量級(見 data/contract.js WAGE_BASE 的稽核
            說明)，不是抽象指數了(這則稽核先前的版本講法已經過時，這裡
            順手訂正)。頭部這條固定窄條用縮寫顯示(formatMoney)，六七位數
            擠在一起會很難一眼看出大小；終局結算那些要看精確數字的地方
            維持完整千分位數字，兩者是不同的閱讀情境，見
            playerCardUtils.js formatMoney 的稽核說明。 */}
        {S.wage > 0 && <span>薪資指數 €{formatMoney(S.wage)}</span>}
        <span>存款 €{formatMoney(S.savings)}</span>
        {S.national.caps > 0 && <span>國家隊 {S.national.caps} 次</span>}
      </div>
    </div>
  );
}
