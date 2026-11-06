# Decyzje projektowe

Format: **kontekst → wybór (alternatywa)**.

## Symulacja i zasady
1. **Friendly fire między bohaterami** — GDD nie mówi o PvP bohaterów. → Bohaterowie nie ranią się nawzajem; rywalizują wyłącznie o ostatni cios. (Alt.: pełne PvP — rozbiłoby współpracę z filaru 1.)
2. **Kolejność przejęcia korony** — GDD 2: slow-mo 1,5 s, potem zamiana. → Boss ginie od razu (`dying`), przez 1,5 s czasu rzeczywistego świat biegnie z prędkością 0,3, a zamiana ról następuje na końcu przejścia. Podniesienie korony ze środka też przechodzi przez ruletkę. (Alt.: natychmiastowa zamiana — gorzej czytelne.)
3. **Hit-stop** — czysto wizualny (render zamraża klatkę na 50 ms przy trafieniu własną postacią), symulacja się nie zatrzymuje, żeby nie psuć determinizmu i sieci. (Alt.: pauza w `step` — wymagałaby synchronizacji.)
4. **Telegraf także dla ataku podstawowego bossa i umiejętności bez obrażeń** — GDD: „każda umiejętność ma telegraf 0,4–0,8 s”. → Wszystkie akcje bossa (atk/Q/E/R) przechodzą przez maszynę stanów `cast → fire` z telegrafem; umiejętności bez obrażeń (Zasłona, Wir, Wysysanie, Przywołanie) mają czerwony znacznik przerywaną linią.
5. **Łańcuch błyskawic** — zrealizowany jako 1 + do 4 skoków (maks. 5 celów) ze strefami 0,5 s na pozycjach celów w chwili rzutu; da się uciec. (Alt.: natychmiastowe trafienie — łamie filar 2.)
6. **Wysysanie** — cel: najbliższy bohater do kursora w zasięgu 7 m; przerwanie > 8,5 m; tick 1 dmg co 1 s (2 dmg łącznie), leczenie ciągłe 4%/s.
7. **Zabójstwa przez miniony** liczą się bossowi jako „zabicie bohatera jako boss” (+3). Miniony znikają przy zmianie bossa.
8. **Wyjście z meczu (DNF)** — gracz zostaje w tabeli z flagą `dnf`, nie może wygrać, jego punkty są zamrożone. Gdy zostaje < 2 aktywnych graczy — mecz kończy się zwycięstwem lidera (`forfeit`).
9. **Odrodzenie zwykłe** — 3 s jak w GDD + 2 s nietykalności (GDD określa tylko 2 s dla byłego bossa; to samo dla wszystkich upraszcza czytelność i ogranicza spawn-kill).
10. **Remis na limit czasu** — lider = najwięcej punktów, potem dłuższy czas w koronie, potem id.
11. **Skin zmieniany tylko podczas odrodzenia** — pole `skin` w inpucie jest stosowane wyłącznie, gdy postać jest martwa.
12. **Gorączka** — +10% przy 40 s, potem +10% co pełne 10 s, maks. +50% (czyli od 80 s).
13. **Losowanie bossa bez powtórki** — pierwszy boss losowany z 4, później z 3 pozostałych; ruletka pokazuje te 3 ikony.
14. **`step()` mutuje przekazany stan** i go zwraca (zamiast kopiować) — 60 Hz × klon stanu byłby zbędnym kosztem. Funkcja nie dotyka niczego poza argumentami, więc pozostaje deterministyczna.
15. **RNG w `rules.js`** — wiązany na czas kroku przez `bindRng` (zamiast przeciągania RNG przez wszystkie funkcje obrażeń). Wywołania są synchroniczne, więc nie ma przecieku między symulacjami.

## Sieć
16. **LocalTransport w E2E między kontekstami** — `BroadcastChannel` nie działa między kontekstami Playwright. → Transport ma opcjonalny most `window.__koronaBridgeSend/__koronaBridgeReceive`, który test podpina przez `exposeBinding`. Aplikacja poza testami go nie używa. (Alt.: lokalny serwer WebSocket — trzeci transport.)
17. **Przekaźnik jako stan domyślny** — dopóki DataChannel nie jest otwarty, wiadomości do peera idą przez przekaźnik (transport). Fallback jest więc automatyczny i bez przerwy w grze; `?relay=1` wymusza sam przekaźnik.
18. **Inputy przez przekaźnik** — przekaźnik wysyła tylko najnowszy snapshot/input z okna 1/Hz, ale bity przycisków z odrzuconych inputów są OR-owane, by nie gubić krótkich wciśnięć. Host robi to samo dla inputów, które przyszły między krokami.
19. **Interpolacja po czasie odbioru** (100 ms za najnowszym snapshotem) zamiast po ticku — działa także przy przyspieszonym czasie (`?speed=`) i slow-mo.
20. **Kwantyzacja snapshotu** do 3 miejsc po przecinku przy serializacji — snapshot jest mniejszy, a wznowienie z niego po migracji jest poprawne (determinizm między hostami nie jest wymagany).
21. **Start meczu** — właściciel klika Start; jeśli nie jest wybranym hostem, wysyła `lobby_cmd:start` do hosta, który tworzy stan i rozgłasza `start` (pełny snapshot) przez transport.
22. **Migracja planowana bez odliczania** — nowy host czeka na `hello` wszystkich (maks. 2 s) i wznawia od razu; nieplanowana — czeka do 5 s i robi odliczanie 3-2-1 (GDD 6.5). Podczas pauzy host wysyła snapshoty, żeby klienci nie uznali go za utraconego.
23. **Następca nie odpowiada** — jeśli w 3,5 s nie przyjdzie `host_claim`, klienci wykluczają też jego i liczą kolejnego.
24. **Wynik urządzenia w testach** — `?score=N` nadpisuje pomiar (deterministyczny ranking w E2E); `__koronaHidden` nadpisuje `document.hidden`.
25. **Właściciel pokoju** — w Supabase z `rooms.owner_id`, w LocalTransport z flagi `owner` w Presence. Host przyjmuje `start` tylko od właściciela.
26. **Zapis wyników** — host na końcu meczu wstawia wiersz `matches` (z `host_id = auth.uid()`) i `match_results`. Wiersz meczu powstaje dopiero na końcu, bo host mógł się zmienić w trakcie (RLS wymaga `host_id = auth.uid()`).
27. **Gracze dołączający w trakcie meczu** nie wchodzą do gry; czekają w lobby na rewanż.

## Render i UI
28. **Kamera** — tryb lokalny pokazuje całą arenę (wspólny ekran), online kamera śledzi gracza z widokiem ~22 m.
29. **Sterowanie lokalne** — Klawiatura 1: WASD+mysz; Klawiatura 2: IJKL, U atak, O umiejętność, P dash, 7/8/9 boss (auto-aim); pady wg GDD; F jako alternatywa PPM.
30. **Kolory** — gracz ma kolor slotu (pociski w kolorze gracza), skin określa sylwetkę (kwadrat, trójkąt, romb, koło, sześciokąt).

## Balans (`npm run balance`)
31. **Czasy odnowienia ataków podstawowych** (GDD ich nie podaje). Pierwsze wartości (0,3–0,45 s) dawały panowania 6–11 s i mecze < 2 min. → Rycerz 1,8 s, Łucznik 1,25 s, Łotrzyk 1,4 s, Kapłan 1,3 s, Inżynier 1,8 s; wieżyczka strzela co 1,6 s. DPS: 5,6 / 4,8 / 5,7 / 5,4 / 5,0 (+0,9 z wieżyczki) — rozrzut w granicach ±15%.
32. **Ataki podstawowe bossów** (GDD nie podaje CD) — Kolos 1,6 s, Cień 1,0 s, Nekromanta 1,3 s, Burza 1,1 s.
33. **Szkielety** (GDD podaje tylko 15 HP i limit 6) — prędkość 2,6 m/s, telegraf 0,6 s, CD 2,4 s.
34. **Punkty za koronę: +1 co 3 s (zamiast +1/s)** — najważniejsza zmiana. Analiza: przy +1/s pula punktów z samej korony to 60/min, a lider zbiera 35–45% puli, więc mecz do 100 pkt trwa ~2–2,5 min niezależnie od DPS i HP bossa (sprawdzone przemiataniem: mnożnik CD ataku 0,7–1,3, HP 120–240 → 2,1–2,5 min). `SCORE.crownInterval = 3` daje 4,2 min średnio (200 meczów), 2 → 3,6 min. Korona pozostaje głównym źródłem punktów. (Alt.: cel 150 pkt — sprzeczny z GDD i wymaganiem „zwycięzca przy 100 pkt”.)
35. **Bot** — unika telegrafów (wychodzi ze strefy, dash gdy < 0,2 s do uderzenia, dash przez pierścień Kolosa). Wyniki balansu są zależne od jakości bota; ludzie zwykle unikają lepiej, więc mecze z ludźmi powinny być nieco dłuższe.

## Rozszerzenia po MVP
36. **8 bossów zamiast 4** — dodani: Smok (czerwony; Zionięcie, Lot, Deszcz meteorów; pasywka Żar), Szron (różowy; Nova, Lodowa ściana, Zamieć; pasywka Wychłodzenie), Pajęczyca (różowy; Sieć z unieruchomieniem, Skok, Gniazdo pajęczaków), Widmo (czerwony; bumerang Kosa, Strach, zaciskający się pierścień Żniwa; pasywka leczenie za zabójstwo). Każda akcja ma telegraf 0,4–0,8 s jak w GDD.
37. **Losowanie w stylu skrzynek CS2** — zamiast ruletki 3 ikon: taśma 40 kart z kolorami rzadkości, zwalniająca (easeOutQuart) pod znacznikiem, z tyknięciem przy każdej karcie. Taśma, indeks i miejsce zatrzymania są losowane przez hosta seeded RNG i trzymane w `state.transition`, więc wszyscy klienci widzą to samo. Przejście wydłużone z 1,5 s do 3,2 s (2,6 s spin + 0,6 s odsłonięcie) — 1,5 s było za krótkie na czytelną animację. (Alt.: zostawić 1,5 s — spin nieczytelny.)
38. **Rzadkość = szansa** — wagi: niebieski 4 (Kolos, Burza), fioletowy 3 (Cień, Nekromanta), różowy 2 (Szron, Pajęczyca), czerwony 1,5 (Smok, Widmo). Rzadkość nie zmienia siły bossa; nadal bez powtórki poprzedniego typu.
39. **Tryb lokalny do 8 graczy** (`MATCH.maxPlayersLocal`), online pozostaje 2–6 (GDD). HP bossa nadal 120 × liczba bohaterów, więc przy 8 graczach boss ma 840 HP (× mnożnik typu). Przycisk „Wypełnij botami”.

## Pixel art i wydajność ładowania
40. **Leniwe ładowanie** — `src/main.js` ładuje tylko menu (~5 KB JS + CSS + font). Rdzeń gry (`ui/core.js`: renderer, symulacja, wejście, audio) doładowuje się po kliknięciu „Tryb lokalny / Stwórz / Dołącz” (z rozgrzewką przy najechaniu na przycisk), a SDK Supabase (~216 KB) dopiero przy wejściu online. Mapy i bossowie są proceduralni, więc nie było czego „ładować per boss” — ciężar stanowiło SDK i ikony PWA (zmniejszone z ~530 KB do 21 KB).
41. **Styl pixel art** (wybór użytkownika zamiast neonu z GDD 9). Świat rysowany w buforze 12 px/m i skalowany bez wygładzania (S przyciągane do pełnych pikseli od 2,5×). Telegrafy nadal czerwone (GDD), półprzezroczystość przez dithering Bayera, obrys miga szybciej tuż przed uderzeniem. Pociski bossa białe z czerwoną obwódką (GDD). HUD w pełnej rozdzielczości fontem Pixelify Sans.
42. **Sprite'y generowane w kodzie** (`src/render/sprites/*`) — żadnych plików graficznych; cache po kluczu.
43. **Muzyka chiptune** proceduralna (menu / walka / boss — gdy lokalny gracz jest bossem / skrzynka / zwycięstwo), scheduler z wyprzedzeniem na zegarze AudioContext.
44. **Predykcja własnej postaci online** — własna postać rysowana z najnowszego snapshotu + ruch z bieżącego inputu (maks. 120 ms), pozostali z bufora interpolacji 100 ms. Pełna predykcja z rekoncyliacją nadal poza zakresem.
45. **Dotyk** — jeden człowiek na dotyku w trybie lokalnym dostaje kamerę za graczem; pasek cooldownów HUD jest ukryty, bo pokazują je przyciski.

## Mapy i tryby z botami
46. **6 losowanych map z biomami** (`src/sim/maps.js`): Kamienna Arena (bez pułapek), Krater Wulkanu (lawa: 1 dmg/s bohaterom, dash nad lawą bezpieczny; boss odporny), Lodowa Tundra (prostokątna; na lodzie poślizg — ruch z bezwładnością), Mroczny Las (krzaki ukrywają bohatera przed bossem/AI do 2,5 m, atak odsłania na 1 s), Stary Cmentarz (prostokątny; co 5 s 3 „ręce z grobów” z telegrafem 0,8 s przy bohaterach), Ruiny na Pustyni (ruchome piaski: −50% prędkości i wciąganie). Środek zawsze wolny (korona). Mapa losowana z ziarna meczu (`pickMapId`) — online losuje host, lokalnie „Losowa” albo wybrana.
47. **Mapa w fizyce** — granica (koło/prostokąt) i przeszkody z danych mapy; mapa wiązana na czas kroku (`bindMap`, jak RNG). Spawny liczone per mapa, poza przeszkodami, lawą i piaskami.
48. **Tryby z botami tylko lokalnie** (online pozostaje Korona). AI-boss to gracz z flagą `ai` (id `AI`) — używa tych samych kitów bossów, a jego input liczy `step()` z osobnego RNG w stanie (`aiRng`), więc tryby są deterministyczne i testowalne bez UI.
49. **Przetrwanie** — budżet fali `(6 + 3n) × (0,6 + 0,4 × bohaterowie)` rozdzielany między odblokowane typy (szkielet 1, pająk 1 od fali 2, łucznik 2 od fali 3, osiłek 4 od fali 4); HP wrogów +12% na falę; co 5. fala boss AI (HP × (0,5 + 0,12n)) i 40% budżetu. Wrogowie pojawiają się na obrzeżu z telegrafem 0,6 s. Zabici bohaterowie wracają dopiero w przerwie; koniec, gdy zginą wszyscy. Punkty: zabójstwa (1/1/2/4), boss 15, przetrwana fala 5.
50. **Boss Rush** — 8 bossów losowanych skrzynką (bez powtórek z rzędu), każdy kolejny ma +30% HP i −6% czasów odnowienia (min. 0,6×). Bohaterowie odradzają się po 5 s, dopóki ktoś żyje.
51. **Ulepszenia** między falami/bossami: 3 losowe z 6 (+1 serce, +20% obrażeń, −15% CD, +10% prędkości, −25% CD dasha, +25% zasięgu). Wybór inputem (lewo/prawo + atak), więc działa na klawiaturze, padzie i dotyku; po 12 s zatwierdza się zaznaczona karta.
52. **Trudność botów** (`AI_LEVELS`): łatwy (duży rozrzut celowania, unika 35% telegrafów, rzadziej używa umiejętności), normalny, trudny (celne, zawsze unika, częściej umiejętności). Dotyczy botów-bohaterów i AI-bossa. Boty omijają lawę i ruchome piaski.
53. **Rekordy** Przetrwania (fala) i Boss Rush (pokonani bossowie) w `localStorage` (`korona.records`).
