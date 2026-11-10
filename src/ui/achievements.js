/**
 * Osiągnięcia (localStorage). Postęp liczony ze statystyk zbieranych po każdym meczu.
 * Nagrody (skiny, czapki, kolory) są na razie oznaczone „wkrótce” — przyjdą z edytorem wyglądu.
 */
import { rewardFor } from '../sim/cosmetics.js';

const KEY = 'korona.stats';
const KIND_NAME = { color: 'Kolor', hat: 'Czapka', nose: 'Nos' };

/** @typedef {{matches:number, wins:number, onlineWins:number, crowns:number, crownTime:number, damage:number, bossKills:number, flawless:number, bestWave:number, bossrushClear:number, bossTypes:string[], winClasses:string[], maps:string[]}} Stats */

/** @returns {Stats} */
const emptyStats = () => ({ matches: 0, wins: 0, onlineWins: 0, crowns: 0, crownTime: 0, damage: 0, bossKills: 0, flawless: 0, bestWave: 0, bossrushClear: 0, bossTypes: [], winClasses: [], maps: [] });

/**
 * @typedef {{id:string, name:string, desc:string, goal:number, reward:string, rewardId?:string, value:(s:Stats)=>number}} Achievement
 * @type {Achievement[]}
 */
export const ACHIEVEMENTS = /** @type {Achievement[]} */ ([
  { id: 'first_match', name: 'Pierwsza krew', desc: 'Zagraj pierwszy mecz', goal: 1, reward: 'Kolor: Miedziany', value: (s) => s.matches },
  { id: 'first_win', name: 'Koronacja', desc: 'Wygraj mecz Korony', goal: 1, reward: 'Czapka: Papierowa korona', value: (s) => s.wins },
  { id: 'wins_10', name: 'Władca areny', desc: 'Wygraj 10 meczów Korony', goal: 10, reward: 'Skin: Złoty Rycerz', value: (s) => s.wins },
  { id: 'crowns_25', name: 'Łowca koron', desc: 'Przejmij koronę 25 razy (najwięcej obrażeń w bossa)', goal: 25, reward: 'Kolor: Królewski fiolet', value: (s) => s.crowns },
  { id: 'crown_time', name: 'Długie panowanie', desc: 'Spędź łącznie 10 minut w koronie', goal: 600, reward: 'Czapka: Diadem', value: (s) => Math.floor(s.crownTime) },
  { id: 'damage_10k', name: 'Niszczyciel', desc: 'Zadaj bossom łącznie 10 000 obrażeń', goal: 10000, reward: 'Skin: Płonący Mag', value: (s) => Math.floor(s.damage) },
  { id: 'boss_kills_50', name: 'Tyran', desc: 'Jako boss pokonaj 50 bohaterów', goal: 50, reward: 'Nos: Rogaty', value: (s) => s.bossKills },
  { id: 'all_bosses', name: 'Osiem twarzy', desc: 'Zostań każdym z 8 bossów', goal: 8, reward: 'Skin: Cień Łotrzyka', value: (s) => s.bossTypes.length },
  { id: 'all_classes', name: 'Wszechstronny', desc: 'Wygraj mecz każdą z 8 klas', goal: 8, reward: 'Kolor: Tęczowy', value: (s) => s.winClasses.length },
  { id: 'all_maps', name: 'Podróżnik', desc: 'Zagraj na każdej z 6 map', goal: 6, reward: 'Czapka: Kapelusz podróżnika', value: (s) => s.maps.length },
  { id: 'survival_5', name: 'Ocalały', desc: 'Przetrwanie: dotrwaj do fali 5', goal: 5, reward: 'Kolor: Kościany', value: (s) => Math.min(5, s.bestWave) },
  { id: 'survival_10', name: 'Niezłomny', desc: 'Przetrwanie: dotrwaj do fali 10', goal: 10, reward: 'Skin: Szkieletowy Łucznik', value: (s) => Math.min(10, s.bestWave) },
  { id: 'survival_20', name: 'Legenda fal', desc: 'Przetrwanie: dotrwaj do fali 20', goal: 20, reward: 'Czapka: Hełm z czaszki', value: (s) => Math.min(20, s.bestWave) },
  { id: 'bossrush', name: 'Pogromca', desc: 'Boss Rush: pokonaj wszystkich 8 bossów', goal: 1, reward: 'Skin: Smoczy Barbarzyńca', value: (s) => s.bossrushClear },
  { id: 'flawless', name: 'Bez skazy', desc: 'Wygraj mecz Korony bez ani jednej śmierci', goal: 1, reward: 'Kolor: Diamentowy', value: (s) => s.flawless },
  { id: 'online_win', name: 'Mistrz sieci', desc: 'Wygraj mecz online', goal: 1, reward: 'Nos: Klaun', value: (s) => s.onlineWins },
]).map((a) => {
  const c = rewardFor(a.id);
  return c ? { ...a, rewardId: `${c.kind}:${c.id}`, reward: `${KIND_NAME[c.kind]}: ${c.name}${c.cls ? ' (skin klasy)' : ''}` } : a;
});

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw ? { ...emptyStats(), ...raw } : emptyStats();
  } catch {
    return emptyStats();
  }
}
function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* brak storage */
  }
}

/** Postęp wszystkich osiągnięć. */
export function getAchievements() {
  const s = load();
  return ACHIEVEMENTS.map((a) => {
    const value = Math.min(a.goal, a.value(s));
    return { ...a, value, unlocked: value >= a.goal };
  });
}

const add = (arr, v) => (v && !arr.includes(v) ? [...arr, v] : arr);

/**
 * Aktualizuje statystyki po meczu i zwraca nowo odblokowane osiągnięcia.
 * Czyste względem wejścia (testowalne): stats -> nowe stats.
 * @param {Stats} s @param {any} state końcowy stan @param {string} meId @param {{online?:boolean}} [o]
 */
export function applyMatch(s, state, meId, o = {}) {
  const me = state.players.find((p) => p.id === meId);
  if (!me) return s;
  const won = state.winnerId === meId;
  const crownMode = !state.mode || state.mode === 'crown';
  const n = { ...s };
  n.matches += 1;
  n.maps = add(n.maps, state.mapId);
  n.crowns += me.lastHits || 0;
  n.crownTime += me.crownTime || 0;
  n.damage += me.dmgTotal || 0;
  n.bossKills += me.bossKills || 0;
  for (const t of me.bossTypes || []) n.bossTypes = add(n.bossTypes, t);
  if (crownMode && won && state.endReason !== 'forfeit') {
    n.wins += 1;
    n.winClasses = add(n.winClasses, me.skin);
    if (!me.deaths) n.flawless += 1;
    if (o.online) n.onlineWins += 1;
  }
  if (state.mode === 'survival') n.bestWave = Math.max(n.bestWave, state.modeData?.wave ?? 0);
  if (state.mode === 'bossrush' && state.endReason === 'victory') n.bossrushClear += 1;
  return n;
}

/** Zapisuje mecz i zwraca nowo odblokowane osiągnięcia. @param {any} state @param {string} meId @param {{online?:boolean}} [o] */
export function recordMatch(state, meId, o = {}) {
  const before = new Set(getAchievements().filter((a) => a.unlocked).map((a) => a.id));
  save(applyMatch(load(), state, meId, o));
  return getAchievements().filter((a) => a.unlocked && !before.has(a.id));
}

/** Id odblokowanych osiągnięć (do sprawdzania kosmetyków). */
export const unlockedIds = () => new Set(getAchievements().filter((a) => a.unlocked).map((a) => a.id));
