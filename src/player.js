import * as THREE from 'three';
import { gridToWorld } from './grid.js';
import { MilitaryTheme as T } from './visuals/militaryTheme.js';

export const DIRS = {
  N: { dx: 0, dz: -1 },
  S: { dx: 0, dz: 1 },
  E: { dx: 1, dz: 0 },
  W: { dx: -1, dz: 0 },
};

/**
 * Figura low-poly tipo operativo: torso + casco + visor (grupo).
 */
export function createPlayer(scene, gx, gz) {
  const group = new THREE.Group();

  const suitMat = new THREE.MeshStandardMaterial({
    color: T.playerSuit,
    roughness: 0.55,
    metalness: 0.22,
  });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.38), suitMat);
  torso.position.y = -0.04;
  torso.castShadow = true;
  group.add(torso);

  const helmMat = new THREE.MeshStandardMaterial({
    color: T.playerHelmet,
    roughness: 0.65,
    metalness: 0.18,
  });
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.36), helmMat);
  helmet.position.y = 0.26;
  helmet.castShadow = true;
  group.add(helmet);

  const visorMat = new THREE.MeshStandardMaterial({
    color: T.playerVisor,
    roughness: 0.25,
    metalness: 0.45,
    emissive: new THREE.Color(T.playerVisorEmissive),
    emissiveIntensity: 0.35,
  });
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.12), visorMat);
  visor.position.set(0, 0.26, 0.2);
  visor.castShadow = true;
  group.add(visor);

  const pos = gridToWorld(gx, gz);
  group.position.set(pos.x, pos.y, pos.z);
  scene.add(group);

  return {
    gx,
    gz,
    mesh: group,
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
  player.mesh.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry?.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    }
  });
}
