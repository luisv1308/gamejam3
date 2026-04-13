import * as THREE from 'three';
import { gridToWorld } from './grid.js';
import { MilitaryTheme as T } from './visuals/militaryTheme.js';

export const EnemyType = {
  CHASER: 'chaser',
  STATIC: 'static',
};

/** Unidad de seguridad low-poly: cuerpo + “sensor” superior. */
export function createEnemyMesh(type) {
  const group = new THREE.Group();

  const isStatic = type === EnemyType.STATIC;
  const bodyColor = isStatic ? T.enemyStatic : T.enemyChaser;
  const accent = isStatic ? T.enemyStaticDark : T.enemyChaserDark;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.48,
    metalness: 0.28,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.48, 0.52), bodyMat);
  body.position.y = -0.06;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const headMat = new THREE.MeshStandardMaterial({
    color: accent,
    roughness: 0.4,
    metalness: 0.35,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
  });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 8), headMat);
  head.position.y = 0.28;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  /** Mismo material que el cuerpo: el juego colorea/emite sobre `mesh.material`. */
  group.userData.bodyMaterial = bodyMat;
  group.userData.headMaterial = headMat;

  return group;
}

/**
 * One enemy instance: grid position + Three mesh + type.
 */
export function disposeEnemy(enemy, scene) {
  if (!enemy?.mesh) return;
  scene.remove(enemy.mesh);
  enemy.mesh.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry?.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    }
  });
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
    /** Material principal para highlights de aim/shift (cuerpo). */
    mainMaterial: mesh.userData.bodyMaterial,
    baseColor,
    pendingRemove: false,
    animFrom: null,
    animTo: null,
    animT: 0,
    destroyAnim: 0,
  };
}

/**
 * Pasos posibles hacia el jugador (hasta 2): eje con mayor |Δ| primero, luego el otro.
 * No evalúa “seguridad”; solo orden de intento. Static → [].
 */
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
