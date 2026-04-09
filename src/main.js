import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE, PLAYER_SPEED, ENEMY_SPEED, SHIFT_MAX_RANGE } from './constants.js';
import { gridToWorld, isWalkable, collectEnemiesInFront, isInsideGrid } from './grid.js';
import { createPlayer, setFacingFromMove, setPlayerAim } from './player.js';
import { makeEnemy, EnemyType } from './enemy.js';
import {
  resolveShift,
  planEnemyTurn,
  countLivingEnemies,
  Phase,
} from './turnManager.js';
import { Shockwave } from './effects/shockwave.js';

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
let player;
let enemies = [];
let phase = Phase.PLAYER;
let busy = false;

/** Cian base | rojo fuerte | amarillo combo | morado especial (victoria). */
function pickShiftWaveColor(lineLen, destroyed, lost, won) {
  if (lost) return 0xff4444;
  if (won) return 0xaa44ff;
  if (destroyed >= 2 || lineLen >= 3) return 0xff4444;
  if (lineLen >= 2) return 0xffdd44;
  return 0x00ffff;
}

function applyShiftCameraShake() {
  camera.position.x = cameraRest.x + (Math.random() - 0.5) * 0.1;
  camera.position.y = cameraRest.y;
  camera.position.z = cameraRest.z + (Math.random() - 0.5) * 0.1;
}

function enemyAt(gx, gz) {
  for (const e of enemies) {
    if (e.pendingRemove) continue;
    if (e.gx === gx && e.gz === gz) return e;
  }
  return null;
}

function logOutcome(won) {
  if (won) console.log('You win — all threats cleared.');
  else console.log('Game over — an enemy reached you.');
}

function setGameOver(won) {
  phase = Phase.GAME_OVER;
  busy = false;
  logOutcome(won);
}

function maybeWin() {
  if (countLivingEnemies(enemies) === 0) setGameOver(true);
}

function beginEnemyPhase() {
  phase = Phase.ENEMY;
  const { lost, moves } = planEnemyTurn(player, enemies);
  if (lost) {
    setGameOver(false);
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
  maybeWin();
  if (phase === Phase.GAME_OVER) return;
  phase = Phase.PLAYER;
  busy = false;
}

function onPlayerMoveComplete() {
  maybeWin();
  if (phase === Phase.GAME_OVER) return;
  beginEnemyPhase();
}

function startPlayerMove(dx, dz) {
  const nx = player.gx + dx;
  const nz = player.gz + dz;
  if (!isWalkable(nx, nz)) return;
  if (enemyAt(nx, nz)) return;

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
    e.mesh.material.emissive.setHex(0x000000);
    e.mesh.material.emissiveIntensity = 0;
  }
}

function updateAimVisuals() {
  if (!aimIndicator || !shiftPreviewLine) return;

  if (phase !== Phase.PLAYER || busy) {
    aimIndicator.visible = false;
    shiftPreviewLine.visible = false;
    clearShiftPreview();
    return;
  }

  const ax = player.aim.x;
  const az = player.aim.z;

  for (let i = 0; i < SHIFT_MAX_RANGE; i++) {
    const mesh = rangeTileMeshes[i];
    if (!mesh) continue;
    const gx = player.gx + ax * (i + 1);
    const gz = player.gz + az * (i + 1);
    if (!isInsideGrid(gx, gz)) {
      mesh.visible = false;
      continue;
    }
    const w = gridToWorld(gx, gz);
    mesh.position.set(w.x, 0.028, w.z);
    mesh.visible = true;
    const target = enemyAt(gx, gz);
    if (target) {
      mesh.material.color.setHex(0xffaa44);
      mesh.material.opacity = 0.52;
    } else {
      mesh.material.color.setHex(0x3d9eff);
      mesh.material.opacity = 0.36;
    }
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
  while (isInsideGrid(gx, gz) && steps < SHIFT_MAX_RANGE) {
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
      e.mesh.material.emissive.setHex(0x88ffcc);
      e.mesh.material.emissiveIntensity = 0.72;
    } else {
      e.mesh.material.emissive.setHex(0x000000);
      e.mesh.material.emissiveIntensity = 0;
    }
  }
}

function startShift() {
  const dx = player.aim.x;
  const dz = player.aim.z;
  const line = collectEnemiesInFront(player.gx, player.gz, dx, dz, enemies);
  if (line.length === 0) return;

  busy = true;
  const snap = enemies.map((e) => ({ e, gx: e.gx, gz: e.gz }));

  const r = resolveShift(player, enemies, () => {});

  const destroyed = snap.filter(({ e }) => e.pendingRemove).length;
  const won = countLivingEnemies(enemies) === 0;
  const waveColor = pickShiftWaveColor(line.length, destroyed, r.lost, won);

  const pw = gridToWorld(player.gx, player.gz);
  shockwave.trigger(pw.x, pw.z, dx, dz, waveColor);
  applyShiftCameraShake();

  if (r.lost) {
    setGameOver(false);
    return;
  }

  let anyAnim = false;
  for (const { e, gx, gz } of snap) {
    if (e.pendingRemove) continue;
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
    maybeWin();
    if (phase === Phase.GAME_OVER) return;
    beginEnemyPhase();
  }
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
    e.mesh.material.emissive.setHex(0xff4444);
    e.mesh.material.emissiveIntensity = 0.6 * k;
    const sc = 0.2 + 0.8 * k;
    e.mesh.scale.set(sc, sc, sc);
    if (k <= 0.01) {
      scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      enemies.splice(i, 1);
    }
  }
}

function tickAnimations(dt) {
  const playerMoving = Boolean(player.animFrom && player.animTo);
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
  if (busy && phase === Phase.PLAYER && !player.animFrom && !shiftEnemyMove) {
    maybeWin();
    if (phase !== Phase.GAME_OVER) beginEnemyPhase();
  }
}

function onKeyDown(ev) {
  if (phase === Phase.GAME_OVER) return;

  if (ev.code === 'Space') {
    if (phase === Phase.PLAYER && !busy) {
      ev.preventDefault();
      startShift();
    }
    return;
  }

  if (ev.code === 'ArrowUp') {
    ev.preventDefault();
    if (phase === Phase.PLAYER && !busy) setPlayerAim(player, 0, -1);
    return;
  }
  if (ev.code === 'ArrowDown') {
    ev.preventDefault();
    if (phase === Phase.PLAYER && !busy) setPlayerAim(player, 0, 1);
    return;
  }
  if (ev.code === 'ArrowLeft') {
    ev.preventDefault();
    if (phase === Phase.PLAYER && !busy) setPlayerAim(player, -1, 0);
    return;
  }
  if (ev.code === 'ArrowRight') {
    ev.preventDefault();
    if (phase === Phase.PLAYER && !busy) setPlayerAim(player, 1, 0);
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

function buildGrid() {
  for (let gz = 0; gz < GRID_SIZE; gz++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const geom = new THREE.PlaneGeometry(TILE_SIZE * 0.96, TILE_SIZE * 0.96);
      const mat = new THREE.MeshStandardMaterial({
        color: (gx + gz) % 2 === 0 ? 0x2f3642 : 0x252b34,
        side: THREE.DoubleSide,
        roughness: 0.85,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = -Math.PI / 2;
      const p = gridToWorld(gx, gz);
      mesh.position.set(p.x, 0, p.z);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1d24);

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

  const amb = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(8, 20, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 50;
  dir.shadow.camera.left = -12;
  dir.shadow.camera.right = 12;
  dir.shadow.camera.top = 12;
  dir.shadow.camera.bottom = -12;
  scene.add(dir);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  shockwave = new Shockwave(scene);

  buildGrid();

  const startGx = 1;
  const startGz = 1;
  player = createPlayer(scene, startGx, startGz);

  const aimGeom = new THREE.BoxGeometry(0.18, 0.06, 0.9);
  const aimMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  aimIndicator = new THREE.Mesh(aimGeom, aimMat);
  scene.add(aimIndicator);

  const lineMat = new THREE.LineBasicMaterial({
    color: 0x66ffcc,
    transparent: true,
    opacity: 0.9,
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
      color: 0x3d9eff,
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

  enemies.push(makeEnemy(EnemyType.CHASER, 5, 1, scene));
  enemies.push(makeEnemy(EnemyType.CHASER, 6, 6, scene));
  enemies.push(makeEnemy(EnemyType.STATIC, 4, 4, scene));

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);
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
  tickAnimations(dt);
  shockwave?.update(dt);
  updateAimVisuals();
  renderer.render(scene, camera);
}

setupScene();
animate(performance.now());
