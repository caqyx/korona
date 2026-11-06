import { describe, it, expect } from 'vitest';
import { COSMETICS, DEFAULT_LOOK, sanitizeLook, isAvailable, findCosmetic, rewardFor, cosmeticsOf } from '../../src/sim/cosmetics.js';
import { ACHIEVEMENTS, applyMatch } from '../../src/ui/achievements.js';
import { validatePresence } from '../../src/net/messages.js';
import { createMatchState } from '../../src/sim/state.js';
import { SKIN_IDS } from '../../src/sim/config.js';

describe('kosmetyki', () => {
  it('każdy rodzaj ma darmową opcję domyślną i unikalne id', () => {
    for (const kind of ['color', 'hat', 'nose']) {
      const list = cosmeticsOf(kind);
      expect(list.some((c) => c.id === DEFAULT_LOOK[kind] && c.unlock === null)).toBe(true);
      expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
      expect(list.filter((c) => c.unlock === null).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('każda nagroda wskazuje istniejące osiągnięcie, a skiny klas istniejącą klasę', () => {
    const ach = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const c of COSMETICS) {
      if (c.unlock) expect(ach.has(c.unlock), c.id).toBe(true);
      if (c.cls) expect(SKIN_IDS).toContain(c.cls);
    }
    for (const a of ACHIEVEMENTS) {
      const r = rewardFor(a.id);
      expect(r, a.id).toBeTruthy();
      expect(a.rewardId).toBe(`${r.kind}:${r.id}`);
    }
  });

  it('sanitizeLook: nieznane id → domyślne, skin innej klasy → kolor klasyczny', () => {
    expect(sanitizeLook(null)).toEqual(DEFAULT_LOOK);
    expect(sanitizeLook({ color: 'hack', hat: 'party', nose: 42 })).toEqual({ ...DEFAULT_LOOK, hat: 'party' });
    expect(sanitizeLook({ color: 'gold_knight' }, 'mag').color).toBe('default');
    expect(sanitizeLook({ color: 'gold_knight' }, 'rycerz').color).toBe('gold_knight');
    expect(sanitizeLook({ ['__proto__']: { hat: 'x' } })).toEqual(DEFAULT_LOOK);
  });

  it('isAvailable: darmowe od razu, nagrody po osiągnięciu, skiny tylko swojej klasie', () => {
    const copper = findCosmetic('color', 'copper');
    expect(isAvailable(copper, [], 'mag')).toBe(false);
    expect(isAvailable(copper, ['first_match'], 'mag')).toBe(true);
    const gold = findCosmetic('color', 'gold_knight');
    expect(isAvailable(gold, ['wins_10'], 'mag')).toBe(false);
    expect(isAvailable(gold, ['wins_10'], 'rycerz')).toBe(true);
    expect(isAvailable(findCosmetic('hat', 'party'), [], 'druid')).toBe(true);
  });

  it('osiągnięcie z meczu odblokowuje nagrodę (statystyki → postęp)', () => {
    const st = createMatchState({ seed: 1, players: [{ id: 'A', nick: 'A', skin: 'mag' }, { id: 'B', nick: 'B', skin: 'rycerz' }] });
    st.winnerId = 'A';
    st.endReason = 'score';
    const s = applyMatch({ matches: 0, wins: 0, onlineWins: 0, crowns: 0, crownTime: 0, damage: 0, bossKills: 0, flawless: 0, bestWave: 0, bossrushClear: 0, bossTypes: [], winClasses: [], maps: [] }, st, 'A');
    expect(s.matches).toBe(1);
    expect(s.wins).toBe(1);
    expect(s.flawless).toBe(1);
    expect(s.winClasses).toEqual(['mag']);
  });

  it('wygląd trafia do stanu meczu (sanitizowany) i przechodzi walidację presence', () => {
    const st = createMatchState({ seed: 1, players: [{ id: 'A', nick: 'A', skin: 'mag', look: { color: 'fire_mage', hat: 'diadem', nose: 'clown' } }, { id: 'B', nick: 'B', skin: 'druid', look: { color: 'fire_mage' } }] });
    expect(st.players[0].look).toEqual({ color: 'fire_mage', hat: 'diadem', nose: 'clown' });
    expect(st.players[1].look.color).toBe('default');
    const pres = { userId: 'u1', nick: 'A', skin: 'mag', deviceScore: 1, joinedAt: 1, ready: false, look: { color: 'royal', hat: 'none', nose: 'round' } };
    expect(validatePresence(pres)).toBe(true);
    expect(validatePresence({ ...pres, look: { color: 'x'.repeat(200) } })).toBe(false);
    expect(validatePresence({ ...pres, look: 'red' })).toBe(false);
  });
});
