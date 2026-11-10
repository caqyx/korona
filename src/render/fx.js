/**
 * „Soczystość”: cząsteczki (piksele), drżenie ekranu, hit-stop, błyski trafień, liczby obrażeń,
 * smugi dashu, cięcia broni, kill feed. Czysto wizualne — nie wpływa na symulację.
 */
import { SCORE, MODES, BOSSES, UPGRADES } from '../sim/config.js';

/** Baner końca meczu żyje dłużej niż okno 1,5 s do podsumowania (znika razem z meczem). */
const END_BANNER_TIME = 4;

export function createFx() {
  return {
    /** @type {{x:number,y:number,vx:number,vy:number,life:number,max:number,color:string,size:number,g:number}[]} */
    parts: [],
    /** liczby obrażeń/napisy w świecie @type {{x:number,y:number,text:string,life:number,max:number,color:string,big:boolean}[]} */
    texts: [],
    /** @type {{pts:number[][],life:number}[]} */
    bolts: [],
    /** cięcia broni @type {{x:number,y:number,a:number,range:number,arc:number,life:number,color:string}[]} */
    swings: [],
    /** fale/kręgi @type {{x:number,y:number,r:number,max:number,life:number,total:number,color:string}[]} */
    rings: [],
    /** błyski trafień per id (sekundy) */
    flash: /** @type {Record<string, number>} */ ({}),
    /** smugi dashu */
    ghosts: /** @type {{id:string,x:number,y:number,life:number}[]} */ ([]),
    /** kill feed @type {{text:string,color:string,life:number}[]} */
    feed: [],
    shake: 0,
    hitStop: 0,
    redFlash: 0,
    /** aktualnie pokazywany baner (górna część ekranu) i kolejka następnych */
    banner: /** @type {Banner|null} */ (null),
    /** @type {Banner[]} */
    banners: [],
    /** blokada ponownego błysku trafienia per id (sekundy) — boss bity przez wielu nie jest stale biały */
    flashLock: /** @type {Record<string, number>} */ ({}),
    /** błysk chipu wyniku per id gracza (sekundy) */
    chipFlash: /** @type {Record<string, number>} */ ({}),
    /** puls znacznika własnej postaci per id (start meczu, odrodzenie) */
    mark: /** @type {Record<string, number>} */ ({}),
    /** błysk licznika „drugich szans” po utracie jednej (Boss Rush), sekundy */
    lifeFlash: 0,
    /** błysk slotu umiejętności po odnowieniu, klucz `${id}:${slot}` (sekundy) */
    cdFlash: /** @type {Record<string, number>} */ ({}),
    /** kto zabił lokalnego gracza (do panelu śmierci): id ofiary -> opis zabójcy */
    killedBy: /** @type {Record<string, {name:string,color:string}>} */ ({}),
    /** pamięć śledzenia wyścigu obrażeń itp. (render/feedback.js) */
    track: /** @type {any} */ (null),
  };
}

/** @typedef {{text:string, sub:string, color:string, life:number, max:number, dim:boolean}} Banner */

/** Czas życia zwykłego banera (s) — krótko, żeby nie zasłaniał walki. */
const BANNER_TIME = 1.2;
/** Najwięcej banerów czekających w kolejce (starsze, nieaktualne, wypadają). */
const BANNER_QUEUE_MAX = 3;
/** Czasy błysków (s). */
const BOSS_FLASH = 0.08;
const BOSS_FLASH_LOCK = 0.22;
export const CHIP_FLASH = 0.6;
export const MARK_PULSE = 1.4;
export const CD_FLASH = 0.25;
export const LIFE_FLASH = 1.2;

/**
 * Dodaje baner do kolejki (pokazywane po kolei, nie nadpisują się).
 * @param {ReturnType<typeof createFx>} fx @param {string} text
 * @param {{sub?:string, color?:string, time?:number, dim?:boolean}} [o]
 */
export function pushBanner(fx, text, o = {}) {
  const time = o.time ?? BANNER_TIME;
  const b = { text, sub: o.sub ?? '', color: o.color ?? '#ffd23f', life: time, max: time, dim: !!o.dim };
  if (!fx.banner) fx.banner = b;
  else {
    fx.banners.push(b);
    if (fx.banners.length > BANNER_QUEUE_MAX) fx.banners.shift();
  }
}

/** @param {ReturnType<typeof createFx>} fx */
function burst(fx, x, y, color, n = 10, speed = 6, size = 1, gravity = 0) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random());
    const life = 0.3 + Math.random() * 0.35;
    fx.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size, g: gravity });
  }
  if (fx.parts.length > 700) fx.parts.splice(0, fx.parts.length - 700);
}

/** Napis w świecie (liczba obrażeń, „+N”, nazwa ulepszenia), unoszący się i gasnący. */
function addText(fx, x, y, text, color, big = false) {
  fx.texts.push({ x: x + (Math.random() - 0.5) * 0.6, y, text, life: big ? 1.3 : 0.8, max: big ? 1.3 : 0.8, color, big });
  if (fx.texts.length > 60) fx.texts.shift();
}

export function addFeed(fx, text, color) {
  fx.feed.unshift({ text, color, life: 5 });
  if (fx.feed.length > 5) fx.feed.length = 5;
}

/** Punkty za przejęcie korony / pokonanie bossa w bieżącym trybie. @param {any} state */
function lastHitPoints(state) {
  if (state.mode === 'survival') return MODES.survival.bossScore;
  if (state.mode === 'bossrush') return MODES.bossrush.killScore;
  return SCORE.lastHit;
}

/** „+N” nad graczem, który właśnie dostał punkty, i błysk jego chipu wyniku. @param {any} p @param {number} pts */
function scorePopup(fx, p, pts) {
  if (!p || !(pts > 0)) return;
  addText(fx, p.x, p.y - (p.boss ? 3.4 : 2.4), `+${pts}`, '#ffd23f', true);
  fx.chipFlash[p.id] = CHIP_FLASH;
}

/** „+N” dla bossa-gracza za pokonanego bohatera; boss AI (Przetrwanie, Boss Rush) nie zbiera punktów. @param {any} killer */
function heroKillPopup(fx, killer, pts) {
  if (killer && !killer.ai) scorePopup(fx, killer, pts);
}

/** Boss Rush: drużyna straciła „drugą szansę” — baner, czerwony błysk i miganie licznika. @param {{left?:number}} e */
function lifeLostFx(fx, e, sound) {
  const left = e.left;
  const sub = !Number.isFinite(left) ? 'Wszyscy polegli' : left > 0 ? `Wszyscy polegli — zostało szans: ${left}` : 'Wszyscy polegli — to była ostatnia';
  pushBanner(fx, 'DRUGA SZANSA!', { sub, color: '#ff5470', time: 1.6 });
  fx.lifeFlash = LIFE_FLASH;
  fx.redFlash = Math.max(fx.redFlash, 0.3);
  fx.shake = Math.min(4, fx.shake + 2);
  sound('lowhp');
}

/** Wybuch, krąg i hit-stop w miejscu pokonanego bossa. @param {any} boss @param {(n:string)=>void} sound */
function bossDeathFx(fx, boss, sound) {
  if (!boss) return;
  burst(fx, boss.x, boss.y, '#ffffff', 40, 10, 2);
  burst(fx, boss.x, boss.y, '#ffd23f', 30, 7, 2);
  fx.rings.push({ x: boss.x, y: boss.y, r: 0, max: 5, life: 0.45, total: 0.45, color: '#ffd23f' });
  fx.shake = 4;
  fx.hitStop = Math.max(fx.hitStop, 0.12);
  sound('bossDie');
}

/** Zapamiętuje zabójcę lokalnego gracza (panel śmierci w HUD). @param {any} e @param {any} killer */
function noteKiller(fx, e, killer, colorOf, meIds) {
  if (!meIds.includes(e.id)) return;
  if (!killer) delete fx.killedBy[e.id];
  else fx.killedBy[e.id] = { name: killer.boss ? `${BOSSES[killer.boss.type]?.name ?? 'Boss'} (${killer.nick})` : killer.nick, color: colorOf(killer.id) };
}

/** Baner końca meczu (z przyciemnieniem) — widoczny do pojawienia się podsumowania. @param {any} e @param {any} state */
function endBanner(fx, e, state) {
  const winner = state.players.find((p) => p.id === e.winner);
  const who = state.mode === 'teams' ? `DRUŻYNA ${state.winnerTeam === 1 ? 'CZERWONA' : 'NIEBIESKA'}` : winner?.nick;
  const o = { time: END_BANNER_TIME, dim: true };
  fx.banner = null;
  fx.banners.length = 0;
  if (e.reason === 'wipe') pushBanner(fx, 'KONIEC', { ...o, sub: 'Wszyscy bohaterowie polegli', color: '#ff5470' });
  else if (e.reason === 'victory') pushBanner(fx, 'ZWYCIĘSTWO!', o);
  else if (e.reason === 'time') pushBanner(fx, 'KONIEC CZASU', { ...o, sub: who ? `Wygrywa ${who}` : '' });
  else pushBanner(fx, who ? `WYGRYWA ${who}` : 'KONIEC MECZU', o);
}

/** Krąg w kolorze gracza i nazwa ulepszenia nad jego głową. @param {any} p @param {string} upg */
function upgradeFx(fx, p, upg, colorOf) {
  if (!p) return;
  const c = colorOf(p.id);
  fx.rings.push({ x: p.x, y: p.y, r: 0, max: 2.2, life: 0.5, total: 0.5, color: c });
  burst(fx, p.x, p.y, c, 12, 4);
  const name = /** @type {any} */ (UPGRADES)[upg]?.name;
  if (name) addText(fx, p.x, p.y - 2.4, name, c, true);
}

/**
 * Zamienia zdarzenia symulacji na efekty, dźwięk i haptykę.
 * @param {ReturnType<typeof createFx>} fx @param {any[]} events @param {any} state @param {string|null} meId
 * @param {(id:string)=>string} colorOf
 * @param {{sound?:(name:string)=>void, vibrate?:(p:number|number[])=>void, meIds?:string[]}} [out]
 *   `meIds` — wszyscy lokalni ludzie (wspólny ekran); domyślnie sam `meId`
 */
export function applyEvents(fx, events, state, meId, colorOf, out = {}) {
  const sound = out.sound || (() => {});
  const vib = out.vibrate || (() => {});
  const meIds = out.meIds || (meId ? [meId] : []);
  const find = (id) => state.players.find((p) => p.id === id);
  const nick = (id) => find(id)?.nick ?? '?';
  for (const e of events) {
    switch (e.t) {
      case 'bossHit':
        burst(fx, e.x + (Math.random() - 0.5), e.y - 0.6 + (Math.random() - 0.5), colorOf(e.by), 5, 6);
        if (!(fx.flashLock[e.id] > 0)) {
          fx.flash[e.id] = BOSS_FLASH;
          fx.flashLock[e.id] = BOSS_FLASH_LOCK;
        }
        addText(fx, e.x, e.y - 1.8, String(Math.round(e.dmg)), e.dmg >= 20 ? '#ffd23f' : '#ffffff', e.dmg >= 20);
        if (e.by === meId) {
          fx.hitStop = Math.max(fx.hitStop, e.dmg >= 20 ? 0.07 : 0.035);
          sound('hit');
        }
        break;
      case 'heroHit':
        burst(fx, e.x, e.y, '#ff5470', 10, 7);
        fx.flash[e.id] = 0.18;
        addText(fx, e.x, e.y - 1.6, '-1', '#ff8fa3');
        fx.shake = Math.min(3, fx.shake + 1.2);
        if (e.id === meId) {
          fx.redFlash = 0.3;
          vib(45);
          const me = state.players.find((p) => p.id === meId);
          sound(me && me.hp <= 1 ? 'lowhp' : 'hurt');
        } else sound('hurt');
        break;
      case 'heroDie':
        burst(fx, e.x, e.y, colorOf(e.id), 26, 9, 2);
        burst(fx, e.x, e.y, '#ffffff', 10, 4);
        fx.shake = Math.min(4, fx.shake + 2);
        if (e.by && find(e.by)) addFeed(fx, `${nick(e.by)} ☠ ${nick(e.id)}`, '#ff8fa3');
        noteKiller(fx, e, find(e.by), colorOf, meIds);
        heroKillPopup(fx, find(e.by), e.pts);
        if (e.id === meId) vib([60, 40, 90]);
        sound('die');
        break;
      case 'zoneFire':
        burst(fx, e.x, e.y, '#ff5470', 8, 6);
        burst(fx, e.x, e.y, '#ffb347', 6, 3);
        fx.rings.push({ x: e.x, y: e.y, r: 0, max: Math.max(1, e.r), life: 0.25, total: 0.25, color: '#ffd0d8' });
        fx.shake = Math.min(3, fx.shake + 0.8);
        sound('boom');
        break;
      case 'block':
      case 'reflect':
        burst(fx, e.x, e.y, '#9be7ff', 10, 6);
        addText(fx, e.x, e.y - 1, e.t === 'block' ? 'BLOK' : 'ODBICIE', '#9be7ff');
        sound('block');
        break;
      case 'dash':
        fx.ghosts.push({ id: e.id, x: e.x, y: e.y, life: 0.2 });
        burst(fx, e.x, e.y + 0.3, '#8f9bff', 5, 2);
        sound('dash');
        break;
      case 'swing':
        fx.swings.push({ x: e.x, y: e.y, a: e.a, range: e.range, arc: (e.arc * Math.PI) / 180, life: 0.14, color: colorOf(e.id) });
        sound('swing');
        break;
      case 'ability':
        if (e.skin === 'kaplan') {
          fx.rings.push({ x: e.x, y: e.y, r: 0, max: e.r, life: 0.5, total: 0.5, color: '#ffe066' });
          burst(fx, e.x, e.y, '#ffe066', 22, 4);
          sound('heal');
        } else if (e.skin === 'inzynier') sound('turret');
        else if (e.skin === 'lotrzyk') {
          burst(fx, e.fromX, e.fromY, '#c77dff', 14, 4);
          burst(fx, e.x, e.y, '#c77dff', 14, 4);
          sound('blink');
        } else sound('ability');
        break;
      case 'charge':
        sound('ability');
        break;
      case 'blink':
        burst(fx, e.fromX, e.fromY, '#b14dff', 16, 5);
        burst(fx, e.x, e.y, '#b14dff', 16, 5);
        sound('blink');
        break;
      case 'bossCast': {
        const me = state.players.find((p) => p.id === meId);
        if (e.ab !== 'atk') sound(me && !me.boss ? 'warn' : 'cast');
        break;
      }
      case 'chain':
        fx.bolts.push({ pts: e.pts, life: 0.35 });
        sound('zap');
        break;
      case 'crownTaken':
        fx.shake = 3;
        addFeed(fx, `♛ ${nick(e.id)} przejmuje koronę`, '#ffd23f');
        sound('crown');
        break;
      case 'lastHit':
        addFeed(fx, `${nick(e.id)} — najwięcej obrażeń (${e.pct ?? '?'}%) +${lastHitPoints(state)}`, '#ffd23f');
        scorePopup(fx, find(e.id), lastHitPoints(state));
        // tryb korony nie emituje `bossDie` — śmierć bossa pokazujemy tutaj, w miejscu starego bossa
        if (!state.mode || state.mode === 'crown') bossDeathFx(fx, find(e.boss), sound);
        if (e.id === meId) vib([30, 30, 60]);
        sound('lastHit');
        break;
      case 'assist':
        addFeed(fx, `${nick(e.id)} — asysta +${SCORE.assist}`, '#9be7ff');
        scorePopup(fx, find(e.id), SCORE.assist);
        break;
      case 'minionDie':
        burst(fx, e.x, e.y, '#e8e8e8', 10, 4);
        break;
      case 'respawn':
        burst(fx, e.x, e.y, '#ffffff', 14, 3);
        if (meIds.includes(e.id)) fx.mark[e.id] = MARK_PULSE;
        if (e.id === meId) sound('respawn');
        break;
      case 'crownDrop':
        addFeed(fx, 'Korona upadła na środek!', '#ffd23f');
        break;
      case 'leave':
        addFeed(fx, `${nick(e.id)} opuścił mecz`, '#888');
        break;
      case 'matchEnd':
        endBanner(fx, e, state);
        sound('win');
        break;
      case 'go':
        pushBanner(fx, 'START!', { time: 0.9 });
        for (const id of meIds) fx.mark[id] = MARK_PULSE;
        sound('go');
        break;
      case 'wave':
        addFeed(fx, e.boss ? `Fala ${e.n} — BOSS!` : `Fala ${e.n}`, e.boss ? '#ff5470' : '#ffd23f');
        sound(e.boss ? 'roar' : 'countdown');
        break;
      case 'waveClear':
        addFeed(fx, `Fala ${e.n} przetrwana!`, '#5ce07a');
        sound('reveal');
        break;
      case 'bossStage':
        addFeed(fx, `Boss ${e.n}/${e.total}`, '#ff5470');
        sound('roar');
        break;
      case 'bossDie':
        burst(fx, e.x, e.y, '#ffffff', 40, 10, 2);
        burst(fx, e.x, e.y, '#ffd23f', 30, 7, 2);
        fx.shake = 4;
        sound('bossDie');
        break;
      case 'upgrade':
      case 'upgradeAuto':
        upgradeFx(fx, find(e.id), e.upg, colorOf);
        sound('pickup');
        break;
      case 'lifeLost':
        lifeLostFx(fx, e, sound);
        break;
      case 'burn':
        burst(fx, e.x, e.y, '#ff8a3d', 8, 3);
        break;
      case 'minionHit':
        addText(fx, e.x, e.y - 1, String(e.dmg), '#ffffff');
        break;
      default:
        break;
    }
  }
}

/** @param {ReturnType<typeof createFx>} fx @param {number} dt */
export function updateFx(fx, dt) {
  for (const p of fx.parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.g * dt;
    p.vx *= 0.9;
    p.vy *= 0.9;
    p.life -= dt;
  }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  for (const t of fx.texts) {
    t.life -= dt;
    t.y -= dt * 1.2;
  }
  fx.texts = fx.texts.filter((t) => t.life > 0);
  for (const arr of [fx.bolts, fx.swings, fx.ghosts, fx.rings, fx.feed]) for (const b of arr) b.life -= dt;
  fx.bolts = fx.bolts.filter((b) => b.life > 0);
  fx.swings = fx.swings.filter((b) => b.life > 0);
  fx.ghosts = fx.ghosts.filter((b) => b.life > 0);
  fx.rings = fx.rings.filter((b) => b.life > 0);
  fx.feed = fx.feed.filter((b) => b.life > 0);
  decayTimers(fx.flash, dt);
  decayTimers(fx.flashLock, dt);
  decayTimers(fx.chipFlash, dt);
  decayTimers(fx.mark, dt);
  decayTimers(fx.cdFlash, dt);
  fx.shake = Math.max(0, fx.shake - dt * 10);
  fx.hitStop = Math.max(0, fx.hitStop - dt);
  fx.redFlash = Math.max(0, fx.redFlash - dt);
  fx.lifeFlash = Math.max(0, fx.lifeFlash - dt);
  if (fx.banner) {
    fx.banner.life -= dt;
    if (fx.banner.life <= 0) fx.banner = fx.banners.shift() ?? null;
  }
}

/** Odlicza słownik liczników i usuwa wygasłe. @param {Record<string, number>} timers @param {number} dt */
function decayTimers(timers, dt) {
  for (const k in timers) {
    timers[k] -= dt;
    if (timers[k] <= 0) delete timers[k];
  }
}
