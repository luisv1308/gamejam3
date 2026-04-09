/**
 * Cada nivel: GRID_SIZE filas de strings de GRID_SIZE caracteres.
 * gz=0 es la primera fila del array.
 *
 * Leyenda:
 *   P = jugador (exactamente uno)
 *   E = enemigo chaser
 *   e = enemigo estático
 *   W = muro (bloquea movimiento y línea de shift)
 *   . = vacío
 */

export const LEVELS = [
  // Nivel 1 — intro: espacio abierto, pocos enemigos
  [
    '........',
    '........',
    '..E..E..',
    '........',
    '........',
    '...P....',
    '........',
    '........',
  ],
  // Nivel 2 — muro, E arriba, E y P abajo
  [
    '........',
    '..WWW...',
    '...E....',
    '........',
    '..E.P...',
    '........',
    '........',
    '........',
  ],
  // Nivel 3 — E arriba, flancos y E abajo-derecha
  [
    '........',
    '...E....',
    '........',
    '..E.P...',
    '......E.',
    '........',
    '........',
    '........',
  ],
];

export const LEVEL_COUNT = LEVELS.length;
