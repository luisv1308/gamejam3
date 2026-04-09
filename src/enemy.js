import * as THREE from 'three';
import { gridToWorld } from './grid.js';

export const EnemyType = {
  CHASER: 'chaser',
  STATIC: 'static',
};

export function createEnemyMesh(type) {
  const geom = new THREE.BoxGeometry(0.55, 0.7, 0.55);
  let color = 0xc94c4c;
  if (type === EnemyType.STATIC) color = 0xd9822b;
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.1,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * One enemy instance: grid position + Three mesh + type.
 */
export function makeEnemy(type, gx, gz, scene) {
  let baseColor = 0xc94c4c;
  if (type === EnemyType.STATIC) baseColor = 0xd9822b;
  const mesh = createEnemyMesh(type);
  const pos = gridToWorld(gx, gz);
  mesh.position.set(pos.x, pos.y, pos.z);
  scene.add(mesh);
  return {
    type,
    gx,
    gz,
    mesh,
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
