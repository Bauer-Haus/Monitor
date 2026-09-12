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
   * @param {THREE.Vector3} eye   eye position, world space
   * @param {Array<{pivot: THREE.Object3D, item: object}>} panels  every panel in the rig
   * @param {object} m            screen metrics
   */
  update(eye, panels, m) {
    this.dispose();

    const add = (points, material) => {
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      this.disposables.push(geo);
      this.group.add(new THREE.Line(geo, material));
    };

    // A pivoted panel carries its curve vertically, so walk the arc along the
    // panel's own local x either way and let its transform place the points.
    const worldPoint = (pivot, u, offset) => {
      const p = screenPoint(u, m);
      return pivot.localToWorld(new THREE.Vector3(p.x, offset, p.z));
    };

    let leftMost = null;
    let rightMost = null;

    for (const { pivot, item } of panels) {
      const arc = [];
      for (let i = 0; i <= 48; i++) arc.push(worldPoint(pivot, -0.5 + i / 48, 0));
      add(arc, MAIN);

      for (const u of [-0.5, 0.5]) {
        const edge = worldPoint(pivot, u, 0);
        add([eye, edge], item.row === 0 ? MAIN : SOFT);
        if (!leftMost || edge.x < leftMost.x) leftMost = edge;
        if (!rightMost || edge.x > rightMost.x) rightMost = edge;
      }
    }

    // straight ahead, and the distance dropped to the floor
    const ahead = new THREE.Vector3(0, eye.y, 0);
    add([eye, ahead], SOFT);
    add([new THREE.Vector3(eye.x, 0.004, eye.z), new THREE.Vector3(0, 0.004, 0)], SOFT);
    add([eye, new THREE.Vector3(eye.x, 0.004, eye.z)], SOFT);
    if (leftMost && rightMost) add([leftMost, rightMost], SOFT);
  }
}
