// DOM wiring: reads the controls into `state`, writes the derived numbers back out.

import { state, DEFAULTS, PRESETS, screenMetrics, resolutionOf, matchPreset, encodeHash, HUMAN_HFOV } from './config.js';

const $ = (id) => document.getElementById(id);

const RANGES = ['diagonal', 'curve', 'bezel', 'riser', 'tilt', 'deskHeight', 'deskDepth', 'personHeight', 'distance'];
const SELECTS = ['aspect', 'resolution', 'content'];
const CHECKS = ['curved', 'showPerson', 'guides', 'units'];

const M_TO_IN = 39.3701;

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
}

export function writeControls() {
  for (const id of RANGES) $(id).value = state[id];
  for (const id of SELECTS) $(id).value = state[id];
  for (const id of CHECKS) $(id).checked = state[id];
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
}

/** @param {{eyeY:number, screenTopY:number, screenBottomY:number, distance?:number}} scene */
export function refreshStats(scene) {
  const metric = state.units;
  const m = screenMetrics(state);
  const res = resolutionOf(state.resolution);
  const distance = scene.distance ?? state.distance / 100;
  const fov = fieldOfView(m, distance);

  $('st-size').textContent = `${fmtLen(m.width, metric)} × ${fmtLen(m.height, metric)}`;
  $('st-area').textContent = fmtArea(m.width * m.height, metric);

  const ppi = Math.hypot(res.w, res.h) / state.diagonal;
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
  for (const id of [...RANGES, ...SELECTS, ...CHECKS]) {
    $(id).addEventListener('input', handle);
    $(id).addEventListener('change', handle);
  }

  presetSel.addEventListener('change', () => {
    const preset = PRESETS.find((p) => p.id === presetSel.value);
    if (!preset || !preset.p) return;
    Object.assign(state, preset.p);
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
