import { BOSSES, BOSS_COMMON } from '../config.js';
import { BTN } from '../state.js';
import { aimAt, glide } from '../heroes/index.js';
import { kolos } from './kolos.js';
import { cien } from './cien.js';
import { nekromanta } from './nekromanta.js';
import { burza } from './burza.js';
import { smok } from './smok.js';
import { szron } from './szron.js';
import { pajeczyca } from './pajeczyca.js';
import { widmo } from './widmo.js';

export const BOSS_KITS = { kolos, cien, nekromanta, burza, smok, szron, pajeczyca, widmo };
export const BOSS_ABILITY_KEYS = /** @type {const} */ (['atk', 'q', 'e', 'r']);

/**
 * Maszyna stanów bossa: idle -> cast (telegraf) -> fire -> [channel] -> idle.
 * @param {import('../state.js').MatchState} state @param {import('../state.js').Player} p
 * @param {import('../state.js').Input} input @param {number} pressed @param {number} dt @param {import('../rng.js').Rng} rng
 */
export function updateBoss(state, p, input, pressed, dt, rng) {
  const b = /** @type {import('../state.js').BossState} */ (p.boss);
  if (b.dying) return;
  const def = BOSSES[/** @type {keyof typeof BOSSES} */ (b.type)];
  const kit = BOSS_KITS[/** @type {keyof typeof BOSS_KITS} */ (b.type)];
  for (const k of BOSS_ABILITY_KEYS) b.cd[k] = Math.max(0, b.cd[k] - dt);
  b.invisT = Math.max(0, b.invisT - dt);
  aimAt(p, input.aimX, input.aimY);
  if (state.phase === 'playing') /** @type {any} */ (kit).passive?.(state, p, dt);
  if (b.channel) {
    kit.channel(state, p, dt);
    b.channel.t -= dt;
    if (b.channel.t <= 0) b.channel = null;
    if (b.channel?.kind === 'charge') return;
  }
  moveBoss(p, input, dt, def.speedMul * (b.cast ? BOSS_COMMON.castMoveMul : 1));
  if (b.cast) return advanceCast(state, p, kit, dt, rng);
  if (state.phase !== 'playing' || b.channel) return;
  const want = pressed & BTN.Q ? 'q' : pressed & BTN.E ? 'e' : pressed & BTN.R ? 'r' : input.buttons & BTN.ATTACK ? 'atk' : null;
  if (want && b.cd[want] <= 0) startCast(state, p, want, input, rng);
}

/** Rozpoczyna rzucanie: tworzy telegraf. @param {import('../state.js').MatchState} state @param {import('../state.js').Player} p @param {'atk'|'q'|'e'|'r'} ab */
export function startCast(state, p, ab, input, rng) {
  const b = /** @type {import('../state.js').BossState} */ (p.boss);
  const def = /** @type {any} */ (BOSSES)[b.type];
  const cfg = def[ab];
  const area = ab !== 'atk' && b.overloaded ? def.overloadArea : 1;
  if (ab !== 'atk' && b.overloaded) b.overloaded = false;
  b.cast = { ab, t: cfg.telegraph, total: cfg.telegraph, ax: input.aimX, ay: input.aimY, area, data: null };
  /** @type {any} */ (BOSS_KITS)[b.type][ab].telegraph(state, p, b.cast, rng);
  b.cd[ab] = cfg.cd * (b.cdMul ?? 1);
  state.events.push({ t: 'bossCast', id: p.id, ab, bossType: b.type });
}

function advanceCast(state, p, kit, dt, rng) {
  const b = p.boss;
  b.cast.t -= dt;
  if (b.cast.t > 1e-9) return;
  const cast = b.cast;
  b.cast = null;
  kit[cast.ab].fire(state, p, cast, rng);
  state.events.push({ t: 'bossFire', id: p.id, ab: cast.ab, bossType: b.type });
}

function moveBoss(p, input, dt, mul) {
  let mx = input.moveX;
  let my = input.moveY;
  const l = Math.hypot(mx, my);
  if (l > 1) {
    mx /= l;
    my /= l;
  }
  glide(p, mx * BOSS_COMMON.speed * mul, my * BOSS_COMMON.speed * mul, dt);
}
