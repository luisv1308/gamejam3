import { GRID_SIZE } from '../constants.js';
import { LEVEL_DEFS, LEVEL_COUNT, LEVELS } from '../levels/levels.js';

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
 * @returns {{ playerGx: number, playerGz: number, wallPositions: {gx:number,gz:number}[], enemies: { type: string, gx: number, gz: number }[], exit: {gx:number,gz:number}|null, terminal: {gx:number,gz:number}|null, keyCell: {gx:number,gz:number}|null }}
 */
export function parseLevelLayout(rows) {
  if (!rows) return null;
  assertLevelShape(rows);

  const wallPositions = [];
  const enemies = [];
  let playerGx = -1;
  let playerGz = -1;
  let playerCount = 0;
  /** @type {{gx:number,gz:number}|null} */
  let exit = null;
  /** @type {{gx:number,gz:number}|null} */
  let terminal = null;
  /** @type {{gx:number,gz:number}|null} */
  let keyCell = null;

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
        case 'p':
          enemies.push({ type: 'patrol', gx, gz });
          break;
        case 'R':
          enemies.push({ type: 'heavy', gx, gz });
          break;
        case 'M':
          enemies.push({ type: 'boss', gx, gz });
          break;
        case 'X':
          if (exit) console.warn('[levelLoader] múltiples X; se usa la primera');
          else exit = { gx, gz };
          break;
        case 'H':
          if (terminal) console.warn('[levelLoader] múltiples H; se usa la primera');
          else terminal = { gx, gz };
          break;
        case 'K':
          if (keyCell) console.warn('[levelLoader] múltiples K; se usa la primera');
          else keyCell = { gx, gz };
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
    exit,
    terminal,
    keyCell,
  };
}

/**
 * Carga un nivel por índice y aplica al juego mediante callbacks.
 * @param {{ onBeforeLoad?: () => void, applyLayout: (layout: object) => void }} api
 */
export function loadLevel(index, api) {
  if (index < 0 || index >= LEVEL_COUNT) {
    console.warn('[levelLoader] índice fuera de rango:', index);
    return false;
  }
  const def = LEVEL_DEFS[index];
  const layout = parseLevelLayout(def.rows);
  if (!layout) return false;

  const fullLayout = {
    ...layout,
    objective: def.objective,
    meta: def.meta ?? {},
  };

  api.onBeforeLoad?.();
  api.applyLayout(fullLayout);
  console.log(`[level] Cargado nivel ${index + 1}/${LEVEL_COUNT}`);
  return true;
}

export { LEVEL_DEFS, LEVEL_COUNT, LEVELS };
