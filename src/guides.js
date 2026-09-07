// Thin overlay lines showing the field of view and the viewing distance.

import * as THREE from 'three';
import { screenPoint } from './config.js';

const MAIN = new THREE.LineBasicMaterial({ color: 0x6aa8ff, transparent: true, opacity: 0.85, depthTest: false });
const SOFT = new THREE.LineBasicMaterial({ color: 0x47d5a6, transparent: true, opacity: 0.55, depthTest: false });

export class Guides {
  constructor() {
    this.group = new THREE.Group();
    this.group.renderOrder = 999;
    this.disposables = [];
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.group.clear();
  }

  setVisible(v) { this.group.visible = v; }

  /**
   * @param {THREE.Vector3} eye     eye position, world space
   * @param {THREE.Object3D} pivot  the monitor's panel pivot (screen centre, already tilted)
   * @param {object} m              screen metrics
   */
  update(eye, pivot, m) {
    this.dispose();

    const add = (points, material) => {
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      this.disposables.push(geo);
      this.group.add(new THREE.Line(geo, material));
    };

    const worldEdge = (u, y) => {
      const p = screenPoint(u, m);
      return pivot.localToWorld(new THREE.Vector3(p.x, y, p.z));
    };

    const left = worldEdge(-0.5, 0);
    const right = worldEdge(0.5, 0);
    const centre = worldEdge(0, 0);
    const top = worldEdge(0, m.height / 2);
    const bottom = worldEdge(0, -m.height / 2);

    add([eye, left], MAIN);
    add([eye, right], MAIN);
    add([eye, top], SOFT);
    add([eye, bottom], SOFT);
    add([eye, centre], SOFT);

    // the screen's horizontal arc, so the curve itself is legible from above
    const arc = [];
    for (let i = 0; i <= 64; i++) arc.push(worldEdge(-0.5 + i / 64, 0));
    add(arc, MAIN);

    // distance line dropped to the floor at both ends
    add([new THREE.Vector3(eye.x, 0.004, eye.z), new THREE.Vector3(centre.x, 0.004, centre.z)], SOFT);
    add([eye, new THREE.Vector3(eye.x, 0.004, eye.z)], SOFT);
  }
}
