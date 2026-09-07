// Scene assembly, layout and the render loop.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { state, decodeHash, HUMAN_HFOV } from './config.js';
import { buildRoom, Desk } from './room.js';
import { Monitor } from './monitor.js';
import { Person } from './person.js';
import { Guides } from './guides.js';
import { initUI, writeControls, refreshLabels, refreshStats, syncHash } from './ui.js';

const canvas = document.getElementById('view');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14161a);
scene.fog = new THREE.Fog(0x14161a, 8, 20);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
camera.position.set(1.45, 1.55, 2.15);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 0.28;
controls.maxDistance = 9;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 1.1, 0.2);

// ---------------------------------------------------------------- lighting

const hemi = new THREE.HemisphereLight(0xdfe6f2, 0x3a3d42, 0.55);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xfff4e6, 2.1);
key.position.set(2.6, 3.4, 2.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.02;
const sc = key.shadow.camera;
sc.left = -3.2; sc.right = 3.2; sc.top = 3.2; sc.bottom = -1.2; sc.near = 0.5; sc.far = 12;
sc.updateProjectionMatrix();
scene.add(key);

const fill = new THREE.DirectionalLight(0xbcd4ff, 0.5);
fill.position.set(-3, 2, 1.2);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.35);
rim.position.set(-0.6, 1.6, -3);
scene.add(rim);

// ---------------------------------------------------------------- contents

buildRoom(scene);

const desk = new Desk();
scene.add(desk.group);

const monitor = new Monitor();
scene.add(monitor.group);

const person = new Person();
scene.add(person.group);

const guides = new Guides();
scene.add(guides.group);

const DESK_BACK_Z = -0.26;   // world z of the desk's back edge; screen centre sits at z = 0

let currentView = 'orbit';

// From the seat you are the person, so the mannequin would only block the view.
function updatePersonVisibility() {
  person.group.visible = state.showPerson && currentView !== 'eye';
}

let lastInfo = null;

function rebuild() {
  const deskTop = state.deskHeight / 100;
  const deskDepth = state.deskDepth / 100;

  monitor.group.position.set(0, deskTop, 0);
  const m = monitor.update(state);

  const deskWidth = THREE.MathUtils.clamp(m.width + 0.5, 1.3, 3.2);
  desk.update(deskTop, deskDepth, deskWidth, DESK_BACK_Z);

  const stature = state.personHeight / 100;
  const eyeZ = state.distance / 100;
  const { eyeY } = person.update({ stature, eyeZ, deskTop, deskFrontZ: desk.frontZ });
  updatePersonVisibility();

  // world-space landmarks
  monitor.panelPivot.updateMatrixWorld(true);
  const centre = monitor.panelPivot.getWorldPosition(new THREE.Vector3());
  const topY = centre.y + Math.cos(THREE.MathUtils.degToRad(state.tilt)) * (m.height / 2);
  const bottomY = centre.y - Math.cos(THREE.MathUtils.degToRad(state.tilt)) * (m.height / 2);

  const eye = new THREE.Vector3(0, eyeY, eyeZ);
  guides.setVisible(state.guides);
  if (state.guides) guides.update(eye, monitor.panelPivot, m);

  // shadow + camera framing follow the size of the setup
  const span = Math.max(1.6, m.width * 0.8 + 1.2);
  sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -1.2;
  sc.updateProjectionMatrix();

  refreshLabels();
  refreshStats({
    eyeY,
    screenTopY: topY,
    screenBottomY: bottomY,
    distance: Math.hypot(eyeZ - centre.z, eyeY - centre.y),
  });
  syncHash();

  lastInfo = { m, centre, eye, deskTop };
  return lastInfo;
}

// The eye-level view renders the human binocular span (HUMAN_HFOV), so the
// monitor covers the same share of the frame as it would of your vision. Any
// flat projection stretches the outer edges; that is the projection, not the
// geometry. The vertical cap keeps tall, narrow windows from exploding.
const HUMAN_VFOV_MAX = 118;

/**
 * Vertical camera FOV that makes the *visible* part of the canvas span
 * `targetH` degrees horizontally, accounting for the control panel offset.
 */
function verticalFovForHorizontal(targetH) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const off = camera.view?.enabled ? camera.view.fullWidth - camera.view.width : 0;
  const target = THREE.MathUtils.degToRad(targetH);

  // horizontal angle covered by the canvas, given a vertical FOV
  const span = (v) => {
    const halfTan = Math.tan(v / 2) * ((w + off) / h);
    const right = halfTan * (2 * w / (w + off) - 1);
    return Math.atan(right) + Math.atan(halfTan);
  };

  let lo = THREE.MathUtils.degToRad(20);
  let hi = THREE.MathUtils.degToRad(HUMAN_VFOV_MAX);
  if (span(hi) <= target) return HUMAN_VFOV_MAX;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    if (span(mid) < target) lo = mid; else hi = mid;
  }
  return THREE.MathUtils.radToDeg((lo + hi) / 2);
}

/** Camera distance that frames a sphere of the given radius at the current aspect. */
function distanceFor(radius, fovDeg) {
  const vFov = THREE.MathUtils.degToRad(fovDeg);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(0.6, camera.aspect));
  return radius / Math.sin(Math.min(vFov, hFov) / 2);
}

function applyView(view, info) {
  currentView = view;
  updatePersonVisibility();
  const { m, centre, eye, deskTop } = info;

  // everything worth seeing sits inside this sphere
  const focus = new THREE.Vector3(0, deskTop * 0.75, 0.45);
  const radius = Math.max(m.width, 1.1) * 0.5 + 0.75;

  const place = (fov, azimuthDeg, elevationDeg, target, r = radius) => {
    camera.fov = fov;
    camera.updateProjectionMatrix();
    const d = distanceFor(r, fov);
    const az = THREE.MathUtils.degToRad(azimuthDeg);
    const el = THREE.MathUtils.degToRad(elevationDeg);
    camera.position.set(
      target.x + d * Math.cos(el) * Math.sin(az),
      target.y + d * Math.sin(el),
      target.z + d * Math.cos(el) * Math.cos(az),
    );
    controls.target.copy(target);
  };

  const hint = document.getElementById('view-hint');
  hint.hidden = view !== 'eye';
  hint.textContent = view === 'eye'
    ? `Rendered with a ${HUMAN_HFOV}° horizontal field of view, matching what both eyes take in at once.`
    : '';

  switch (view) {
    case 'eye': {
      // Sit in the person's seat and look at the screen with a human field of
      // view: no stepping back, so a panel that overflows the frame is a panel
      // that genuinely overflows your vision.
      camera.fov = verticalFovForHorizontal(HUMAN_HFOV);
      camera.updateProjectionMatrix();
      camera.position.copy(eye);
      controls.target.set(0, centre.y, centre.z);
      break;
    }
    case 'front': {
      // Head-on, from just high enough to see over the person.
      const headTop = eye.y + 0.14;
      const bottomEdge = centre.y - Math.cos(THREE.MathUtils.degToRad(state.tilt)) * (m.height / 2);
      const clearance = Math.max(0, headTop + 0.16 - bottomEdge) / Math.max(0.25, eye.z + 0.12 - centre.z);
      const elevation = state.showPerson
        ? THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(Math.atan(clearance)), 6, 44)
        : 6;
      place(38, 0, elevation, new THREE.Vector3(0, centre.y - 0.12, centre.z), Math.max(m.width * 0.62, 0.42) + 0.3);
      break;
    }
    case 'side':
      place(38, 90, 9, new THREE.Vector3(0, centre.y - 0.22, 0.42), Math.max(m.width * 0.3, 0.55) + 0.5);
      break;
    case 'top':
      place(45, 0.4, 84, new THREE.Vector3(0, 0.25, 0.45), Math.max(m.width * 0.5, 0.8) + 0.3);
      break;
    default:
      place(40, 36, 19, focus);
  }
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- lifecycle

function onChange() {
  const info = rebuild();
  if (currentView === 'eye') applyView('eye', info);   // the seat moves with the settings
}

if (decodeHash(location.hash)) { /* state came from the URL */ }
writeControls();

initUI({
  onChange,
  onView: (view) => applyView(view, rebuild()),
  onReset: () => applyView(currentView, rebuild()),
  onLayout: () => resize(),
});


// The control panel covers the left edge of the canvas, so nudge the frustum
// sideways to keep the setup centred in the part of the canvas you can see.
function panelWidth() {
  const panel = document.getElementById('panel');
  if (!panel || panel.classList.contains('collapsed')) return 0;
  const rect = panel.getBoundingClientRect();
  return rect.right > 0 ? Math.min(rect.width, window.innerWidth * 0.5) : 0;
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;

  const offset = panelWidth();
  if (offset > 8) camera.setViewOffset(w + offset, h, 0, 0, w, h);
  else camera.clearViewOffset();

  camera.updateProjectionMatrix();

  // the eye view's FOV depends on the window shape, so re-solve it
  if (currentView === 'eye' && lastInfo) applyView('eye', lastInfo);
}
window.addEventListener('resize', resize);
resize();

applyView('orbit', rebuild());

let hidden = false;
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  if (!hidden) {
    hidden = true;
    document.getElementById('loading').classList.add('hidden');
  }
});
