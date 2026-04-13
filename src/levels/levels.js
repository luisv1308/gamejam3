/**
 * Cada nivel: GRID_SIZE filas de strings de GRID_SIZE caracteres.
 * gz=0 es la primera fila del array.
 *
 * Lore (ver docs/telequinesis-identidad.md): los expedientes críticos están en la planta del nivel 3 (pantalla 3); al neutralizarlo, K-27 usa el ascensor de servicio
 * para acceder al piso 2 (nivel 4) mediante ascensor de servicio.
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
  // Nivel 3 — expedientes; ascensor fijo en (7,0) NE; al ganar: cutscene → piso 2
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
  // Nivel 4 — planta 2 / mundo 2 (tras ascensor)
  [
    '........',
    '........',
    '..E.E...',
    '...W....',
    '...P....',
    '...W....',
    '..e.E...',
    '........',
  ],
];

export const LEVEL_COUNT = LEVELS.length;
