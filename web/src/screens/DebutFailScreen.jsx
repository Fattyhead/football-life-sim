export default function DebutFailScreen({ onRestart }) {
  return (
    <div className="app-shell">
      <h1 className="screen-title">完</h1>
      <div className="card">
        <p className="narrate-line">三年青訓過去，俱樂部沒有跟你續約的打算。你的職業球員夢，還沒開始就結束了。</p>
      </div>
      <button className="primary-btn" onClick={onRestart}>
        再試一次
      </button>
    </div>
  );
}
