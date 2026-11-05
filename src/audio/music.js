/**
 * Muzyka: planista z wyprzedzeniem (setInterval 25 ms, planowanie ~120 ms do przodu na czasie
 * AudioContext). Każdy tryb = Player z trwałymi węzłami na kanał (oscylator/szum + obwiednia),
 * nuty to wyłącznie automatyzacja parametrów — brak tworzenia węzłów per nuta.
 * Przełączanie: start nowego trybu wyrównany do taktu/miary, crossfade ~0.5 s.
 */
import { E, setWave, applyEnvelope, WAVE_GAIN } from './engine.js';
import { SONGS } from './songs.js';
import { compileSong } from './pattern.js';
import { midiToFreq, songStepAt, pickStartTime } from './theory.js';

export const MUSIC_MODES = ['menu', 'hero', 'boss', 'case', 'victory', 'off'];

const TICK_MS = 25;
const LOOKAHEAD = 0.12;
const FADE = 0.5;

/** Jak startuje dany tryb: wyrównanie i czas wejścia. */
const ENTRY = {
  menu: { quantize: 'bar', fadeIn: FADE },
  hero: { quantize: 'bar', fadeIn: FADE },
  boss: { quantize: 'bar', fadeIn: 0.25 },
  case: { quantize: 'none', fadeIn: 0.05 }, // zsynchronizowane z animacją 3.2 s
  victory: { quantize: 'beat', fadeIn: 0.05 },
};

/** @type {Record<string, ReturnType<typeof compileSong>>} */
const compiled = {};
const getSong = (name) => (compiled[name] ??= compileSong(/** @type {any} */ (SONGS)[name]));

/** Kanał tonalny: trwały oscylator → obwiednia (→ echo dla leadu). */
function toneChannel(ac, def, out, t, stepDur) {
  const osc = ac.createOscillator();
  setWave(osc, def.wave);
  osc.frequency.value = 220;
  const env = ac.createGain();
  env.gain.value = 0;
  osc.connect(env).connect(out);
  const nodes = [osc, env];
  if (def.echo) {
    // echo na ósemkę z kropką, z tłumieniem w pętli — głębia bez pogłosu
    const send = ac.createGain();
    const delay = ac.createDelay(1);
    const fb = ac.createGain();
    const damp = ac.createBiquadFilter();
    send.gain.value = def.echo;
    delay.delayTime.value = stepDur * 3;
    fb.gain.value = 0.3;
    damp.type = 'lowpass';
    damp.frequency.value = 2400;
    env.connect(send).connect(delay).connect(damp).connect(fb).connect(delay);
    damp.connect(out);
    nodes.push(send, delay, fb, damp);
  }
  if (def.vib) {
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = def.vib;
    lfo.connect(depth).connect(osc.detune);
    lfo.start(t);
    nodes.push(lfo, depth);
  }
  osc.start(t);
  const peak = def.vol * (WAVE_GAIN[def.wave] ?? 1);
  return {
    nodes,
    sources: nodes.filter((n) => n instanceof OscillatorNode),
    trigger(ev, at) {
      const span = ev.len * stepDur;
      const dur = Math.max(0.01, Math.min(span * (def.gate ?? 0.9), span - 0.008));
      const fs = ev.midis.map(midiToFreq);
      if (fs.length === 1) osc.frequency.setValueAtTime(fs[0], at);
      else {
        const rate = def.arpRate || 0.035;
        for (let k = 0; k * rate < dur; k++) osc.frequency.setValueAtTime(fs[k % fs.length], at + k * rate);
      }
      applyEnvelope(env.gain, at, dur, peak, def.adsr);
    },
  };
}

/** Stopa: trójkąt z szybkim opadaniem wysokości. */
function kickChannel(ac, def, out, t, stepDur) {
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 50;
  const env = ac.createGain();
  env.gain.value = 0;
  osc.connect(env).connect(out);
  osc.start(t);
  const f0 = def.f0 ?? 150;
  const f1 = def.f1 ?? 45;
  return {
    nodes: [osc, env],
    sources: [osc],
    trigger(ev, at) {
      const dur = Math.min(0.16, ev.len * stepDur - 0.006);
      osc.frequency.setValueAtTime(f0, at);
      osc.frequency.exponentialRampToValueAtTime(f1, at + Math.min(0.1, dur));
      applyEnvelope(env.gain, at, dur, def.vol * ev.vel, { a: 0.001, d: dur * 0.6, s: 0.3, r: dur * 0.35 });
    },
  };
}

/** Werbel/hi-hat: zapętlony szum → stały filtr → obwiednia. */
function noiseChannel(ac, def, out, t, stepDur) {
  const src = ac.createBufferSource();
  src.buffer = E.white;
  src.loop = true;
  const flt = ac.createBiquadFilter();
  flt.type = def.filter;
  flt.frequency.value = def.freq;
  flt.Q.value = def.q ?? 0.7;
  const env = ac.createGain();
  env.gain.value = 0;
  src.connect(flt).connect(env).connect(out);
  src.start(t, Math.random() * 0.9);
  const hit = (at, vel, decay, room) => {
    const dur = Math.max(0.006, Math.min(decay + 0.002, room - 0.004));
    applyEnvelope(env.gain, at, dur, def.vol * vel, { a: 0.001, d: dur * 0.5, s: 0.35, r: dur * 0.45 });
  };
  return {
    nodes: [src, flt, env],
    sources: [src],
    trigger(ev, at) {
      const room = ev.len * stepDur;
      if (ev.hit === 'r') {
        hit(at, ev.vel, def.decay * 0.5, stepDur / 2);
        hit(at + stepDur / 2, ev.vel * 0.85, def.decay * 0.5, room - stepDur / 2);
      } else {
        hit(at, ev.vel, ev.hit === 'o' ? (def.openDecay ?? def.decay * 3) : def.decay, room);
      }
    },
  };
}

const CHANNEL = { tone: toneChannel, kick: kickChannel, noise: noiseChannel };

class Player {
  /** @param {string} name @param {number} t0 @param {number} fadeIn */
  constructor(name, t0, fadeIn) {
    const ac = /** @type {AudioContext} */ (E.ac);
    this.name = name;
    this.song = getSong(name);
    this.t0 = t0;
    this.stepDur = this.song.stepDur;
    this.stepsPerBar = this.song.stepsPerBar;
    this.stepsPerBeat = this.song.stepsPerBeat;
    this.step = 0;
    this.next = t0;
    this.ended = false; // koniec nut (utwór bez pętli)
    this.stopAt = Infinity; // koniec dźwięku
    this.fading = false;
    this.out = ac.createGain();
    this.out.gain.setValueAtTime(0, ac.currentTime);
    this.out.gain.setValueAtTime(0, t0);
    this.out.gain.linearRampToValueAtTime(1, t0 + Math.max(0.01, fadeIn));
    this.out.connect(/** @type {GainNode} */ (E.music));
    const start = ac.currentTime;
    this.channels = this.song.channels.map((c) => ({ byStep: c.byStep, ch: CHANNEL[c.def.type](ac, c.def, this.out, start, this.stepDur) }));
  }

  /** Planuje nuty do `horizon`. */
  schedule(now, horizon) {
    if (this.ended) return;
    if (this.next < now - 0.05) {
      // przeglądarka zdławiła timer (karta w tle) — przeskocz, zamiast grać zaległe nuty naraz
      this.step = Math.ceil((now - this.t0) / this.stepDur);
      this.next = this.t0 + this.step * this.stepDur;
    }
    const { len, loopStart, loop } = this.song;
    while (this.next < horizon && this.next < this.stopAt) {
      const idx = songStepAt(this.step, len, loopStart, loop);
      if (idx < 0) {
        this.ended = true;
        this.fadeOut(this.next + 1.5, 0.3); // wybrzmienie fanfary, potem cisza
        return;
      }
      for (const { byStep, ch } of this.channels) {
        const ev = byStep[idx];
        if (ev) ch.trigger(ev, this.next);
      }
      this.step++;
      this.next = this.t0 + this.step * this.stepDur;
    }
  }

  /** Wycisza od `at` przez ~`fade` i zatrzymuje źródła. */
  fadeOut(at, fade = FADE) {
    if (this.fading) return;
    this.fading = true;
    const g = this.out.gain;
    const ac = /** @type {AudioContext} */ (E.ac);
    at = Math.max(at, ac.currentTime);
    if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(at);
    else {
      g.cancelScheduledValues(at);
      g.setValueAtTime(at < this.t0 ? 0 : g.value, at);
    }
    g.setTargetAtTime(0, at, fade / 4);
    this.stopAt = at + fade * 1.5;
    for (const { ch } of this.channels) for (const s of ch.sources) s.stop(this.stopAt);
  }

  /** Natychmiastowe zatrzymanie (np. tryb, który jeszcze nie zabrzmiał). */
  kill() {
    this.fadeOut(/** @type {AudioContext} */ (E.ac).currentTime, 0.02);
  }

  dispose() {
    for (const { ch } of this.channels) for (const n of ch.nodes) n.disconnect();
    this.out.disconnect();
  }
}

let desired = 'off';
/** @type {Player[]} */
let players = [];
/** @type {ReturnType<typeof setInterval>|null} */
let timer = null;

function tick() {
  const ac = E.ac;
  if (!ac) return;
  const now = ac.currentTime;
  for (const p of players) p.schedule(now, now + LOOKAHEAD);
  players = players.filter((p) => {
    if (now > p.stopAt + 0.1) {
      p.dispose();
      return false;
    }
    return true;
  });
  if (!players.length && timer) {
    clearInterval(timer);
    timer = null;
  }
}

const ensureTimer = () => (timer ??= setInterval(tick, TICK_MS));

/** Przełącza tryb (zapamiętuje go, jeśli kontekst jeszcze nie istnieje). @param {string} mode */
export function setMode(mode) {
  if (!MUSIC_MODES.includes(mode)) mode = 'off';
  if (mode === desired) return;
  desired = mode;
  if (E.ac) start(mode);
}

export const getMode = () => desired;

/** Wołane po utworzeniu kontekstu: uruchamia tryb ustawiony wcześniej. */
export function onContextReady() {
  if (desired !== 'off' && !players.some((p) => !p.fading)) start(desired);
}

function start(mode) {
  const ac = /** @type {AudioContext} */ (E.ac);
  const now = ac.currentTime;
  // tryby zaplanowane, ale jeszcze niesłyszalne — usuń od razu
  for (const p of players) if (!p.fading && p.t0 > now + 0.01) p.kill();
  const cur = players.filter((p) => !p.fading).pop() || null;
  if (mode === 'off') {
    for (const p of players) p.fadeOut(now, 0.8);
    return;
  }
  const entry = /** @type {any} */ (ENTRY)[mode];
  const t0 = pickStartTime(now, cur, { quantize: entry.quantize });
  for (const p of players) p.fadeOut(t0, mode === 'case' ? 0.35 : FADE);
  players.push(new Player(mode, t0, entry.fadeIn));
  tick();
  ensureTimer();
}
