# Do zrobienia przez człowieka

Projekt Supabase **`korona`** (ref `stnsislxdqqewbaichur`, region eu-central-1) został utworzony, a migracje z `supabase/migrations/` są już na nim zastosowane (tabele, RLS, indeksy, pg_cron co 15 min).

## 0. Zastosuj migrację `20261105000003_harden_room_timestamps.sql`
Migracje 0001 i 0002 są już na projekcie. Trzecia (serwer ustawia `created_at/updated_at` w `rooms`, żeby pokoje nie omijały sprzątania) **nie została zastosowana** — narzędzie Supabase poprosiło o potwierdzenie (zawiera `drop trigger`), a w sesji nikt nie odpowiedział. Uruchom jej treść w Dashboard → SQL Editor albo `npx supabase db push`.

## 0b. Zastosuj migrację `20261106000004_new_skins.sql`
Dodaje nowe klasy (mag, barbarzynca, druid) do ograniczeń `profiles.favorite_skin` i `match_results.skin`. Bez niej zapis wyniku meczu online z nową klasą zostanie odrzucony (gra działa, tylko wynik się nie zapisze). Uruchom treść w SQL Editor.

## 1. Włącz anonimowe logowanie (wymagane dla trybu online przez Supabase)
Nie da się tego zrobić przez SQL ani narzędzia, którymi dysponowała sesja.
1. Otwórz https://supabase.com/dashboard/project/stnsislxdqqewbaichur/auth/providers
2. **Authentication → Sign In / Providers → Allow anonymous sign-ins** → włącz → Save.
3. (Zalecane) **Authentication → Attack Protection**: włącz CAPTCHA lub limit tworzenia anonimowych kont, żeby nikt nie zaśmiecał bazy kontami.

## 2. Plik `.env`
Lokalny `.env` (nie jest w repo) powinien zawierać:
```
VITE_SUPABASE_URL=https://stnsislxdqqewbaichur.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key z Settings → API Keys>
```
Klucz publishable odczytasz w Dashboard → Project Settings → API Keys (jest publiczny z założenia — chroni RLS).

## 3. Sprawdź tryb online na prawdziwym Supabase
Sieć kontenera, w którym budowano grę, blokowała `*.supabase.co`, więc **SupabaseTransport nie był uruchomiony na żywo** (tylko LocalTransport w E2E). Po kroku 1–2:
1. `npm run dev`, otwórz 2–3 przeglądarki/urządzenia (np. telefon w tej samej sieci: `npm run dev -- --host`).
2. Stwórz pokój, dołącz kodem, Gotowy → Start.
3. Po meczu w Dashboard → Table Editor sprawdź wiersze w `matches` i `match_results`.
Jeśli coś nie działa: konsola przeglądarki i `window.__korona.debug()` (rola, host, epoch, łącza, log migracji).

## 4. TURN (opcjonalnie)
Bez TURN gracze za restrykcyjnym NAT-em grają przez przekaźnik Supabase (10 Hz). Dla płynności ustaw w `.env` `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` (np. Cloudflare Calls TURN, metered.ca, coturn).

## 5. Hosting
`npm run build` → wrzuć `dist/` na dowolny statyczny hosting z HTTPS (Netlify, Vercel, Cloudflare Pages). HTTPS jest wymagany dla Service Workera, Wake Lock i instalacji PWA.

## 6. Lighthouse
Lighthouse nie był dostępny w sesji. Instalowalność sprawdza test E2E (`Page.getInstallabilityErrors` z Chrome — ta sama lista co w Lighthouse). Dla pełnego raportu: `npx lighthouse https://twoj-host --view`.

## 7. Ręczne testy, których nie da się zautomatyzować
- Prawdziwe pady (Xbox/PS) w trybie lokalnym — mapowanie „standard gamepad”.
- Sterowanie dotykowe na telefonie (zainstalowana PWA, orientacja pozioma, Wake Lock).

## 8. Bezpieczeństwo przed publicznym udostępnieniem (wynik przeglądu QA)
- **Kanały Realtime są publiczne**: znając kod pokoju i klucz anon, można podszyć się pod `from` (np. hosta). Między znajomymi to akceptowane ryzyko (GDD 6.6); dla obcych: włącz private channels (`config: { private: true }`) z RLS na `realtime.messages` ograniczającym topic do członków pokoju.
- **Ranking wyników można sfałszować**: każdy zalogowany może wstawić własny `matches` (jako host) i dowolne `match_results`. Przed rankingiem globalnym potrzebna weryfikacja po stronie serwera (Edge Function lub tabela uczestników).
- `rooms_select using (true)` pozwala wylistować kody pokoi; rozważ RPC `find_room(code)` zamiast pełnego SELECT.
