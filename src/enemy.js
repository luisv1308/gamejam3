import * as THREE from 'three';
import { gridToWorld, isWalkable } from './grid.js';
import { addLegoEyesToHead, centerMinifigPivotOnCell } from './visuals/minifigLayout.js';
import { MilitaryTheme as T } from './visuals/militaryTheme.js';
import { BOSS_HP } from './constants.js';

export const EnemyType = {
  CHASER: 'chaser',
  STATIC: 'static',
  PATROL: 'patrol',
  HEAVY: 'heavy',
  BOSS: 'boss',
};

function plasticMat(hex, emissiveHex = null, emissiveIntensity = 0) {
  const m = new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.38,
    metalness: 0.08,
    emissive: new THREE.Color(emissiveHex ?? 0x000000),
    emissiveIntensity: emissiveHex != null ? emissiveIntensity : 0,
  });
  return m;
}

function pickInitialPatrolDir(gx, gz) {
  const order = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  for (const [dx, dz] of order) {
    const nx = gx + dx;
    const nz = gz + dz;
    if (isWalkable(nx, nz)) return { patrolDx: dx, patrolDz: dz };
  }
  return { patrolDx: 0, patrolDz: 1 };
}

/** Minifig LEGO: variante por tipo (seguridad / pesado / patrulla / jefe). */
export function createEnemyMesh(type) {
  const group = new THREE.Group();

  const isStatic = type === EnemyType.STATIC;
  const isPatrol = type === EnemyType.PATROL;
  const isHeavy = type === EnemyType.HEAVY;
  const isBoss = type === EnemyType.BOSS;

  const shirtMat = plasticMat(isBoss ? 0x2a1844 : T.securityShirt);
  const sleeveMat = plasticMat(isBoss ? 0x1a0f2e : T.securityShirtDark);
  const vestMat = plasticMat(isHeavy ? 0x3a4555 : isBoss ? 0x4a2288 : T.securityVest);
  const pantsMat = plasticMat(isBoss ? 0x151018 : T.securityPants);
  const skinMat = plasticMat(T.securitySkin);
  const capMat = plasticMat(isBoss ? 0x110822 : T.securityCap);

  let stripeHex = isStatic ? T.securityStripeStatic : T.securityStripeChaser;
  if (isPatrol) stripeHex = 0xffcc44;
  if (isHeavy) stripeHex = 0xff8844;
  if (isBoss) stripeHex = 0xcc66ff;
  const stripeMat = plasticMat(stripeHex, stripeHex, isStatic ? 0.14 : 0.1);

  const torsoScale = isHeavy ? 1.12 : isBoss ? 1.22 : 1;
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.26 * torsoScale, 0.28 * torsoScale, 0.15 * torsoScale),
    shirtMat
  );
  torso.position.y = 0.04;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.055), vestMat);
  vest.position.set(0, 0.05, 0.065);
  vest.castShadow = true;
  vest.receiveShadow = true;
  group.add(vest);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.028, 0.02), stripeMat);
  stripe.position.set(0, 0.05, 0.098);
  stripe.castShadow = true;
  group.add(stripe);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.18), skinMat);
  head.position.y = 0.24;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  const capH = isBoss ? 0.055 : 0.045;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.084, capH, 12),
    capMat
  );
  cap.position.y = 0.335 + (isBoss ? 0.02 : 0);
  cap.castShadow = true;
  group.add(cap);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.1), pantsMat);
  legL.position.set(-0.06, -0.16, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.1), pantsMat);
  legR.position.set(0.06, -0.16, 0);
  legR.castShadow = true;
  group.add(legR);

  const armGeo = new THREE.BoxGeometry(0.085, 0.085, 0.21);
  const armL = new THREE.Mesh(armGeo, sleeveMat);
  armL.position.set(-0.19, 0.05, 0);
  armL.rotation.set(0, 0, 0.4);
  armL.castShadow = true;
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, sleeveMat);
  armR.position.set(0.19, 0.05, 0);
  armR.rotation.set(0, 0, -0.4);
  armR.castShadow = true;
  group.add(armR);

  group.userData.bodyMaterial = shirtMat;
  group.userData.headMaterial = skinMat;

  centerMinifigPivotOnCell(group);
  addLegoEyesToHead(head, { headDepth: 0.18, eyeSpacing: 0.037, eyeRadius: 0.015 });

  group.userData.stripeMaterial = stripeMat;
  return group;
}

/** Centinela despertado por teleempuje: raya tipo perseguidor + leve brillo. */
export function applyStaticAggravatedVisual(enemy) {
  const stripe = enemy.mesh?.userData?.stripeMaterial;
  if (stripe) {
    stripe.color.setHex(T.securityStripeChaser);
    stripe.emissive.setHex(T.securityStripeChaser);
    stripe.emissiveIntensity = 0.1;
  }
  if (enemy.mainMaterial) {
    enemy.mainMaterial.emissive.setHex(0x442211);
    enemy.mainMaterial.emissiveIntensity = 0.22;
  }
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
    type === EnemyType.BOSS ? 0x2a1844 : type === EnemyType.HEAVY ? 0x3d4450 : T.securityShirt;
  const mesh = createEnemyMesh(type);
  const pos = gridToWorld(gx, gz);
  mesh.position.set(pos.x, pos.y, pos.z);
  scene.add(mesh);

  const patrol =
    type === EnemyType.PATROL ? pickInitialPatrolDir(gx, gz) : { patrolDx: 0, patrolDz: 0 };

  const enemy = {
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
    patrolDx: patrol.patrolDx,
    patrolDz: patrol.patrolDz,
    isBoss: type === EnemyType.BOSS,
    hp: type === EnemyType.BOSS ? BOSS_HP : 1,
    maxHp: type === EnemyType.BOSS ? BOSS_HP : 1,
    phase2Spawned: false,
    /** Centinela (`static`) pasa a perseguir tras ser movido por shift. */
    aggravated: false,
  };
  return enemy;
}

export function getChaserStepCandidatesToward(enemy, targetGx, targetGz) {
  const canChase =
    enemy.type === EnemyType.CHASER ||
    (enemy.type === EnemyType.STATIC && enemy.aggravated);
  if (!canChase) return [];

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
