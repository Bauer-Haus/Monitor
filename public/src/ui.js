// DOM wiring: reads the controls into `state`, writes the derived numbers back out.

import { state, DEFAULTS, PRESETS, screenMetrics, resolutionOf, matchPreset, encodeHash, HUMAN_HFOV } from './config.js';

const $ = (id) => document.getElementById(id);

const RANGES = ['diagonal', 'curve', 'bezel', 'riser', 'tilt', 'deskHeight', 'deskDepth', 'personHeight', 'distance'];
const SELECTS = ['sizeMode', 'aspect', 'resolution', 'content'];
const CHECKS = ['curved', 'showPerson', 'guides', 'units'];
const NUMBERS = ['panelW', 'panelH'];

// `units` and `sizeMode` are wired by hand: both need work done in a set order
// around the value they change, so they are kept out of the generic handler.
const SELF_WIRED = new Set(['units', 'sizeMode']);

const M_TO_IN = 39.3701;
const MM_LIMITS = { panelW: [40, 2500], panelH: [30, 1600] };

// Manual dimensions are held in millimetres and drawn in whichever unit is
// active; `displayMetric` tracks the unit the boxes currently hold, so a
// units toggle cannot be misread as the user retyping the number.
let displayMetric = DEFAULTS.units;
const mmPerUnit = (metric) => (metric ? 1 : 25.4);

function readNumberInputs() {
  const f = mmPerUnit(displayMetric);
  for (const id of NUMBERS) {
    const raw = $(id).value.trim();
    if (raw === '') continue;                       // mid-edit: keep the last good value
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    const [lo, hi] = MM_LIMITS[id];
    state[id] = Math.round(Math.min(hi, Math.max(lo, n * f)) * 10) / 10;
  }
}

function writeNumberInputs() {
  displayMetric = state.units;
  const f = mmPerUnit(displayMetric);
  for (const id of NUMBERS) {
    const [lo, hi] = MM_LIMITS[id];
    const el = $(id);
    el.min = (lo / f).toFixed(1);
    el.max = (hi / f).toFixed(1);
    el.step = displayMetric ? 0.5 : 0.05;
    el.value = (state[id] / f).toFixed(displayMetric ? 1 : 2);
  }
  const label = displayMetric ? 'mm' : 'in';
  $('panelW-unit').textContent = label;
  $('panelH-unit').textContent = label;
}

/** Closest listed aspect ratio to a width/height ratio, for leaving manual mode. */
function nearestAspect(ratio) {
  let best = state.aspect;
  let bestDelta = Infinity;
  for (const opt of $('aspect').options) {
    const [w, h] = opt.value.split(':').map(Number);
    const delta = Math.abs(w / h - ratio);
    if (delta < bestDelta) { bestDelta = delta; best = opt.value; }
  }
  return best;
}

function fmtLen(metres, metric, digits = 1) {
  return metric
    ? `${(metres * 100).toFixed(digits)} cm`
    : `${(metres * M_TO_IN).toFixed(digits)} in`;
}

function fmtSmall(metres, metric) {
  return metric
    ? `${(metres * 1000).toFixed(0)} mm`
    : `${(metres * M_TO_IN).toFixed(2)} in`;
}

function fmtArea(sqm, metric) {
  return metric
    ? (sqm >= 0.1 ? `${sqm.toFixed(2)} m²` : `${(sqm * 10000).toFixed(0)} cm²`)
    : `${(sqm * M_TO_IN * M_TO_IN).toFixed(0)} in²`;
}

/** Angle subtended by the whole screen, seen from `distance` metres in front of its centre. */
function fieldOfView(m, distance) {
  // measured to where the edges actually sit, so a curve's forward wrap counts
  const edgeX = isFinite(m.radius) ? m.radius * Math.sin(m.wrap / 2) : m.width / 2;
  const h = Math.atan2(edgeX, Math.max(0.05, distance - m.sagitta));
  const v = Math.atan2(m.height / 2, Math.max(0.05, distance));
  return { h: h * 2 * (180 / Math.PI), v: v * 2 * (180 / Math.PI) };
}

export function readControls() {
  for (const id of RANGES) state[id] = Number($(id).value);
  for (const id of SELECTS) state[id] = $(id).value;
  for (const id of CHECKS) state[id] = $(id).checked;
  readNumberInputs();
}

export function writeControls() {
  for (const id of RANGES) $(id).value = state[id];
  for (const id of SELECTS) $(id).value = state[id];
  for (const id of CHECKS) $(id).checked = state[id];
  writeNumberInputs();
  $('preset').value = matchPreset(state);
}

export function refreshLabels() {
  const metric = state.units;
  $('diagonal-out').textContent = `${state.diagonal}″ (${(state.diagonal * 2.54).toFixed(0)} cm)`;
  $('curve-out').textContent = state.curved ? `${state.curve}R` : 'flat';
  $('bezel-out').textContent = metric ? `${state.bezel} mm` : `${(state.bezel / 25.4).toFixed(2)} in`;
  $('riser-out').textContent = metric ? `${state.riser} cm` : `${(state.riser / 2.54).toFixed(1)} in`;
  $('tilt-out').textContent = `${state.tilt}°`;
  $('deskHeight-out').textContent = metric ? `${state.deskHeight} cm` : `${(state.deskHeight / 2.54).toFixed(1)} in`;
  $('deskDepth-out').textContent = metric ? `${state.deskDepth} cm` : `${(state.deskDepth / 2.54).toFixed(1)} in`;
  $('personHeight-out').textContent = metric
    ? `${state.personHeight} cm`
    : `${Math.floor(state.personHeight / 2.54 / 12)}′${Math.round((state.personHeight / 2.54) % 12)}″`;
  $('distance-out').textContent = metric ? `${state.distance} cm` : `${(state.distance / 2.54).toFixed(0)} in`;
  $('curve-field').classList.toggle('disabled', !state.curved);

  const manual = state.sizeMode === 'manual';
  $('size-diagonal').hidden = manual;
  $('size-manual').hidden = !manual;
}

/** @param {{eyeY:number, screenTopY:number, screenBottomY:number, distance?:number}} scene */
export function refreshStats(scene) {
  const metric = state.units;
  const m = screenMetrics(state);
  const res = resolutionOf(state.resolution);
  const distance = scene.distance ?? state.distance / 100;
  const fov = fieldOfView(m, distance);

  $('st-size').textContent = `${fmtLen(m.width, metric)} × ${fmtLen(m.height, metric)}`;
  $('st-diagonal').textContent = `${fmtLen(m.diag, metric)} · ${m.ratio.toFixed(2)}:1`;
  $('st-area').textContent = fmtArea(m.width * m.height, metric);

  const ppi = Math.hypot(res.w, res.h) / m.diagonalIn;
  const pitch = (m.width * 1000) / res.w;
  $('st-ppi').textContent = `${ppi.toFixed(0)} PPI · ${pitch.toFixed(3)} mm pitch`;

  $('st-sagitta').textContent = state.curved ? fmtSmall(m.sagitta, metric) : '—';
  $('st-wrap').textContent = state.curved
    ? `${(m.wrap * 180 / Math.PI).toFixed(1)}° · ${state.curve}R`
    : 'flat panel';
  $('st-hfov').textContent = `${fov.h.toFixed(1)}° · ${Math.round((fov.h / HUMAN_HFOV) * 100)}% of vision`;
  $('st-vfov').textContent = `${fov.v.toFixed(1)}°`;

  const delta = scene.eyeY - scene.screenTopY;
  $('st-eye').textContent = Math.abs(delta) < 0.005
    ? 'level with the top edge'
    : `${fmtLen(Math.abs(delta), metric)} ${delta > 0 ? 'above' : 'below'} top edge`;

  const notes = [];
  if (state.curved && Math.abs(distance - m.radius) < 0.2) {
    notes.push('You are sitting close to the curve’s centre point — every part of the screen is about the same distance from your eyes.');
  } else if (state.curved && distance < m.radius * 0.45) {
    notes.push('You are much closer than the curve radius, so the edges wrap noticeably around you.');
  }
  if (fov.h > 100) notes.push('Over 100° wide: expect to turn your head to reach the edges.');
  else if (fov.h < 25) notes.push('Under 25° wide: the screen occupies a small part of your vision — you could sit closer.');
  if (scene.eyeY < scene.screenBottomY) notes.push('Your eyes are below the bottom edge — the screen is mounted quite high.');
  else if (scene.eyeY > scene.screenTopY + 0.08) notes.push('Your eyes are well above the top edge — consider raising the screen.');
  $('st-note').textContent = notes.join(' ');
}

export function initUI({ onChange, onView, onReset, onLayout }) {
  const presetSel = $('preset');
  for (const p of PRESETS) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    presetSel.appendChild(opt);
  }

  const handle = () => { readControls(); onChange(); };
  for (const id of [...RANGES, ...NUMBERS, ...SELECTS, ...CHECKS]) {
    if (SELF_WIRED.has(id)) continue;
    $(id).addEventListener('input', handle);
    $(id).addEventListener('change', handle);
  }

  // Switching modes carries the current size across, so the monitor on screen
  // does not jump when you change how you describe it.
  $('sizeMode').addEventListener('change', () => {
    const next = $('sizeMode').value;
    if (next === state.sizeMode) return;
    const m = screenMetrics(state);
    if (next === 'manual') {
      state.panelW = Math.round(m.width * 10000) / 10;
      state.panelH = Math.round(m.height * 10000) / 10;
    } else {
      state.aspect = nearestAspect(m.ratio);
      state.diagonal = Math.min(65, Math.max(13, Math.round(m.diagonalIn * 2) / 2));
    }
    state.sizeMode = next;
    writeControls();
    onChange();
  });

  // Redraw the manual boxes in the new unit rather than reinterpreting them.
  $('units').addEventListener('change', () => {
    state.units = $('units').checked;
    writeNumberInputs();
    onChange();
  });

  presetSel.addEventListener('change', () => {
    const preset = PRESETS.find((p) => p.id === presetSel.value);
    if (!preset || !preset.p) return;
    Object.assign(state, { sizeMode: 'diagonal' }, preset.p);
    writeControls();
    onChange();
  });

  document.querySelectorAll('.views button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.views button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onView(btn.dataset.view);
    });
  });

  const toggle = $('panel-toggle');
  const panel = $('panel');
  toggle.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    toggle.classList.toggle('shifted', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    onLayout?.();
  });
  panel.addEventListener('transitionend', () => onLayout?.());
  if (window.innerWidth < 720) {
    panel.classList.add('collapsed');
    toggle.classList.add('shifted');
    toggle.setAttribute('aria-expanded', 'false');
  }

  $('share').addEventListener('click', async (e) => {
    const url = `${location.origin}${location.pathname}#${encodeHash(state)}`;
    history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      const btn = e.currentTarget;
      const old = btn.textContent;
      btn.textContent = 'Link copied ✓';
      setTimeout(() => { btn.textContent = old; }, 1600);
    } catch {
      prompt('Copy this link:', url);
    }
  });

  $('reset').addEventListener('click', () => {
    Object.assign(state, DEFAULTS);
    history.replaceState(null, '', `${location.origin}${location.pathname}`);
    writeControls();
    onReset();
  });
}

export function syncHash() {
  const hash = encodeHash(state);
  history.replaceState(null, '', hash ? `#${hash}` : `${location.pathname}`);
}
