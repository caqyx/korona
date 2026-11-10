/**
 * Informacje zwrotne wyliczane ze STANU (nie ze zdarzeń): wyścig obrażeń o koronę, „DOBIJ!”,
 * gorączka korony, tykanie końcówki meczu i błysk odnowionych umiejętności.
 * Wołane raz na klatkę przez pętlę widoku; pamięć trzyma w `fx.track`. Stan gry tylko czyta.
 */
import { BOSS_COMMON } from '../sim/config.js';
import { feverMultiplier } from '../sim/combat.js';
import { topDamageDealer } from '../sim/rules.js';
import { pushBanner, addFeed, CD_FLASH } from './fx.js';

/** Próg „DOBIJ!”: ułamek HP bossa. */
const FINISH_HP = BOSS_COMMON.lowHpPulse ?? 0.1;
/** Ostatnie sekundy meczu z tykaniem. */
export const TICK_LAST_S = 10;
/** Sloty umiejętności śledzone pod kątem błysku „gotowe”. */
const HERO_SLOTS = /** @type {const} */ (['atk', 'dash', 'abil']);
const BOSS_SLOTS = /** @type {const} */ (['atk', 'q', 'e', 'r']);

function createTrack() {
  return {
    /** id bossa bieżącego panowania i jego ostatni czas panowania (wykrycie nowego panowania) */
    bossId: /** @type {string|null} */ (null),
    reign: 0,
    /** lider obrażeń w tym panowaniu */
    leaderId: /** @type {string|null} */ (null),
    finishShown: false,
    feverShown: false,
    /** ostatnia sekunda, dla której zagrał tik końcówki */
    tickSec: -1,
    /** poprzedni stan cooldownów lokalnych graczy: id -> slot -> czy trwał */
    cd: /** @type {Record<string, Record<string, number>>} */ ({}),
  };
}

/**
 * Lider wyścigu o koronę: ten sam gracz, którego wskazałaby symulacja (`topDamageDealer`, remis jak tam),
 * ale dopiero gdy zadał świeże obrażenia w TYM panowaniu — samo roszczenie przeniesione z poprzedniej
 * walki (`claim0`) nie odpala banera na starcie panowania.
 * @param {any} view @returns {any|null}
 */
export function damageLeader(view) {
  const top = topDamageDealer(view, '');
  return top && top.dmgToBoss > (top.claim0 ?? 0) ? top : null;
}

/** Boss, z którym walczy `me` (nie on sam, nie sojusznik z drużyny). @param {any} view @param {any} me */
function enemyBoss(view, me) {
  for (const p of view.players) {
    if (!p.boss || p.boss.dying || p.id === me?.id) continue;
    if (me && me.team !== undefined && p.team === me.team) continue;
    return p;
  }
  return null;
}

/** Nowe panowanie = inny boss albo licznik panowania cofnął się do zera. */
function syncReign(tr, boss) {
  const id = boss ? boss.id : null;
  const reign = boss ? boss.boss.reign : 0;
  if (id !== tr.bossId || reign < tr.reign) {
    tr.leaderId = null;
    tr.finishShown = false;
    tr.feverShown = false;
  }
  tr.bossId = id;
  tr.reign = reign;
}

/** Wyścig obrażeń (tylko tryb korony): baner, gdy lokalny gracz obejmuje prowadzenie; wpis, gdy je traci. */
function trackRace(fx, tr, view, me, sound) {
  const lead = damageLeader(view);
  const id = lead ? lead.id : null;
  if (id === tr.leaderId) return;
  const lost = tr.leaderId === me.id;
  tr.leaderId = id;
  if (id === me.id) {
    pushBanner(fx, 'PROWADZISZ', { sub: 'korona będzie twoja' });
    sound('reveal');
  } else if (lost && lead) addFeed(fx, `${lead.nick} wyprzedza cię w obrażeniach`, '#ff8fa3');
}

/** Jednorazowe banery panowania: „DOBIJ!” poniżej progu HP i pierwszy stopień gorączki. */
function trackBossMoments(fx, tr, view, boss) {
  if (!tr.finishShown && boss.boss.hp > 0 && boss.boss.hp <= boss.boss.maxHp * FINISH_HP) {
    tr.finishShown = true;
    pushBanner(fx, 'DOBIJ!', { color: '#ff5470', time: 0.9 });
  }
  if (!tr.feverShown && (!view.mode || view.mode === 'crown') && feverMultiplier(boss.boss.reign) > 1) {
    tr.feverShown = true;
    pushBanner(fx, 'GORĄCZKA KORONY', { sub: 'boss otrzymuje coraz większe obrażenia', color: '#ff8a3d' });
  }
}

/** Tik dźwiękowy w każdej z ostatnich sekund meczu na czas (tryb korony). */
function trackClock(tr, view, sound) {
  const left = view.timeLimit - view.matchTime;
  if (left > TICK_LAST_S || left <= 0) return;
  const sec = Math.ceil(left);
  if (sec === tr.tickSec) return;
  tr.tickSec = sec;
  sound('tick');
}

/** Stan slotu zapamiętany z poprzedniej klatki. */
const CD_READY = 0;
const CD_SHORT = 1;
const CD_LONG = 2;
/** Odnowienie od tylu sekund w górę błyska po zakończeniu (zwykły atak nie mruga co cios). */
const CD_LONG_S = 1;

/** Ile sekund zostało do odnowienia slotu `k` gracza `p`. */
function cooldownLeft(p, k) {
  if (p.boss) return p.boss.cd[k] ?? 0;
  return k === 'atk' ? p.atkCd : k === 'dash' ? p.dashCd : p.abilCd;
}

/** Błysk slotu w chwili, gdy dłuższa umiejętność lokalnego gracza się odnowiła. */
function trackCooldowns(fx, tr, p) {
  const prev = (tr.cd[p.id] ??= {});
  const slots = p.boss ? BOSS_SLOTS : HERO_SLOTS;
  for (const k of slots) {
    const left = cooldownLeft(p, k);
    const was = prev[k] ?? CD_READY;
    if (left > 0) {
      if (was === CD_READY) prev[k] = left >= CD_LONG_S ? CD_LONG : CD_SHORT;
      continue;
    }
    if (was === CD_LONG) fx.cdFlash[`${p.id}:${k}`] = CD_FLASH;
    prev[k] = CD_READY;
  }
}

/**
 * @param {ReturnType<typeof import('./fx.js').createFx>} fx
 * @param {any} view @param {string[]} meIds lokalni ludzie
 * @param {{sound?:(n:string)=>void}} [out]
 */
export function updateFeedback(fx, view, meIds, out = {}) {
  const tr = (fx.track ??= createTrack());
  const sound = out.sound || (() => {});
  if (view.phase !== 'playing') return;
  const crown = !view.mode || view.mode === 'crown';
  if (crown) trackClock(tr, view, sound);
  let me = null;
  for (const p of view.players) {
    if (!meIds.includes(p.id)) continue;
    if (p.alive) trackCooldowns(fx, tr, p);
    me = p;
  }
  // banery osobiste tylko dla jednego lokalnego gracza (na wspólnym ekranie nie wiadomo, czyje)
  if (!me || meIds.length !== 1) return;
  const boss = enemyBoss(view, me);
  syncReign(tr, boss);
  if (!boss || me.boss) return;
  if (crown) trackRace(fx, tr, view, me, sound);
  trackBossMoments(fx, tr, view, boss);
}
