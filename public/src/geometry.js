// Shared geometry helpers.

import * as THREE from 'three';

function roundedRect(w, d, r) {
  const shape = new THREE.Shape();
  const x = w / 2;
  const z = d / 2;
  const rr = Math.min(r, x, z);
  shape.moveTo(-x + rr, -z);
  shape.lineTo(x - rr, -z);
  shape.quadraticCurveTo(x, -z, x, -z + rr);
  shape.lineTo(x, z - rr);
  shape.quadraticCurveTo(x, z, x - rr, z);
  shape.lineTo(-x + rr, z);
  shape.quadraticCurveTo(-x, z, -x, z - rr);
  shape.lineTo(-x, -z + rr);
  shape.quadraticCurveTo(-x, -z, -x + rr, -z);
  return shape;
}

/** Box with rounded corners and softened top/bottom edges, centred on the origin. */
export function roundedBox(width, height, depth, radius = 0.02, bevel = 0.006) {
  const b = Math.min(bevel, height / 2.5);
  const geo = new THREE.ExtrudeGeometry(roundedRect(width, depth, radius), {
    depth: Math.max(0.001, height - b * 2),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -(height - b * 2) / 2);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}
