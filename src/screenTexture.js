// Procedurally drawn screen contents. No external images, everything is canvas 2D.

import * as THREE from 'three';

const BASE_W = 1600;

function makeCanvas(aspectRatio) {
  const c = document.createElement('canvas');
  c.width = BASE_W;
  c.height = Math.max(2, Math.round(BASE_W / aspectRatio));
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Deterministic pseudo-random in [0,1) so the drawing is stable between renders.
function rand(i) {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

function textLines(ctx, x, y, w, lines, gap, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < lines; i++) {
    const lw = w * (0.45 + 0.55 * rand(i + 1));
    roundRect(ctx, x, y + i * gap, Math.max(30, lw), gap * 0.34, gap * 0.17);
    ctx.fill();
  }
}

function drawDesktop(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1d3557');
  g.addColorStop(0.55, '#2a6f97');
  g.addColorStop(1, '#61a5c2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // soft "mountains" so the wallpaper reads as an image, not a flat fill
  ctx.fillStyle = 'rgba(12,32,56,0.55)';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H * 0.72);
  for (let x = 0; x <= W; x += W / 8) {
    ctx.lineTo(x + W / 16, H * (0.55 + 0.16 * Math.abs(Math.sin(x * 0.004))));
    ctx.lineTo(x + W / 8, H * 0.74);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  const pad = H * 0.05;
  const winH = H * 0.62;

  // editor window
  const w1x = pad, w1y = pad, w1w = W * 0.46;
  ctx.fillStyle = 'rgba(22,26,34,0.95)';
  roundRect(ctx, w1x, w1y, w1w, winH, 14); ctx.fill();
  ctx.fillStyle = '#2b313d';
  roundRect(ctx, w1x, w1y, w1w, H * 0.055, 14); ctx.fill();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(w1x + 26 + i * 22, w1y + H * 0.0275, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  const gap = H * 0.045;
  const rows = Math.floor((winH - H * 0.09) / gap);
  for (let i = 0; i < rows; i++) {
    const y = w1y + H * 0.085 + i * gap;
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(w1x + 18, y, 22, gap * 0.3);
    const seg = ((i * 37) % 5) + 2;
    let x = w1x + 58;
    for (let s = 0; s < seg; s++) {
      const wseg = 30 + ((i * 53 + s * 29) % 90);
      ctx.fillStyle = ['#7dd3fc', '#c4b5fd', '#86efac', '#fca5a5', '#e5e7eb'][(i + s) % 5];
      ctx.globalAlpha = 0.85;
      roundRect(ctx, x, y, wseg, gap * 0.3, gap * 0.14); ctx.fill();
      ctx.globalAlpha = 1;
      x += wseg + 14;
      if (x > w1x + w1w - 60) break;
    }
  }

  // browser window
  const w2x = W * 0.52, w2y = H * 0.12, w2w = W * 0.43, w2h = winH;
  ctx.fillStyle = 'rgba(248,250,252,0.97)';
  roundRect(ctx, w2x, w2y, w2w, w2h, 14); ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  roundRect(ctx, w2x, w2y, w2w, H * 0.06, 14); ctx.fill();
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, w2x + 90, w2y + H * 0.014, w2w - 130, H * 0.032, H * 0.016); ctx.fill();
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, w2x + 24, w2y + H * 0.09, w2w * 0.55, H * 0.05, 6); ctx.fill();
  textLines(ctx, w2x + 24, w2y + H * 0.18, w2w - 48, 6, H * 0.052, '#cbd5e1');
  ctx.fillStyle = '#93c5fd';
  roundRect(ctx, w2x + 24, w2y + w2h * 0.66, w2w - 48, w2h * 0.26, 10); ctx.fill();

  // dock
  const dockH = H * 0.1, dockW = Math.min(W * 0.5, H * 0.86);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, (W - dockW) / 2, H - dockH * 1.25, dockW, dockH, dockH * 0.24); ctx.fill();
  const icons = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#e5e7eb'];
  icons.forEach((c, i) => {
    const s = dockH * 0.66;
    const x = (W - dockW) / 2 + dockH * 0.22 + i * (s + dockH * 0.18);
    ctx.fillStyle = c;
    roundRect(ctx, x, H - dockH * 1.25 + (dockH - s) / 2, s, s, s * 0.26); ctx.fill();
  });
}

function drawGrid(ctx, W, H) {
  ctx.fillStyle = '#101318';
  ctx.fillRect(0, 0, W, H);

  const step = W / 32;
  ctx.strokeStyle = 'rgba(120,140,170,0.35)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= W + 1; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H + 1; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // thirds
  ctx.strokeStyle = 'rgba(106,168,255,0.85)';
  ctx.lineWidth = 3;
  [1 / 3, 2 / 3].forEach((f) => {
    ctx.beginPath(); ctx.moveTo(W * f, 0); ctx.lineTo(W * f, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, H * f); ctx.lineTo(W, H * f); ctx.stroke();
  });

  // centre cross + circle
  ctx.strokeStyle = '#71d5a6';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, H * 0.18, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2 - H * 0.26, H / 2); ctx.lineTo(W / 2 + H * 0.26, H / 2);
  ctx.moveTo(W / 2, H / 2 - H * 0.26); ctx.lineTo(W / 2, H / 2 + H * 0.26); ctx.stroke();

  // colour bars
  const bars = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff', '#000000'];
  const bw = W / bars.length;
  bars.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * bw, H * 0.82, bw, H * 0.18); });

  ctx.fillStyle = '#e7e9ee';
  ctx.font = `600 ${Math.round(H * 0.07)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('TEST PATTERN', W / 2, H * 0.26);
}

function drawPhoto(ctx, W, H) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  sky.addColorStop(0, '#f9c74f');
  sky.addColorStop(0.45, '#f8961e');
  sky.addColorStop(1, '#9d4edd');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,246,214,0.95)';
  ctx.beginPath(); ctx.arc(W * 0.62, H * 0.44, H * 0.11, 0, Math.PI * 2); ctx.fill();

  const layers = [
    { y: 0.60, c: '#5a3a7e' }, { y: 0.70, c: '#432c63' },
    { y: 0.80, c: '#2f1f49' }, { y: 0.90, c: '#1c1330' },
  ];
  layers.forEach((l, li) => {
    ctx.fillStyle = l.c;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H * l.y);
    for (let x = 0; x <= W; x += W / 40) {
      const n = Math.sin(x * 0.006 + li * 2.1) * 0.5 + Math.sin(x * 0.013 + li) * 0.5;
      ctx.lineTo(x, H * (l.y + n * 0.045));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  });

  // reflection strip
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, H * 0.9, W, H * 0.1);
}

function drawGame(ctx, W, H) {
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, W, H);

  // perspective floor
  const horizon = H * 0.46;
  const g = ctx.createLinearGradient(0, horizon, 0, H);
  g.addColorStop(0, '#12263f'); g.addColorStop(1, '#050a12');
  ctx.fillStyle = g; ctx.fillRect(0, horizon, W, H - horizon);
  ctx.strokeStyle = 'rgba(106,168,255,0.5)'; ctx.lineWidth = 2;
  for (let i = -20; i <= 20; i++) {
    ctx.beginPath(); ctx.moveTo(W / 2 + i * (W / 12), H); ctx.lineTo(W / 2 + i * 12, horizon); ctx.stroke();
  }
  for (let i = 1; i < 14; i++) {
    const y = horizon + (H - horizon) * Math.pow(i / 14, 2.4);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // sky glow
  const sg = ctx.createRadialGradient(W / 2, horizon, 10, W / 2, horizon, W * 0.5);
  sg.addColorStop(0, 'rgba(120,180,255,0.55)'); sg.addColorStop(1, 'rgba(10,13,20,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, horizon + 40);

  // crosshair
  ctx.strokeStyle = '#7cf7a6'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 26, H / 2); ctx.lineTo(W / 2 - 9, H / 2);
  ctx.moveTo(W / 2 + 9, H / 2); ctx.lineTo(W / 2 + 26, H / 2);
  ctx.moveTo(W / 2, H / 2 - 26); ctx.lineTo(W / 2, H / 2 - 9);
  ctx.moveTo(W / 2, H / 2 + 9); ctx.lineTo(W / 2, H / 2 + 26);
  ctx.stroke();

  // HUD
  ctx.fillStyle = 'rgba(124,247,166,0.85)';
  roundRect(ctx, W * 0.03, H * 0.88, W * 0.16, H * 0.03, 6); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,120,0.85)';
  roundRect(ctx, W * 0.03, H * 0.93, W * 0.1, H * 0.03, 6); ctx.fill();
  ctx.fillStyle = 'rgba(231,233,238,0.85)';
  roundRect(ctx, W * 0.84, H * 0.9, W * 0.13, H * 0.05, 8); ctx.fill();
}

function drawOff(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, '#1a1c20');
  g.addColorStop(0.5, '#111316');
  g.addColorStop(1, '#0c0d10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.beginPath();
  ctx.moveTo(0, H); ctx.lineTo(W * 0.55, 0); ctx.lineTo(W * 0.8, 0); ctx.lineTo(W * 0.25, H);
  ctx.closePath(); ctx.fill();
}

const PAINTERS = { desktop: drawDesktop, grid: drawGrid, photo: drawPhoto, game: drawGame, off: drawOff };

/** Returns a THREE.CanvasTexture for the requested content at the requested aspect ratio. */
export function makeScreenTexture(content, aspectRatio) {
  const canvas = makeCanvas(aspectRatio);
  const ctx = canvas.getContext('2d');
  (PAINTERS[content] || drawDesktop)(ctx, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}
