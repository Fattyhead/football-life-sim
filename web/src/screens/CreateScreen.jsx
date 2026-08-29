import { useState } from 'react';
import { POSN, REGION } from '../engine.js';

const posKeys = Object.keys(POSN);
const regionKeys = Object.keys(REGION);

export default function CreateScreen({ onCreate }) {
  const [name, setName] = useState('');
  const [jersey, setJersey] = useState('9');
  const [pos, setPos] = useState(posKeys[0]);
  const [regionCode, setRegionCode] = useState(regionKeys[0]);

  const jerseyNum = Math.min(99, Math.max(1, parseInt(jersey, 10) || 1));

  return (
    <div className="app-shell">
      <h1 className="screen-title">創建球員</h1>
      <div className="card">
        <div className="field-row">
          <label htmlFor="name">姓名</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="無名小將" />
        </div>
        <div className="field-row">
          <label htmlFor="jersey">背號</label>
          <input id="jersey" type="text" inputMode="numeric" value={jersey} onChange={(e) => setJersey(e.target.value)} />
        </div>
        <div className="field-row">
          <label htmlFor="pos">位置</label>
          <select id="pos" value={pos} onChange={(e) => setPos(e.target.value)}>
            {posKeys.map((k) => (
              <option key={k} value={k}>
                {POSN[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <label htmlFor="region">出身地區</label>
          <select id="region" value={regionCode} onChange={(e) => setRegionCode(e.target.value)}>
            {regionKeys.map((k) => (
              <option key={k} value={k}>
                {REGION[k].name}
              </option>
            ))}
          </select>
        </div>
        <button className="primary-btn" onClick={() => onCreate({ name: name.trim() || '無名小將', jersey: jerseyNum, pos, regionCode })}>
          確定
        </button>
      </div>
    </div>
  );
}
