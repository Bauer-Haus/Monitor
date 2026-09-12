// Where each monitor sits. One source of truth for the 3D scene and the
// readouts: the arrangement maths lives here, in plain numbers.
//
// Local frame: x right, y up from the desk surface, z towards the viewer.
// The main row's centre seam is at x = 0, z = 0, and a panel's own origin is
// the centre of its image area.

import { screenMetrics } from './config.js';

const DEG = Math.PI / 180;

/** Rotate (x, z) about the vertical axis. Positive yaw turns a panel's face towards +x. */
function rotate(yaw, x, z) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
}

/**
 * Half-extents of one panel, including its bezel.
 * `hx`/`hz` locate the panel's own side edge; a curved panel's edges sit `hz`
 * forward of its centre, a pivoted (portrait) one curves vertically instead so
 * its side edges are flat in plan.
 */
function halfExtents(m, bezel, portrait) {
  if (portrait) {
    return {
      hx: m.height / 2 + bezel,
      hz: 0,
      imgW: m.height,
      imgH: m.width,
      outerH: m.width + bezel * 2,
    };
  }
  const t = m.wrap / 2;
  return {
    hx: m.chord / 2 + bezel * Math.cos(t),
    hz: m.sagitta + bezel * Math.sin(t),
    imgW: m.width,
    imgH: m.height,
    outerH: m.height + bezel * 2,
  };
}

/**
 * @returns {{
 *   items: Array<{x:number, y:number, z:number, yaw:number, portrait:boolean, row:number, primary:boolean, half:object}>,
 *   m: object, bezel: number,
 *   edges: Array<{x:number, z:number}>,
 *   spanX: number, minX: number, maxX: number,
 *   imageTop: number, imageBottom: number,
 *   primary: object,
 * }}
 */
export function rigLayout(s) {
  const m = screenMetrics(s);
  const bezel = s.bezel / 1000;
  const gap = s.gap / 1000;
  const riser = s.riser / 100;
  const angle = s.arrayAngle * DEG;
  const count = Math.min(3, Math.max(1, Math.round(s.count)));
  const sidePortrait = s.sideOrient === 'portrait';

  const items = [];
  const centreIdx = (count - 1) / 2;
  const odd = count % 2 === 1;

  // Each panel turns in by `angle` relative to its neighbour, so the row is
  // symmetric about the centre whether the count is odd or even.
  const yawOf = (i) => -(i - centreIdx) * angle;

  const seat = (i, portrait) => {
    const half = halfExtents(m, bezel, portrait);
    const y = Math.max(riser + half.imgH / 2, half.outerH / 2);
    return { i, portrait, half, y, row: 0, primary: false };
  };

  let seamR = { x: 0, z: 0 };
  let seamL = { x: 0, z: 0 };
  let gapR = gap;
  let gapL = gap;

  if (odd) {
    // the middle panel stays square-on; it is the one you face
    const it = seat(centreIdx, false);
    Object.assign(it, { x: 0, z: 0, yaw: 0, primary: true });
    items[centreIdx] = it;
    seamR = { x: it.half.hx, z: it.half.hz };
    seamL = { x: -it.half.hx, z: it.half.hz };
  } else {
    // no middle panel: the two innermost share the centre gap
    gapR = gap / 2;
    gapL = gap / 2;
  }

  for (let i = Math.ceil(centreIdx + 0.001); i < count; i++) {
    const it = seat(i, sidePortrait);
    const yaw = yawOf(i);
    const c = rotate(yaw, gapR + it.half.hx, -it.half.hz);
    Object.assign(it, { x: seamR.x + c.x, z: seamR.z + c.z, yaw, primary: !odd && i === Math.ceil(centreIdx) });
    items[i] = it;
    const n = rotate(yaw, gapR + it.half.hx * 2, 0);
    seamR = { x: seamR.x + n.x, z: seamR.z + n.z };
    gapR = gap;
  }

  for (let i = Math.floor(centreIdx - 0.001); i >= 0; i--) {
    const it = seat(i, sidePortrait);
    const yaw = yawOf(i);
    const c = rotate(yaw, -(gapL + it.half.hx), -it.half.hz);
    Object.assign(it, { x: seamL.x + c.x, z: seamL.z + c.z, yaw });
    items[i] = it;
    const n = rotate(yaw, -(gapL + it.half.hx * 2), 0);
    seamL = { x: seamL.x + n.x, z: seamL.z + n.z };
    gapL = gap;
  }

  // second row, centred over the main row
  if (s.topMonitor && s.topMonitor !== 'none') {
    const portrait = s.topMonitor === 'portrait';
    const half = halfExtents(m, bezel, portrait);
    const rowTop = Math.max(...items.map((it) => it.y + it.half.outerH / 2));
    items.push({
      i: items.length,
      x: 0,
      z: 0,
      yaw: 0,
      portrait,
      half,
      y: rowTop + gap + half.outerH / 2,
      row: 1,
      primary: false,
    });
  }

  // outermost image corners, for field of view and desk fit
  const edges = [];
  for (const it of items) {
    for (const side of [-1, 1]) {
      const e = rotate(it.yaw, side * it.half.hx, it.half.hz);
      edges.push({ x: it.x + e.x, z: it.z + e.z });
    }
  }
  const xs = edges.map((e) => e.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  const row0 = items.filter((it) => it.row === 0);
  const primary = items.find((it) => it.primary) || row0[0];

  return {
    items,
    m,
    bezel,
    edges,
    minX,
    maxX,
    spanX: maxX - minX,
    imageTop: Math.max(...items.map((it) => it.y + it.half.imgH / 2)),
    imageBottom: Math.min(...items.map((it) => it.y - it.half.imgH / 2)),
    rowTop: Math.max(...row0.map((it) => it.y + it.half.imgH / 2)),
    rowBottom: Math.min(...row0.map((it) => it.y - it.half.imgH / 2)),
    primary,
    count: items.length,
  };
}
