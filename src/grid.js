import { GRID_SIZE, TILE_SIZE } from './constants.js';

/**
 * Array-based grid: coordinates are integer gx, gz in [0, GRID_SIZE).
 * World Y is 0 for floor; entities sit slightly above tiles.
 */

export function gridToWorld(gx, gz) {
  const x = (gx - GRID_SIZE / 2 + 0.5) * TILE_SIZE;
  const z = (gz - GRID_SIZE / 2 + 0.5) * TILE_SIZE;
  return { x, y: TILE_SIZE * 0.55, z };
}

export function isInsideGrid(gx, gz) {
  return gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE;
}

/** Border-only walkability (no inner walls in this prototype). */
export function isWalkable(gx, gz) {
  return isInsideGrid(gx, gz);
}

/**
 * Returns enemies strictly in front of (px, pz) along (dx, dz).
 * dx, dz must be one of: (±1,0) or (0,±1).
 */
export function collectEnemiesInFront(px, pz, dx, dz, enemies) {
  const inFront = [];
  for (const e of enemies) {
    if (e.pendingRemove) continue;
    const ex = e.gx;
    const ez = e.gz;
    if (dx !== 0) {
      if (ez !== pz) continue;
      if (dx > 0 && ex > px) inFront.push(e);
      else if (dx < 0 && ex < px) inFront.push(e);
    } else {
      if (ex !== px) continue;
      if (dz > 0 && ez > pz) inFront.push(e);
      else if (dz < 0 && ez < pz) inFront.push(e);
    }
  }
  // Farther from player first (process pushes from the far end of the line)
  const dist = (e) => Math.abs(e.gx - px) + Math.abs(e.gz - pz);
  inFront.sort((a, b) => dist(b) - dist(a));
  return inFront;
}
