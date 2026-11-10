/** PWA: przycisk instalacji (beforeinstallprompt), Wake Lock, rejestracja SW. */
let deferredPrompt = /** @type {any} */ (null);
let wakeLock = /** @type {any} */ (null);

/**
 * @param {HTMLElement} btn przycisk „Zainstaluj”
 * @param {HTMLElement} updateBtn przycisk „Aktualizuj” (pokazywany, gdy nowa wersja czeka)
 */
export function setupPwa(btn, updateBtn) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.classList.remove('hidden');
  });
  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    btn.classList.add('hidden');
  });
  window.addEventListener('appinstalled', () => btn.classList.add('hidden'));
  if (import.meta.env.PROD && 'serviceWorker' in navigator) registerServiceWorker(updateBtn);
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
}

/**
 * Rejestruje service workera PO starcie (zdarzenie `load`), żeby nie konkurował z pierwszym malowaniem.
 * Nowa wersja pobiera się w tle i NIE przeładowuje otwartej aplikacji: wchodzi przy następnym
 * uruchomieniu albo po kliknięciu „Aktualizuj”. Wcześniej (autoUpdate) każde wdrożenie kończyło się
 * wymuszonym przeładowaniem kilka sekund po otwarciu — aplikacja „otwierała się dwa razy”.
 * @param {HTMLElement} updateBtn
 */
function registerServiceWorker(updateBtn) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const applyUpdate = registerSW({
        onNeedRefresh() {
          updateBtn.classList.remove('hidden');
        },
      });
      updateBtn.addEventListener('click', () => {
        updateBtn.textContent = 'Aktualizuję…';
        applyUpdate(true);
      });
    })
    .catch(() => {});
}

/** Wake Lock podczas meczu (mobile). @param {boolean} on */
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await /** @type {any} */ (navigator).wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock === null && document.body.dataset.inMatch === '1') keepAwake(true);
});
