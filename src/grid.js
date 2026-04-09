import { GRID_SIZE, TILE_SIZE, SHIFT_MAX_RANGE } from './constants.js';

/**
 * Array-based grid: coordinates are integer gx, gz in [0, GRID_SIZE).
 * World Y is 0 for floor; entities sit slightly above tiles.
 */

/** @type {Uint8Array | null} — 1 = muro (no transitable). */
let wallMask = null;

export function clearWallMask() {
  wallMask = null;
}

/** @param {Uint8Array | null} mask length GRID_SIZE*GRID_SIZE */
export function setWallMask(mask) {
  wallMask = mask;
}

export function isWall(gx, gz) {
  if (!isInsideGrid(gx, gz)) return false;
  return wallMask !== null && wallMask[gz * GRID_SIZE + gx] === 1;
}

export function gridToWorld(gx, gz) {
  const x = (gx - GRID_SIZE / 2 + 0.5) * TILE_SIZE;
  const z = (gz - GRID_SIZE / 2 + 0.5) * TILE_SIZE;
  return { x, y: TILE_SIZE * 0.55, z };
}

export function isInsideGrid(gx, gz) {
  return gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE;
}

export function isWalkable(gx, gz) {
  if (!isInsideGrid(gx, gz)) return false;
  if (wallMask !== null && wallMask[gz * GRID_SIZE + gx] === 1) return false;
  return true;
}

/**
 * Enemigos en línea de visión: avanza casilla a casilla y se detiene en muro o borde.
 * dx, dz ∈ { (±1,0), (0,±1) }.
 */
export function collectEnemiesInFront(px, pz, dx, dz, enemies, maxRange = SHIFT_MAX_RANGE) {
  const inFront = [];
  let cx = px + dx;
  let cz = pz + dz;
  for (let dist = 1; dist <= maxRange; dist++) {
    if (!isInsideGrid(cx, cz)) break;
    if (isWall(cx, cz)) break;
    for (const e of enemies) {
      if (e.pendingRemove) continue;
      if (e.gx === cx && e.gz === cz) {
        inFront.push(e);
        break;
      }
    }
    cx += dx;
    cz += dz;
  }
  const distFn = (e) => Math.abs(e.gx - px) + Math.abs(e.gz - pz);
  inFront.sort((a, b) => distFn(b) - distFn(a));
  return inFront;
}
