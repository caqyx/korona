import { $, showScreen, setOverlay } from './dom.js';
import { createGameView } from './gameView.js';
import { createLocalGame } from './localGame.js';
import { showLocalSetup } from './localSetup.js';
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
  const getTouch = () => (touchDevice ??= createTouch(touchRoot));

  const nickInput = /** @type {HTMLInputElement} */ ($('#nick'));
  unlockAudio();

  /** Tworzy urządzenie wejścia z nazwy. */
  function makeDevice(name, i) {
    if (name === 'kbm') return createKeyboardMouse(gameView);
    if (name === 'kb2') return createKeyboard2();
    if (name.startsWith('pad')) return createGamepad(Number(name.slice(3)));
    if (name === 'touch') return getTouch();
    return createBotDevice(1000 + i * 77);
  }

  function backToMenu() {
    gameView.setSource(null);
    touchRoot.classList.add('hidden');
    setOverlay(null);
    keepAwake(false);
    showScreen('#screen-start');
  }

  function startLocal(slots) {
    const players = slots.map((s, i) => ({ id: `L${i + 1}`, nick: s.nick || `Gracz ${i + 1}`, skin: s.skin, device: makeDevice(s.device, i) }));
    touchRoot.classList.toggle('hidden', !slots.some((s) => s.device === 'touch'));
    // jeden człowiek na dotyku: kamera za graczem (na telefonie cała arena jest za mała)
  const humans = slots.filter((s) => s.device !== 'bot');
  gameView.cam.mode = humans.length === 1 && humans[0].device === 'touch' ? 'follow' : 'fit';
    const target = Number(params.get('target')) || undefined;
    const game = createLocalGame({ slots: players, seed: (Date.now() & 0xffffffff) >>> 0, targetScore: target, speed: Number(params.get('speed')) || 1 }, (finalState) => {
      touchRoot.classList.add('hidden');
      keepAwake(false);
      showSummary(finalState, { canRematch: true, onRematch: () => startLocal(slots), onBack: backToMenu });
    });
    window.__korona = { mode: 'local', getState: () => game.state };
    gameView.setSource(game);
    showScreen(null);
    keepAwake(true);
  }

  function openLocal() {
    showLocalSetup(nickInput.value.trim(), startLocal, backToMenu, isTouchDevice() ? 'touch' : 'kbm');
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && window.__korona?.mode === 'local') window.__korona.togglePause?.();
  });

  const online = startOnlineUi({ gameView, nickInput, touchRoot, getTouch, params, backToMenu });
  return { openLocal, enterOnline: online.enter };
}
