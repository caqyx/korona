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
