import { $, showScreen, setOverlay } from './dom.js';
import { createGameView } from './gameView.js';
import { createLocalGame } from './localGame.js';
import { showLocalSetup } from './localSetup.js';
import { showModeSelect } from './modeSelect.js';
import { recordMatch } from './achievements.js';
import { getActiveLook } from './profile.js';
import { showAchievementToast } from './toast.js';
import { showSummary } from './summary.js';
import { installKeyboard, createKeyboardMouse, createKeyboard2 } from '../input/keyboard.js';
import { createGamepad } from '../input/gamepad.js';
import { createTouch, isTouchDevice } from '../input/touch.js';
import { createBotDevice } from '../input/bot.js';
import { unlockAudio } from '../audio/sfx.js';
import { keepAwake } from './pwa.js';
import { startOnlineUi } from './onlineUi.js';

/**
 * Rdzeń gry ładowany leniwie (dopiero po kliknięciu w menu): renderer, symulacja,
 * wejście, audio, tryb lokalny i online.
 */
export function createCore() {
  const canvas = /** @type {HTMLCanvasElement} */ ($('#game'));
  const touchRoot = $('#touch');
  const params = new URLSearchParams(location.search);

  installKeyboard(canvas);
  const gameView = createGameView(canvas, 'local');
  gameView.start();
  let touchDevice = /** @type {any} */ (null);
  const getTouch = () => {
    if (!touchDevice) {
      touchDevice = createTouch(touchRoot);
      gameView.aimSource = (me) => touchDevice.aimPreview(me);
    }
    return touchDevice;
  };

  const nickInput = /** @type {HTMLInputElement} */ ($('#nick'));
  unlockAudio();

  /** Tworzy urządzenie wejścia z nazwy. */
  function makeDevice(name, i, level = 'normal') {
    if (name === 'kbm') return createKeyboardMouse(gameView);
    if (name === 'kb2') return createKeyboard2();
    if (name.startsWith('pad')) return createGamepad(Number(name.slice(3)));
    if (name === 'touch') return getTouch();
    return createBotDevice(1000 + i * 77, level);
  }

  function backToMenu() {
    gameView.setSource(null);
    touchRoot.classList.add('hidden');
    setOverlay(null);
    keepAwake(false);
    showScreen('#screen-start');
  }

  /** @param {any[]} slots @param {{mode?:string, mapId?:string, aiLevel?:string}} [opts] */
  async function startLocal(slots, opts = {}) {
    // gracz 1 (pierwszy slot, jeśli nie jest botem) dostaje swój wygląd z profilu
    if (slots[0] && slots[0].device !== 'bot') slots[0] = { ...slots[0], look: await getActiveLook(slots[0].skin) };
    const level = opts.aiLevel || 'normal';
    const players = slots.map((s, i) => ({ id: `L${i + 1}`, nick: s.nick || `Gracz ${i + 1}`, skin: s.skin, device: makeDevice(s.device, i, level), look: s.look }));
    touchRoot.classList.toggle('hidden', !slots.some((s) => s.device === 'touch'));
    // jeden człowiek na dotyku: kamera za graczem (na telefonie cała arena jest za mała)
  const humans = slots.filter((s) => s.device !== 'bot');
  gameView.cam.mode = humans.length === 1 && humans[0].device === 'touch' ? 'follow' : 'fit';
    const target = Number(params.get('target')) || undefined;
    const game = createLocalGame({ slots: players, seed: (Date.now() & 0xffffffff) >>> 0, targetScore: target, speed: Number(params.get('speed')) || 1, mode: /** @type {any} */ (opts.mode), mapId: opts.mapId, aiLevel: /** @type {any} */ (level) }, (finalState) => {
      touchRoot.classList.add('hidden');
      keepAwake(false);
      const unlocked = recordMatch(finalState, 'L1');
      showSummary(finalState, { canRematch: true, onRematch: () => startLocal(slots, opts), onBack: backToMenu });
      if (unlocked.length) showAchievementToast(unlocked);
    });
    window.__korona = { mode: 'local', getState: () => game.state };
    gameView.setSource(game);
    showScreen(null);
    keepAwake(true);
  }

  function openLocal() {
    const firstDevice = isTouchDevice() ? 'touch' : 'kbm';
    showModeSelect({
      nick: nickInput.value.trim(),
      firstDevice,
      onStart: startLocal,
      onCustom: () => showLocalSetup(nickInput.value.trim(), startLocal, openLocal, firstDevice),
      onBack: backToMenu,
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && window.__korona?.mode === 'local') window.__korona.togglePause?.();
  });

  const online = startOnlineUi({
    gameView,
    nickInput,
    touchRoot,
    getTouch,
    params,
    backToMenu,
    onMatchRecorded: (state, meId, o) => {
      const unlocked = recordMatch(state, meId, o);
      if (unlocked.length) showAchievementToast(unlocked);
    },
  });
  return { openLocal, enterOnline: online.enter };
}
