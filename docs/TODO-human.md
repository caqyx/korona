# Do zrobienia przez człowieka

Projekt Supabase **`korona`** (ref `stnsislxdqqewbaichur`, region eu-central-1) został utworzony, a migracje z `supabase/migrations/` są już na nim zastosowane (tabele, RLS, indeksy, pg_cron co 15 min).

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
