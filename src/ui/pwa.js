/** PWA: przycisk instalacji (beforeinstallprompt), Wake Lock, rejestracja SW. */
let deferredPrompt = /** @type {any} */ (null);
let wakeLock = /** @type {any} */ (null);

/** @param {HTMLElement} btn */
export function setupPwa(btn) {
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
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
  }
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
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
