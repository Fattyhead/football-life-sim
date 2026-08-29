import { LV } from '../engine.js';

/* 六個「引擎骰出來的重大決定」共用的一張卡片，靠 pending.type 分派內容——
   跟 AgentLine.jsx/TrainingRivalry.jsx 同一種「一個元件、pending.type 分派」
   寫法，不是六個各自獨立的檔案，因為六者的形狀高度相似(一段情境文案+
   2-3 個按鈕)，真正不同的只有文案跟按鈕的 choice 字串。choice 字串要跟
   flow/proSeason.js resolveSeasonChoiceGen() yield 出來的六種 type 各自
   期待的值完全對上(見那邊的稽核說明)：
     LOAN_OFFER/PROMOTION_OFFER/LATERAL_OFFER — 'accept'/'decline'
     CONTRACT_CRISIS — 'retired'/'dropped'/'paycut'(dropped 只在
       offer.options.dropped 為 true 時才會出現，已經在最底層的地區聯賽
       沒有更低一級可以降)
     CHAMPION_RETIREMENT/BOSS_RETIREMENT — 'retired'/'continue'
   pending 是 null 就不渲染任何東西(呼叫端已經先判斷過，這裡再擋一次
   純粹保險)。 */
export default function SeasonOffer({ pending, onPick }) {
  if (!pending) return null;

  if (pending.type === 'LOAN_OFFER') {
    const targetLabel = LV[pending.target]?.label || pending.target;
    return (
      <div className="card love-choice">
        <p className="eyebrow">人生的抉擇</p>
        <p className="frame-text">{targetLabel}的球隊想租借你一季，練練兵、也給自己一個被更高層級看見的機會——你要接受這份租借邀約嗎？</p>
        <div className="option-grid">
          <button className="option-btn" onClick={() => onPick('accept')}>
            <span className="opt-label">接受租借</span>
            <span className="opt-desc">這季轉戰{targetLabel}，表現好可以留下轉正式，不好就無傷回原隊。</span>
          </button>
          <button className="option-btn" onClick={() => onPick('decline')}>
            <span className="opt-label">婉拒</span>
            <span className="opt-desc">留在原球隊，繼續在熟悉的環境踢球。</span>
          </button>
        </div>
      </div>
    );
  }

  if (pending.type === 'PROMOTION_OFFER') {
    const targetLabel = LV[pending.offer.target]?.label || pending.offer.target;
    return (
      <div className="card love-choice">
        <p className="eyebrow">人生的抉擇</p>
        <p className="frame-text">{targetLabel}的球隊送來報價，想把你買走——這是往上爬的真正機會，你要接受這筆轉會嗎？</p>
        <div className="option-grid">
          <button className="option-btn" onClick={() => onPick('accept')}>
            <span className="opt-label">接受轉會</span>
            <span className="opt-desc">加盟{targetLabel}球隊，重新簽一份新合約。</span>
          </button>
          <button className="option-btn" onClick={() => onPick('decline')}>
            <span className="opt-label">留下來</span>
            <span className="opt-desc">拒絕這次報價，留在原球隊，之後也許還有其他機會。</span>
          </button>
        </div>
      </div>
    );
  }

  if (pending.type === 'LATERAL_OFFER') {
    return (
      <div className="card love-choice">
        <p className="eyebrow">人生的抉擇</p>
        <p className="frame-text">一支豪門球隊看上了你，想把你從現在的球隊挖走——加盟豪門，你的生涯還能再往上一階，你要接受嗎？</p>
        <div className="option-grid">
          <button className="option-btn" onClick={() => onPick('accept')}>
            <span className="opt-label">加盟豪門</span>
            <span className="opt-desc">轉戰豪門球隊，薪資水準跟著跳一個檔次。</span>
          </button>
          <button className="option-btn" onClick={() => onPick('decline')}>
            <span className="opt-label">留下來</span>
            <span className="opt-desc">拒絕挖角，留在現在的球隊。</span>
          </button>
        </div>
      </div>
    );
  }

  if (pending.type === 'CONTRACT_CRISIS') {
    const { options, loyal } = pending.offer;
    return (
      <div className="card love-choice">
        <p className="eyebrow">人生的抉擇</p>
        <p className="frame-text">
          合約到期了，球隊沒有無條件續約的打算——{loyal ? '看在你這些年的付出份上，球隊還是願意給你一些選擇。' : '你得自己決定接下來怎麼走。'}
        </p>
        <div className="option-grid">
          <button className="option-btn" onClick={() => onPick('retired')}>
            <span className="opt-label">就此掛靴</span>
            <span className="opt-desc">結束球員生涯，這是你在球場上的最後一季。</span>
          </button>
          {options.dropped && (
            <button className="option-btn" onClick={() => onPick('dropped')}>
              <span className="opt-label">降級留隊</span>
              <span className="opt-desc">轉往較低層級的球隊繼續踢球，重新證明自己。</span>
            </button>
          )}
          <button className="option-btn" onClick={() => onPick('paycut')}>
            <span className="opt-label">降薪續約</span>
            <span className="opt-desc">接受一份縮水的短約(1年)，留在原球隊，用表現換回你的位置。</span>
          </button>
        </div>
      </div>
    );
  }

  if (pending.type === 'CHAMPION_RETIREMENT') {
    return (
      <div className="card love-choice">
        <p className="eyebrow">人生的抉擇</p>
        <p className="frame-text">捧著世界盃冠軍獎盃，站在生涯的最高點——這是見好就收的完美時刻，還是你還想繼續踢下去？</p>
        <div className="option-grid">
          <button className="option-btn" onClick={() => onPick('retired')}>
            <span className="opt-label">在巔峰退休</span>
            <span className="opt-desc">捧著這座獎盃走下球場，生涯在最高點畫下句點。</span>
          </button>
          <button className="option-btn" onClick={() => onPick('continue')}>
            <span className="opt-label">繼續踢下去</span>
            <span className="opt-desc">榮耀先收下，生涯還沒打算結束。</span>
          </button>
        </div>
      </div>
    );
  }

  if (pending.type === 'BOSS_RETIREMENT') {
    return (
      <div className="card love-choice">
        <p className="eyebrow">人生的抉擇</p>
        <p className="frame-text">場外收入已經超過你在球場上的薪水——你早就不需要靠踢球維生了，是要就此轉戰場外人生，還是繼續留在球場上？</p>
        <div className="option-grid">
          <button className="option-btn" onClick={() => onPick('retired')}>
            <span className="opt-label">轉戰場外人生</span>
            <span className="opt-desc">掛靴，把重心全部移到球場之外。</span>
          </button>
          <button className="option-btn" onClick={() => onPick('continue')}>
            <span className="opt-label">繼續踢下去</span>
            <span className="opt-desc">場外事業照樣經營，球場上也還沒打算放手。</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
