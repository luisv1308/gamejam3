# Cosas a implementar — K-27 «Vector»

Backlog de diseño y mecánicas. No sustituye al código hasta que cada ítem esté implementado y probado.

## Principio rector

**Regla de oro:** no fuerza bruta, solo manipulación espacial. Las propuestas siguientes deben respetar esa identidad.

---

## 1. Nuevas mecánicas (sin romper la identidad)

### A. Empuje + atracción (Shift dual)

- **Empuje:** ya existe (reposicionar en línea).
- **Atracción:** jalar objetos o enemigos hacia el jugador.

**Resultado posible:**

- Trampas usando paredes.
- Enemigos que se eliminan entre ellos.
- Puzzles tipo «traer la llave hacia ti sin moverte».

### B. «Peso mental» (límite táctico)

No todo se mueve igual:

- Objetos ligeros: sin coste extra o mínimo.
- Enemigos: coste medio.
- Anclas / objetos pesados: requieren 2 turnos o barra de carga.

**Resultado:** decisiones del tipo «¿uso el turno en mover esto o en sobrevivir?».

### C. Proyección (ghost move)

Simular un movimiento antes de ejecutarlo; en la vista previa los enemigos reaccionan como en el turno real.

**Resultado:** «resuelvo antes de ejecutar» — planificación pura.

### D. Interacción con objetos del entorno

- Cajas movibles.
- Núcleos de energía.
- Puertas que abren al empujar algo encima de un mecanismo.
- Interruptores accionables a distancia con el poder.

**Resultado:** el poder deja de ser solo combate y pasa a ser **lenguaje** del nivel.

### E. Sobrecarga mental (riesgo / recompensa)

Narrativa ya sugiere inestabilidad; llevarlo a gameplay:

- Uso intensivo de poderes seguidos: distorsión visual, retardo de inputs, activación de peligros extra.

**Resultado:** conexión directa con K-27 perdiendo estabilidad.

---

## 2. Enemigos y trampas nuevas

### Enemigos

1. **Centinela de pulso** — No se mueve; activa zonas cada X turnos. Presión por timing.
2. **Espejo** — Refleja el poder telequinético (empuje rebota hacia ti u otra dirección). Puzzle inmediato.
3. **Cazador predictivo** — No va a tu casilla actual; va hacia donde «vas a estar». Obliga a romper patrones.
4. **Enjambre (multi-unidad)** — Se mueve como bloque o en patrón. Manipular varios objetivos y caos controlado.

### Trampas del entorno

- **Piso de impulso:** te lanza en dirección fija.
- **Piso frágil:** se rompe tras pisarlo (o N pisadas).
- **Láser lineal:** se activa cada cierto número de turnos.
- **Zona anti-psíquica:** no puedes usar poderes dentro de la zona.

**Nota de diseño:** limitar al jugador sin quitarle control del personaje.

---

## 3. Diseño de mundos (pantallas 4–9)

### Mundo 2 — niveles 4–6: «Contención avanzada»

**Tema:** te encierran más que perseguirte sin tino.

| Nivel | Introduce | Sensación / lección |
|-------|-----------|---------------------|
| 4 — «Arquitectura hostil» | Objetos movibles y rutas que parecen válidas | Manipular el espacio, no solo rodear. |
| 5 — «Reloj interno» | Centinela + más espacio = timing real | Presión temporal; esperar también se castiga. |
| 6 — «Cierre limpio» | Examen con varias rutas creativas y timing estricto | Múltiples soluciones, poco margen elegante si fallas. |

### Mundo 3 — niveles 7–9: «Núcleo psíquico»

**Tema:** la realidad empieza a romperse.

| Nivel | Introduce | Sensación / lección |
|-------|-----------|---------------------|
| 7 — «Gravedad invertida» | Atracción; objeto lejos obliga a jalar | El 8×8 da distancia real para la mecánica. |
| 8 — «Geometría mental» | Rebotes / manipulación indirecta | Ángulos y empujes no triviales. |
| 9 — «Colapso del sistema» (clímax) | Dos centinelas, `~`, objetos, ancla | Pensar varios turnos; condicionar sin bloquear todo. |

### En resumen (objetivo de producto)

El juego no necesita solo «más cosas», sino **más formas de pensar**. Bien ejecutado, el jugador no dice solo «qué difícil», sino «esto ya no es el mismo juego».

---

## 4. Bonus: giro memorable (opcional)

**Nivel donde tú eres el enemigo:** un clon o «eco» repite tus movimientos pasados y te persigue. Literalmente jugar contra tu propio plan anterior.

---

## 5. Grids de laboratorio (diseño 8×8)

**Leyenda:**

| Símbolo | Significado |
|---------|-------------|
| `P` | Jugador |
| `E` | Perseguidor (chaser) |
| `A` | Ancla |
| `C` | Centinela de pulso |
| `#` | Pared |
| `O` | Objeto movible |
| `X` | Meta |
| `~` | Zona anti-psíquica |
| `.` | Vacío |

Los grids siguientes son **8×8** y alineados con [`GRID_SIZE` en `constants.js`](../src/constants.js) y el formato de [`levels.js`](../src/levels/levels.js). Aun así, hay que **validar solubilidad** cuando existan las mecánicas (atracción, pulso, `~`, etc.).

### Ajuste fino: espacio muerto intencional

Tiles vacíos que **no ayudan directamente** pero dan margen para **equivocarse con elegancia**: el jugador puede pensar «casi lo tenía…» en lugar de «esto es injusto». El tamaño 8×8 permite ese colchón sin diluir el puzzle.

---

### Mundo 2 — Contención avanzada (niveles 4–6)

#### Nivel 4 — «Arquitectura hostil»

Introduce: objetos movibles con rutas falsas.

```
# # # # # # # #
# . . O . . . #
# . # # # # . #
# P . . . . A #
# . # # # # . #
# . . O . . . #
# . . . . . X #
# # # # # # # #
```

- **Qué aporta el 8×8:** espacio para equivocarse; rutas que parecen válidas y no lo son.
- **Intención:** el jugador cree que puede rodear, pero necesita **manipular**.

#### Nivel 5 — «Reloj interno»

Centinela + más espacio = timing real.

```
# # # # # # # #
# . . C . . . #
# . # # # # . #
# P . E . . X #
# . # # # # . #
# . . . . . . #
# . . . . . . #
# # # # # # # #
```

- **Cambio clave:** más casillas permiten «esperar», pero el pulso castiga esa espera.
- **Regla diseñada (referencia):** `C` activa zona en cruz cada N turnos.
- **Intención:** presión temporal tangible.

#### Nivel 6 — «Cierre limpio»

Examen con múltiples soluciones.

```
# # # # # # # #
# . C . O . . #
# . # # # # . #
# P . E . A . #
# . # # # # . #
# O . . . . . #
# . . . . . X #
# # # # # # # #
```

- **Diseño:** espacio extra para rutas creativas; el timing sigue estricto.
- **Intención:** examen de contención sin una única línea obvia.

---

### Mundo 3 — Núcleo psíquico (niveles 7–9)

El 8×8 encaja bien en puzzles de **varias capas** (distancia, ángulos, zonas que condicionan sin ahogar).

#### Nivel 7 — «Gravedad invertida»

Introduce **atracción**.

```
# # # # # # # #
# . . O . . . #
# . # # # # . #
# P . . . . X #
# . # # # # . #
# . . E . . . #
# . . . . . . #
# # # # # # # #
```

- **Uso del espacio:** el objeto queda lejos → fuerza usar atracción además del movimiento.
- **Intención:** «acercar también es controlar».

#### Nivel 8 — «Geometría mental»

Rebotes / manipulación indirecta (espejos o superficies que desvían el poder).

```
# # # # # # # #
# . . A . . . #
# . # # # # . #
# P . O . . X #
# . # # # # . #
# . . E . . . #
# . . . . . . #
# # # # # # # #
```

- **Mejora con 8×8:** ángulos y empujes no triviales, no solo líneas rectas.
- **Intención:** controlar **trayectoria**, no solo el objetivo final.

#### Nivel 9 — «Colapso del sistema»

Final con todo combinado.

```
# # # # # # # #
# C . O . . C #
# . # ~ # # . #
# P . E . . X #
# . # ~ # # . #
# O . A . . O #
# . . . . . . #
# # # # # # # #
```

- **Por qué 8×8:** dos centinelas necesitan aire para ser interesantes; las zonas `~` **condicionan** sin bloquear todo el tablero.
- **Intención:** pensar varios turnos adelante y combinar lo aprendido; sensación de «desarmar el sistema».

---

### Opcional — Nivel 10 — «Eco»

Mecánica: sombra que repite tus acciones (retraso de 1 turno). Grid8×8 alineado al motor (marco interior ampliable según diseño final).

```
# # # # # # # #
# . . . . . . #
# . # # # # . #
# P . . . . X #
# . # # # # . #
# . . . . . . #
# . . . . . . #
# # # # # # # #
```

- **Regla diseñada:** tras 1 turno aparece un clon que repite lo que hiciste.
- **Resultado:** jugar contra tu propio pasado.

---

## Nota técnica: alineación con el código

- `GRID_SIZE` **8** en [`src/constants.js`](../src/constants.js); strings de **8×8** en [`src/levels/levels.js`](../src/levels/levels.js).
- Los bocetos de esta sección ya están en **8×8**; al pasarlos a `LEVELS` hay que **comprobar** solubilidad con turnos reales (jugador → enemigos, shift, victoria por criterio del juego) y con las mecánicas que aún no existan en código (marcar como *diseño objetivo* hasta implementarlas).
