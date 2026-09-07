// Central state, presets and URL (de)serialisation.

export const IN_TO_M = 0.0254;

export const DEFAULTS = {
  diagonal: 27,        // inches, measured flat/diagonally across the panel
  aspect: '16:9',
  curved: false,
  curve: 1800,         // curvature radius in mm
  resolution: '2560x1440',
  bezel: 7,            // mm
  riser: 8,            // cm, screen bottom above the desk surface
  tilt: 5,             // degrees, positive tilts the top away from the viewer
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
 * All derived screen geometry, in metres.
 * The diagonal of a curved monitor is quoted as if the panel were flattened,
 * so the flat width/height below are also the arc length / height of the curve.
 */
export function screenMetrics(s = state) {
  const { w, h } = aspectRatio(s.aspect);
  const hyp = Math.hypot(w, h);
  const diag = s.diagonal * IN_TO_M;
  const width = (diag * w) / hyp;    // arc length for a curved panel
  const height = (diag * h) / hyp;

  const radius = s.curved ? s.curve / 1000 : Infinity;
  const wrap = s.curved ? width / radius : 0;                       // radians
  const sagitta = s.curved ? radius * (1 - Math.cos(wrap / 2)) : 0; // curve depth
  const chord = s.curved ? 2 * radius * Math.sin(wrap / 2) : width; // edge-to-edge straight line

  return { width, height, diag, radius, wrap, sagitta, chord, aspectW: w, aspectH: h };
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
  for (const k of KEYS) {
    if (s[k] === DEFAULTS[k]) continue;
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

export function matchPreset(s = state) {
  for (const preset of PRESETS) {
    if (!preset.p) continue;
    const ok = Object.entries(preset.p).every(([k, v]) => s[k] === v);
    if (ok) return preset.id;
  }
  return 'custom';
}
