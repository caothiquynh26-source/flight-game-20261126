// Sound, synthesised live with WebAudio: an engine hum tied to throttle, a chime
// for each ring, a low warning when the fuel runs short. Silent until the player
// first interacts (browsers require a gesture before audio starts). M mutes it.
let ctx = null, engine = null, engineGain = null;
let muted = false;

export function setMuted(m) {
  muted = m;
  if (engineGain && ctx) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
}

export function isMuted() { return muted; }

function ensure() {
  if (ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 320;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engine.connect(filter); filter.connect(engineGain); engineGain.connect(ctx.destination);
    engine.start();
    return true;
  } catch { return false; }
}

export function unlockAudio() {
  if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

/** Call every frame: the hum follows throttle and speed. */
export function engineSound(throttle, speed, onGround) {
  if (muted || !ensure() || !ctx || ctx.state !== 'running') return;
  const target = onGround ? 0.012 : 0.015 + throttle * 0.05;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
  engine.frequency.setTargetAtTime(48 + throttle * 55 + speed * 0.25, ctx.currentTime, 0.1);
}

function tone(freq, dur, type = 'sine', vol = 0.12, when = 0) {
  if (muted || !ensure() || !ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

export function ringChime(centre) {
  tone(660, 0.35); tone(990, 0.5, 'sine', 0.12, 0.09);
  if (centre) tone(1320, 0.6, 'sine', 0.1, 0.18);
}

export function crashThud() { tone(70, 0.5, 'triangle', 0.25); tone(45, 0.7, 'sine', 0.2, 0.05); }
export function landFanfare() { tone(523, 0.25); tone(659, 0.25, 'sine', 0.12, 0.12); tone(784, 0.5, 'sine', 0.12, 0.24); }
export function lowFuelBeep() { tone(880, 0.12, 'square', 0.05); }
