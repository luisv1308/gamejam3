import * as THREE from 'three';
import {
  GRID_SIZE,
  TILE_SIZE,
  PLAYER_SPEED,
  ENEMY_SPEED,
  SHIFT_MAX_RANGE,
  ELEVATOR_TRANSITION_LEVEL_INDEX,
  ELEVATOR_GRID_GX,
  ELEVATOR_GRID_GZ,
} from './constants.js';
import {
  gridToWorld,
  ENTITY_ANCHOR_Y,
  cardinalYawFromDelta,
  isWalkable,
  collectEnemiesInFront,
  isInsideGrid,
  clearWallMask,
  setWallMask,
  isWall,
} from './grid.js';
import { createPlayer, setFacingFromMove, setPlayerAim, disposePlayer } from './player.js';
import { loadLevel, buildWallMaskFromPositions, LEVEL_COUNT } from './systems/levelLoader.js';
import { makeEnemy, EnemyType, disposeEnemy } from './enemy.js';
import {
  resolveShift,
  planEnemyTurn,
  countLivingEnemies,
  Phase,
} from './turnManager.js';
import { Shockwave } from './effects/shockwave.js';
import { buildElevatorStation } from './effects/elevatorStation.js';
import { MilitaryTheme as Theme } from './visuals/militaryTheme.js';
import {
  resumeAudio,
  startAmbient,
  playPlayerStep,
  playAimTick,
  playShiftCharge,
  playShiftImpact,
  playEnemyDeath,
  playSectorClear,
  playElevatorButton,
  playDefeat,
  playVictory,
} from './audio/gameAudio.js';

/** Nombres de sector para copy narrativo (alineado con LEVEL_COUNT). */
const SECTOR_NAMES = [
  'Sector 01 — Archivo de sujetos',
  'Sector 02 — Contención',
  'Sector 03 — Núcleo de datos (expedientes)',
  'Planta 2 — Acceso restringido',
];

const INTRO_TITLE = 'K-27 «Vector»';
const INTRO_BODY =
  'Telekinesis táctica. Objetivo: infiltrar la instalación y borrar los expedientes que convierten a las personas en activos del programa. La seguridad reconoce tu firma psíquica.';
const INTRO_HINT =
  'WASD mover · Flechas apuntar · Espacio telequinesis (shift) · Esc pausa · Enter o clic para comenzar';

// ——— Game state ———
let scene;
let camera;
let renderer;
let shockwave;
/** Posición de reposo de la cámara (para screen-shake sin deriva). */
let cameraRest;
/** Planos en el suelo: casillas de alcance del shift (sin barra ni línea 3D). */
let rangeTileMeshes = [];
let rangeHighlightGeom = null;
let wallSharedGeom = null;
let wallSharedMat = null;
let wallMeshes = [];
let player;
let enemies = [];
let phase = Phase.PLAYER;
let busy = false;
/** Durante el delay de 0,1 s antes de resolver el shift. */
let shiftDelayPending = false;
let currentLevelIndex = 0;
/** Fase de juego antes de abrir pausa (PLAYER o ENEMY). */
let phaseBeforePause = Phase.PLAYER;
/** Solo en DEV: { sync(levelIndex) } */
let devMenuApi = null;

/** Ascensor entre plantas: estado del cutscene (ver updateElevatorCutscene). */
let elevatorRun = null;
/** Cabina en escena durante el nivel 3; null en otros niveles. */
let elevatorStationState = null;

function updateHud() {
  const sectorEl = document.getElementById('hud-sector');
  const progressEl = document.getElementById('hud-progress');
  const phaseEl = document.getElementById('hud-phase');
  if (!sectorEl || !progressEl) return;

  const i = currentLevelIndex;
  sectorEl.textContent = SECTOR_NAMES[i] ?? `Sector ${String(i + 1).padStart(2, '0')}`;
  progressEl.textContent = `Nivel ${i + 1} / ${LEVEL_COUNT}`;

  if (phaseEl) {
    let line = '';
    if (phase === Phase.INTRO) line = 'Briefing';
    else if (phase === Phase.LEVEL_CLEAR) line = 'Sector limpio — continúa';
    else if (phase === Phase.ELEVATOR) line = 'Ascensor — transición de planta';
    else if (phase === Phase.DEFEAT) line = 'Protocolo activo — reintentar';
    else if (phase === Phase.GAME_OVER) line = 'Campaña completada';
    else if (phase === Phase.PAUSE) line = 'Pausa';
    phaseEl.textContent = line;
  }
}

function showPauseOverlay() {
  const el = document.getElementById('pause-overlay');
  if (!el) return;
  el.classList.add('visible');
  el.setAttribute('aria-hidden', 'false');
}

function hidePauseOverlay() {
  const el = document.getElementById('pause-overlay');
  if (!el) return;
  el.classList.remove('visible');
  el.setAttribute('aria-hidden', 'true');
}

function togglePause() {
  if (phase === Phase.PAUSE) {
    phase = phaseBeforePause;
    hidePauseOverlay();
    updateHud();
    return;
  }
  if (
    phase === Phase.INTRO ||
    phase === Phase.LEVEL_CLEAR ||
    phase === Phase.GAME_OVER ||
    phase === Phase.DEFEAT ||
    phase === Phase.ELEVATOR
  ) {
    return;
  }
  if (phase !== Phase.PLAYER && phase !== Phase.ENEMY) return;
  if (busy || shiftDelayPending) return;
  phaseBeforePause = phase;
  phase = Phase.PAUSE;
  showPauseOverlay();
  updateHud();
}

/** Mundo lógico y animaciones detenidos (narrativa + pausa manual). */
function isWorldFrozen() {
  return (
    phase === Phase.INTRO ||
    phase === Phase.LEVEL_CLEAR ||
    phase === Phase.GAME_OVER ||
    phase === Phase.DEFEAT ||
    phase === Phase.PAUSE ||
    phase === Phase.ELEVATOR
  );
}

function hideNarrativeOverlay() {
  const el = document.getElementById('narrative-overlay');
  if (!el) return;
  el.classList.remove('visible');
  el.setAttribute('aria-hidden', 'true');
}

function setElevatorFadeOpacity(opacity) {
  const el = document.getElementById('elevator-fade');
  if (!el) return;
  el.style.opacity = String(Math.max(0, Math.min(1, opacity)));
}

function disposeElevatorStation() {
  if (!elevatorStationState) return;
  elevatorStationState.dispose(scene);
  elevatorStationState = null;
}

function startElevatorCutscene() {
  if (!player?.mesh || !elevatorStationState) return;
  const ec = elevatorStationState;
  const front = gridToWorld(ELEVATOR_GRID_GX, ELEVATOR_GRID_GZ + 1);
  const inside = gridToWorld(ELEVATOR_GRID_GX, ELEVATOR_GRID_GZ);
  setElevatorFadeOpacity(0);
  elevatorRun = {
    stage: 'fadeOut',
    stageTime: 0,
    liftGroup: ec.liftGroup,
    doorL: ec.doorL,
    doorR: ec.doorR,
    doorLClosedX: ec.doorLClosedX,
    doorRClosedX: ec.doorRClosedX,
    doorOpenAmt: ec.doorOpenAmt,
    front,
    inside,
    buttonPlayed: false,
  };
}

function updateElevatorCutscene(dt) {
  if (!elevatorRun || !player?.mesh) return;
  const r = elevatorRun;
  r.stageTime += dt;

  const easeOut = (k) => 1 - (1 - k) * (1 - k);
  const smooth = (k) => k * k * (3 - 2 * k);

  switch (r.stage) {
    case 'fadeOut': {
      const d = 0.48;
      setElevatorFadeOpacity(Math.min(1, r.stageTime / d));
      if (r.stageTime >= d) {
        player.mesh.position.set(r.front.x, ENTITY_ANCHOR_Y, r.front.z);
        player.mesh.rotation.y = Math.PI;
        player.gx = ELEVATOR_GRID_GX;
        player.gz = ELEVATOR_GRID_GZ + 1;
        r.stage = 'fadeIn';
        r.stageTime = 0;
      }
      break;
    }
    case 'fadeIn': {
      const d = 0.52;
      setElevatorFadeOpacity(1 - Math.min(1, r.stageTime / d));
      if (r.stageTime >= d) {
        setElevatorFadeOpacity(0);
        r.stage = 'button';
        r.stageTime = 0;
      }
      break;
    }
    case 'button': {
      if (!r.buttonPlayed) {
        r.buttonPlayed = true;
        void resumeAudio();
        playElevatorButton();
      }
      if (r.stageTime >= 0.38) {
        r.stage = 'doorsOpen';
        r.stageTime = 0;
      }
      break;
    }
    case 'doorsOpen': {
      const d = 0.42;
      const k = Math.min(1, r.stageTime / d);
      const e = easeOut(k);
      r.doorL.position.x = r.doorLClosedX - e * r.doorOpenAmt;
      r.doorR.position.x = r.doorRClosedX + e * r.doorOpenAmt;
      if (r.stageTime >= d) {
        r.stage = 'walkIn';
        r.stageTime = 0;
      }
      break;
    }
    case 'walkIn': {
      const d = 0.64;
      const k = Math.min(1, r.stageTime / d);
      const e = smooth(k);
      player.mesh.position.x = r.front.x + (r.inside.x - r.front.x) * e;
      player.mesh.position.z = r.front.z + (r.inside.z - r.front.z) * e;
      player.mesh.position.y = ENTITY_ANCHOR_Y;
      if (r.stageTime >= d) {
        player.mesh.position.set(r.inside.x, ENTITY_ANCHOR_Y, r.inside.z);
        player.gx = ELEVATOR_GRID_GX;
        player.gz = ELEVATOR_GRID_GZ;
        r.stage = 'doorsClose';
        r.stageTime = 0;
      }
      break;
    }
    case 'doorsClose': {
      const d = 0.36;
      const k = Math.min(1, r.stageTime / d);
      const e = easeOut(k);
      const openL = r.doorLClosedX - r.doorOpenAmt;
      const openR = r.doorRClosedX + r.doorOpenAmt;
      r.doorL.position.x = openL + e * (r.doorLClosedX - openL);
      r.doorR.position.x = openR - e * (openR - r.doorRClosedX);
      if (r.stageTime >= d) {
        r.liftGroup.attach(player.mesh);
        r.stage = 'rise';
        r.stageTime = 0;
      }
      break;
    }
    case 'rise': {
      const riseDur = 3.05;
      const k = Math.min(1, r.stageTime / riseDur);
      const e = easeOut(k);
      const riseAm = 7.25;
      r.liftGroup.position.y = e * riseAm;
      if (r.stageTime >= riseDur) {
        r.stage = 'fadeEnd';
        r.stageTime = 0;
      }
      break;
    }
    case 'fadeEnd': {
      const fd = 1.02;
      setElevatorFadeOpacity(Math.min(1, r.stageTime / fd));
      if (r.stageTime >= fd) {
        finishElevatorTransition();
      }
      break;
    }
    default:
      break;
  }
}

function finishElevatorTransition() {
  elevatorRun = null;
  setElevatorFadeOpacity(0);
  if (player?.mesh && elevatorStationState?.liftGroup) {
    scene.attach(player.mesh);
  }
  disposeElevatorStation();
  loadLevelFromIndex(currentLevelIndex + 1);
}

function showNarrativeOverlay(title, body, hint) {
  const el = document.getElementById('narrative-overlay');
  if (!el) return;
  const h = el.querySelector('#narrative-title');
  const p = el.querySelector('#narrative-body');
  const hi = el.querySelector('#narrative-hint');
  if (h) h.textContent = title;
  if (p) p.textContent = body;
  if (hi) hi.textContent = hint;
  el.classList.add('visible');
  el.setAttribute('aria-hidden', 'false');
}

function continueToNextLevel() {
  if (phase !== Phase.LEVEL_CLEAR) return;
  hideNarrativeOverlay();
  loadLevelFromIndex(currentLevelIndex + 1);
}

async function dismissIntro() {
  if (phase !== Phase.INTRO) return;
  hideNarrativeOverlay();
  await resumeAudio();
  startAmbient();
  phase = Phase.PLAYER;
  busy = false;
  updateHud();
}

function continueFromDefeat() {
  if (phase !== Phase.DEFEAT) return;
  hideNarrativeOverlay();
  restartCurrentLevel();
}

function continueFromVictory() {
  if (phase !== Phase.GAME_OVER) return;
  hideNarrativeOverlay();
  loadLevelFromIndex(0);
}

/** @param {{ fromShift?: boolean }} [opts] Si el shift te aplasta, el impacto ya lleva SFX. */
function showDefeatNarrative(opts = {}) {
  if (!opts.fromShift) playDefeat();
  showNarrativeOverlay(
    'Firma psíquica colapsada',
    'Protocolo de contención te ha interceptado. Reinicio del sector.',
    'Pulsa Enter, Espacio o clic para reintentar'
  );
  updateHud();
}

/** Cian base | rojo fuerte | amarillo combo | morado especial (victoria). */
function pickShiftWaveColor(lineLen, destroyed, lost, won) {
  if (lost) return 0xff4444;
  if (won) return 0xaa44ff;
  if (destroyed >= 2 || lineLen >= 3) return 0xff4444;
  if (lineLen >= 2) return 0xffdd44;
  return 0x00ffff;
}

function applyShiftCameraShake() {
  camera.position.x = cameraRest.x + (Math.random() - 0.5) * 0.15;
  camera.position.y = cameraRest.y;
  camera.position.z = cameraRest.z + (Math.random() - 0.5) * 0.15;
}

function enemyAt(gx, gz) {
  for (const e of enemies) {
    if (e.pendingRemove) continue;
    if (e.gx === gx && e.gz === gz) return e;
  }
  return null;
}

function maybeWin() {
  if (
    phase === Phase.LEVEL_CLEAR ||
    phase === Phase.GAME_OVER ||
    phase === Phase.INTRO ||
    phase === Phase.DEFEAT ||
    phase === Phase.PAUSE ||
    phase === Phase.ELEVATOR
  ) {
    return;
  }
  if (countLivingEnemies(enemies) !== 0) return;
  if (enemies.length > 0) return;

  if (currentLevelIndex >= LEVEL_COUNT - 1) {
    console.log('[progreso] Campaña completada');
    phase = Phase.GAME_OVER;
    busy = true;
    showNarrativeOverlay(
      'Expedientes aniquilados',
      'Los dossiers dejan de existir. Nadie vuelve a ser propiedad del programa.',
      'Enter, Espacio o clic para reiniciar la campaña desde el Sector 01'
    );
    playVictory();
    updateHud();
    return;
  }

  playSectorClear();

  if (currentLevelIndex === ELEVATOR_TRANSITION_LEVEL_INDEX) {
    console.log('[progreso] Ascensor: planta expedientes → piso 2');
    phase = Phase.ELEVATOR;
    busy = true;
    hideNarrativeOverlay();
    startElevatorCutscene();
    updateHud();
    return;
  }

  console.log(`[progreso] Nivel ${currentLevelIndex + 1} completado`);
  phase = Phase.LEVEL_CLEAR;
  busy = true;
  updateHud();
  const doneName = SECTOR_NAMES[currentLevelIndex] ?? `Sector ${currentLevelIndex + 1}`;
  const nextName = SECTOR_NAMES[currentLevelIndex + 1] ?? `Sector ${currentLevelIndex + 2}`;
  showNarrativeOverlay(
    'Sector neutralizado',
    `${doneName} despejado. Ingresando: ${nextName}.`,
    'Pulsa Enter, Espacio o clic para continuar'
  );
}

function loadLevelFromIndex(idx) {
  currentLevelIndex = idx;
  hideNarrativeOverlay();
  hidePauseOverlay();
  const ok = loadLevel(idx, {
    onBeforeLoad: clearLevelEntities,
    applyLayout: applyLevelLayout,
  });
  if (!ok) {
    console.error('[level] No se pudo cargar el nivel', idx);
    return;
  }
  phase = Phase.PLAYER;
  busy = false;
  devMenuApi?.sync?.(idx);
  updateHud();
}

function restartCurrentLevel() {
  hideNarrativeOverlay();
  console.log(`[progreso] Reinicio del nivel ${currentLevelIndex + 1}`);
  loadLevelFromIndex(currentLevelIndex);
}

function clearWallMeshes() {
  for (const m of wallMeshes) {
    scene.remove(m);
  }
  wallMeshes.length = 0;
}

function clearAllEnemies() {
  for (const e of enemies) {
    disposeEnemy(e, scene);
  }
  enemies.length = 0;
}

function clearLevelEntities() {
  disposeElevatorStation();
  clearWallMeshes();
  clearAllEnemies();
  clearWallMask();
  if (player) {
    disposePlayer(player, scene);
    player = null;
  }
}

function applyLevelLayout(layout) {
  clearWallMask();
  const mask = buildWallMaskFromPositions(layout.wallPositions);
  if (currentLevelIndex === ELEVATOR_TRANSITION_LEVEL_INDEX) {
    mask[ELEVATOR_GRID_GZ * GRID_SIZE + ELEVATOR_GRID_GX] = 1;
  }
  setWallMask(mask);
  for (const { gx, gz } of layout.wallPositions) {
    const mesh = new THREE.Mesh(wallSharedGeom, wallSharedMat);
    const p = gridToWorld(gx, gz);
    mesh.position.set(p.x, 0.42, p.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    wallMeshes.push(mesh);
  }
  if (currentLevelIndex === ELEVATOR_TRANSITION_LEVEL_INDEX) {
    elevatorStationState = buildElevatorStation(gridToWorld, ELEVATOR_GRID_GX, ELEVATOR_GRID_GZ);
    scene.add(elevatorStationState.liftGroup);
  }
  for (const spec of layout.enemies) {
    const t = spec.type === 'chaser' ? EnemyType.CHASER : EnemyType.STATIC;
    enemies.push(makeEnemy(t, spec.gx, spec.gz, scene));
  }
  player = createPlayer(scene, layout.playerGx, layout.playerGz);
  for (const e of enemies) {
    const edx = player.gx - e.gx;
    const edz = player.gz - e.gz;
    if (edx !== 0 || edz !== 0) {
      e.mesh.rotation.y = cardinalYawFromDelta(edx, edz);
    }
  }
}

function beginEnemyPhase() {
  phase = Phase.ENEMY;
  const { lost, moves } = planEnemyTurn(player, enemies);
  if (lost) {
    phase = Phase.DEFEAT;
    busy = true;
    showDefeatNarrative({ fromShift: false });
    return;
  }
  if (moves.length === 0) {
    finishEnemyPhase();
    return;
  }
  for (const m of moves) {
    const e = m.enemy;
    const ogx = e.gx;
    const ogz = e.gz;
    const from = gridToWorld(e.gx, e.gz);
    e.animFrom = { x: from.x, y: from.y, z: from.z };
    e.gx = m.gx;
    e.gz = m.gz;
    const mdx = e.gx - ogx;
    const mdz = e.gz - ogz;
    if (mdx !== 0 || mdz !== 0) {
      e.mesh.rotation.y = cardinalYawFromDelta(mdx, mdz);
    }
    const to = gridToWorld(e.gx, e.gz);
    e.animTo = { x: to.x, y: to.y, z: to.z };
    e.animT = 0;
  }
  busy = true;
}

function finishEnemyPhase() {
  if (
    phase === Phase.GAME_OVER ||
    phase === Phase.LEVEL_CLEAR ||
    phase === Phase.INTRO ||
    phase === Phase.DEFEAT ||
    phase === Phase.PAUSE
  ) {
    return;
  }
  phase = Phase.PLAYER;
  busy = false;
}

function onPlayerMoveComplete() {
  if (
    phase === Phase.GAME_OVER ||
    phase === Phase.LEVEL_CLEAR ||
    phase === Phase.INTRO ||
    phase === Phase.DEFEAT ||
    phase === Phase.PAUSE
  ) {
    return;
  }
  beginEnemyPhase();
}

function startPlayerMove(dx, dz) {
  const nx = player.gx + dx;
  const nz = player.gz + dz;
  if (!isWalkable(nx, nz)) return;
  if (enemyAt(nx, nz)) return;

  playPlayerStep();

  const from = gridToWorld(player.gx, player.gz);
  const to = gridToWorld(nx, nz);
  player.animFrom = { x: from.x, y: from.y, z: from.z };
  player.animTo = { x: to.x, y: to.y, z: to.z };
  player.animT = 0;
  player.pendingGx = nx;
  player.pendingGz = nz;
  setFacingFromMove(player, dx, dz);
  busy = true;
}

function hideRangeTileHighlights() {
  for (const m of rangeTileMeshes) {
    m.visible = false;
  }
}

function clearShiftPreview() {
  hideRangeTileHighlights();
  for (const e of enemies) {
    if (e.pendingRemove) continue;
    const mat = e.mainMaterial;
    mat.color.setHex(e.baseColor);
    mat.emissive.setHex(0x000000);
    mat.emissiveIntensity = 0;
  }
}

function updateAimVisuals() {
  if (!player) return;

  if (phase === Phase.ELEVATOR) {
    clearShiftPreview();
    return;
  }

  if (phase === Phase.PAUSE) {
    clearShiftPreview();
    return;
  }

  if (phase === Phase.PLAYER) {
    const ax = player.aim.x;
    const az = player.aim.z;
    player.mesh.rotation.y = cardinalYawFromDelta(ax, az);
  }

  if (phase !== Phase.PLAYER || busy) {
    clearShiftPreview();
    return;
  }

  const ax = player.aim.x;
  const az = player.aim.z;

  let cx = player.gx + ax;
  let cz = player.gz + az;
  for (let i = 0; i < SHIFT_MAX_RANGE; i++) {
    const mesh = rangeTileMeshes[i];
    if (!mesh) continue;
    if (!isInsideGrid(cx, cz) || isWall(cx, cz)) {
      for (let k = i; k < SHIFT_MAX_RANGE; k++) {
        if (rangeTileMeshes[k]) rangeTileMeshes[k].visible = false;
      }
      break;
    }
    const w = gridToWorld(cx, cz);
    mesh.position.set(w.x, 0.028, w.z);
    mesh.visible = true;
    const target = enemyAt(cx, cz);
    if (target) {
      mesh.material.color.setHex(0xffaa44);
      mesh.material.opacity = 0.52;
    } else {
      mesh.material.color.setHex(0x42c4e8);
      mesh.material.opacity = 0.36;
    }
    cx += ax;
    cz += az;
  }

  const inLine = new Set(collectEnemiesInFront(player.gx, player.gz, ax, az, enemies));
  for (const e of enemies) {
    if (e.pendingRemove) continue;
    if (inLine.has(e)) {
      const mat = e.mainMaterial;
      mat.color.setHex(0xffee99);
      mat.emissive.setHex(0x44ff99);
      mat.emissiveIntensity = 0.72;
    } else {
      const mat = e.mainMaterial;
      mat.color.setHex(e.baseColor);
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    }
  }
}

function startShift() {
  const dx = player.aim.x;
  const dz = player.aim.z;
  const line = collectEnemiesInFront(player.gx, player.gz, dx, dz, enemies);
  if (line.length === 0) return;

  playShiftCharge();

  shiftDelayPending = true;
  busy = true;

  setTimeout(() => {
    shiftDelayPending = false;
    if (phase === Phase.PAUSE) return;
    if (phase !== Phase.PLAYER || phase === Phase.GAME_OVER) {
      busy = false;
      return;
    }

    const line2 = collectEnemiesInFront(player.gx, player.gz, dx, dz, enemies);
    if (line2.length === 0) {
      busy = false;
      return;
    }

    const snap = enemies.map((e) => ({ e, gx: e.gx, gz: e.gz }));
    const r = resolveShift(player, enemies);

    const shiftDeaths = r.shiftDeaths ?? [];
    const destroyed = shiftDeaths.length;
    const doomed = new Set(shiftDeaths.map((d) => d.enemy));
    const won =
      enemies.filter((e) => !e.pendingRemove && !doomed.has(e)).length === 0;
    const waveColor = pickShiftWaveColor(line2.length, destroyed, r.lost, won);

    const pw = gridToWorld(player.gx, player.gz);
    shockwave.trigger(pw.x, pw.z, waveColor);
    applyShiftCameraShake();
    playShiftImpact({
      lost: r.lost,
      won,
      destroyed,
      lineLen: line2.length,
    });

    if (r.lost) {
      phase = Phase.DEFEAT;
      busy = true;
      showDefeatNarrative({ fromShift: true });
      return;
    }

    let anyAnim = false;
    for (const { enemy, endGx, endGz } of shiftDeaths) {
      const row = snap.find((s) => s.e === enemy);
      if (!row) continue;
      const from = gridToWorld(row.gx, row.gz);
      const to = gridToWorld(endGx, endGz);
      enemy.animFrom = { x: from.x, y: from.y, z: from.z };
      enemy.animTo = { x: to.x, y: to.y, z: to.z };
      enemy.animT = 0;
      enemy.shiftDeathAfterTravel = true;
      const sdx = endGx - row.gx;
      const sdz = endGz - row.gz;
      if (sdx !== 0 || sdz !== 0) {
        enemy.mesh.rotation.y = cardinalYawFromDelta(sdx, sdz);
      }
      anyAnim = true;
    }
    for (const { e, gx, gz } of snap) {
      if (e.pendingRemove || e.shiftDeathAfterTravel) continue;
      if (e.gx !== gx || e.gz !== gz) {
        const pdx = e.gx - gx;
        const pdz = e.gz - gz;
        if (pdx !== 0 || pdz !== 0) {
          e.mesh.rotation.y = cardinalYawFromDelta(pdx, pdz);
        }
        const from = gridToWorld(gx, gz);
        const to = gridToWorld(e.gx, e.gz);
        e.animFrom = { x: from.x, y: from.y, z: from.z };
        e.animTo = { x: to.x, y: to.y, z: to.z };
        e.animT = 0;
        anyAnim = true;
      }
    }

    if (!anyAnim) {
      if (enemies.some((e) => !e.pendingRemove)) {
        beginEnemyPhase();
      } else {
        busy = enemies.length > 0;
      }
    }
  }, 100);
}

function updateMovementAnimations(dt, speed) {
  let moving = false;

  if (player.animFrom && player.animTo) {
    moving = true;
    player.animT += dt * speed;
    const t = Math.min(1, player.animT);
    const a = easeOutQuad(t);
    player.mesh.position.lerpVectors(
      new THREE.Vector3(player.animFrom.x, player.animFrom.y, player.animFrom.z),
      new THREE.Vector3(player.animTo.x, player.animTo.y, player.animTo.z),
      a
    );
    const bounce = 1 + 0.1 * Math.sin(t * Math.PI);
    player.mesh.scale.set(1, bounce, 1);
    if (t >= 1) {
      player.gx = player.pendingGx;
      player.gz = player.pendingGz;
      player.mesh.position.set(player.animTo.x, player.animTo.y, player.animTo.z);
      player.mesh.scale.set(1, 1, 1);
      player.animFrom = null;
      player.animTo = null;
      onPlayerMoveComplete();
    }
  }

  for (const e of enemies) {
    if (e.pendingRemove) continue;
    if (e.animFrom && e.animTo) {
      moving = true;
      e.animT += dt * speed;
      const t = Math.min(1, e.animT);
      const a = easeOutQuad(t);
      e.mesh.position.lerpVectors(
        new THREE.Vector3(e.animFrom.x, e.animFrom.y, e.animFrom.z),
        new THREE.Vector3(e.animTo.x, e.animTo.y, e.animTo.z),
        a
      );
      const bounce = 1 + 0.08 * Math.sin(t * Math.PI);
      e.mesh.scale.set(1, bounce, 1);
      if (t >= 1) {
        e.mesh.position.set(e.animTo.x, e.animTo.y, e.animTo.z);
        e.mesh.scale.set(1, 1, 1);
        if (e.shiftDeathAfterTravel) {
          e.shiftDeathAfterTravel = false;
          e.pendingRemove = true;
          e.destroyAnim = 1;
          playEnemyDeath();
        }
        e.animFrom = null;
        e.animTo = null;
      }
    }
  }

  return moving;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function updateDestroyAnimations(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.pendingRemove) continue;
    e.destroyAnim -= dt * 1.8;
    const k = Math.max(0, e.destroyAnim);
    e.mainMaterial.emissive.setHex(0xff4444);
    e.mainMaterial.emissiveIntensity = 0.6 * k;
    const sc = 0.2 + 0.8 * k;
    e.mesh.scale.set(sc, sc, sc);
    if (k <= 0.01) {
      disposeEnemy(e, scene);
      enemies.splice(i, 1);
    }
  }
}

function tickAnimations(dt) {
  const playerMoving = Boolean(player?.animFrom && player?.animTo);
  const enemyMoving = enemies.some((e) => !e.pendingRemove && e.animFrom && e.animTo);

  if (playerMoving || enemyMoving) {
    const spd = playerMoving ? PLAYER_SPEED : ENEMY_SPEED;
    updateMovementAnimations(dt, spd);
  }

  updateDestroyAnimations(dt);

  const stillEnemyMove = enemies.some((e) => !e.pendingRemove && e.animFrom && e.animTo);

  if (busy && phase === Phase.ENEMY && !playerMoving && !stillEnemyMove) {
    busy = false;
    finishEnemyPhase();
  }

  const shiftEnemyMove = enemies.some((e) => !e.pendingRemove && e.animFrom && e.animTo);
  if (
    busy &&
    phase === Phase.PLAYER &&
    player &&
    !player.animFrom &&
    !shiftEnemyMove &&
    !shiftDelayPending
  ) {
    if (enemies.some((e) => !e.pendingRemove)) {
      beginEnemyPhase();
    } else {
      busy = enemies.length > 0;
    }
  }

  if (!isWorldFrozen()) {
    maybeWin();
  }
}

function onKeyDown(ev) {
  void resumeAudio();

  if (ev.code === 'Escape') {
    ev.preventDefault();
    if (phase === Phase.INTRO) {
      void dismissIntro();
      return;
    }
    togglePause();
    return;
  }

  if (phase === Phase.INTRO) {
    if (ev.code === 'Enter' || ev.code === 'Space') {
      ev.preventDefault();
      dismissIntro();
    }
    return;
  }

  if (phase === Phase.ELEVATOR) {
    ev.preventDefault();
    return;
  }

  if (phase === Phase.LEVEL_CLEAR) {
    if (ev.code === 'Enter' || ev.code === 'Space') {
      ev.preventDefault();
      continueToNextLevel();
    }
    return;
  }

  if (phase === Phase.DEFEAT) {
    if (ev.code === 'Enter' || ev.code === 'Space') {
      ev.preventDefault();
      continueFromDefeat();
    }
    return;
  }

  if (phase === Phase.GAME_OVER) {
    if (ev.code === 'Enter' || ev.code === 'Space') {
      ev.preventDefault();
      continueFromVictory();
    }
    return;
  }

  if (ev.code === 'Space') {
    if (phase === Phase.PLAYER && !busy) {
      ev.preventDefault();
      startShift();
    }
    return;
  }

  if (ev.code === 'ArrowUp') {
    ev.preventDefault();
    if (phase === Phase.PLAYER && !busy) {
      if (player.aim.x !== 0 || player.aim.z !== -1) playAimTick();
      setPlayerAim(player, 0, -1);
    }
    return;
  }
  if (ev.code === 'ArrowDown') {
    ev.preventDefault();
    if (phase === Phase.PLAYER && !busy) {
      if (player.aim.x !== 0 || player.aim.z !== 1) playAimTick();
      setPlayerAim(player, 0, 1);
    }
    return;
  }
  if (ev.code === 'ArrowLeft') {
    ev.preventDefault();
    if (phase === Phase.PLAYER && !busy) {
      if (player.aim.x !== -1 || player.aim.z !== 0) playAimTick();
      setPlayerAim(player, -1, 0);
    }
    return;
  }
  if (ev.code === 'ArrowRight') {
    ev.preventDefault();
    if (phase === Phase.PLAYER && !busy) {
      if (player.aim.x !== 1 || player.aim.z !== 0) playAimTick();
      setPlayerAim(player, 1, 0);
    }
    return;
  }

  if (phase !== Phase.PLAYER || busy) return;

  let dx = 0;
  let dz = 0;
  if (ev.code === 'KeyW') dz = -1;
  else if (ev.code === 'KeyS') dz = 1;
  else if (ev.code === 'KeyA') dx = -1;
  else if (ev.code === 'KeyD') dx = 1;
  else return;

  if (dx !== 0 && dz !== 0) return;
  ev.preventDefault();
  startPlayerMove(dx, dz);
}

function addFacilityBase() {
  const padH = 0.16;
  const span = GRID_SIZE * TILE_SIZE + 1.5;
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(span, padH, span),
    new THREE.MeshStandardMaterial({
      color: Theme.baseColor,
      roughness: Theme.baseRoughness,
      metalness: 0.04,
    })
  );
  pad.position.y = -padH / 2 - 0.01;
  pad.receiveShadow = true;
  scene.add(pad);
}

function buildGrid() {
  for (let gz = 0; gz < GRID_SIZE; gz++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const geom = new THREE.PlaneGeometry(TILE_SIZE * 0.96, TILE_SIZE * 0.96);
      const mat = new THREE.MeshStandardMaterial({
        color: (gx + gz) % 2 === 0 ? Theme.floorA : Theme.floorB,
        side: THREE.DoubleSide,
        roughness: 0.78,
        metalness: 0.06,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = -Math.PI / 2;
      const p = gridToWorld(gx, gz);
      mesh.position.set(p.x, 0.002, p.z);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(Theme.sceneBackground);
  scene.fog = new THREE.Fog(Theme.fogColor, Theme.fogNear, Theme.fogFar);

  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 11;
  camera = new THREE.OrthographicCamera(
    (frustumSize * aspect) / -2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    200
  );
  camera.position.set(12, 18, 12);
  camera.lookAt(0, 0, 0);
  cameraRest = new THREE.Vector3().copy(camera.position);

  const amb = new THREE.AmbientLight(Theme.ambientLightColor, Theme.ambientIntensity);
  scene.add(amb);
  const hemi = new THREE.HemisphereLight(
    Theme.hemisphereSky,
    Theme.hemisphereGround,
    Theme.hemisphereIntensity
  );
  hemi.position.set(0, 20, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(Theme.keyLightColor, Theme.keyLightIntensity);
  dir.position.set(...Theme.keyLightPosition);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.bias = -0.00025;
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 50;
  dir.shadow.camera.left = -12;
  dir.shadow.camera.right = 12;
  dir.shadow.camera.top = 12;
  dir.shadow.camera.bottom = -12;
  scene.add(dir);

  const fill = new THREE.DirectionalLight(Theme.fillLightColor, Theme.fillLightIntensity);
  fill.position.set(...Theme.fillLightPosition);
  scene.add(fill);

  const accent = new THREE.PointLight(Theme.accentLightColor, Theme.accentLightIntensity, 28, 2);
  accent.position.set(...Theme.accentLightPosition);
  scene.add(accent);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  document.body.appendChild(renderer.domElement);

  shockwave = new Shockwave(scene);

  addFacilityBase();
  buildGrid();

  wallSharedGeom = new THREE.BoxGeometry(0.92, 0.85, 0.92);
  wallSharedMat = new THREE.MeshStandardMaterial({
    color: Theme.wallColor,
    roughness: Theme.wallRoughness,
    metalness: Theme.wallMetalness,
  });

  rangeHighlightGeom = new THREE.PlaneGeometry(TILE_SIZE * 0.88, TILE_SIZE * 0.88);
  rangeTileMeshes = [];
  for (let i = 0; i < SHIFT_MAX_RANGE; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4ad4f0,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(rangeHighlightGeom, mat);
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 2;
    m.visible = false;
    scene.add(m);
    rangeTileMeshes.push(m);
  }

  currentLevelIndex = 0;
  loadLevelFromIndex(0);
  phase = Phase.INTRO;
  busy = true;
  showNarrativeOverlay(INTRO_TITLE, INTRO_BODY, INTRO_HINT);
  updateHud();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);

  document.getElementById('pause-overlay')?.addEventListener('click', () => {
    if (phase === Phase.PAUSE) togglePause();
  });

  document.getElementById('narrative-overlay')?.addEventListener('click', () => {
    if (phase === Phase.LEVEL_CLEAR) continueToNextLevel();
    else if (phase === Phase.INTRO) dismissIntro();
    else if (phase === Phase.DEFEAT) continueFromDefeat();
    else if (phase === Phase.GAME_OVER) continueFromVictory();
  });
}

function onResize() {
  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 11;
  camera.left = (frustumSize * aspect) / -2;
  camera.right = (frustumSize * aspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = frustumSize / -2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (phase === Phase.ELEVATOR) {
    updateElevatorCutscene(dt);
  } else if (!isWorldFrozen()) {
    tickAnimations(dt);
    shockwave?.update(dt);
  }
  updateAimVisuals();
  renderer.render(scene, camera);
}

setupScene();

if (import.meta.env.DEV) {
  import('./dev/devMenu.js').then(({ initDevMenu }) => {
    devMenuApi = initDevMenu({
      levelCount: LEVEL_COUNT,
      getPhaseLabel: () => phase,
      goToLevel: (idx) => {
        loadLevelFromIndex(Math.max(0, Math.min(LEVEL_COUNT - 1, idx)));
      },
      restartLevel: restartCurrentLevel,
    });
    devMenuApi.sync(currentLevelIndex);
  });
}

animate(performance.now());
