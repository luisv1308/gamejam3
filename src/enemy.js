import * as THREE from 'three';
import { gridToWorld } from './grid.js';
import { addLegoEyesToHead, centerMinifigPivotOnCell } from './visuals/minifigLayout.js';
import { MilitaryTheme as T } from './visuals/militaryTheme.js';

export const EnemyType = {
  CHASER: 'chaser',
  STATIC: 'static',
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

/** Minifig LEGO: uniforme de seguridad de la instalación (no facción genérica). */
export function createEnemyMesh(type) {
  const group = new THREE.Group();

  const isStatic = type === EnemyType.STATIC;
  const shirtMat = plasticMat(T.securityShirt);
  const sleeveMat = plasticMat(T.securityShirtDark);
  const vestMat = plasticMat(T.securityVest);
  const pantsMat = plasticMat(T.securityPants);
  const skinMat = plasticMat(T.securitySkin);
  const capMat = plasticMat(T.securityCap);

  const stripeHex = isStatic ? T.securityStripeStatic : T.securityStripeChaser;
  const stripeMat = plasticMat(stripeHex, stripeHex, isStatic ? 0.14 : 0.1);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.15), shirtMat);
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

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.084, 0.045, 12),
    capMat
  );
  cap.position.y = 0.335;
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
  const baseColor = T.securityShirt;
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
