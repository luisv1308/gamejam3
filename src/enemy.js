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
 * Chaser: one step along axis that reduces Manhattan distance to (tx, tz).
 * Static: does not move.
 */
export function planChaserMove(enemy, tx, tz) {
  if (enemy.type !== EnemyType.CHASER) return null;
  const dx = tx - enemy.gx;
  const dz = tz - enemy.gz;
  if (dx === 0 && dz === 0) return null;
  let ngx = enemy.gx;
  let ngz = enemy.gz;
  if (Math.abs(dx) >= Math.abs(dz)) {
    ngx += dx > 0 ? 1 : -1;
  } else {
    ngz += dz > 0 ? 1 : -1;
  }
  return { gx: ngx, gz: ngz };
}
