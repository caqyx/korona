import { SKINS } from '../config.js';
import { fireHeroProjectile } from './common.js';

const A = SKINS.lucznik.ability;

/**
 * Naładowany strzał wstrzymany ogłuszeniem: `abilT` zatrzymuje się na tej wartości zamiast spaść do 0
 * (0 znaczyłoby „nie ładuję”). 0,001 przechodzi przez kwantyzację snapshotu do 3 miejsc.
 */
const HELD = 0.001;

/**
 * Przeszywający strzał: ładowanie (ability.charge), potem pocisk przebijający wszystko (ability.dmg).
 * Ogłuszenie w trakcie ładowania: licznik biegnie dalej, ale ogłuszony nie strzela — gotowy strzał
 * czeka (`HELD`) i wychodzi w pierwszym kroku po ogłuszeniu, w aktualnym kierunku celowania.
 * (Alternatywy odrzucone: zamrożenie licznika — ogłuszenie przedłużało ładowanie; anulowanie —
 * jedno trafienie kasowałoby umiejętność z 7 s odnowienia.)
 */
export const lucznik = {
  /** @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h */
  start(state, h) {
    h.abilT = A.charge;
    h.abilCd = A.cd;
    state.events.push({ t: 'charge', id: h.id });
    return true;
  },
  /**
   * @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h @param {number} dt
   * @param {boolean} [canAct] false, gdy bohater jest ogłuszony
   */
  update(state, h, dt, canAct = true) {
    if (h.abilT <= 0) return;
    h.abilT -= dt;
    if (h.abilT > 0) return;
    if (!canAct) {
      h.abilT = HELD;
      return;
    }
    h.abilT = 0;
    h.atkCd = Math.max(h.atkCd, SKINS.lucznik.attack.cd);
    fireHeroProjectile(state, h, A.dmg * (h.mods?.dmg ?? 1), A.speed, A.range, A.r, true, 'pierce');
    state.events.push({ t: 'ability', id: h.id, skin: 'lucznik' });
  },
  blocksAttack: (h) => h.abilT > 0,
  moveMul: (h) => (h.abilT > 0 ? 0.5 : 1),
};
