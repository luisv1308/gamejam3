import * as THREE from 'three';
import { gridToWorld, cardinalYawFromDelta } from './grid.js';
import { addLegoEyesToHead, centerMinifigPivotOnCell } from './visuals/minifigLayout.js';

export const DIRS = {
  N: { dx: 0, dz: -1 },
  S: { dx: 0, dz: 1 },
  E: { dx: 1, dz: 0 },
  W: { dx: -1, dz: 0 },
};

function plasticMat(hex) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.38,
    metalness: 0.08,
  });
}

/** Minifig LEGO: pivot en suelo, centro XZ = centro de casilla (ver centerMinifigPivotOnCell). */
export function createPlayer(scene, gx, gz) {
  const group = new THREE.Group();

  const headMat = plasticMat(0xffcd00);
  const torsoMat = plasticMat(0x0055bf);
  const legMat = plasticMat(0x1a1a1a);
  const handMat = plasticMat(0xffcd00);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.14), torsoMat);
  torso.position.y = 0.04;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.17, 0.17), headMat);
  head.position.y = 0.22;
  head.castShadow = true;
  group.add(head);

  const stud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.072, 0.04, 12),
    headMat
  );
  stud.position.y = 0.315;
  stud.castShadow = true;
  group.add(stud);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), legMat);
  legL.position.set(-0.055, -0.15, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), legMat);
  legR.position.set(0.055, -0.15, 0);
  legR.castShadow = true;
  group.add(legR);

  const armGeo = new THREE.BoxGeometry(0.08, 0.08, 0.2);
  const armL = new THREE.Mesh(armGeo, torsoMat);
  armL.position.set(-0.18, 0.06, 0);
  armL.rotation.set(0, 0, 0.38);
  armL.castShadow = true;
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, torsoMat);
  armR.position.set(0.18, 0.06, 0);
  armR.rotation.set(0, 0, -0.38);
  armR.castShadow = true;
  group.add(armR);

  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.06), handMat);
  handL.position.set(-0.26, -0.02, 0);
  handL.rotation.z = 0.35;
  group.add(handL);
  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.06), handMat);
  handR.position.set(0.26, -0.02, 0);
  handR.rotation.z = -0.35;
  group.add(handR);

  centerMinifigPivotOnCell(group);
  addLegoEyesToHead(head, { headDepth: 0.17, eyeSpacing: 0.035, eyeRadius: 0.014 });

  const pos = gridToWorld(gx, gz);
  group.position.set(pos.x, pos.y, pos.z);
  group.rotation.y = cardinalYawFromDelta(0, -1);
  scene.add(group);

  return {
    gx,
    gz,
    mesh: group,
    aim: { x: 0, z: -1 },
    facing: { ...DIRS.N },
    animFrom: null,
    animTo: null,
    animT: 0,
  };
}

export function setPlayerAim(player, x, z) {
  player.aim.x = x;
  player.aim.z = z;
}

export function setFacingFromMove(player, dx, dz) {
  if (dx !== 0 || dz !== 0) {
    player.facing = { dx, dz };
  }
}

export function disposePlayer(player, scene) {
  if (!player?.mesh) return;
  scene.remove(player.mesh);
  const materials = new Set();
  player.mesh.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry?.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x && materials.add(x));
      else if (m) materials.add(m);
    }
  });
  materials.forEach((m) => m.dispose());
}
