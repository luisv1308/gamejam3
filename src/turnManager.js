import { isWalkable, collectEnemiesInFront } from './grid.js';
import { EnemyType, getChaserStepCandidatesToward, applyStaticAggravatedVisual } from './enemy.js';
import { PUSH_TILES, HEAVY_PUSH_TILES } from './constants.js';

export const Phase = {
  /** Pantalla de bienvenida / contexto; el mundo no avanza. */
  INTRO: 'intro',
  PLAYER: 'player',
  ENEMY: 'enemy',
  /** Nivel limpio: UI de victoria, juego pausado hasta confirmar. */
  LEVEL_CLEAR: 'level_clear',
  /** Ascensor entre plantas (solo tras ciertos niveles); animación automática. */
  ELEVATOR: 'elevator',
  /** Campaña completada (último sector); pantalla final. */
  GAME_OVER: 'game_over',
  /** Interceptado por seguridad; reintento desde el mismo sector. */
  DEFEAT: 'defeat',
  /** Pausa manual (Esc); se restaura phaseBeforePause. */
  PAUSE: 'pause',
};

function posKey(gx, gz) {
  return `${gx},${gz}`;
}

/** @param {{ type: string }} e */
function getPushTilesForEnemy(e) {
  return e.type === EnemyType.HEAVY ? HEAVY_PUSH_TILES : PUSH_TILES;
}

/** Centinela quieto hasta que el shift lo desplaza; luego persigue como un E. */
function actsAsChaserInPlanning(e) {
  return e.type === EnemyType.CHASER || (e.type === EnemyType.STATIC && e.aggravated);
}

/**
 * Resolves Shift: pushes enemies in front along player.aim; destroys on wall/other enemy;
 * landing on player ends the game (loss).
 * Los muertos no reciben pendingRemove aquí: se devuelve shiftDeaths para animar hasta el impacto.
 * @returns {{ lost: boolean, shiftDeaths: { enemy, endGx, endGz }[], bossDamaged: boolean }}
 */
export function resolveShift(player, enemies) {
  const dx = player.aim.x;
  const dz = player.aim.z;
  const pushedList = collectEnemiesInFront(player.gx, player.gz, dx, dz, enemies);
  if (pushedList.length === 0) return { lost: false, shiftDeaths: [], bossDamaged: false };

  const targets = new Map();
  const toDestroy = new Set();
  /** Casilla lógica donde “impacta” (muro, choque, etc.) para animación */
  const deathEnds = new Map();
  let bossDamaged = false;

  for (const e of pushedList) {
    if (e.pendingRemove) continue;
    const dist = getPushTilesForEnemy(e);
    const ngx = e.gx + dx * dist;
    const ngz = e.gz + dz * dist;

    if (ngx === player.gx && ngz === player.gz) {
      return { lost: true, shiftDeaths: [], bossDamaged: false };
    }
    if (!isWalkable(ngx, ngz)) {
      if (e.isBoss && e.hp > 1) {
        e.hp -= 1;
        bossDamaged = true;
        continue;
      }
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
    for (const en of list) {
      if (en.isBoss && en.hp > 1) {
        en.hp -= 1;
        bossDamaged = true;
        targets.delete(en);
      } else {
        toDestroy.add(en);
        deathEnds.set(en, { gx: t.gx, gz: t.gz });
      }
    }
  }

  const pushedSet = new Set(pushedList);
  for (const [e, t] of [...targets.entries()]) {
    if (toDestroy.has(e)) continue;
    for (const other of enemies) {
      if (other.pendingRemove || toDestroy.has(other)) continue;
      if (pushedSet.has(other)) continue;
      if (other.gx === t.gx && other.gz === t.gz) {
        if (e.isBoss && e.hp > 1) {
          e.hp -= 1;
          bossDamaged = true;
          targets.delete(e);
        } else {
          toDestroy.add(e);
          deathEnds.set(e, { gx: t.gx, gz: t.gz });
        }
        break;
      }
    }
  }

  const preShift = new Map(pushedList.map((en) => [en, { gx: en.gx, gz: en.gz }]));

  for (const e of pushedList) {
    if (toDestroy.has(e)) continue;
    const t = targets.get(e);
    if (!t) continue;
    const prev = preShift.get(e);
    e.gx = t.gx;
    e.gz = t.gz;
    if (
      e.type === EnemyType.STATIC &&
      prev &&
      (prev.gx !== e.gx || prev.gz !== e.gz) &&
      !e.aggravated
    ) {
      e.aggravated = true;
      applyStaticAggravatedVisual(e);
    }
  }

  const shiftDeaths = [];
  for (const e of toDestroy) {
    const end = deathEnds.get(e);
    if (end) shiftDeaths.push({ enemy: e, endGx: end.gx, endGz: end.gz });
  }

  return { lost: false, shiftDeaths, bossDamaged };
}

/**
 * Planifica patrullas y perseguidores en orden de array.
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
    if (e.type !== EnemyType.PATROL) continue;

    const fromKey = posKey(e.gx, e.gz);
    occupied.delete(fromKey);

    let nx = e.gx + e.patrolDx;
    let nz = e.gz + e.patrolDz;
    let chosen = null;
    if (isWalkable(nx, nz) && !occupied.has(posKey(nx, nz)) && !(nx === player.gx && nz === player.gz)) {
      chosen = { gx: nx, gz: nz };
    } else {
      e.patrolDx *= -1;
      e.patrolDz *= -1;
      nx = e.gx + e.patrolDx;
      nz = e.gz + e.patrolDz;
      if (isWalkable(nx, nz) && !occupied.has(posKey(nx, nz)) && !(nx === player.gx && nz === player.gz)) {
        chosen = { gx: nx, gz: nz };
      }
    }

    if (chosen) {
      if (chosen.gx === player.gx && chosen.gz === player.gz) {
        return { lost: true, moves: [] };
      }
      occupied.add(posKey(chosen.gx, chosen.gz));
      moves.push({ enemy: e, gx: chosen.gx, gz: chosen.gz });
    } else {
      occupied.add(fromKey);
    }
  }

  for (const e of enemies) {
    if (e.pendingRemove) continue;
    if (!actsAsChaserInPlanning(e)) continue;

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
