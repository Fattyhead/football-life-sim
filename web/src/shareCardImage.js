/* ---------- 掛靴卡「儲存圖片」的 canvas 手繪版 ---------- */
/* 稽核抓出來的取捨：本來想直接把畫面上的 .ec-card DOM 序列化成 SVG
   foreignObject 再轉 canvas(業界常見的「DOM 轉圖」做法)，但那個技巧
   高度依賴瀏覽器願不願意在 <img> 渲染的 SVG 資料網址內部載入外部字體
   (Google Fonts 的 @import)，不同瀏覽器的安全限制不一致，很容易做出
   「畫面上看起來對，存出來的圖卻是系統預設字體、版面跑掉」的東西。
   改成直接用 Canvas 2D API 手繪——版面資訊(顏色/字級/間距)照抄
   index.css 的 --ec- 系列 token 跟 EndingCard.jsx 的實際版面，不是
   forEach 複製 DOM，圖片保證跟畫面上看到的顏色/字體一致，不用賭瀏覽器
   支不支援。代價是這裡的版面是簡化過的重點摘要(拿掉生涯軌跡時間軸的
   細節連線)，不是逐畫素還原，這是刻意的範圍縮減，不是遺漏。 */

const COLOR = {
  bgTop: '#12211a',
  bgBottom: '#1a2e23',
  border: 'rgba(42, 69, 54, 0.9)',
  gold: '#d4af37',
  goldSoft: 'rgba(212, 175, 55, 0.14)',
  text: '#eef2ea',
  textDim: '#9fb3a5',
};

function wrapText(ctx, text, maxWidth) {
  const words = text.split('');
  const lines = [];
  let line = '';
  for (const ch of words) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function ensureFonts() {
  try {
    await Promise.all([document.fonts.load('700 60px Teko'), document.fonts.load('400 26px "Noto Sans TC"'), document.fonts.load('700 26px "Noto Sans TC"')]);
    await document.fonts.ready;
  } catch {
    // 字體載入失敗就用系統預設字體畫，圖片還是能產生，只是不夠精緻——
    // 不因為這個擋掉整個下載功能。
  }
}

export async function renderEndingCardImage({ S, legacy, seed, posText, regionName, nameText, cells, obtainedCount }) {
  await ensureFonts();

  const W = 920;
  const PAD = 56;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 先用一個足夠大的暫定高度畫一次量測用的內容，實際輸出高度依內容動態
  // 決定(敘事段落長度不固定)——這裡用兩階段：先在記憶體算出每段落實際
  // 佔用的高度，再真正設定 canvas 尺寸重畫一次。
  function layout(measureCtx) {
    let y = 0;
    y += 60; // hero pill
    y += 76; // tier name
    y += 30; // tier desc
    y += 46; // score row
    y += 40; // hero bottom padding + divider
    y += 70; // identity row
    measureCtx.font = '400 26px "Noto Sans TC", sans-serif';
    const narrativeLines = wrapText(measureCtx, legacy.summary, W - PAD * 2);
    y += 24 + narrativeLines.length * 34 + 30; // 引號 + 每行 + 下邊距
    y += 96; // stats row
    if (legacy.clubJourney?.length) y += 100; // journey (簡化單行)
    if (S.honors.length) {
      measureCtx.font = '700 22px "Noto Sans TC", sans-serif';
      let chipRows = 1;
      let rowW = 0;
      for (const h of S.honors) {
        const w = measureCtx.measureText(h).width + 44;
        if (rowW + w > W - PAD * 2) {
          chipRows++;
          rowW = 0;
        }
        rowW += w + 12;
      }
      y += 24 + chipRows * 46 + 10;
    }
    y += 24 + 20 + 10 * 5 + 30 + 40; // achievements h-row + grid(10列高度粗估) + tip
    y += 90; // footer
    return { y, narrativeLines };
  }

  const { y: H, narrativeLines } = layout(ctx);
  canvas.width = W;
  canvas.height = H;

  // 背景
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, COLOR.bgTop);
  bgGrad.addColorStop(1, COLOR.bgBottom);
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 24);
  ctx.fill();
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1, 1, W - 2, H - 2, 24);
  ctx.stroke();

  let cy = 0;
  const cx = W / 2;

  function hline(atY) {
    ctx.strokeStyle = COLOR.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, atY);
    ctx.lineTo(W - PAD, atY);
    ctx.stroke();
  }

  // ---- hero ----
  cy += 40;
  ctx.textAlign = 'center';
  const pillText = `★ ${legacy.tier.toUpperCase()}`;
  ctx.font = '700 22px Teko, sans-serif';
  const pillW = ctx.measureText(pillText).width + 48;
  ctx.fillStyle = COLOR.goldSoft;
  ctx.beginPath();
  ctx.roundRect(cx - pillW / 2, cy - 24, pillW, 34, 999);
  ctx.fill();
  ctx.strokeStyle = 'rgba(212,175,55,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = COLOR.gold;
  ctx.fillText(pillText, cx, cy - 1);

  cy += 68;
  const tierGrad = ctx.createLinearGradient(0, cy - 60, 0, cy + 10);
  tierGrad.addColorStop(0, '#fff6de');
  tierGrad.addColorStop(0.55, COLOR.gold);
  tierGrad.addColorStop(1, '#b8863a');
  ctx.fillStyle = tierGrad;
  ctx.font = '700 76px Teko, sans-serif';
  ctx.fillText(legacy.tier, cx, cy);

  cy += 34;
  ctx.fillStyle = COLOR.textDim;
  ctx.font = '400 20px "Noto Sans TC", sans-serif';
  ctx.fillText(legacy.tierDesc, cx, cy);

  cy += 46;
  ctx.font = '600 40px Teko, sans-serif';
  ctx.fillStyle = COLOR.text;
  const scoreText = `${legacy.legendPercent.toFixed(1)}%`;
  const scoreW = ctx.measureText(scoreText).width;
  ctx.font = '400 18px "Noto Sans TC", sans-serif';
  const lblW = ctx.measureText('傳奇度').width;
  const totalW = scoreW + 10 + lblW;
  ctx.font = '600 40px Teko, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(scoreText, cx - totalW / 2, cy);
  ctx.font = '400 18px "Noto Sans TC", sans-serif';
  ctx.fillStyle = COLOR.textDim;
  ctx.fillText('傳奇度', cx - totalW / 2 + scoreW + 10, cy);
  ctx.textAlign = 'center';

  cy += 40;
  hline(cy);

  // ---- identity ----
  cy += 46;
  ctx.textAlign = 'left';
  ctx.fillStyle = COLOR.goldSoft;
  ctx.beginPath();
  ctx.roundRect(PAD, cy - 34, 68, 68, 18);
  ctx.fill();
  ctx.fillStyle = COLOR.gold;
  ctx.font = '700 30px Teko, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(S.pos, PAD + 34, cy + 10);
  ctx.textAlign = 'left';
  ctx.fillStyle = COLOR.text;
  ctx.font = '700 26px "Noto Sans TC", sans-serif';
  ctx.fillText(nameText, PAD + 88, cy - 4);
  ctx.fillStyle = COLOR.textDim;
  ctx.font = '400 18px "Noto Sans TC", sans-serif';
  ctx.fillText(`出身${regionName} · ${posText} · ${S.age} 歲掛靴`, PAD + 88, cy + 22);

  cy += 44;
  hline(cy);

  // ---- narrative ----
  cy += 20;
  ctx.font = '700 48px Teko, sans-serif';
  ctx.fillStyle = 'rgba(212,175,55,0.35)';
  ctx.fillText('"', PAD - 6, cy + 20);
  cy += 30;
  ctx.font = '400 26px "Noto Sans TC", sans-serif';
  ctx.fillStyle = COLOR.text;
  for (const line of narrativeLines) {
    ctx.fillText(line, PAD, cy);
    cy += 34;
  }
  cy += 20;
  hline(cy);

  // ---- stats ----
  cy += 60;
  const statCols = [
    [legacy.careerTotals.APP, '出賽場次'],
    [legacy.clubCount, '待過的球隊'],
    [S.national.caps, '國家隊出賽'],
  ];
  const colW = (W - PAD * 2) / 3;
  statCols.forEach(([num, lbl], i) => {
    const x = PAD + colW * i + colW / 2;
    ctx.textAlign = 'center';
    ctx.font = '600 44px Teko, sans-serif';
    ctx.fillStyle = COLOR.text;
    ctx.fillText(String(num), x, cy);
    ctx.font = '400 18px "Noto Sans TC", sans-serif';
    ctx.fillStyle = COLOR.textDim;
    ctx.fillText(lbl, x, cy + 26);
  });
  cy += 46;
  hline(cy);

  // ---- journey(簡化單行：球隊名用箭頭串起來，不畫時間軸圓點) ----
  if (legacy.clubJourney?.length) {
    cy += 40;
    ctx.textAlign = 'left';
    ctx.font = '600 20px Teko, sans-serif';
    ctx.fillStyle = COLOR.textDim;
    ctx.fillText('生涯軌跡', PAD, cy);
    cy += 32;
    ctx.font = '400 20px "Noto Sans TC", sans-serif';
    const journeyText = legacy.clubJourney.map((s) => s.club).join('  →  ');
    const jLines = wrapText(ctx, journeyText, W - PAD * 2);
    ctx.fillStyle = COLOR.text;
    for (const line of jLines.slice(0, 2)) {
      ctx.fillText(line, PAD, cy);
      cy += 28;
    }
    cy += 14;
    hline(cy);
  }

  // ---- honors ----
  if (S.honors.length) {
    cy += 40;
    ctx.font = '600 20px Teko, sans-serif';
    ctx.fillStyle = COLOR.textDim;
    ctx.fillText('生涯稱號', PAD, cy);
    cy += 30;
    ctx.font = '700 22px "Noto Sans TC", sans-serif';
    let x = PAD;
    for (const h of S.honors) {
      const w = ctx.measureText(h).width + 32;
      if (x + w > W - PAD) {
        x = PAD;
        cy += 46;
      }
      ctx.fillStyle = COLOR.goldSoft;
      ctx.beginPath();
      ctx.roundRect(x, cy - 26, w, 36, 999);
      ctx.fill();
      ctx.fillStyle = COLOR.gold;
      ctx.fillText(h, x + 16, cy - 2);
      x += w + 12;
    }
    cy += 40;
    hline(cy);
  }

  // ---- achievements ----
  cy += 40;
  ctx.font = '600 20px Teko, sans-serif';
  ctx.fillStyle = COLOR.textDim;
  ctx.fillText('生涯成就', PAD, cy);
  ctx.textAlign = 'right';
  ctx.font = '600 22px Teko, sans-serif';
  ctx.fillStyle = COLOR.gold;
  ctx.fillText(`${obtainedCount} / ${cells.length}`, W - PAD, cy);
  ctx.textAlign = 'left';

  cy += 20;
  const cellCols = 10;
  const gap = 6;
  const cellSize = (W - PAD * 2 - gap * (cellCols - 1)) / cellCols;
  cells.forEach((c, i) => {
    const col = i % cellCols;
    const row = Math.floor(i / cellCols);
    const x = PAD + col * (cellSize + gap);
    const cyCell = cy + row * (cellSize + gap);
    if (c === 'obtained') {
      ctx.fillStyle = COLOR.gold;
    } else if (c === 'hint') {
      ctx.fillStyle = 'rgba(180,142,224,0.14)';
    } else if (c === 'locked') {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
    }
    ctx.beginPath();
    ctx.roundRect(x, cyCell, cellSize, cellSize, 4);
    ctx.fill();
  });
  const rows = Math.ceil(cells.length / cellCols);
  cy += rows * (cellSize + gap) + 26;
  ctx.textAlign = 'center';
  ctx.font = '400 16px "Noto Sans TC", sans-serif';
  ctx.fillStyle = COLOR.textDim;
  const remain = cells.length - obtainedCount;
  if (remain > 0) ctx.fillText(`亮起的是你拿到的，還有 ${remain} 個等你下一輪解鎖`, cx, cy);

  // ---- footer ----
  cy += 44;
  ctx.fillStyle = 'rgba(26, 46, 35, 0.6)';
  ctx.fillRect(0, cy, W, H - cy);
  ctx.textAlign = 'left';
  ctx.font = '400 18px Teko, sans-serif';
  ctx.fillStyle = COLOR.textDim;
  ctx.fillText(`種子 ${seed || '—'}`, PAD, cy + 40);
  ctx.textAlign = 'right';
  ctx.font = '600 18px "Noto Sans TC", sans-serif';
  ctx.fillStyle = COLOR.gold;
  ctx.fillText('足球人生模擬器', W - PAD, cy + 40);

  return canvas.toDataURL('image/png');
}
