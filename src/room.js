// Neutral studio room and a plain, empty desk.

import * as THREE from 'three';
import { roundedBox } from './geometry.js';

const FLOOR = new THREE.MeshStandardMaterial({ color: 0x53565c, roughness: 0.95 });
const WALL = new THREE.MeshStandardMaterial({ color: 0x6d7178, roughness: 1 });
const TOP = new THREE.MeshStandardMaterial({ color: 0xb9b3a8, roughness: 0.7 });
const FRAME = new THREE.MeshStandardMaterial({ color: 0x4a4d53, roughness: 0.5, metalness: 0.4 });

export function buildRoom(scene) {
  const room = new THREE.Group();

  const floorGeo = new THREE.PlaneGeometry(14, 14);
  const floor = new THREE.Mesh(floorGeo, FLOOR);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const backGeo = new THREE.PlaneGeometry(14, 5);
  const back = new THREE.Mesh(backGeo, WALL);
  back.position.set(0, 2.5, -2.2);
  back.receiveShadow = true;
  room.add(back);

  const sideGeo = new THREE.PlaneGeometry(8, 5);
  const side = new THREE.Mesh(sideGeo, WALL);
  side.position.set(-3.4, 2.5, 1.8);
  side.rotation.y = Math.PI / 2;
  side.receiveShadow = true;
  room.add(side);

  scene.add(room);
  return room;
}

export class Desk {
  constructor() {
    this.group = new THREE.Group();
    this.disposables = [];
    this.top = 0.74;
    this.frontZ = 0.5;
    this.backZ = -0.25;
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.group.clear();
  }

  /**
   * @param {number} height  desk surface height, metres
   * @param {number} depth   front-to-back depth, metres
   * @param {number} width   left-to-right width, metres
   * @param {number} backZ   world z of the back edge (monitor screen centre sits at z = 0)
   */
  update(height, depth, width, backZ) {
    this.dispose();
    const D = this.disposables;
    const thickness = 0.03;
    this.top = height;
    this.backZ = backZ;
    this.frontZ = backZ + depth;
    const centreZ = backZ + depth / 2;

    const topGeo = roundedBox(width, thickness, depth, 0.025, 0.005);
    D.push(topGeo);
    const top = new THREE.Mesh(topGeo, TOP);
    top.position.set(0, height - thickness / 2, centreZ);
    top.castShadow = true;
    top.receiveShadow = true;
    this.group.add(top);

    // simple square-tube legs, inset from the corners
    const legH = height - thickness;
    const inset = 0.06;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const legGeo = new THREE.BoxGeometry(0.05, legH, 0.05);
        D.push(legGeo);
        const leg = new THREE.Mesh(legGeo, FRAME);
        leg.position.set(sx * (width / 2 - inset), legH / 2, centreZ + sz * (depth / 2 - inset));
        leg.castShadow = true;
        this.group.add(leg);
      }

      const railGeo = new THREE.BoxGeometry(0.04, 0.04, depth - inset * 2);
      D.push(railGeo);
      const rail = new THREE.Mesh(railGeo, FRAME);
      rail.position.set(sx * (width / 2 - inset), legH - 0.06, centreZ);
      rail.castShadow = true;
      this.group.add(rail);
    }

    const crossGeo = new THREE.BoxGeometry(width - inset * 2, 0.04, 0.04);
    D.push(crossGeo);
    const cross = new THREE.Mesh(crossGeo, FRAME);
    cross.position.set(0, legH - 0.06, centreZ - depth / 2 + inset);
    cross.castShadow = true;
    this.group.add(cross);
  }
}
