// Central state, presets and URL (de)serialisation.

export const IN_TO_M = 0.0254;

// Roughly the horizontal span both eyes take in at once. The full field of a
// single eye is wider, but this binocular overlap is what reads as "what you
// see", and it is what the eye-level view renders.
export const HUMAN_HFOV = 114;

export const DEFAULTS = {
  sizeMode: 'diagonal', // 'diagonal' (diagonal + aspect) or 'manual' (exact width x height)
  diagonal: 27,        // inches, measured flat/diagonally across the image area
  aspect: '16:9',
  panelW: 598,         // mm, image area width — used in manual mode (matches 27" 16:9)
  panelH: 336,         // mm, image area height
  curved: false,
  curve: 1800,         // curvature radius in mm
  resolution: '2560x1440',
  bezel: 7,            // mm

  // the array
  count: 1,            // monitors side by side, 1-3
  arrayAngle: 25,      // degrees each panel turns in towards its neighbour
  gap: 8,              // mm between panel bodies
  sideOrient: 'landscape', // orientation of the outer panels: 'landscape' or 'portrait'
  topMonitor: 'none',  // second row above the centre: 'none', 'landscape' or 'portrait'

  riser: 8,            // cm, screen bottom above the desk surface
  tilt: 5,             // degrees, positive tilts the top away from the viewer
  deskWidth: 140,      // cm, left to right
  deskHeight: 74,      // cm
  deskDepth: 75,       // cm
  personHeight: 175,   // cm
  distance: 70,        // cm, eye to screen centre
  showPerson: true,
  content: 'desktop',
  guides: false,
  units: false,        // false = imperial-ish (inches), true = metric
};

// key -> short code, so shared links stay readable
const KEYS = Object.keys(DEFAULTS);

export const PRESETS = [
  { id: 'custom', name: 'Custom…' },
  { id: '24-16-9',  name: '24" 16:9 — office standard',      p: { diagonal: 24, aspect: '16:9',  curved: false, resolution: '1920x1080', riser: 8 } },
  { id: '27-16-9',  name: '27" 16:9 — the popular one',      p: { diagonal: 27, aspect: '16:9',  curved: false, resolution: '2560x1440', riser: 8 } },
  { id: '32-16-9',  name: '32" 16:9 4K',                     p: { diagonal: 32, aspect: '16:9',  curved: false, resolution: '3840x2160', riser: 6 } },
  { id: '32-16-9c', name: '32" 16:9 curved 1500R',           p: { diagonal: 32, aspect: '16:9',  curved: true,  curve: 1500, resolution: '3840x2160', riser: 6 } },
  { id: '34-21-9',  name: '34" 21:9 ultrawide 1900R',        p: { diagonal: 34, aspect: '21:9',  curved: true,  curve: 1900, resolution: '3440x1440', riser: 6 } },
  { id: '38-21-9',  name: '38" 21:9 ultrawide 2300R',        p: { diagonal: 38, aspect: '21:9',  curved: true,  curve: 2300, resolution: '3840x1600', riser: 5 } },
  { id: '40-21-9',  name: '40" 21:9 5K2K 2500R',             p: { diagonal: 40, aspect: '21:9',  curved: true,  curve: 2500, resolution: '5120x2160', riser: 5 } },
  { id: '45-21-9',  name: '45" 21:9 OLED 800R',              p: { diagonal: 45, aspect: '21:9',  curved: true,  curve: 800,  resolution: '3440x1440', riser: 4 } },
  { id: '49-32-9',  name: '49" 32:9 super ultrawide 1000R',  p: { diagonal: 49, aspect: '32:9',  curved: true,  curve: 1000, resolution: '5120x1440', riser: 4 } },
  { id: '57-32-9',  name: '57" 32:9 dual-4K 1000R',          p: { diagonal: 57, aspect: '32:9',  curved: true,  curve: 1000, resolution: '7680x2160', riser: 3 } },
  { id: '27-16-10', name: '27" 16:10 — taller workhorse',    p: { diagonal: 27, aspect: '16:10', curved: false, resolution: '2560x1440', riser: 8 } },
  { id: '19-4-3',   name: '19" 4:3 — retro',                 p: { diagonal: 19, aspect: '4:3',   curved: false, resolution: '1920x1080', riser: 10 } },

  { id: 'dual-34',  name: '2 × 34" 21:9 curved 1900R',        p: { count: 2, diagonal: 34, aspect: '21:9', curved: true, curve: 1900, resolution: '3440x1440', riser: 6, arrayAngle: 22, deskWidth: 220 } },
  { id: 'triple-27', name: '3 × 27" 16:9',                    p: { count: 3, diagonal: 27, aspect: '16:9', curved: false, resolution: '2560x1440', riser: 8, arrayAngle: 28, deskWidth: 220 } },
  { id: 'triple-27p', name: '3 × 27" — portrait wings',       p: { count: 3, diagonal: 27, aspect: '16:9', curved: false, resolution: '2560x1440', riser: 8, arrayAngle: 35, sideOrient: 'portrait', deskWidth: 200 } },
  { id: 'stack-27', name: '27" + 27" stacked above',          p: { count: 1, diagonal: 27, aspect: '16:9', curved: false, resolution: '2560x1440', riser: 4, topMonitor: 'landscape' } },
  { id: 'cockpit',  name: '3 × 27" + one above — cockpit',    p: { count: 3, diagonal: 27, aspect: '16:9', curved: false, resolution: '2560x1440', riser: 4, arrayAngle: 30, topMonitor: 'landscape', deskWidth: 220 } },
];

export const state = { ...DEFAULTS };

export function aspectRatio(aspect) {
  const [w, h] = aspect.split(':').map(Number);
  return { w, h, ratio: w / h };
}

export function resolutionOf(res) {
  const [w, h] = res.split('x').map(Number);
  return { w, h };
}

/**
 * All derived screen geometry, in metres. `width` and `height` describe the
 * active image area — the figure a spec sheet quotes, and what the diagonal
 * measures. The diagonal of a curved monitor is quoted as if the panel were
 * flattened, so `width` is also the arc length of the curve.
 */
export function screenMetrics(s = state) {
  const manual = s.sizeMode === 'manual';
  const { w, h } = aspectRatio(s.aspect);
  const hyp = Math.hypot(w, h);

  const width = manual ? s.panelW / 1000 : (s.diagonal * IN_TO_M * w) / hyp;
  const height = manual ? s.panelH / 1000 : (s.diagonal * IN_TO_M * h) / hyp;
  const diag = Math.hypot(width, height);

  const radius = s.curved ? s.curve / 1000 : Infinity;
  const wrap = s.curved ? width / radius : 0;                       // radians
  const sagitta = s.curved ? radius * (1 - Math.cos(wrap / 2)) : 0; // curve depth
  const chord = s.curved ? 2 * radius * Math.sin(wrap / 2) : width; // edge-to-edge straight line

  return {
    width, height, diag, radius, wrap, sagitta, chord,
    diagonalIn: diag / IN_TO_M,
    ratio: height > 0 ? width / height : 1,
    aspectW: manual ? width : w,
    aspectH: manual ? height : h,
  };
}

/** Point on the screen's horizontal centre-line, u in [-0.5, 0.5]. Local space, screen centre at origin, facing +Z. */
export function screenPoint(u, m) {
  if (!isFinite(m.radius)) return { x: u * m.width, z: 0 };
  const phi = u * m.wrap;
  return { x: m.radius * Math.sin(phi), z: m.radius * (1 - Math.cos(phi)) };
}

// ---------------------------------------------------------------- URL state

export function encodeHash(s = state) {
  const parts = [];
  const manual = s.sizeMode === 'manual';
  for (const k of KEYS) {
    if (s[k] === DEFAULTS[k]) continue;
    // only the fields the active size mode actually uses
    if (!manual && (k === 'panelW' || k === 'panelH')) continue;
    if (manual && (k === 'diagonal' || k === 'aspect')) continue;
    parts.push(`${k}=${encodeURIComponent(typeof s[k] === 'boolean' ? (s[k] ? 1 : 0) : s[k])}`);
  }
  return parts.join('&');
}

export function decodeHash(hash, s = state) {
  const raw = (hash || '').replace(/^#/, '');
  if (!raw) return false;
  let touched = false;
  for (const pair of raw.split('&')) {
    const [k, v] = pair.split('=');
    if (!(k in DEFAULTS) || v === undefined) continue;
    const def = DEFAULTS[k];
    const val = decodeURIComponent(v);
    if (typeof def === 'boolean') s[k] = val === '1' || val === 'true';
    else if (typeof def === 'number') { const n = Number(val); if (Number.isFinite(n)) s[k] = n; }
    else s[k] = val;
    touched = true;
  }
  return touched;
}

// The fields a preset describes. Anything here that a preset does not mention
// goes back to its default when the preset is applied, so a three-wide portrait
// setup does not leak into the next preset you pick. Everything else — the desk,
// the person, the view — is yours and is left alone unless the preset says so.
const PRESET_KEYS = [
  'sizeMode', 'diagonal', 'aspect', 'curved', 'curve', 'resolution',
  'riser', 'count', 'arrayAngle', 'sideOrient', 'topMonitor',
];

export function applyPreset(preset, s = state) {
  if (!preset || !preset.p) return;
  for (const k of PRESET_KEYS) s[k] = k in preset.p ? preset.p[k] : DEFAULTS[k];
  for (const [k, v] of Object.entries(preset.p)) s[k] = v;   // anything extra, e.g. deskWidth
}

export function matchPreset(s = state) {
  if (s.sizeMode === 'manual') return 'custom';
  for (const preset of PRESETS) {
    if (!preset.p) continue;
    const ok = PRESET_KEYS.every((k) => s[k] === (k in preset.p ? preset.p[k] : DEFAULTS[k]))
      && Object.entries(preset.p).every(([k, v]) => s[k] === v);
    if (ok) return preset.id;
  }
  return 'custom';
}
