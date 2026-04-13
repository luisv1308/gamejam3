import { isWalkable, collectEnemiesInFront } from './grid.js';
import { EnemyType, getChaserStepCandidatesToward } from './enemy.js';
import { PUSH_TILES } from './constants.js';

export const Phase = {
  /** Pantalla de bienvenida / contexto; el mundo no avanza. */
  INTRO: 'intro',
  PLAYER: 'player',
  ENEMY: 'enemy',
  /** Nivel limpio: UI de victoria, juego pausado hasta confirmar. */
  LEVEL_CLEAR: 'level_clear',
  /** Campaña completada (último sector); pantalla final. */
  GAME_OVER: 'game_over',
  /** Interceptado por seguridad; reintento desde el mismo sector. */
  DEFEAT: 'defeat',
};

function posKey(gx, gz) {
  return `${gx},${gz}`;
}

/**
 * Resolves Shift: pushes enemies in front along player.aim; destroys on wall/other enemy;
 * landing on player ends the game (loss).
 * Los muertos no reciben pendingRemove aquí: se devuelve shiftDeaths para animar hasta el impacto.
 * @returns {{ lost: boolean, shiftDeaths: { enemy, endGx, endGz }[] }}
 */
export function resolveShift(player, enemies) {
  const dx = player.aim.x;
  const dz = player.aim.z;
  const pushedList = collectEnemiesInFront(player.gx, player.gz, dx, dz, enemies);
  if (pushedList.length === 0) return { lost: false, shiftDeaths: [] };

  const targets = new Map();
  const toDestroy = new Set();
  /** Casilla lógica donde “impacta” (muro, choque, etc.) para animación */
  const deathEnds = new Map();

  for (const e of pushedList) {
    if (e.pendingRemove) continue;
    const ngx = e.gx + dx * PUSH_TILES;
    const ngz = e.gz + dz * PUSH_TILES;

    if (ngx === player.gx && ngz === player.gz) {
      return { lost: true, shiftDeaths: [] };
    }
    if (!isWalkable(ngx, ngz)) {
      toDestroy.add(e);
      deathEnds.set(e, { gx: ngx, gz: ngz });
      continue;
    }
    targets.set(e, { gx: ngx, gz: ngz });
  }

  const incoming = new Map();
  for (const [e, t] of targets) {
    const k = posKey(t.gx, t.gz);
    if (!incoming.has(k)) incoming.set(k, []);
    incoming.get(k).push(e);
  }
  for (const list of incoming.values()) {
    if (list.length <= 1) continue;
    const t = targets.get(list[0]);
    for (const e of list) {
      toDestroy.add(e);
      deathEnds.set(e, { gx: t.gx, gz: t.gz });
    }
  }

  const pushedSet = new Set(pushedList);
  for (const [e, t] of targets) {
    if (toDestroy.has(e)) continue;
    for (const other of enemies) {
      if (other.pendingRemove || toDestroy.has(other)) continue;
      if (pushedSet.has(other)) continue;
      if (other.gx === t.gx && other.gz === t.gz) {
        toDestroy.add(e);
        deathEnds.set(e, { gx: t.gx, gz: t.gz });
        break;
      }
    }
  }

  for (const e of pushedList) {
    if (toDestroy.has(e)) continue;
    const t = targets.get(e);
    if (!t) continue;
    e.gx = t.gx;
    e.gz = t.gz;
  }

  const shiftDeaths = [];
  for (const e of toDestroy) {
    const end = deathEnds.get(e);
    if (end) shiftDeaths.push({ enemy: e, endGx: end.gx, endGz: end.gz });
  }

  return { lost: false, shiftDeaths };
}

/**
 * Planifica movimientos de chasers en orden de array: siempre intentan acercarse;
 * primero el eje con mayor distancia, si no puede (muro u ocupado) el otro eje.
 * Resolución secuencial evita que dos enemigos anulen el turno al mismo destino.
 */
export function planEnemyTurn(player, enemies) {
  const occupied = new Set();
  for (const e of enemies) {
    if (e.pendingRemove) continue;
    occupied.add(posKey(e.gx, e.gz));
  }

  const moves = [];

  for (const e of enemies) {
    if (e.pendingRemove) continue;
    if (e.type !== EnemyType.CHASER) continue;

    const fromKey = posKey(e.gx, e.gz);
    occupied.delete(fromKey);

    const candidates = getChaserStepCandidatesToward(e, player.gx, player.gz);
    let chosen = null;

    for (const c of candidates) {
      if (!isWalkable(c.gx, c.gz)) continue;
      if (c.gx === player.gx && c.gz === player.gz) {
        return { lost: true, moves: [] };
      }
      if (occupied.has(posKey(c.gx, c.gz))) continue;
      chosen = c;
      break;
    }

    if (chosen) {
      occupied.add(posKey(chosen.gx, chosen.gz));
      moves.push({ enemy: e, gx: chosen.gx, gz: chosen.gz });
    } else {
      occupied.add(fromKey);
    }
  }

  return { lost: false, moves };
}

export function countLivingEnemies(enemies) {
  return enemies.filter((e) => !e.pendingRemove).length;
}
