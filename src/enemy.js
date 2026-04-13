import * as THREE from 'three';
import { gridToWorld } from './grid.js';
import { addLegoEyesToHead, centerMinifigPivotOnCell } from './visuals/minifigLayout.js';
import { MilitaryTheme as T } from './visuals/militaryTheme.js';

export const EnemyType = {
  CHASER: 'chaser',
  STATIC: 'static',
};

function plasticMat(hex) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.38,
    metalness: 0.08,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
  });
}

/** Minifig LEGO enemigo: mismo esquema que el jugador, colores de facción. */
export function createEnemyMesh(type) {
  const group = new THREE.Group();

  const isStatic = type === EnemyType.STATIC;
  const torsoColor = isStatic ? T.enemyStatic : T.enemyChaser;
  const headColor = isStatic ? T.enemyStaticDark : T.enemyChaserDark;

  const torsoMat = plasticMat(torsoColor);
  const headMat = plasticMat(headColor);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.15), torsoMat);
  torso.position.y = 0.04;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.18), headMat);
  head.position.y = 0.24;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  const stud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.075, 0.042, 12),
    headMat
  );
  stud.position.y = 0.34;
  stud.castShadow = true;
  group.add(stud);

  const legMat = plasticMat(isStatic ? 0x3d2810 : 0x2a1515);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.1), legMat);
  legL.position.set(-0.06, -0.16, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.1), legMat);
  legR.position.set(0.06, -0.16, 0);
  legR.castShadow = true;
  group.add(legR);

  const armGeo = new THREE.BoxGeometry(0.085, 0.085, 0.21);
  const armL = new THREE.Mesh(armGeo, torsoMat);
  armL.position.set(-0.19, 0.05, 0);
  armL.rotation.set(0, 0, 0.4);
  armL.castShadow = true;
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, torsoMat);
  armR.position.set(0.19, 0.05, 0);
  armR.rotation.set(0, 0, -0.4);
  armR.castShadow = true;
  group.add(armR);

  group.userData.bodyMaterial = torsoMat;
  group.userData.headMaterial = headMat;

  centerMinifigPivotOnCell(group);
  addLegoEyesToHead(head, { headDepth: 0.18, eyeSpacing: 0.037, eyeRadius: 0.015 });

  return group;
}

export function disposeEnemy(enemy, scene) {
  if (!enemy?.mesh) return;
  scene.remove(enemy.mesh);
  const materials = new Set();
  enemy.mesh.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry?.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x && materials.add(x));
      else if (m) materials.add(m);
    }
  });
  materials.forEach((m) => m.dispose());
}

export function makeEnemy(type, gx, gz, scene) {
  const baseColor =
    type === EnemyType.STATIC ? T.enemyStatic : T.enemyChaser;
  const mesh = createEnemyMesh(type);
  const pos = gridToWorld(gx, gz);
  mesh.position.set(pos.x, pos.y, pos.z);
  scene.add(mesh);
  return {
    type,
    gx,
    gz,
    mesh,
    mainMaterial: mesh.userData.bodyMaterial,
    baseColor,
    pendingRemove: false,
    animFrom: null,
    animTo: null,
    animT: 0,
    destroyAnim: 0,
  };
}

export function getChaserStepCandidatesToward(enemy, targetGx, targetGz) {
  if (enemy.type !== EnemyType.CHASER) return [];

  const pdx = targetGx - enemy.gx;
  const pdz = targetGz - enemy.gz;
  if (pdx === 0 && pdz === 0) return [];

  const sx = Math.sign(pdx);
  const sz = Math.sign(pdz);

  const horizontal = sx !== 0 ? { gx: enemy.gx + sx, gz: enemy.gz } : null;
  const vertical = sz !== 0 ? { gx: enemy.gx, gz: enemy.gz + sz } : null;

  const primaryFirst = Math.abs(pdx) >= Math.abs(pdz);
  const ordered = primaryFirst ? [horizontal, vertical] : [vertical, horizontal];
  return ordered.filter((c) => c !== null);
}
