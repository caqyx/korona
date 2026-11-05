# KORONA

Arena PvP 2D top-down dla 2–6 graczy w przeglądarce (PWA). Na arenie jest jeden boss — kto zada mu ostatni cios, przejmuje koronę i sam staje się bossem. Pełny projekt: [`GDD.md`](GDD.md).

## Uruchomienie

```bash
npm install
```

```bash
npm run dev
```

Otwórz http://localhost:5173. Bez kluczy Supabase tryb online działa przez `LocalTransport` (karty tej samej przeglądarki — otwórz 2–3 karty, stwórz pokój w jednej, dołącz kodem w pozostałych). Tryb lokalny (jeden ekran, 2–4 graczy, boty) działa zawsze, także offline.

| Skrypt | Co robi |
|---|---|
| `npm run dev` | serwer deweloperski Vite |
| `npm run build` | build produkcyjny + Service Worker (`dist/`) |
| `npm run preview` | podgląd buildu na :4173 |
| `npm test` | testy jednostkowe (Vitest) |
| `npm run test:e2e` | testy E2E (Playwright, 3 osobne konteksty, LocalTransport) |
| `npm run lint` | ESLint |
| `npm run balance` | 200 meczów bot vs bot w samej symulacji + bramki balansu |

Parametry URL (debug/testy): `?transport=local` wymusza transport lokalny, `?relay=1` wyłącza WebRTC (tylko przekaźnik), `?bot=1` steruje botem, `?speed=8` przyspiesza symulację hosta, `?score=N` nadpisuje wynik urządzenia, `?target=N` zmienia cel punktowy, `?ice=none` bez STUN.

## Publikacja na GitHub Pages

Pages nie może serwować plików źródłowych — gra musi być zbudowana (`dist/`). Robi to workflow `.github/workflows/deploy.yml`:
1. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions** (nie „Deploy from a branch”).
2. Push na `main` (lub tę gałąź) albo **Actions → Deploy na GitHub Pages → Run workflow**.
3. Gra będzie pod `https://<użytkownik>.github.io/<repo>/` — workflow ustawia `BASE_PATH=/<repo>/`.
4. (Opcjonalnie, online przez Supabase) **Settings → Secrets and variables → Actions → Variables**: dodaj `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`. Bez nich działa tryb lokalny i online w kartach jednej przeglądarki.

## Konfiguracja Supabase krok po kroku

1. Utwórz projekt na https://supabase.com (dla tego repo już istnieje: `korona`, ref `stnsislxdqqewbaichur`).
2. Zastosuj migracje z `supabase/migrations/` w kolejności nazw: SQL Editor → wklej i uruchom, albo `npx supabase link --project-ref <ref>` i `npx supabase db push`. Migracje tworzą `profiles`, `rooms`, `matches`, `match_results`, polityki RLS, indeksy i zadanie pg_cron sprzątające stare pokoje.
3. **Authentication → Sign In / Providers → Allow anonymous sign-ins** → włącz.
4. **Project Settings → API Keys** → skopiuj URL projektu i klucz publishable (lub legacy anon).
5. Skopiuj `.env.example` do `.env` i wpisz `VITE_SUPABASE_URL` oraz `VITE_SUPABASE_ANON_KEY`.
6. (Opcjonalnie) TURN: `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`.
7. `npm run dev` — na ekranie startowym pojawi się „Online przez Supabase Realtime + WebRTC”.

Realtime (Presence i Broadcast) nie wymaga dodatkowej konfiguracji — używane są publiczne kanały `room:{kod}`.

## Sterowanie

| Akcja | Klawiatura + mysz | Klawiatura 2 (lokalnie) | Gamepad | Dotyk |
|---|---|---|---|---|
| Ruch | WASD | IJKL | lewa gałka | wirtualny joystick (lewa strona) |
| Celowanie | mysz | auto-aim | prawa gałka (bez — auto-aim) | auto-aim, przeciągnij ATAK |
| Atak | LPM | U | RT | ATAK |
| Dash | Spacja | P | A | DASH |
| Umiejętność bohatera | PPM lub F | O | RB | UMIEJ. |
| Umiejętności bossa | Q / E / R | 7 / 8 / 9 | X / Y / B | Q / E / R (po przejęciu korony) |
| Pauza (lokalnie) | Esc | | | |

## Architektura w 10 zdaniach

1. `src/sim/` to czysta, deterministyczna symulacja: `step(state, inputsByPlayer, dt, rng)` ze stałym krokiem 1/60 s, bez DOM, sieci, zegara i `Math.random` — pilnuje tego test architektury i reguły ESLint.
2. Cały stan meczu (z RNG mulberry32 i cooldownami) to jeden obiekt JSON, więc dowolny klient może wznowić grę z ostatniego snapshotu.
3. Bohaterowie (`sim/heroes/`) i bossowie (`sim/bosses/`) są osobnymi modułami; każda akcja bossa przechodzi przez maszynę stanów telegraf → efekt, a strefy z telegrafem obsługuje generycznie `sim/zones.js`.
4. Reguły korony, punktacji, gorączki, losowania bossa bez powtórki i DNF są w `sim/rules.js`, a wszystkie liczby balansu w `sim/config.js`.
5. `src/net/transport.js` definiuje jeden interfejs (Presence + wiadomości) z dwiema implementacjami: Supabase Realtime i `BroadcastChannel`.
6. Sygnalizacja WebRTC idzie przez transport; topologia to gwiazda z hostem, z kanałem `state` (bez retransmisji) i `events` (niezawodnym), a dopóki DataChannel nie działa, ruch automatycznie idzie przekaźnikiem.
7. Host (`net/host.js`) zbiera inputy, liczy `step()` 60 Hz i wysyła snapshot 20 Hz; klient (`net/client.js`) wysyła input 30 Hz i renderuje z bufora interpolacji opóźnionego o 100 ms.
8. `net/election.js` liczy wynik urządzenia z benchmarku `step()`, ustala deterministyczny ranking hosta i następcy, rozstrzyga konflikty `epoch` i warunki migracji planowanej, a `net/session.js` wykonuje migracje (handoff, `host_claim`, odliczanie).
9. Każda wiadomość z sieci przechodzi przez walidację w `net/messages.js`, a w bazie zapis wyników chronią polityki RLS (tylko host meczu).
10. Warstwa `render/` (Canvas 2D, neon, juice), `input/` (klawiatura, pady, dotyk, bot), `audio/` (WebAudio) i `ui/` tylko czytają stan — update i render są rozdzielone.

## Dokumenty
- [`docs/decisions.md`](docs/decisions.md) — decyzje projektowe i zmiany balansu
- [`docs/known-issues.md`](docs/known-issues.md) — znane problemy
- [`docs/TODO-human.md`](docs/TODO-human.md) — co trzeba zrobić ręcznie
