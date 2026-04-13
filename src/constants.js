/** Grid and gameplay constants */
export const GRID_SIZE = 8;
export const TILE_SIZE = 1;
/** How many tiles Shift pushes enemies along the line (1–2 per spec). */
export const PUSH_TILES = 2;
/** Casillas hacia delante (desde el jugador) que el shift puede alcanzar. */
export const SHIFT_MAX_RANGE = 3;

export const PLAYER_SPEED = 8;
export const ENEMY_SPEED = 6;

/**
 * Tras limpiar el nivel con este índice (0-based), se reproduce la escena del ascensor
 * y se carga el siguiente (p. ej. nivel 3 en pantalla → transición a piso 2).
 */
export const ELEVATOR_TRANSITION_LEVEL_INDEX = 2;

/** Casilla del ascensor (esquina noreste: máximo X, fila norte gz=0). */
export const ELEVATOR_GRID_GX = GRID_SIZE - 1;
export const ELEVATOR_GRID_GZ = 0;
