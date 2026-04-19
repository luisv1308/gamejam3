import { ObjectiveType } from '../systems/objectives.js';

/**
 * Cada nivel: `rows` = GRID_SIZE filas de strings de GRID_SIZE caracteres.
 * gz=0 es la primera fila del array (norte).
 * Lore y ascensores: docs/telequinesis-identidad.md.
 *
 * Leyenda:
 *   P = jugador (exactamente uno)
 *   W = muro
 *   E = perseguidor
 *   e = centinela (quieto hasta que el shift lo desplaza; luego persigue)
 *   p = patrullero (rebota en muros)
 *   R = pesado (empuje corto)
 *   M = jefe (HP elevado; ver constants.BOSS_HP)
 *   X = salida (reach_exit / extract)
 *   H = terminal (hack_terminal)
 *   K = datachip / llave (extract)
 *   . = vacío
 */

/** @typedef {{ rows: string[], objective: string, meta?: Record<string, unknown> }} LevelDef */

/** @type {LevelDef[]} */
export const LEVEL_DEFS = [
  {
    objective: ObjectiveType.ELIMINATE_ALL,
    rows: [
      '........',
      '........',
      '..E.....',
      '........',
      '...P....',
      '........',
      '........',
      '........',
    ],
  },
  {
    objective: ObjectiveType.ELIMINATE_ALL,
    rows: [
      '........',
      '........',
      '....E...',
      '...W....',
      '........',
      '...P....',
      '........',
      '........',
    ],
  },
  {
    objective: ObjectiveType.ELIMINATE_ALL,
    rows: [
      '........',
      '...E....',
      '..EW....',
      '........',
      '..EP....',
      '........',
      '........',
      '........',
    ],
  },
  {
    objective: ObjectiveType.REACH_EXIT,
    rows: [
      '.......X',
      '........',
      '..E.....',
      '........',
      '...P....',
      '........',
      '........',
      '........',
    ],
  },
  {
    objective: ObjectiveType.HACK_TERMINAL,
    rows: [
      '........',
      '....E...',
      '...H....',
      '..P.....',
      '....p...',
      '........',
      '........',
      '........',
    ],
  },
  {
    objective: ObjectiveType.EXTRACT,
    rows: [
      '.......X',
      '........',
      '...E....',
      '....K...',
      '...P....',
      '..E.....',
      '........',
      '........',
    ],
  },
  {
    objective: ObjectiveType.ELIMINATE_ALL,
    rows: [
      '........',
      '..R.E...',
      '...W.W..',
      '........',
      '...P....',
      '...W....',
      '..E.....',
      '........',
    ],
  },
  {
    objective: ObjectiveType.ELIMINATE_ALL,
    rows: [
      '........',
      '.p...E..',
      '...W....',
      '........',
      '...P....',
      '...W....',
      '.E...p..',
      '........',
    ],
  },
  {
    objective: ObjectiveType.ELIMINATE_ALL,
    meta: { isBossFloor: true },
    rows: [
      '........',
      '...e.e..',
      '..WWMWW.',
      '...eMe..',
      '..W.W.W.',
      '...P....',
      '........',
      '........',
    ],
  },
];

export const LEVEL_COUNT = LEVEL_DEFS.length;

/** Compat: solo matrices de filas (p. ej. tests o herramientas). */
export const LEVELS = LEVEL_DEFS.map((d) => d.rows);
