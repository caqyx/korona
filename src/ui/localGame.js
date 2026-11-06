import { createMatchState, step, cloneState } from '../sim/index.js';
import { DT, MATCH } from '../sim/config.js';
import { MAP_IDS } from '../sim/maps.js';

/**
 * Tryb lokalny: 2–8 graczy (ludzie + boty) na jednym ekranie, bez sieci i Supabase.
 * @param {{slots:{id:string,nick:string,skin:string,device:{read:Function}}[], seed:number, targetScore?:number, speed?:number,
 *   mode?:'crown'|'survival'|'bossrush', mapId?:string, aiLevel?:'easy'|'normal'|'hard'}} opts
 * @param {(state:any)=>void} onEnd
 */
export function createLocalGame(opts, onEnd) {
  const mapId = !opts.mapId || opts.mapId === 'random' ? MAP_IDS[opts.seed % MAP_IDS.length] : opts.mapId;
  const state = createMatchState({
    seed: opts.seed,
    players: opts.slots.map((s) => ({ id: s.id, nick: s.nick, skin: s.skin })),
    targetScore: opts.targetScore,
    maxPlayers: MATCH.maxPlayersLocal,
    mode: opts.mode || 'crown',
    mapId,
    aiLevel: opts.aiLevel || 'normal',
  });
  let acc = 0;
  let ended = false;
  let paused = false;
  const speed = opts.speed || 1;
  return {
    state,
    togglePause() {
      paused = !paused;
    },
    /** @type {import('./gameView.js').FrameSource['frame']} */
    frame(dt) {
      const events = [];
      if (!paused && !ended) {
        acc += dt * speed;
        let n = 0;
        while (acc >= DT && n < 12 * speed) {
          acc -= DT;
          n++;
          const inputs = {};
          for (const s of opts.slots) {
            const me = state.players.find((p) => p.id === s.id);
            inputs[s.id] = s.device.read(state, me);
          }
          step(state, inputs);
          events.push(...state.events);
          if (state.phase === 'ended') {
            ended = true;
            setTimeout(() => onEnd(cloneState(state)), 1500);
            break;
          }
        }
      }
      const humans = opts.slots.filter((s) => s.device.kind !== 'bot').map((s) => s.id);
      return { view: state, events, meIds: humans, overlay: paused ? 'PAUZA' : null };
    },
  };
}
