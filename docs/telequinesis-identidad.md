# Identidad y lore — K-27 «Vector»

## Premisa

Espionaje corporativo con telequinesis táctica: el protagonista asciende un rascacielos para **extraer inteligencia** de la cúspide (penthouse / núcleo de acceso). La seguridad reconoce patrones de intrusión; cada planta sube el riesgo.

## Plantas y niveles

| Pantalla | Nivel (array) | Idea narrativa |
|----------|---------------|----------------|
| 1 | 0 | Planta B1 — perímetro; intro al grid y al shift. |
| 2 | 1 | Control de accesos; muros y patrullas. |
| 3 | 2 | Pasillo térmico; **ascensor** en casilla noreste `(gx=7, gz=0)`; bloqueada al paso. |
| 4 | 3 | Archivo intermedio — **objetivo: salida** (`X`). |
| 5 | 4 | Sala de terminales — **hack**: `Q`×2 en `H`, o si la sala queda vacía basta con **pisar el terminal** (cian). |
| 6 | 5 | Bóveda de credenciales — **objetivo: extract** (`K` + `X`); tras victoria, **ascensor**. |
| 7 | 6 | Seguridad reforzada — enemigos **pesados** (`R`). |
| 8 | 7 | Patrullas (`p`) y perseguidores. |
| 9 | 8 | **Jefe** (`M`) en penthouse; HP múltiple; refuerzos al bajar a 1 HP. |

Coordenadas del ascensor: `ELEVATOR_GRID_GX`, `ELEVATOR_GRID_GZ`. Índices de transición: `ELEVATOR_TRANSITION_LEVEL_INDICES` en `src/constants.js`.

## Leyenda de nivel (ASCII)

- `P` jugador · `W` muro · `E` perseguidor · `e` estático · `p` patrulla · `R` pesado · `M` jefe
- `X` salida · `H` terminal (hack) · `K` datachip (extract)
- `e` centinela: no patrulla hasta que lo **mueve el teleempuje**; entonces pasa a **perseguirte** como un `E`.

## Telequinesis en UI

- Mecánica principal: **Shift** (empuje en línea).
- **Q**: pasar turno (necesario para completar hack en la terminal sin moverse).

## Backlog de diseño

- **[Cosas a implementar](cosas-a-implementar.md)** — mecánicas propuestas, enemigos, trampas, mundos 2–3 y grids de niveles 4–10 (bocetos 8×8, alineados al motor).
