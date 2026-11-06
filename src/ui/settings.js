/**
 * Panel ustawień: głośności, wyciszenie, haptyka i ściąga ze sterowania.
 * Moduł audio ładowany dynamicznie dopiero przy otwarciu panelu (ekran startowy zostaje lekki).
 */
import { openModal } from './dom.js';

const SLIDERS = [
  ['master', 'Głośność ogólna'],
  ['music', 'Muzyka'],
  ['sfx', 'Efekty'],
];

const CONTROLS = [
  ['Ruch', 'WASD', 'IJKL', 'lewa gałka', 'joystick'],
  ['Celowanie', 'mysz', 'auto', 'prawa gałka', 'auto / ciągnij ATAK'],
  ['Atak', 'LPM', 'U', 'RT', 'ATAK'],
  ['Dash', 'Spacja', 'P', 'A', 'DASH'],
  ['Umiejętność', 'PPM / F', 'O', 'RB', 'UMIEJ.'],
  ['Boss', 'Q / E / R', '7 / 8 / 9', 'X / Y / B', 'Q / E / R'],
  ['Pauza', 'Esc', '', '', ''],
];

export async function openSettings() {
  const audio = await import('../audio/sfx.js');
  audio.unlockAudio?.();
  const s = audio.getSettings();
  const body = openModal({
    title: 'Ustawienia',
    cls: 'modal-settings',
    body: `
      <div class="set-grid">
        <section class="set-col">
          <h3>Dźwięk</h3>
          ${SLIDERS.map(
            ([k, l]) => `<label class="set-row"><span>${l}</span>
              <input type="range" class="px-range" min="0" max="100" step="5" data-set="${k}" value="${Math.round((s[k] ?? 0.8) * 100)}" style="--fill:${Math.round((s[k] ?? 0.8) * 100)}%" />
              <output data-out="${k}">${Math.round((s[k] ?? 0.8) * 100)}</output></label>`,
          ).join('')}
          <label class="set-row toggle"><span>Wycisz wszystko</span><input type="checkbox" class="px-check" data-set="muted" ${s.muted ? 'checked' : ''} /><i></i></label>
          <label class="set-row toggle"><span>Wibracje (telefon)</span><input type="checkbox" class="px-check" data-set="haptics" ${s.haptics !== false ? 'checked' : ''} /><i></i></label>
        </section>
        <section class="set-col">
          <h3>Sterowanie</h3>
          <table class="controls-table">
            <tr><th></th><th>Klaw. + mysz</th><th>Klaw. 2</th><th>Pad</th><th>Dotyk</th></tr>
            ${CONTROLS.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c ? `<kbd>${c}</kbd>` : ''}</td>` : `<th>${c}</th>`)).join('')}</tr>`).join('')}
          </table>
          <p class="small">Zadaj bossowi najwięcej obrażeń, by przejąć koronę po jego upadku. Każdy atak bossa ma czerwony telegraf — uciekaj dashem.</p>
        </section>
      </div>`,
  });
  for (const el of body.querySelectorAll('[data-set]')) {
    const inp = /** @type {HTMLInputElement} */ (el);
    const k = /** @type {string} */ (inp.dataset.set);
    inp.addEventListener('input', () => {
      if (inp.type === 'checkbox') audio.setSettings({ [k]: inp.checked });
      else {
        audio.setSettings({ [k]: Number(inp.value) / 100 });
        inp.style.setProperty('--fill', `${inp.value}%`);
        const out = body.querySelector(`[data-out="${k}"]`);
        if (out) out.textContent = inp.value;
      }
      if (k === 'haptics' && inp.checked) audio.vibrate?.(30);
      else audio.play?.('click');
    });
  }
}
