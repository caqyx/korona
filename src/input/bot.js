import { botInput } from '../sim/bot.js';
import { makeRng } from '../sim/rng.js';

/** Urządzenie „bot” — proste AI inputu (tryb lokalny, testy E2E). */
export function createBotDevice(seed, level = 'normal') {
  const rng = makeRng({ s: seed >>> 0 || 1 });
  return {
    kind: 'bot',
    label: 'Bot',
    read(state, me) {
      return botInput(state, me ? me.id : '', rng, level);
    },
  };
}
