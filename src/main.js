import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE, PLAYER_SPEED, ENEMY_SPEED, SHIFT_MAX_RANGE } from './constants.js';
import {
  gridToWorld,
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
  playDefeat,
  playVictory,
} from './audio/gameAudio.js';

/** Nombres de sector para copy narrativo (alineado con LEVEL_COUNT). */
const SECTOR_NAMES = [
  'Sector 01 — Archivo de sujetos',
  'Sector 02 — Contención',
  'Sector 03 — Núcleo de datos',
];

const INTRO_TITLE = 'K-27 «Vector»';
const INTRO_BODY =
  'Telekinesis táctica. Objetivo: infiltrar la instalación y borrar los expedientes que convierten a las personas en activos del programa. La seguridad reconoce tu firma psíquica.';
const INTRO_HINT =
  'WASD mover · Flechas apuntar · Espacio telequinesis (shift) · Enter o clic para comenzar';

// ——— Game state ———
let scene;
let camera;
let renderer;
let shockwave;
/** Posición de reposo de la cámara (para screen-shake sin deriva). */
let cameraRest;
let aimIndicator;
let shiftPreviewLine;
/** Planos sobre el suelo: una por casilla de alcance del shift. */
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
/** Solo en DEV: { sync(levelIndex) } */
let devMenuApi = null;

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
    else if (phase === Phase.DEFEAT) line = 'Protocolo activo — reintentar';
    else if (phase === Phase.GAME_OVER) line = 'Campaña completada';
    phaseEl.textContent = line;
  }
}

function hideNarrativeOverlay() {
  const el = document.getElementById('narrative-overlay');
  if (!el) return;
  el.classList.remove('visible');
  el.setAttribute('aria-hidden', 'true');
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

function isNarrativePausePhase() {
  return (
    phase === Phase.INTRO ||
    phase === Phase.LEVEL_CLEAR ||
    phase === Phase.GAME_OVER ||
    phase === Phase.DEFEAT
  );
}

function continueToNextLevel() {
  if (phase !== Phase.LEVEL_CLEAR) return;
  hideNarrativeOverlay();
  currentLevelIndex++;
  loadLevelFromIndex(currentLevelIndex);
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
  currentLevelIndex = 0;
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
    phase === Phase.DEFEAT
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

  console.log(`[progreso] Nivel ${currentLevelIndex + 1} completado`);
  phase = Phase.LEVEL_CLEAR;
  busy = true;
  playSectorClear();
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
  hideNarrativeOverlay();
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
  if (layout.wallPositions.length > 0) {
    setWallMask(buildWallMaskFromPositions(layout.wallPositions));
    for (const { gx, gz } of layout.wallPositions) {
      const mesh = new THREE.Mesh(wallSharedGeom, wallSharedMat);
      const p = gridToWorld(gx, gz);
      mesh.position.set(p.x, 0.42, p.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      wallMeshes.push(mesh);
    }
  }
  for (const spec of layout.enemies) {
    const t = spec.type === 'chaser' ? EnemyType.CHASER : EnemyType.STATIC;
    enemies.push(makeEnemy(t, spec.gx, spec.gz, scene));
  }
  player = createPlayer(scene, layout.playerGx, layout.playerGz);
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
    const from = gridToWorld(e.gx, e.gz);
    e.animFrom = { x: from.x, y: from.y, z: from.z };
    e.gx = m.gx;
    e.gz = m.gz;
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
    phase === Phase.DEFEAT
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
    phase === Phase.DEFEAT
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
  if (!player || !aimIndicator || !shiftPreviewLine) return;

  if (phase !== Phase.PLAYER || busy) {
    aimIndicator.visible = false;
    shiftPreviewLine.visible = false;
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

  aimIndicator.visible = true;
  shiftPreviewLine.visible = true;
  const p = gridToWorld(player.gx, player.gz);
  aimIndicator.position.set(p.x + ax * 0.45, 0.08, p.z + az * 0.45);
  aimIndicator.rotation.y = Math.atan2(ax, az);

  const w0 = gridToWorld(player.gx, player.gz);
  const pts = [new THREE.Vector3(w0.x, 0.04, w0.z)];
  let gx = player.gx + ax;
  let gz = player.gz + az;
  let steps = 0;
  while (steps < SHIFT_MAX_RANGE) {
    if (!isInsideGrid(gx, gz)) break;
    if (isWall(gx, gz)) break;
    const w = gridToWorld(gx, gz);
    pts.push(new THREE.Vector3(w.x, 0.04, w.z));
    gx += ax;
    gz += az;
    steps++;
  }
  if (pts.length === 1) {
    pts.push(new THREE.Vector3(w0.x + ax * 0.35, 0.04, w0.z + az * 0.35));
  }
  shiftPreviewLine.geometry.dispose();
  shiftPreviewLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);

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
      anyAnim = true;
    }
    for (const { e, gx, gz } of snap) {
      if (e.pendingRemove || e.shiftDeathAfterTravel) continue;
      if (e.gx !== gx || e.gz !== gz) {
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

  if (!isNarrativePausePhase()) {
    maybeWin();
  }
}

function onKeyDown(ev) {
  void resumeAudio();

  if (phase === Phase.INTRO) {
    if (ev.code === 'Enter' || ev.code === 'Space') {
      ev.preventDefault();
      dismissIntro();
    }
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

  const aimGeom = new THREE.BoxGeometry(0.18, 0.06, 0.9);
  const aimMat = new THREE.MeshBasicMaterial({ color: 0x5cffd9 });
  aimIndicator = new THREE.Mesh(aimGeom, aimMat);
  scene.add(aimIndicator);

  const lineMat = new THREE.LineBasicMaterial({
    color: 0x7dffe8,
    transparent: true,
    opacity: 0.88,
  });
  shiftPreviewLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.04, 0),
      new THREE.Vector3(0.01, 0.04, 0),
    ]),
    lineMat
  );
  scene.add(shiftPreviewLine);

  rangeHighlightGeom = new THREE.PlaneGeometry(TILE_SIZE * 0.88, TILE_SIZE * 0.88);
  rangeTileMeshes = [];
  for (let i = 0; i < SHIFT_MAX_RANGE; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4ad4f0,
      transparent: true,
      opacity: 0.34,
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
  if (!isNarrativePausePhase()) {
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
        currentLevelIndex = Math.max(0, Math.min(LEVEL_COUNT - 1, idx));
        loadLevelFromIndex(currentLevelIndex);
      },
      restartLevel: restartCurrentLevel,
    });
    devMenuApi.sync(currentLevelIndex);
  });
}

animate(performance.now());
