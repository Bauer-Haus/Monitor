// The monitor: chassis (curved or flat), bezel, emissive screen surface and stand.

import * as THREE from 'three';
import { screenMetrics, screenPoint } from './config.js';
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
function chassisShape(m, depth) {
  const shape = new THREE.Shape();
  const SEG = 48;

  const front = [];
  const back = [];
  for (let i = 0; i <= SEG; i++) {
    const u = -0.5 + i / SEG;
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

export class Monitor {
  constructor() {
    this.group = new THREE.Group();          // origin at the desk surface, screen centre at x=0,z=0
    this.panelPivot = new THREE.Group();
    this.stand = new THREE.Group();
    this.group.add(this.stand, this.panelPivot);
    this.disposables = [];
    this.screenCentre = new THREE.Vector3();
    this.metrics = null;
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.panelPivot.clear();
    this.stand.clear();
  }

  update(state) {
    this.dispose();
    const m = screenMetrics(state);
    this.metrics = m;

    const bezel = Math.min(state.bezel / 1000, m.height / 3);
    const riser = state.riser / 100;

    // ---- chassis -------------------------------------------------------
    const shape = chassisShape(m, CHASSIS_DEPTH);
    const chassis = new THREE.Mesh(extrudeUpright(shape, m.height), bodyMaterial);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.disposables.push(chassis.geometry);
    this.panelPivot.add(chassis);

    // ---- bezel face (matte black frame just in front of the chassis) ----
    const bezelGeo = surfaceGeometry(m, m.width, m.height, BEZEL_LIFT);
    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMaterial);
    this.disposables.push(bezelGeo);
    this.panelPivot.add(bezelMesh);

    // ---- active screen -------------------------------------------------
    const screenW = Math.max(0.02, m.width - bezel * 2);
    const screenH = Math.max(0.02, m.height - bezel * 2);
    const screenGeo = surfaceGeometry(m, screenW, screenH, SCREEN_LIFT);
    const texture = makeScreenTexture(state.content, screenW / screenH);
    const screenMat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: true });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    this.disposables.push(screenGeo, screenMat, texture);
    this.panelPivot.add(screen);

    // ---- rear housing --------------------------------------------------
    // A 1 inch panel needs somewhere to put the electronics, so slim monitors
    // carry a shallow raised block across the middle of the back.
    const housingW = Math.min(m.width * 0.55, 0.42);
    const housingH = Math.min(m.height * 0.62, 0.24);
    const housingGeo = roundedBox(housingW, housingH, HOUSING_DEPTH, 0.02, 0.006);
    const housing = new THREE.Mesh(housingGeo, housingMaterial);
    housing.position.set(0, 0, -CHASSIS_DEPTH - HOUSING_DEPTH / 2 + 0.004);
    housing.castShadow = true;
    this.disposables.push(housingGeo);
    this.panelPivot.add(housing);

    // ---- stand ---------------------------------------------------------
    const columnZ = -CHASSIS_DEPTH - HOUSING_DEPTH - 0.028;

    const baseW = THREE.MathUtils.clamp(m.width * 0.28, 0.16, 0.34);
    const baseD = THREE.MathUtils.clamp(m.height * 0.42, 0.13, 0.24);
    const baseGeo = new THREE.CylinderGeometry(baseW / 2, baseW / 2, 0.016, 32);
    baseGeo.scale(1, 1, baseD / baseW);
    const base = new THREE.Mesh(baseGeo, standMaterial);
    base.position.set(0, 0.008, columnZ);
    base.castShadow = true;
    base.receiveShadow = true;
    this.disposables.push(baseGeo);
    this.stand.add(base);

    const neckH = Math.max(0.04, riser + m.height * 0.35);
    const neckGeo = new THREE.BoxGeometry(0.075, neckH, 0.03);
    const neck = new THREE.Mesh(neckGeo, standMaterial);
    neck.position.set(0, neckH / 2, columnZ);
    neck.castShadow = true;
    this.disposables.push(neckGeo);
    this.stand.add(neck);

    // bridges the column to the back of the panel; its front end hides inside the body
    const armBack = columnZ - 0.02;
    const armFront = -CHASSIS_DEPTH * 0.4;
    const armGeo = new THREE.BoxGeometry(0.075, 0.05, armFront - armBack);
    const arm = new THREE.Mesh(armGeo, standMaterial);
    arm.position.set(0, riser + m.height * 0.35, (armFront + armBack) / 2);
    arm.castShadow = true;
    this.disposables.push(armGeo);
    this.stand.add(arm);

    // ---- placement -----------------------------------------------------
    this.panelPivot.position.set(0, riser + m.height / 2, 0);
    this.panelPivot.rotation.x = -THREE.MathUtils.degToRad(state.tilt);

    this.screenCentre.set(0, this.group.position.y + this.panelPivot.position.y, this.group.position.z);
    return m;
  }
}
