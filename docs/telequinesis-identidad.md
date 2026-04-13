# Identidad y lore — K-27 «Vector»

## Premisa

Infiltración telequinética: el protagonista borra expedientes que convierten a personas en “activos” del programa. La seguridad reconoce la firma psíquica.

## Plantas y niveles

| Pantalla | Nivel (array) | Idea narrativa |
|----------|---------------|----------------|
| 1 | 0 | Intro al grid; archivo de sujetos. |
| 2 | 1 | Contención; muros y patrullas. |
| 3 | 2 | **Núcleo de datos / expedientes**. Cabina de ascensor fija en casilla noreste `(gx=7, gz=0)`; bloqueada al paso. |
| Transición | — | Tras victoria: fade out → héroe delante del ascensor → fade in → pulsador (SFX) → abre puertas → entra → cierra → sube → fade a negro → nivel 4. |
| 4 | 3 | **Planta 2** — acceso restringido; primer sector del “mundo 2”. |

Coordenadas: `ELEVATOR_GRID_GX`, `ELEVATOR_GRID_GZ` e índice `ELEVATOR_TRANSITION_LEVEL_INDEX` en `constants.js`.

## Telequinesis en UI

- Mecánica principal: **Shift** (empuje en línea).
- Copy de briefing: infiltrar, borrar dossiers, evitar contención.
