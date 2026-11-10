# KORONA — Game Design Document

Wersja 1.0 · 2D top-down · PvP 2–6 graczy · przeglądarka + PWA · Supabase

---

## 1. Pitch

Na arenie jest jeden boss, a reszta graczy to bohaterowie. **Kto zada bossowi ostatni cios, przejmuje koronę i sam staje się bossem.** Typ bossa jest losowany z 4 dostępnych. Punkty dostajesz głównie za czas w koronie. Wygrywa pierwszy gracz, który zdobędzie 100 punktów.

Bohaterowie muszą współpracować, żeby zbić bossa, ale rywalizują o ostatni cios. W efekcie sojusze tworzą się i rozpadają co 30–60 sekund.

**Filary:**
1. **Każdy będzie bossem.** Rotacja korony daje każdemu graczowi kilka okazji na mecz.
2. **Czytelny chaos.** Każdy atak bossa ma telegraf (zapowiedź), więc śmierć zawsze jest „moją winą”.
3. **Krótkie mecze.** Rozgrywka trwa 5–8 minut, a od kodu pokoju do gry mija mniej niż 30 sekund.

---

## 2. Zasady meczu

| Element | Wartość |
|---|---|
| Gracze | 2–6 |
| Cel | 100 pkt |
| Limit czasu | 8 min (potem wygrywa lider) |
| Arena | 1 mapa, okrągła, ok. 2 ekrany szerokości, kilka filarów jako osłony |

### Start
Korona pojawia się na środku areny. Pierwszy bohater, który jej dotknie, zostaje bossem. Bohater, który podnosi koronę po starcie albo po jej upadku, nie dostaje bonusu za ostatni cios.

### Punktacja
| Akcja | Punkty |
|---|---|
| Każda sekunda w koronie | +1 |
| Zabicie bohatera jako boss | +3 |
| Ostatni cios w bossa (przejęcie korony) | +10 |
| Zadanie w tym panowaniu świeżych obrażeń ≥ min(25%, 75% / liczba bohaterów) HP bossa, bez przejęcia korony (asysta) | +2 |

### Przejęcie korony
1. HP bossa spada do 0, a ostatnie trafienie należy do bohatera X.
2. Na 1,5 s świat zwalnia do 30% (slow-mo), wyświetla się nazwa X i przejście.
3. Poprzedni boss odradza się jako bohater w losowym punkcie odrodzenia, z 2 s nietykalności.
4. X staje się bossem. Typ bossa jest losowany (patrz 4.1), a HP ustawia się na pełne.

### Mechaniki doganiania (anty-snowball)
- **HP bossa się nie regeneruje**, chyba że umiejętność mówi inaczej.
- **Gorączka korony:** po 40 s w koronie boss dostaje o 10% więcej obrażeń, a co kolejne 10 s dochodzi następne +10% (maksymalnie +50%).
- **HP bossa** = 120 × liczba bohaterów, więc skaluje się do liczby graczy.
- Ostatnie 10% HP bossa pulsuje na pasku, żeby wszyscy wiedzieli, że zaczyna się walka o ostatni cios.

### Upadek korony
Jeśli boss się rozłączy, korona upada na środek areny i działa tak jak na starcie. Gracz, który wychodzi z gry, traci punkty, ale jego wynik zostaje w tabeli z oznaczeniem „DNF”.

---

## 3. Bohaterowie (skiny)

**Wspólne dla wszystkich:** 3 HP (klasy wręcz — Rycerz, Łotrzyk, Inżynier, Barbarzyńca — 4 HP), ruch, atak podstawowy (LPM / RT), dash (Spacja / A) z 1,2 s cooldownu i 0,15 s nietykalności podczas dashu. Po śmierci odrodzenie po 2 s.

Każdy skin to wygląd i **jedna unikalna umiejętność** (PPM / RB), czasem z drobną zmianą ataku podstawowego. Skin wybierasz w lobby, a zmienić go możesz tylko podczas odrodzenia.

| Skin | Atak podstawowy | Umiejętność | CD | Rola |
|---|---|---|---|---|
| **Rycerz** | Cięcie melee 120°, 10 dmg | **Tarcza:** blokuje wszystko z przodu przez 1,5 s, a odbite pociski lecą w bossa | 8 s | przetrwanie |
| **Łucznik** | Strzała, zasięg 9 m, 6 dmg | **Przeszywający strzał:** po naładowaniu 0,6 s przebija wszystko, 30 dmg | 7 s | dystans, dobijanie |
| **Łotrzyk** | Sztylet melee 60°, 8 dmg, szybki | **Krok cienia:** teleport za plecy celu (do 5 m), następny atak zadaje 3× obrażenia | 10 s | kradzież ostatniego ciosu |
| **Kapłan** | Kula światła, 5 m, 7 dmg | **Aura:** leczy 1 HP **wszystkim** bohaterom w promieniu 3 m, także rywalom (w Bitwie bossów tylko własnej drużynie) | 14 s | wsparcie, dylemat |
| **Inżynier** | Klucz melee, 9 dmg | **Wieżyczka:** stawia działko na 6 s, które strzela w bossa po 4 dmg. Ostatni cios zadany przez wieżyczkę liczy się jako cios Inżyniera | 15 s | presja obszarowa |

**Zasady balansu:** średnie obrażenia na sekundę wszystkich skinów różnią się najwyżej o ±15%. Łotrzyk ma najwyższy potencjał do kradzieży ostatniego ciosu, ale najsłabszą przeżywalność.

---

## 4. Bossy

**Wspólne dla wszystkich:** promień postaci 3× większy niż u bohatera, atak podstawowy, 3 umiejętności (Q / E / R lub X / Y / B) i 1 pasywka. **Każda umiejętność ma telegraf od 0,4 do 0,8 s**, czyli czerwony kształt na ziemi przed uderzeniem.

### 4.1 Losowanie bossa
- Losowanie robi **host** generatorem liczb losowych z ziarnem (seeded RNG). Stan generatora jest częścią snapshotu, żeby przetrwał migrację hosta.
- **Nie losuje się tego samego typu, który był chwilę wcześniej.** Losowanie odbywa się z 3 pozostałych.
- Przez 1,5 s slow-mo widać animację losowania (ruletka 3 ikon), a potem nazwę wylosowanego bossa.

### 4.2 Kolos (tank)
- **Pasywka:** odporny na odrzut, obrażenia zmniejszone o 15%. Prędkość 0,7×.
- **Atak:** pięść w łuku przed sobą, 1 dmg (bohater ma 3 HP).
- **Q, Fala uderzeniowa:** pierścień rozchodzący się od bossa. Trzeba go przeskoczyć dashem w odpowiednim momencie. CD 6 s.
- **E, Szarża:** biegnie po linii 8 m, przewraca bohaterów i odrzuca ich. CD 9 s.
- **R, Deszcz głazów:** 4 strefy z telegrafem 0,8 s w miejscach, gdzie stoją bohaterowie. CD 14 s.

### 4.3 Cień (zabójca)
- **Pasywka:** prędkość 1,3×, HP 0,9× (było 0,7× — patrz docs/decisions.md 73).
- **Atak:** szybkie cięcie, 1 dmg.
- **Q, Teleport:** przeniesienie do kursora (do 7 m), zostawia wybuch w punkcie startu. CD 7 s.
- **E, Zasłona:** niewidzialność na 2,5 s. Widać tylko delikatny cień na ziemi. Zadanie obrażeń przerywa zasłonę. CD 12 s.
- **R, Wachlarz ostrzy:** 7 pocisków w stożku 90°. CD 8 s.

### 4.4 Nekromanta (kontrola)
- **Pasywka:** zabite miniony nie dają bohaterom punktów, ale też nie liczą się do obrażeń bossa.
- **Atak:** wolny pocisk, 1 dmg.
- **Q, Przywołanie:** 3 szkielety (każdy ma 15 HP i goni najbliższego bohatera). Jednocześnie żyje najwyżej 6 szkieletów. CD 10 s.
- **E, Wysysanie:** promień do jednego bohatera przez 2 s. Zadaje mu 1 dmg na sekundę i leczy bossa o 4% max HP na sekundę. Przerywa go wyjście z zasięgu. CD 12 s.
- **R, Kostnica:** strefa o promieniu 4 m, która przez 4 s spowalnia o 50% i zadaje 1 dmg na sekundę. CD 15 s.

### 4.5 Burza (obszar)
- **Pasywka:** co 3 trafienia ładuje Przeciążenie, przez co następna umiejętność ma większy obszar (+50%).
- **Atak:** iskra o średnim zasięgu, 1 dmg.
- **Q, Piorun:** uderzenie w punkt z telegrafem 0,6 s, promień 2 m. CD 4 s.
- **E, Wir:** przez 2 s przyciąga bohaterów w promieniu 6 m do bossa. CD 11 s.
- **R, Łańcuch błyskawic:** trafia najbliższego bohatera i przeskakuje na kolejnych w promieniu 4 m (maksymalnie 4 skoki). Karze za skupianie się w grupie. CD 9 s.

---

## 5. Sterowanie

| Akcja | Klawiatura + mysz | Gamepad | Dotyk (PWA mobile) |
|---|---|---|---|
| Ruch | WASD | Lewa gałka | Wirtualny joystick (lewa strona) |
| Celowanie | Mysz | Prawa gałka | Auto-aim w najbliższy cel + przeciągnięcie przycisku ataku |
| Atak | LPM | RT | Przycisk |
| Dash | Spacja | A | Przycisk |
| Umiejętność bohatera | PPM | RB | Przycisk |
| Umiejętności bossa | Q / E / R | X / Y / B | 3 przyciski (pojawiają się po przejęciu korony) |

---

## 6. Architektura sieci

### 6.1 Rola Supabase
| Funkcja | Usługa Supabase |
|---|---|
| Logowanie bez konta | Auth, **anonymous sign-in** i nickname |
| Pokoje i kody pokoi | Postgres, tabela `rooms` |
| Lista graczy online w pokoju i ich wynik urządzenia | **Realtime Presence** na kanale `room:{code}` |
| Sygnalizacja WebRTC (offer / answer / ICE) | **Realtime Broadcast** na tym samym kanale, wiadomości z polem `to` |
| Ogłaszanie hosta (`host_claim`) | Realtime Broadcast |
| Zapasowy przekaźnik, gdy WebRTC nie wstanie | Realtime Broadcast z niższą częstotliwością (ok. 10 Hz) |
| Historia meczów, statystyki, ranking | Postgres: `matches`, `match_results` |

**Supabase nie liczy gry.** Symulację prowadzi host, a ruch w trakcie meczu idzie przez WebRTC peer-to-peer.

### 6.2 Topologia
Gwiazda: wszyscy klienci łączą się z hostem przez WebRTC DataChannel.
- Kanał `state`: `ordered:false, maxRetransmits:0`. Snapshoty wysyłane 20 razy na sekundę i inputy klientów.
- Kanał `events`: niezawodny. Zabójstwa, zmiana korony, koniec meczu.
- ICE: publiczny serwer STUN. TURN jest opcjonalny, w konfiguracji `.env`. Bez TURN-a klienci za restrykcyjnym NAT-em przechodzą na przekaźnik przez Supabase.

### 6.3 Pętla gry
- **Host:** symulacja ze stałym krokiem 60 Hz, snapshot co 3 kroki (20 Hz), zdarzenia wysyłane od razu.
- **Klient:** wysyła input 30 razy na sekundę (`{seq, moveX, moveY, aimX, aimY, buttons}`) i renderuje świat z **bufora interpolacji opóźnionego o 100 ms**. Lokalna predykcja ruchu własnej postaci to etap po MVP.
- **Kluczowa zasada:** symulacja to **czysty moduł** `step(state, inputsByPlayer, dt, rng) → state`, bez DOM-a i bez sieci. Każdy klient ma ten sam kod, więc każdy może w dowolnej chwili zostać hostem.

### 6.4 Wybór hosta (najlepsze urządzenie)
**Pomiar (raz po wejściu do lobby, ok. 1 s):**
1. Benchmark: 300 kroków `step()` na syntetycznym, najcięższym scenariuszu (6 graczy, boss, 150 pocisków, 6 minionów). Wynik to mediana ms na krok.
2. Wynik urządzenia:
```
base   = 1000 / medianMsPerStep
cores  = min(navigator.hardwareConcurrency, 8) / 8        // 0..1
score  = base * (0.8 + 0.2 * cores)
if mobile/tablet                       score *= 0.6
if battery && !charging && level<0.3   score *= 0.5
if connection.effectiveType in [2g,3g] score *= 0.5
if document.hidden                     score  = 0
```
3. Wynik trafia do Presence: `{userId, nick, skin, deviceScore, joinedAt, ready}`.

**Wybór (deterministyczny, bez głosowania):** każdy klient sortuje listę z Presence po `deviceScore DESC, joinedAt ASC, userId ASC`. Pierwszy na liście jest hostem, drugi jest **następcą**. Wszyscy dochodzą do tego samego wyniku.

**Histereza:** w trakcie meczu nowy gracz z lepszym urządzeniem **nie przejmuje** roli hosta. Zmiana hosta następuje tylko w sytuacjach z 6.5.

### 6.5 Migracja hosta
**Migracja nieplanowana (host wyszedł albo stracił połączenie)**
- Wykrycie: zamknięcie DataChannela **lub** opuszczenie Presence **lub** brak snapshotu przez 1500 ms.
- Każdy klient trzyma ostatni pełny snapshot, łącznie ze stanem generatora losowego i licznikami cooldownów.
- Następca (wyliczony z Presence bez starego hosta) zwiększa `hostEpoch`, wysyła `host_claim {epoch, hostId}` i wznawia symulację z ostatniego snapshotu.
- Pozostali łączą się z nowym hostem przez WebRTC. Na ekranie widać nakładkę „Migracja hosta…”, a po połączeniu wszystkich odliczanie 3-2-1 przed wznowieniem gry.
- **Konflikt (split-brain):** wygrywa wyższy `epoch`. Przy równym `epoch` wygrywa wyższa pozycja w rankingu, a przegrany wraca do roli klienta.

**Migracja planowana (host słabnie)**
- Warunki: `document.hidden` przez ponad 1 s **lub** średni czas kroku powyżej 12 ms przez 5 s.
- Host wysyła ostatni snapshot i `handoff {to: następca}`, po czym sam staje się klientem. Przejście jest prawie płynne.

**Optymalizacja (po MVP):** każdy klient trzyma w tle drugie, nieaktywne połączenie WebRTC z następcą, więc migracja trwa poniżej 300 ms.

### 6.6 Zaufanie
Host może oszukiwać, co między znajomymi jest akceptowalnym ryzykiem. Wynik meczu do `match_results` zapisuje host. Polityki RLS (Row Level Security) pozwalają na zapis tylko temu, kto jest zapisany jako `host_id` meczu.

---

## 7. Schemat bazy (Supabase)

```sql
profiles      (id uuid PK = auth.uid(), nickname text, favorite_skin text, created_at)
rooms         (id uuid PK, code text UNIQUE (5 znaków, bez 0/O/1/I), owner_id uuid,
               status text check in ('lobby','playing','finished'), max_players int default 6,
               created_at, updated_at)
matches       (id uuid PK, room_id uuid FK, host_id uuid, started_at, ended_at, winner_id uuid)
match_results (match_id uuid FK, user_id uuid FK, score int, crown_seconds int,
               last_hits int, boss_kills int, skin text, dnf bool, PK(match_id,user_id))
```
**RLS:**
- `profiles`: każdy zalogowany może czytać, edytować tylko własny wiersz.
- `rooms`: zalogowani mogą czytać i tworzyć, aktualizować tylko `owner_id`.
- `matches` i `match_results`: insert tylko gdy `auth.uid()` jest równe `matches.host_id`.
- Sprzątanie: pokoje w stanie `lobby` starsze niż 2 h są usuwane przez cron albo pg_cron.

---

## 8. Ekrany i przepływ

1. **Start:** nickname (anonymous auth), przyciski „Stwórz pokój” i „Dołącz kodem”.
2. **Lobby:** kod pokoju z przyciskiem kopiowania lub udostępniania, lista graczy z ikoną hosta i paskiem wyniku urządzenia, wybór skina, przycisk „Gotowy”. Mecz startuje, gdy właściciel kliknie Start i wszyscy są gotowi.
3. **Mecz:** HUD z punktami wszystkich graczy (pasek u góry), paskiem HP bossa, cooldownami i licznikiem czasu.
4. **Podsumowanie:** podium, statystyki z `match_results`, przycisk „Rewanż” (ten sam pokój).
5. **Tryb lokalny (offline):** 2–4 graczy na jednym ekranie z padami i/lub klawiaturą, bez Supabase. Działa w PWA bez internetu.

---

## 9. Oprawa

- Grafika: geometryczne kształty z neonowym świeceniem (glow) na ciemnym tle. Każdy skin ma inną sylwetkę i kolor, a bossowie mają wyrazisty, nasycony kolor plus koronę nad głową.
- „Soczystość” (juice): drżenie ekranu przy uderzeniach bossa, hit-stop 50 ms przy trafieniu, cząsteczki, slow-mo przy przejęciu korony.
- Dźwięk: WebAudio, efekty generowane proceduralnie w MVP.
- Czytelność: telegrafy zawsze czerwone, pociski bohaterów w kolorze gracza, pociski bossa białe z czerwoną obwódką.

---

## 10. PWA

- `manifest.webmanifest`: nazwa, ikony 192/512, `display: standalone`, orientacja landscape.
- Service Worker: precache wszystkich zasobów (Vite + vite-plugin-pwa / Workbox). Tryb online wymaga sieci, a tryb lokalny działa offline.
- Mobile: wirtualne sterowanie, Wake Lock podczas meczu, blokada przypadkowego zoomu i scrolla.
- Przycisk „Zainstaluj” obsługiwany przez `beforeinstallprompt`.

---

## 11. Zakres MVP i poza zakresem

**MVP:** 1 arena, 5 skinów, 4 bossy, tryb online (do 6 graczy), tryb lokalny, migracja hosta (planowana i nieplanowana), PWA, zapis wyników.

**Poza MVP:** predykcja klienta, połączenie w tle z następcą, wiele aren, ranking globalny, odblokowywane kosmetyki, czat głosowy.
