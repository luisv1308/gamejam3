import { GRID_SIZE } from '../constants.js';
import { LEVELS, LEVEL_COUNT } from '../levels/levels.js';

function assertLevelShape(rows) {
  if (rows.length !== GRID_SIZE) throw new Error(`expected ${GRID_SIZE} rows, got ${rows.length}`);
  for (const row of rows) {
    if (row.length !== GRID_SIZE) throw new Error(`row length ${row.length}`);
  }
}

/**
 * Construye máscara de muros para grid.js (Uint8Array).
 * @param {string[][]} wallPositions
 */
export function buildWallMaskFromPositions(wallPositions) {
  const mask = new Uint8Array(GRID_SIZE * GRID_SIZE);
  for (const { gx, gz } of wallPositions) {
    mask[gz * GRID_SIZE + gx] = 1;
  }
  return mask;
}

/**
 * Devuelve layout de un nivel o null si falla.
 * @returns {{ playerGx: number, playerGz: number, wallPositions: {gx:number,gz:number}[], enemies: { type: string, gx: number, gz: number }[] } | null}
 */
export function parseLevelLayout(rows) {
  if (!rows) return null;
  assertLevelShape(rows);

  const wallPositions = [];
  const enemies = [];
  let playerGx = -1;
  let playerGz = -1;
  let playerCount = 0;

  for (let gz = 0; gz < GRID_SIZE; gz++) {
    const row = rows[gz];
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const c = row[gx];
      switch (c) {
        case 'P':
          playerGx = gx;
          playerGz = gz;
          playerCount++;
          break;
        case 'W':
          wallPositions.push({ gx, gz });
          break;
        case 'E':
          enemies.push({ type: 'chaser', gx, gz });
          break;
        case 'e':
          enemies.push({ type: 'static', gx, gz });
          break;
        case '.':
          break;
        default:
          console.warn(`[levelLoader] carácter desconocido "${c}" en (${gx},${gz})`);
      }
    }
  }

  if (playerCount !== 1) {
    console.error('[levelLoader] se requiere exactamente un P en el nivel');
    return null;
  }

  return {
    playerGx,
    playerGz,
    wallPositions,
    enemies,
  };
}

/**
 * Carga un nivel por índice y aplica al juego mediante callbacks.
 * @param {{ onBeforeLoad?: () => void, applyLayout: (layout: ReturnType<typeof parseLevelLayout>) => void }} api
 */
export function loadLevel(index, api) {
  if (index < 0 || index >= LEVEL_COUNT) {
    console.warn('[levelLoader] índice fuera de rango:', index);
    return false;
  }
  const rows = LEVELS[index];
  const layout = parseLevelLayout(rows);
  if (!layout) return false;

  api.onBeforeLoad?.();
  api.applyLayout(layout);
  console.log(`[level] Cargado nivel ${index + 1}/${LEVEL_COUNT}`);
  return true;
}

export { LEVEL_COUNT, LEVELS };
