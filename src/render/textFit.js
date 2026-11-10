/**
 * Dopasowanie rozmiaru napisu do szerokości z pamięcią wyniku. Pomiar (`ctx.font` + `measureText`
 * w pętli) jest drogi, a HUD pyta o te same napisy co klatkę — wynik trzymany jest pod kluczem
 * tekst|rozmiar|szerokość. Czysty moduł: pomiar wstrzykiwany, więc testowalny bez canvasa.
 */

/** Domyślna pojemność pamięci (wpisy); po jej przekroczeniu wypada najstarszy. */
const FIT_CACHE_MAX = 96;

/**
 * @param {number} [max] największa liczba zapamiętanych wyników
 * @returns {{fit:(measure:(str:string,size:number)=>number, str:string, size:number, minSize:number, maxW:number)=>number,
 *   clear:()=>void, size:()=>number}}
 */
export function createFitCache(max = FIT_CACHE_MAX) {
  /** @type {Map<string, number>} */
  const cache = new Map();
  return {
    /**
     * Największy rozmiar ≤ `size` (krokiem 1, nie mniej niż `minSize`), przy którym `str` mieści się w `maxW`.
     * @param {(str:string, size:number)=>number} measure szerokość napisu dla rozmiaru
     */
    fit(measure, str, size, minSize, maxW) {
      const key = `${str}|${size}|${minSize}|${Math.round(maxW)}`;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      let s = size;
      while (s > minSize && measure(str, s) > maxW) s -= 1;
      if (cache.size >= max) cache.delete(/** @type {string} */ (cache.keys().next().value));
      cache.set(key, s);
      return s;
    },
    /** Unieważnia wszystko (np. po doładowaniu fontu pomiary się zmieniają). */
    clear: () => cache.clear(),
    size: () => cache.size,
  };
}
