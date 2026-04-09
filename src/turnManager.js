import { isWalkable, collectEnemiesInFront } from './grid.js';
import { EnemyType, planChaserMove } from './enemy.js';
import { PUSH_TILES } from './constants.js';

export const Phase = {
  PLAYER: 'player',
  ENEMY: 'enemy',
  GAME_OVER: 'game_over',
};

function posKey(gx, gz) {
  return `${gx},${gz}`;
}

/**
 * Resolves Shift: pushes enemies in front along facing; destroys on wall/other enemy;
 * landing on player ends the game (loss).
 * @returns {{ lost: boolean }}
 */
export function resolveShift(player, enemies, onEnemyDestroyed) {
  const dx = player.facing.dx;
  const dz = player.facing.dz;
  const pushedList = collectEnemiesInFront(player.gx, player.gz, dx, dz, enemies);
  if (pushedList.length === 0) return { lost: false };

  const targets = new Map();
  const toDestroy = new Set();

  for (const e of pushedList) {
    if (e.pendingRemove) continue;
    const ngx = e.gx + dx * PUSH_TILES;
    const ngz = e.gz + dz * PUSH_TILES;

    if (ngx === player.gx && ngz === player.gz) {
      return { lost: true };
    }
    if (!isWalkable(ngx, ngz)) {
      toDestroy.add(e);
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
    if (list.length > 1) list.forEach((e) => toDestroy.add(e));
  }

  const pushedSet = new Set(pushedList);
  for (const [e, t] of targets) {
    if (toDestroy.has(e)) continue;
    for (const other of enemies) {
      if (other.pendingRemove || toDestroy.has(other)) continue;
      if (pushedSet.has(other)) continue;
      if (other.gx === t.gx && other.gz === t.gz) {
        toDestroy.add(e);
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

  for (const e of toDestroy) {
    e.pendingRemove = true;
    e.destroyAnim = 1;
    onEnemyDestroyed?.(e);
  }

  return { lost: false };
}

function enemyAt(gx, gz, enemies, exclude) {
  for (const e of enemies) {
    if (e.pendingRemove) continue;
    if (exclude && e === exclude) continue;
    if (e.gx === gx && e.gz === gz) return e;
  }
  return null;
}

/**
 * Plans enemy moves (no animation). Returns { lost: boolean, moves: Array<{ enemy, gx, gz }> }
 */
export function planEnemyTurn(player, enemies) {
  const planned = [];
  for (const e of enemies) {
    if (e.pendingRemove) continue;
    if (e.type !== EnemyType.CHASER) continue;

    const step = planChaserMove(e, player.gx, player.gz);
    if (!step) continue;
    const { gx: ngx, gz: ngz } = step;

    if (!isWalkable(ngx, ngz)) continue;

    if (ngx === player.gx && ngz === player.gz) {
      return { lost: true, moves: [] };
    }

    if (enemyAt(ngx, ngz, enemies, e)) continue;

    planned.push({ enemy: e, gx: ngx, gz: ngz });
  }

  const byTarget = new Map();
  for (const p of planned) {
    const k = posKey(p.gx, p.gz);
    if (!byTarget.has(k)) byTarget.set(k, []);
    byTarget.get(k).push(p);
  }

  const moves = [];
  for (const p of planned) {
    if (byTarget.get(posKey(p.gx, p.gz)).length > 1) continue;
    moves.push({ enemy: p.enemy, gx: p.gx, gz: p.gz });
  }

  return { lost: false, moves };
}

export function countLivingEnemies(enemies) {
  return enemies.filter((e) => !e.pendingRemove).length;
}
