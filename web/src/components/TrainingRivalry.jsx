import { computeRivalryRiskFlavor } from '../engine.js';
import { useT } from '../i18n/localize.js';

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
   'compete'/'cooperate'。
   稽核修正(使用者委託：繁中/簡中雙語)：這張卡片的敘事句是「JSX 片段+
   插值」拼出來的(文字節點夾在 {c.name} 這種動態值中間)，逐段包
   t(...) 太瑣碎——改成先在 JS 端把完整句子組成一個字串(對手名字這種
   動態值本來就在字串裡)，最後整句只呼叫一次 t()，簡體轉換也會連動態
   插入的姓名/頭銜一起轉到，不用另外處理。按鈕的 label/desc 是獨立短
   字串，各自單獨包一次 t() 就好。 */
export default function TrainingRivalry({ S, pending, onPick }) {
  const t = useT();
  if (!pending) return null;

  if (pending.type === 'ENCOUNTER') {
    const c = pending.candidate;
    const label = c.type === 'RIVAL' ? '一個看起來很想較量的人' : '一個主動搭話的人';
    const tail = c.type === 'RIVAL' ? '，話裡話外都是挑釁的意思。' : '，看起來想跟你熟識一下。';
    const message = `訓練場上，${label}——${c.title}・${c.name}走了過來${tail}你要接受，還是不予理會？`;
    return (
      <div className="card love-choice">
        <p className="eyebrow">{t('人生的抉擇')}</p>
        <p className="frame-text">{t(message)}</p>
        <div className="option-grid">
          <button className="option-btn" onClick={() => onPick('accept')}>
            <span className="opt-label">{t('接受')}</span>
            <span className="opt-desc">{t('正式認識這個人，之後訓練場上會有更多互動。')}</span>
          </button>
          <button className="option-btn" onClick={() => onPick('ignore')}>
            <span className="opt-label">{t('不予理會')}</span>
            <span className="opt-desc">{t('這次算了，沒有任何代價，之後還可能遇到類似的機會。')}</span>
          </button>
        </div>
      </div>
    );
  }

  const partner = S.trainingPartner;
  if (!partner) return null;
  const partnerLabel = partner.type === 'RIVAL' ? '對手' : '訓練夥伴';
  const riskFlavor = computeRivalryRiskFlavor(S);
  const message = `訓練場上，${partnerLabel}${partner.title}・${partner.name}朝你走了過來——這次，要拚出個高下，還是互相拉一把？`;

  return (
    <div className="card love-choice">
      <p className="eyebrow">{t('人生的抉擇')}</p>
      <p className="frame-text">{t(message)}</p>
      {riskFlavor && <p className="streak-flavor">{t(riskFlavor)}</p>}
      <div className="option-grid">
        <button className="option-btn" onClick={() => onPick('compete')}>
          <span className="opt-label">{t('較勁')}</span>
          <span className="opt-desc">{t('正面對決，個人能力立即成長，但隊伍氣氛會跟著繃緊一點。')}</span>
        </button>
        <button className="option-btn" onClick={() => onPick('cooperate')}>
          <span className="opt-label">{t('合作')}</span>
          <span className="opt-desc">{t('互相扶持，隊伍核心力明顯提升，沒有個人能力的立即效果。')}</span>
        </button>
      </div>
    </div>
  );
}
