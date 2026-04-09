import * as THREE from 'three';
import { gridToWorld } from './grid.js';

export const DIRS = {
  N: { dx: 0, dz: -1 },
  S: { dx: 0, dz: 1 },
  E: { dx: 1, dz: 0 },
  W: { dx: -1, dz: 0 },
};

export function createPlayer(scene, gx, gz) {
  const geom = new THREE.BoxGeometry(0.5, 0.65, 0.5);
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a9eff, roughness: 0.4, metalness: 0.15 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  const pos = gridToWorld(gx, gz);
  mesh.position.set(pos.x, pos.y, pos.z);
  scene.add(mesh);

  return {
    gx,
    gz,
    mesh,
    /** Dirección del shift (flechas); independiente del movimiento WASD. */
    aim: { x: 0, z: -1 },
    facing: { ...DIRS.N },
    animFrom: null,
    animTo: null,
    animT: 0,
  };
}

/** Flechas: apuntar sin mover (cardinal). */
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
  player.mesh.geometry.dispose();
  player.mesh.material.dispose();
}
