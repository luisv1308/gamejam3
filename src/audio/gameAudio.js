/**
 * SFX y drone ambiental vía Web Audio API (sin assets).
 * Requiere gesto del usuario: resumeAudio() al cerrar intro o al primer input.
 */

let audioCtx = null;
let ambientStarted = false;

function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  return audioCtx;
}

export async function resumeAudio() {
  const c = ctx();
  if (c && c.state === 'suspended') {
    try {
      await c.resume();
    } catch {
      /* ignore */
    }
  }
}

function outGain(c, t0, peak, attack, sustain, release) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak, t0 + attack + sustain);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + attack + sustain + release);
  return g;
}

/** Drone bajo muy suave; idempotente. */
export function startAmbient() {
  const c = ctx();
  if (!c || ambientStarted) return;
  ambientStarted = true;

  const master = c.createGain();
  master.gain.value = 0.06;
  master.connect(c.destination);

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 280;
  filter.Q.value = 0.7;
  filter.connect(master);

  for (const freq of [48, 72]) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = 0.35;
    o.connect(g);
    g.connect(filter);
    o.start();
  }
}

export function playPlayerStep() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.06);
  const g = outGain(c, t, 0.06, 0.008, 0.02, 0.05);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.09);
}

export function playAimTick() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.04);
  const g = outGain(c, t, 0.035, 0.005, 0.01, 0.04);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.06);
}

/** Ascenso breve antes de resolver el shift (sincronizado con el delay del juego). */
export function playShiftCharge() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(100, t);
  osc.frequency.exponentialRampToValueAtTime(320, t + 0.085);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.02);
  g.gain.linearRampToValueAtTime(0, t + 0.1);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.11);
}

/**
 * @param {{ lost: boolean, won: boolean, destroyed: number, lineLen: number }} p
 */
export function playShiftImpact(p) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;

  const noiseBuf = c.createBuffer(1, c.sampleRate * 0.08, c.sampleRate);
  const ch = noiseBuf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) {
    ch[i] = (Math.random() * 2 - 1) * 0.6;
  }
  const noise = c.createBufferSource();
  noise.buffer = noiseBuf;
  const nf = c.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = p.lost ? 200 : p.won ? 520 : 340;
  nf.Q.value = 1.2;
  const ng = outGain(c, t, p.lost ? 0.22 : p.won ? 0.18 : 0.14, 0.002, 0.02, 0.06);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(c.destination);
  noise.start(t);
  noise.stop(t + 0.08);

  const thump = c.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(p.lost ? 55 : p.won ? 95 : 70, t);
  thump.frequency.exponentialRampToValueAtTime(30, t + 0.12);
  const tg = outGain(c, t, p.lost ? 0.35 : 0.22, 0.005, 0.04, 0.1);
  thump.connect(tg);
  tg.connect(c.destination);
  thump.start(t);
  thump.stop(t + 0.16);

  if (p.won && !p.lost) {
    const bell = c.createOscillator();
    bell.type = 'triangle';
    bell.frequency.setValueAtTime(660, t + 0.02);
    bell.frequency.setValueAtTime(990, t + 0.08);
    const bg = outGain(c, t + 0.02, 0.06, 0.01, 0.05, 0.2);
    bell.connect(bg);
    bg.connect(c.destination);
    bell.start(t + 0.02);
    bell.stop(t + 0.28);
  }

  if (p.destroyed >= 2 && !p.lost) {
    const clap = c.createOscillator();
    clap.type = 'square';
    clap.frequency.value = 140;
    const cg = outGain(c, t + 0.03, 0.04, 0.001, 0.01, 0.04);
    clap.connect(cg);
    cg.connect(c.destination);
    clap.start(t + 0.03);
    clap.stop(t + 0.09);
  }
}

export function playEnemyDeath() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;

  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.14);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(2000, t);
  f.frequency.exponentialRampToValueAtTime(200, t + 0.12);
  const g = outGain(c, t, 0.07, 0.01, 0.02, 0.1);
  osc.connect(f);
  f.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.18);
}

/** Pulsador / llamada de cabina (ascensor). */
export function playElevatorButton() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.06);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1200;
  const g = outGain(c, t, 0.09, 0.002, 0.02, 0.05);
  osc.connect(f);
  f.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.09);

  const click = c.createOscillator();
  click.type = 'sine';
  click.frequency.value = 880;
  const cg = outGain(c, t + 0.04, 0.04, 0.001, 0.008, 0.04);
  click.connect(cg);
  cg.connect(c.destination);
  click.start(t + 0.04);
  click.stop(t + 0.09);
}

export function playSectorClear() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = outGain(c, t + i * 0.07, 0.07, 0.02, 0.08, 0.15);
    o.connect(g);
    g.connect(c.destination);
    o.start(t + i * 0.07);
    o.stop(t + i * 0.07 + 0.28);
  });
}

export function playDefeat() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.35);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(800, t);
  f.frequency.exponentialRampToValueAtTime(80, t + 0.35);
  const g = outGain(c, t, 0.12, 0.02, 0.1, 0.2);
  o.connect(f);
  f.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + 0.45);
}

export function playVictory() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const chord = [392, 493.88, 587.33, 783.99];
  chord.forEach((freq, i) => {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.05 + i * 0.04);
    g.gain.setValueAtTime(0.045, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + 1.15);
  });
}
