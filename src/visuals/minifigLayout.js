import * as THREE from 'three';

/**
 * Ojos impresos estilo LEGO: hijos de la cabeza, +Z local = cara (misma orientación que el cuerpo).
 * Llamar **después** de centerMinifigPivotOnCell para no desplazar el anclaje al suelo.
 */
export function addLegoEyesToHead(headMesh, opts) {
  const {
    headDepth,
    eyeSpacing = 0.036,
    eyeRadius = 0.015,
    eyeYOffset = 0.02,
    zBias = 0.003,
  } = opts;
  const halfZ = headDepth / 2;
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x0c0c0c,
    roughness: 0.45,
    metalness: 0.06,
  });
  for (const sign of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(eyeRadius, 10), eyeMat);
    eye.position.set(sign * eyeSpacing, eyeYOffset, halfZ + zBias);
    eye.castShadow = false;
    eye.receiveShadow = false;
    headMesh.add(eye);
  }
}

/**
 * Origen del grupo = centro XZ de la silueta + base en Y=0 (pies en el suelo).
 * Así `gridToWorld(gx,gz)` coloca la figura en el centro de la casilla sin “flotar” el pivote
 * (la cámara oblicua ya no desplaza visualmente el cuerpo hacia una esquina del tile).
 * Llamar antes de añadir ojos u otros detalles que no deban contar en el encaje al grid.
 */
export function centerMinifigPivotOnCell(group) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const off = new THREE.Vector3(-c.x, -box.min.y, -c.z);
  for (const ch of group.children) {
    ch.position.add(off);
  }
}
