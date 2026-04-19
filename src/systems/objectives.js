import { countLivingEnemies } from '../turnManager.js';

export const ObjectiveType = {
  ELIMINATE_ALL: 'eliminate_all',
  REACH_EXIT: 'reach_exit',
  HACK_TERMINAL: 'hack_terminal',
  EXTRACT: 'extract',
};

export function createLevelRuntimeState() {
  return { hasKey: false, hackProgress: 0 };
}

export function playerOnCell(player, cell) {
  if (!cell || !player) return false;
  return player.gx === cell.gx && player.gz === cell.gz;
}

/**
 * @param {{ hasKey: boolean, hackProgress: number }} levelRuntime
 * @param {{ exit?: {gx:number,gz:number}|null, terminal?: {gx:number,gz:number}|null, objective: string }} layout
 */
export function isObjectiveMet({ layout, levelRuntime, player, enemies }) {
  const objective = layout.objective ?? ObjectiveType.ELIMINATE_ALL;

  switch (objective) {
    case ObjectiveType.ELIMINATE_ALL:
      return countLivingEnemies(enemies) === 0 && enemies.length === 0;
    case ObjectiveType.REACH_EXIT: {
      if (!layout.exit) return false;
      return playerOnCell(player, layout.exit);
    }
    case ObjectiveType.HACK_TERMINAL: {
      const cleared = countLivingEnemies(enemies) === 0 && enemies.length === 0;
      if (
        cleared &&
        layout.terminal &&
        player &&
        playerOnCell(player, layout.terminal)
      ) {
        return true;
      }
      return levelRuntime.hackProgress >= 2;
    }
    case ObjectiveType.EXTRACT: {
      return (
        levelRuntime.hasKey &&
        layout.exit &&
        playerOnCell(player, layout.exit)
      );
    }
    default:
      return false;
  }
}

/**
 * Tras el turno enemigo: acumula progreso de hackeo si sigues en la terminal.
 * Si sales de la casilla, el progreso se reinicia.
 */
export function updateHackProgressAfterEnemyPhase({ layout, levelRuntime, player }) {
  if ((layout.objective ?? ObjectiveType.ELIMINATE_ALL) !== ObjectiveType.HACK_TERMINAL) return;
  if (!layout.terminal || !player) return;
  if (playerOnCell(player, layout.terminal)) {
    levelRuntime.hackProgress += 1;
  } else {
    levelRuntime.hackProgress = 0;
  }
}

export function tryPickKeyCell(layout, levelRuntime, player) {
  if (!layout.keyCell || !player) return;
  if (player.gx === layout.keyCell.gx && player.gz === layout.keyCell.gz) {
    levelRuntime.hasKey = true;
  }
}

export function objectiveHudLabel(objective) {
  switch (objective) {
    case ObjectiveType.REACH_EXIT:
      return 'Objetivo: salida';
    case ObjectiveType.HACK_TERMINAL:
      return 'Objetivo: terminal (cian)';
    case ObjectiveType.EXTRACT:
      return 'Objetivo: chip (amarillo) y luego salida (verde)';
    case ObjectiveType.ELIMINATE_ALL:
    default:
      return 'Objetivo: neutralizar hostiles';
  }
}

/** Texto corto para el HUD: qué son las marcas en el suelo y cómo gana cada modo. */
export function floorLegendForObjective(objective) {
  switch (objective) {
    case ObjectiveType.REACH_EXIT:
      return 'Círculo verde = salida. Ganas al pisarla (no hace falta limpiar el mapa).';
    case ObjectiveType.HACK_TERMINAL:
      return 'Círculo cian = terminal. Opción A: Q dos veces encima del cian (con turno enemigo entre Q). Opción B: si no queda nadie, basta con pisar el cian.';
    case ObjectiveType.EXTRACT:
      return 'Amarillo = chip, verde = salida. Pisa chip, luego salida.';
    case ObjectiveType.ELIMINATE_ALL:
    default:
      return 'Casillas tenues en línea con tu puntería = alcance del shift, no un “objetivo” en el suelo. Victoria: 0 hostiles (espera a que termine la animación del último).';
  }
}

/**
 * Leyenda HUD con detalle extra en extract (chip sí/no).
 * @param {string} objective
 * @param {{ hasKey?: boolean } | null} levelRuntime
 */
export function fullFloorLegend(objective, levelRuntime) {
  if (objective === ObjectiveType.EXTRACT) {
    const has = levelRuntime?.hasKey === true;
    return has
      ? 'Chip ya recogido. Falta: entrar en el círculo verde (salida; en este nivel suele estar arriba a la derecha).'
      : 'No basta con derrotar enemigos: primero pisa el círculo amarillo (chip). Luego el círculo verde (salida). El orden importa.';
  }
  return floorLegendForObjective(objective);
}
