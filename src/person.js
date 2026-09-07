// A featureless seated mannequin plus an office chair, sized from the person's stature.
// Proportions follow common seated anthropometry ratios (fractions of standing height).

import * as THREE from 'three';
import { roundedBox } from './geometry.js';

const SKIN = new THREE.MeshStandardMaterial({ color: 0xb9bcc4, roughness: 0.75, metalness: 0.02 });
const CLOTH = new THREE.MeshStandardMaterial({ color: 0x8f939c, roughness: 0.9 });
const CHAIR_SOFT = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.85 });
const CHAIR_HARD = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.5, metalness: 0.5 });

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Capsule between two points. */
function bone(from, to, radius, material, store) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new THREE.CapsuleGeometry(radius, Math.max(0.001, len - radius * 2), 6, 14);
  store.push(geo);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  return mesh;
}

/** Elbow/knee position for a two-bone chain, bending towards `pole`. */
function twoBoneIK(root, target, l1, l2, pole) {
  const delta = new THREE.Vector3().subVectors(target, root);
  const dist = THREE.MathUtils.clamp(delta.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const dir = delta.clone().normalize();
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (perp.lengthSq() < 1e-8) perp.set(0, 1, 0).sub(dir.clone().multiplyScalar(dir.y));
  perp.normalize();
  return root.clone().add(dir.multiplyScalar(a)).add(perp.multiplyScalar(h));
}

export class Person {
  constructor() {
    this.group = new THREE.Group();  // person faces -Z (towards the monitor)
    this.disposables = [];
    this.eye = new THREE.Vector3();
    this.seatHeight = 0.45;
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.group.clear();
  }

  /**
   * @param {object} opts
   * @param {number} opts.stature      standing height, metres
   * @param {number} opts.eyeZ         world z of the eyes (person is placed to match)
   * @param {number} opts.deskTop      desk surface height, metres
   * @param {number} opts.deskFrontZ   world z of the desk's front edge
   */
  update({ stature, eyeZ, deskTop, deskFrontZ }) {
    this.dispose();
    const D = this.disposables;
    const g = this.group;
    const k = stature / 1.75;                       // scale factor vs. a 175 cm reference

    // --- seated key heights (above the floor) ---------------------------
    const seat = THREE.MathUtils.clamp(0.25 * stature, 0.38, 0.55);
    const hipY = seat + 0.075 * k;
    const shoulderY = seat + 0.345 * stature;
    const eyeY = seat + 0.455 * stature;
    const headY = eyeY + 0.035 * k;
    this.seatHeight = seat;

    // Eyes sit slightly forward of the hips; place the body from the eye target.
    const hipZ = eyeZ + 0.09 * k;
    g.position.set(0, 0, 0);
    this.eye.set(0, eyeY, eyeZ);

    // --- torso ----------------------------------------------------------
    const torsoLen = shoulderY - hipY;
    const torsoGeo = new THREE.CapsuleGeometry(0.115 * k, Math.max(0.02, torsoLen - 0.14 * k), 6, 18);
    D.push(torsoGeo);
    const torso = new THREE.Mesh(torsoGeo, CLOTH);
    torso.scale.set(1.45, 1, 0.86);
    torso.position.set(0, (hipY + shoulderY) / 2, hipZ - 0.015 * k);
    torso.rotation.x = -0.06;                        // leaning very slightly forward
    torso.castShadow = true;
    g.add(torso);

    // hips
    const hipGeo = new THREE.CapsuleGeometry(0.115 * k, 0.14 * k, 5, 16);
    D.push(hipGeo);
    const hips = new THREE.Mesh(hipGeo, CLOTH);
    hips.rotation.z = Math.PI / 2;
    hips.scale.set(1, 1, 0.9);
    hips.position.set(0, hipY - 0.02 * k, hipZ);
    hips.castShadow = true;
    g.add(hips);

    // --- neck + head ----------------------------------------------------
    const neckTop = V(0, headY - 0.05 * k, hipZ - 0.03 * k);
    g.add(bone(V(0, shoulderY - 0.02 * k, hipZ - 0.01 * k), neckTop, 0.046 * k, SKIN, D));

    const headGeo = new THREE.SphereGeometry(0.097 * k, 28, 20);
    D.push(headGeo);
    const head = new THREE.Mesh(headGeo, SKIN);
    head.scale.set(0.92, 1.12, 1);
    head.position.set(0, headY, hipZ - 0.035 * k);
    head.castShadow = true;
    g.add(head);

    // --- arms: hands rest on the desk -----------------------------------
    const upperArm = 0.186 * stature;
    const foreArm = 0.176 * stature;
    // hands rest on the desk, roughly a keyboard's distance in front of the torso
    const handZ = THREE.MathUtils.clamp(
      hipZ - 0.30 * k,
      hipZ - (upperArm + foreArm) * 0.85,
      deskFrontZ - 0.08,
    );
    for (const side of [-1, 1]) {
      const shoulder = V(side * 0.185 * k, shoulderY, hipZ - 0.02 * k);
      const hand = V(side * 0.19 * k, deskTop + 0.035, handZ);
      const elbow = twoBoneIK(shoulder, hand, upperArm, foreArm, V(side * 0.55, -0.72, 0.42).normalize());
      g.add(bone(shoulder, elbow, 0.049 * k, CLOTH, D));
      g.add(bone(elbow, hand, 0.041 * k, SKIN, D));

      const handGeo = new THREE.SphereGeometry(0.048 * k, 16, 12);
      D.push(handGeo);
      const handMesh = new THREE.Mesh(handGeo, SKIN);
      handMesh.scale.set(0.85, 0.55, 1.2);
      handMesh.position.copy(hand);
      handMesh.castShadow = true;
      g.add(handMesh);

      // shoulder cap
      const capGeo = new THREE.SphereGeometry(0.056 * k, 16, 12);
      D.push(capGeo);
      const cap = new THREE.Mesh(capGeo, CLOTH);
      cap.position.copy(shoulder);
      cap.castShadow = true;
      g.add(cap);
    }

    // --- legs -----------------------------------------------------------
    const thigh = 0.245 * stature;
    const shin = Math.max(0.2, seat - 0.055 * k);
    for (const side of [-1, 1]) {
      const hip = V(side * 0.095 * k, hipY - 0.03 * k, hipZ);
      const knee = V(side * 0.105 * k, seat + 0.035 * k, hipZ - thigh);
      const ankle = V(side * 0.105 * k, 0.055 * k, knee.z + 0.03 * k);
      g.add(bone(hip, knee, 0.078 * k, CLOTH, D));
      g.add(bone(knee, ankle, 0.062 * k, CLOTH, D));

      const footGeo = roundedBox(0.09 * k, 0.055 * k, 0.24 * k, 0.03, 0.012);
      D.push(footGeo);
      const foot = new THREE.Mesh(footGeo, CHAIR_HARD);
      foot.position.set(side * 0.105 * k, 0.028 * k, ankle.z - 0.075 * k);
      foot.castShadow = true;
      g.add(foot);
    }

    this.buildChair({ seat, hipZ, k });
    return { eyeY, seat };
  }

  buildChair({ seat, hipZ, k }) {
    const D = this.disposables;
    const g = this.group;
    const seatW = 0.46 * k;
    const seatD = 0.44 * k;
    const seatZ = hipZ - 0.13 * k;

    const cushionGeo = roundedBox(seatW, 0.075, seatD, 0.05, 0.02);
    D.push(cushionGeo);
    const cushion = new THREE.Mesh(cushionGeo, CHAIR_SOFT);
    cushion.position.set(0, seat - 0.037, seatZ);
    cushion.castShadow = true;
    cushion.receiveShadow = true;
    g.add(cushion);

    const backH = 0.52 * k;
    const backGeo = roundedBox(seatW * 0.92, backH, 0.075, 0.06, 0.025);
    D.push(backGeo);
    const back = new THREE.Mesh(backGeo, CHAIR_SOFT);
    back.position.set(0, seat + backH / 2 - 0.02, hipZ + 0.11 * k);
    back.rotation.x = -0.16;
    back.castShadow = true;
    g.add(back);

    const postGeo = new THREE.CylinderGeometry(0.032, 0.042, seat - 0.11, 16);
    D.push(postGeo);
    const post = new THREE.Mesh(postGeo, CHAIR_HARD);
    post.position.set(0, (seat - 0.11) / 2 + 0.05, seatZ);
    post.castShadow = true;
    g.add(post);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const legGeo = roundedBox(0.05, 0.035, 0.3 * k, 0.016, 0.008);
      D.push(legGeo);
      const leg = new THREE.Mesh(legGeo, CHAIR_HARD);
      leg.position.set(Math.sin(a) * 0.15 * k, 0.06, seatZ + Math.cos(a) * 0.15 * k);
      leg.rotation.y = a;
      leg.castShadow = true;
      g.add(leg);

      const casterGeo = new THREE.SphereGeometry(0.032, 12, 10);
      D.push(casterGeo);
      const caster = new THREE.Mesh(casterGeo, CHAIR_HARD);
      caster.position.set(Math.sin(a) * 0.29 * k, 0.032, seatZ + Math.cos(a) * 0.29 * k);
      caster.castShadow = true;
      g.add(caster);
    }
  }
}
