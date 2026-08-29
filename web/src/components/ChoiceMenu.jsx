import { useState } from 'react';
import { RISK_TIERS, optionHasRiskTier, effectiveRiskSuccessPct } from '../engine.js';

const CATEGORY_LABEL = { TRAINING: '訓練', OPPORTUNITY: '機會', SOCIAL: '社交' };

/* 共用的「訓練/機會/社交」年度選擇——對照原版畫面「下半部選項」的實際流程：
   先選一個方面(三選一)，再看到那個方面對應的子選項，不是把三類9~12個
   選項全部攤平列在同一頁(舊版就是這樣做，這次稽核抓出來的落差)。這樣
   放進固定高度的底部選項區才塞得下，也才是原版真正的操作邏輯。
   有些子選項底下還有第三步——訓練/機會選項如果帶風險層(見
   flow/yearlyChoice.js optionHasRiskTier，季初骰子的自由分配已經搬去
   season_screen_prototype.html/SeasonOpener.jsx 那套獨立步驟了，這裡的
   風險層是完全不同的小整數±1/2/3機制)，選完子選項後要再選穩健/平衡/
   冒進才會真的呼叫 onPick，onPick(category, optionKey, riskTierKey) 的
   riskTierKey 在沒有風險層的選項上是 undefined。顯示的成功率要吃
   effectiveRiskSuccessPct(S, tierKey)——風險層稱號(小心翼翼/走在鋼索上的
   男人等)解鎖後會永久疊加對應那一檔的成功率，畫面顯示的數字要跟
   flow/shared.js resolveRiskTier() 真正在算的機率一致，不能顯示基準值。
   categories: { TRAINING: { table, keys }, OPPORTUNITY: {...}, SOCIAL: {...} }
   table 是完整選項定義表，keys 是這次真正開放的子選項。 */
export default function ChoiceMenu({ S, categories, onPick }) {
  const [phase, setPhase] = useState('category'); // 'category' | 'sub' | 'risk'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);

  if (phase === 'category') {
    return (
      <div className="option-grid category-pick-grid">
        {Object.entries(categories).map(([category, { table, keys }]) => (
          <button
            key={category}
            className="option-btn category-pick-btn"
            onClick={() => {
              setSelectedCategory(category);
              setPhase('sub');
            }}
          >
            <span className="opt-label">{CATEGORY_LABEL[category]}</span>
            <span className="opt-desc">{keys.map((k) => table[k].label).join('、')}</span>
          </button>
        ))}
      </div>
    );
  }

  if (phase === 'risk') {
    const def = categories[selectedCategory].table[selectedOption];
    return (
      <div>
        <div className="choice-substep-head">
          <button className="back-btn" onClick={() => setPhase('sub')}>
            ← 換方式
          </button>
          <span className="category-label" style={{ margin: 0 }}>
            {def.label}
          </span>
        </div>
        <div className="option-grid">
          {Object.entries(RISK_TIERS).map(([tierKey, tier]) => (
            <button
              key={tierKey}
              className="option-btn risk-tier-btn"
              onClick={() => onPick(selectedCategory, selectedOption, tierKey)}
            >
              <span className="risk-tier-text">
                <span className="opt-label">{tier.label}</span>
                <span className="opt-desc">{tier.desc}</span>
              </span>
              <span className="risk-prob-badge">{effectiveRiskSuccessPct(S, tierKey)}%</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const { table, keys } = categories[selectedCategory];
  return (
    <div>
      <div className="choice-substep-head">
        <button className="back-btn" onClick={() => setPhase('category')}>
          ← 換方面
        </button>
        <span className="category-label" style={{ margin: 0 }}>
          {CATEGORY_LABEL[selectedCategory]}
        </span>
      </div>
      <div className="option-grid">
        {keys.map((optionKey) => {
          const def = table[optionKey];
          return (
            <button
              key={optionKey}
              className="option-btn"
              onClick={() => {
                if (optionHasRiskTier(selectedCategory, def)) {
                  setSelectedOption(optionKey);
                  setPhase('risk');
                } else {
                  onPick(selectedCategory, optionKey);
                }
              }}
            >
              <span className="opt-label">
                {def.cost ? '💰 ' : ''}
                {def.label}
              </span>
              <span className="opt-desc">{def.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
