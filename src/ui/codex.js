/**
 * Opisy bohaterów i bossów dla UI (wybór skina, sloty lokalne, Bestiariusz).
 * Liczby pochodzą z sim/config.js, więc zmiana balansu od razu zmienia opisy.
 */
import { SKINS, BOSSES, RARITY, HERO } from '../sim/config.js';

/** Liczba po polsku: 1.5 → „1,5”. @param {number} n */
export const num = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

const S = SKINS;
/** @type {Record<string, {role:string, attack:string, ability:string, abilityDesc:string, cd:number}>} */
export const SKIN_TEXT = {
  rycerz: {
    role: 'Przetrwanie',
    attack: `Cięcie ${S.rycerz.attack.arc}°, ${S.rycerz.attack.dmg} dmg`,
    ability: 'Tarcza',
    abilityDesc: `Blokuje wszystko z przodu przez ${num(S.rycerz.ability.duration)} s, odbite pociski lecą w bossa.`,
    cd: S.rycerz.ability.cd,
  },
  lucznik: {
    role: 'Dystans, dobijanie',
    attack: `Strzała ${S.lucznik.attack.range} m, ${S.lucznik.attack.dmg} dmg`,
    ability: 'Przeszywający strzał',
    abilityDesc: `Ładowanie ${num(S.lucznik.ability.charge)} s, przebija wszystko, ${S.lucznik.ability.dmg} dmg.`,
    cd: S.lucznik.ability.cd,
  },
  lotrzyk: {
    role: 'Kradzież ostatniego ciosu',
    attack: `Sztylet ${S.lotrzyk.attack.arc}°, ${S.lotrzyk.attack.dmg} dmg, szybki`,
    ability: 'Krok cienia',
    abilityDesc: `Teleport za plecy bossa (do ${S.lotrzyk.ability.range} m), następny atak ×${S.lotrzyk.ability.mult}.`,
    cd: S.lotrzyk.ability.cd,
  },
  kaplan: {
    role: 'Wsparcie, dylemat',
    attack: `Kula światła ${S.kaplan.attack.range} m, ${S.kaplan.attack.dmg} dmg`,
    ability: 'Aura',
    abilityDesc: `Leczy ${S.kaplan.ability.heal} HP wszystkim bohaterom w promieniu ${S.kaplan.ability.radius} m — także rywalom.`,
    cd: S.kaplan.ability.cd,
  },
  inzynier: {
    role: 'Presja obszarowa',
    attack: `Klucz, ${S.inzynier.attack.dmg} dmg`,
    ability: 'Wieżyczka',
    abilityDesc: `Działko na ${S.inzynier.ability.life} s, strzela w bossa po ${S.inzynier.ability.dmg} dmg. Jego ostatni cios jest Twój.`,
    cd: S.inzynier.ability.cd,
  },
  mag: {
    role: 'Wybuchowe obrażenia',
    attack: `Kula ognia, ${S.mag.attack.range} m, ${S.mag.attack.dmg} dmg`,
    ability: 'Meteor',
    abilityDesc: `Po ${num(S.mag.ability.telegraph)} s spada w wybrany punkt (do ${S.mag.ability.range} m): ${S.mag.ability.dmg} dmg w promieniu ${num(S.mag.ability.radius)} m.`,
    cd: S.mag.ability.cd,
  },
  barbarzynca: {
    role: 'Obrażenia wręcz',
    attack: `Topór 150°, ${S.barbarzynca.attack.dmg} dmg`,
    ability: 'Szał',
    abilityDesc: `Przez ${S.barbarzynca.ability.duration} s ataki ponad 2× szybciej i +20% prędkości ruchu.`,
    cd: S.barbarzynca.ability.cd,
  },
  druid: {
    role: 'Kontrola',
    attack: `Ciernie, ${S.druid.attack.range} m, ${S.druid.attack.dmg} dmg`,
    ability: 'Korzenie',
    abilityDesc: `Strefa ${num(S.druid.ability.radius)} m na ${S.druid.ability.life} s: spowalnia bossa o ${Math.round(S.druid.ability.slow * 100)}%, unieruchamia miniony, ${S.druid.ability.dmg} dmg co ${num(S.druid.ability.tick)} s.`,
    cd: S.druid.ability.cd,
  },
};

export const HERO_COMMON = `Każdy bohater: ${HERO.hp} HP, dash co ${num(HERO.dashCooldown)} s (${num(HERO.dashDuration)} s nietykalności), odrodzenie po ${HERO.respawnTime} s.`;

const B = BOSSES;
/** @type {Record<string, {title:string, passive:[string,string], atk:string, q:[string,string], e:[string,string], r:[string,string]}>} */
export const BOSS_TEXT = {
  kolos: {
    title: 'Tank',
    passive: ['Kamienna skóra', `Odporny na odrzut, obrażenia −${Math.round((1 - B.kolos.dmgTakenMul) * 100)}%, prędkość ${num(B.kolos.speedMul)}×.`],
    atk: 'Pięść w łuku przed sobą.',
    q: ['Fala uderzeniowa', 'Pierścień rozchodzący się od bossa — przeskocz go dashem.'],
    e: ['Szarża', `Bieg po linii ${B.kolos.e.len} m, przewraca i odrzuca bohaterów.`],
    r: ['Deszcz głazów', `${B.kolos.r.count} strefy spadają tam, gdzie stoją bohaterowie.`],
  },
  cien: {
    title: 'Zabójca',
    passive: ['Zwinność', `Prędkość ${num(B.cien.speedMul)}×, ale tylko ${num(B.cien.hpMul)}× HP.`],
    atk: 'Szybkie cięcie.',
    q: ['Teleport', `Skok do kursora (do ${B.cien.q.range} m), wybuch w punkcie startu.`],
    e: ['Zasłona', `Niewidzialność na ${num(B.cien.e.duration)} s; zadanie obrażeń ją przerywa.`],
    r: ['Wachlarz ostrzy', `${B.cien.r.count} pocisków w stożku ${B.cien.r.arc}°.`],
  },
  nekromanta: {
    title: 'Kontrola',
    passive: ['Martwa armia', 'Miniony nie dają punktów i nie liczą się do obrażeń bossa.'],
    atk: 'Wolny pocisk.',
    q: ['Przywołanie', `${B.nekromanta.q.count} szkielety po ${B.nekromanta.q.hp} HP gonią bohaterów (maks. ${B.nekromanta.q.max}).`],
    e: ['Wysysanie', `Promień przez ${B.nekromanta.e.duration} s: ${B.nekromanta.e.dps} dmg/s, leczy bossa ${Math.round(B.nekromanta.e.healPct * 100)}% HP/s.`],
    r: ['Kostnica', `Strefa ${B.nekromanta.r.radius} m na ${B.nekromanta.r.duration} s: spowolnienie ${Math.round(B.nekromanta.r.slow * 100)}% i ${B.nekromanta.r.dps} dmg/s.`],
  },
  burza: {
    title: 'Obszar',
    passive: ['Przeciążenie', `Co ${B.burza.overloadHits} trafienia następna umiejętność ma +${Math.round((B.burza.overloadArea - 1) * 100)}% obszaru.`],
    atk: 'Iskra o średnim zasięgu.',
    q: ['Piorun', `Uderzenie w punkt, promień ${B.burza.q.radius} m.`],
    e: ['Wir', `Przez ${B.burza.e.duration} s przyciąga bohaterów z ${B.burza.e.radius} m.`],
    r: ['Łańcuch błyskawic', `Przeskakuje między bohaterami w promieniu ${B.burza.r.jumpRadius} m (do ${B.burza.r.jumps} skoków).`],
  },
  smok: {
    title: 'Ogień',
    passive: ['Żar', `Co ${B.smok.passive.every} s zostawia pod sobą płonącą plamę.`],
    atk: 'Kula ognia.',
    q: ['Zionięcie', `Stożek ognia ${B.smok.q.arc}°, ${B.smok.q.range} m.`],
    e: ['Lot', `Skok do punktu (do ${B.smok.e.range} m), lądowanie z falą i odrzutem.`],
    r: ['Deszcz meteorów', `${B.smok.r.count} meteorów wokół bossa, połowa celuje w bohaterów.`],
  },
  szron: {
    title: 'Spowolnienie',
    passive: ['Wychłodzenie', `Każde trafienie spowalnia bohatera o ${Math.round(B.szron.passive.slow * 100)}% na ${num(B.szron.passive.duration)} s.`],
    atk: 'Lodowy odłamek.',
    q: ['Lodowa nova', `Krąg ${B.szron.q.radius} m wokół bossa.`],
    e: ['Lodowa ściana', `Linia ${B.szron.e.len} m: rani raz, potem przez ${B.szron.e.life} s spowalnia.`],
    r: ['Zamieć', `Strefa ${B.szron.r.radius} m na ${B.szron.r.life} s: spowolnienie i 1 dmg co ${num(B.szron.r.tick)} s.`],
  },
  pajeczyca: {
    title: 'Łowczyni',
    passive: ['Odnóża', `Szybka (${num(B.pajeczyca.speedMul)}×), ale ${num(B.pajeczyca.hpMul)}× HP.`],
    atk: 'Ukąszenie w łuku.',
    q: ['Sieć', `Pocisk, który unieruchamia trafionego na ${num(B.pajeczyca.q.stun)} s.`],
    e: ['Skok', `Na bohatera najbliższego kursorowi (do ${B.pajeczyca.e.range} m), strefa lądowania ${B.pajeczyca.e.radius} m.`],
    r: ['Gniazdo', `${B.pajeczyca.r.count} pajęczaki po ${B.pajeczyca.r.hp} HP (maks. ${B.pajeczyca.r.max}).`],
  },
  widmo: {
    title: 'Żniwiarz',
    passive: ['Żniwiarz', `Zabicie bohatera leczy ${Math.round(B.widmo.passive.healOnKill * 100)}% maks. HP.`],
    atk: 'Szerokie cięcie kosą.',
    q: ['Rzut kosą', 'Bumerang przez filary — trafia w obie strony.'],
    e: ['Strach', `Odpycha bohaterów w promieniu ${B.widmo.e.radius} m.`],
    r: ['Żniwa', `Pierścień zaciska się od ${B.widmo.r.from} m do bossa — przeskocz go dashem.`],
  },
};

/** @param {string} type */
export const rarityOf = (type) => RARITY[/** @type {keyof typeof RARITY} */ (B[type]?.rarity)] || RARITY.blue;
