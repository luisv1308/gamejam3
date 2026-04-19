/** Grid and gameplay constants */
export const GRID_SIZE = 8;
export const TILE_SIZE = 1;
/** How many tiles Shift pushes normal enemies along the line. */
export const PUSH_TILES = 2;
/** Heavy enemies are pushed fewer tiles. */
export const HEAVY_PUSH_TILES = 1;
/** Casillas hacia delante (desde el jugador) que el shift puede alcanzar. */
export const SHIFT_MAX_RANGE = 3;

export const PLAYER_SPEED = 8;
export const ENEMY_SPEED = 6;

/** Vida del jefe (golpes de impacto en muro / bloqueo antes de destruirse). */
export const BOSS_HP = 3;

/**
 * Tras completar el nivel con este índice (0-based), se reproduce la escena del ascensor
 * y se carga el siguiente.
 */
export const ELEVATOR_TRANSITION_LEVEL_INDICES = [2, 5];

/** Casilla del ascensor (esquina noreste: máximo X, fila norte gz=0). */
export const ELEVATOR_GRID_GX = GRID_SIZE - 1;
export const ELEVATOR_GRID_GZ = 0;
