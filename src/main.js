import { $, showScreen, setOverlay } from './ui/dom.js';
import { createGameView } from './ui/gameView.js';
import { createLocalGame } from './ui/localGame.js';
import { showLocalSetup } from './ui/localSetup.js';
import { showSummary } from './ui/summary.js';
import { installKeyboard, createKeyboardMouse, createKeyboard2 } from './input/keyboard.js';
import { createGamepad } from './input/gamepad.js';
import { createTouch, isTouchDevice } from './input/touch.js';
import { createBotDevice } from './input/bot.js';
import { unlockAudio } from './audio/sfx.js';
import { setupPwa, keepAwake } from './ui/pwa.js';
import { startOnlineUi } from './ui/onlineUi.js';

const canvas = /** @type {HTMLCanvasElement} */ ($('#game'));
const touchRoot = $('#touch');
const params = new URLSearchParams(location.search);

installKeyboard(canvas);
const gameView = createGameView(canvas, 'local');
gameView.start();
let touchDevice = /** @type {any} */ (null);
const getTouch = () => (touchDevice ??= createTouch(touchRoot));

const nickInput = /** @type {HTMLInputElement} */ ($('#nick'));
nickInput.value = safeGet('korona.nick') || '';
nickInput.addEventListener('change', () => safeSet('korona.nick', nickInput.value.trim()));

window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });
setupPwa($('#btn-install'));

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
  gameView.cam.mode = 'fit';
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

$('#btn-local').onclick = () => {
  const defaultDev = isTouchDevice() ? 'touch' : 'kbm';
  showLocalSetup(nickInput.value.trim(), startLocal, backToMenu);
  void defaultDev;
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && window.__korona?.mode === 'local') window.__korona.togglePause?.();
});

startOnlineUi({ gameView, nickInput, touchRoot, getTouch, params, backToMenu });
showScreen('#screen-start');

function safeGet(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* brak storage */
  }
}
