// The monitors: chassis (curved or flat), bezel, emissive screen surface and
// stand, assembled into however many panels the arrangement calls for.

import * as THREE from 'three';
import { screenPoint } from './config.js';
import { rigLayout } from './rig.js';
import { makeScreenTexture } from './screenTexture.js';
import { roundedBox } from './geometry.js';

const CHASSIS_DEPTH = 0.0254; // panel thickness: 1 inch, in line with current slim monitors
const HOUSING_DEPTH = 0.026;  // the electronics bulge behind the middle of the panel
const CHASSIS_BEVEL = 0.0025; // rounded lip around the chassis; the extrusion bulges forward by this much
const BEZEL_LIFT = CHASSIS_BEVEL + 0.0015;   // bezel face sits just proud of the chassis
const SCREEN_LIFT = BEZEL_LIFT + 0.0012;     // active screen sits just proud of the bezel

const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.55, metalness: 0.25 });
const bezelMaterial = new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.42, metalness: 0.1 });
const standMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.4, metalness: 0.6 });
const housingMaterial = new THREE.MeshStandardMaterial({ color: 0x1d2025, roughness: 0.6, metalness: 0.2 });

/**
 * Horizontal cross-section of the panel as a THREE.Shape.
 * Shape-space y maps to -z once the extrusion is rotated upright.
 */
function chassisShape(m, depth, span = 1) {
  const shape = new THREE.Shape();
  const SEG = 48;

  const front = [];
  const back = [];
  for (let i = 0; i <= SEG; i++) {
    const u = (-0.5 + i / SEG) * span;
    const f = screenPoint(u, m);
    front.push([f.x, -f.z]);
    if (isFinite(m.radius)) {
      const phi = u * m.wrap;
      const R = m.radius + depth;
      back.push([R * Math.sin(phi), -(m.radius - R * Math.cos(phi))]);
    } else {
      back.push([f.x, depth]);
    }
  }

  shape.moveTo(front[0][0], front[0][1]);
  for (let i = 1; i < front.length; i++) shape.lineTo(front[i][0], front[i][1]);
  for (let i = back.length - 1; i >= 0; i--) shape.lineTo(back[i][0], back[i][1]);
  shape.closePath();
  return shape;
}

/** Extrudes a horizontal cross-section vertically into an upright slab centred on the origin. */
function extrudeUpright(shape, height, bevel = CHASSIS_BEVEL) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -(height - bevel * 2) / 2);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Curved (or flat) surface mesh with UVs, offset `lift` metres towards the viewer. */
function surfaceGeometry(m, width, height, lift) {
  const SEG_X = isFinite(m.radius) ? 96 : 1;
  const SEG_Y = 1;
  const geo = new THREE.PlaneGeometry(1, height, SEG_X, SEG_Y);
  const pos = geo.attributes.position;
  const uScale = width / m.width; // fraction of the full panel arc this surface covers

  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) * uScale; // PlaneGeometry x runs -0.5..0.5
    if (isFinite(m.radius)) {
      const phi = u * m.wrap;
      const R = m.radius - lift;
      pos.setX(i, R * Math.sin(phi));
      pos.setZ(i, m.radius - R * Math.cos(phi));
    } else {
      pos.setX(i, u * m.width);
      pos.setZ(i, lift);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** One panel: chassis, bezel, screen and the housing behind it, centred on its image area. */
function buildPanel(m, state, portrait, store) {
  const group = new THREE.Group();

  const bezel = state.bezel / 1000;
  const outerW = m.width + bezel * 2;
  const outerH = m.height + bezel * 2;

  const shape = chassisShape(m, CHASSIS_DEPTH, outerW / m.width);
  const chassis = new THREE.Mesh(extrudeUpright(shape, outerH), bodyMaterial);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  store.push(chassis.geometry);
  group.add(chassis);

  const bezelGeo = surfaceGeometry(m, outerW, outerH, BEZEL_LIFT);
  store.push(bezelGeo);
  group.add(new THREE.Mesh(bezelGeo, bezelMaterial));

  const screenGeo = surfaceGeometry(m, m.width, m.height, SCREEN_LIFT);
  // A pivoted panel shows a portrait desktop, so the picture is drawn at the
  // proportions it ends up with on the wall and turned to meet the rolled UVs.
  const texture = makeScreenTexture(state.content, portrait ? m.height / m.width : m.width / m.height);
  if (portrait) {
    texture.center.set(0.5, 0.5);
    texture.rotation = Math.PI / 2;
  }
  const screenMat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: true });
  store.push(screenGeo, screenMat, texture);
  group.add(new THREE.Mesh(screenGeo, screenMat));

  const housingW = Math.min(m.width * 0.55, 0.42);
  const housingH = Math.min(m.height * 0.62, 0.24);
  const housingGeo = roundedBox(housingW, housingH, HOUSING_DEPTH, 0.02, 0.006);
  const housing = new THREE.Mesh(housingGeo, housingMaterial);
  housing.position.set(0, 0, -CHASSIS_DEPTH - HOUSING_DEPTH / 2 + 0.004);
  housing.castShadow = true;
  store.push(housingGeo);
  group.add(housing);

  return group;
}

/** Foot, column and arm for one panel, built in that panel's own frame. */
function buildStand(m, height, store) {
  const stand = new THREE.Group();
  const columnZ = -CHASSIS_DEPTH - HOUSING_DEPTH - 0.028;

  const baseW = THREE.MathUtils.clamp(m.width * 0.28, 0.16, 0.34);
  const baseD = THREE.MathUtils.clamp(m.height * 0.42, 0.13, 0.24);
  const baseGeo = new THREE.CylinderGeometry(baseW / 2, baseW / 2, 0.016, 32);
  baseGeo.scale(1, 1, baseD / baseW);
  const base = new THREE.Mesh(baseGeo, standMaterial);
  base.position.set(0, 0.008, columnZ);
  base.castShadow = true;
  base.receiveShadow = true;
  store.push(baseGeo);
  stand.add(base);

  const neckH = Math.max(0.04, height);
  const neckGeo = new THREE.BoxGeometry(0.075, neckH, 0.03);
  const neck = new THREE.Mesh(neckGeo, standMaterial);
  neck.position.set(0, neckH / 2, columnZ);
  neck.castShadow = true;
  store.push(neckGeo);
  stand.add(neck);

  const armBack = columnZ - 0.02;
  const armFront = -CHASSIS_DEPTH * 0.4;
  const armGeo = new THREE.BoxGeometry(0.075, 0.05, armFront - armBack);
  const arm = new THREE.Mesh(armGeo, standMaterial);
  arm.position.set(0, neckH, (armFront + armBack) / 2);
  arm.castShadow = true;
  store.push(armGeo);
  stand.add(arm);

  return stand;
}

/**
 * The whole arrangement: one to three panels across, optionally a second row,
 * each on its own stand. The group's origin is the desk surface at the centre
 * seam of the main row.
 */
export class MonitorRig {
  constructor() {
    this.group = new THREE.Group();
    this.panels = [];     // [{ pivot, item }] in layout order
    this.primary = null;  // the panel you sit square-on to
    this.layout = null;
    this.disposables = [];
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.group.clear();
    this.panels.length = 0;
  }

  update(state) {
    this.dispose();
    const layout = rigLayout(state);
    const { m } = layout;
    this.layout = layout;
    this.metrics = m;

    const tilt = THREE.MathUtils.degToRad(state.tilt);

    for (const item of layout.items) {
      const pivot = new THREE.Group();
      pivot.rotation.order = 'YXZ';   // roll in the panel's own frame, then tilt, then turn
      pivot.position.set(item.x, item.y, item.z);
      pivot.rotation.set(-tilt, item.yaw, item.portrait ? -Math.PI / 2 : 0);
      pivot.add(buildPanel(m, state, item.portrait, this.disposables));
      this.group.add(pivot);
      this.panels.push({ pivot, item });
      if (item.primary) this.primary = pivot;

      if (item.row === 0) {
        const stand = buildStand(m, item.y, this.disposables);
        stand.position.set(item.x, 0, item.z);
        stand.rotation.y = item.yaw;
        this.group.add(stand);
      }
    }

    // The second row rides a pole set back behind the main row rather than a
    // foot of its own, which is how stacked monitors are actually mounted.
    const top = layout.items.find((it) => it.row === 1);
    if (top) {
      const poleZ = -CHASSIS_DEPTH - HOUSING_DEPTH - 0.1;
      const poleGeo = new THREE.CylinderGeometry(0.028, 0.032, top.y, 16);
      const pole = new THREE.Mesh(poleGeo, standMaterial);
      pole.position.set(0, top.y / 2, poleZ);
      pole.castShadow = true;
      this.disposables.push(poleGeo);
      this.group.add(pole);

      const footGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.018, 28);
      const foot = new THREE.Mesh(footGeo, standMaterial);
      foot.position.set(0, 0.009, poleZ);
      foot.castShadow = true;
      foot.receiveShadow = true;
      this.disposables.push(footGeo);
      this.group.add(foot);

      const armGeo = new THREE.BoxGeometry(0.07, 0.05, Math.abs(poleZ) - CHASSIS_DEPTH * 0.4);
      const arm = new THREE.Mesh(armGeo, standMaterial);
      arm.position.set(0, top.y, (poleZ - CHASSIS_DEPTH * 0.4) / 2);
      arm.castShadow = true;
      this.disposables.push(armGeo);
      this.group.add(arm);
    }

    if (!this.primary) this.primary = this.panels[0].pivot;
    return layout;
  }
}
