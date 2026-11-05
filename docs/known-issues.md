# Znane problemy

1. **SupabaseTransport nie był testowany na żywo** — sieć sesji budującej blokowała `*.supabase.co`. Kod używa standardowego API Realtime (Presence `track`, Broadcast `send`), ale wymaga ręcznej weryfikacji (patrz `TODO-human.md`, krok 3). Obejście: tryb online działa na `LocalTransport` (`?transport=local`) — karty tej samej przeglądarki.
2. **Limity Supabase Realtime** — przekaźnik (gdy WebRTC nie wstanie) wysyła snapshot 10 Hz do każdego klienta osobno. Przy 6 graczach to ~50 wiad./s + inputy; plan Free ma limity wiadomości na sekundę na projekt. Przy wielu pokojach naraz przekaźnik może być dławiony. Docelowo: TURN albo jeden broadcast snapshotu do wszystkich.
3. **Rozmiar snapshotu** — pełny stan w JSON (bez delta-kompresji): typowo 3–10 KB, w scenariuszu benchmarkowym (150 pocisków) ~30 KB. Przy 20 Hz i 5 klientach to do ~3 MB/s wysyłania z hosta w skrajnym przypadku. Po MVP: delty/kwantyzacja binarna.
4. **Balans oparty na botach** — `npm run balance` daje średnio ~4,2 min (bramka 4–10 min spełniona z niewielkim zapasem; mecze 3-osobowe bywają krótsze). Żeby to osiągnąć przy celu 100 pkt, punkt za koronę przyznawany jest co 3 s zamiast co 1 s (`SCORE.crownInterval`, decyzja 34). Warto zweryfikować z ludźmi.
5. **Host może oszukiwać** (zgodnie z GDD 6.6) — host jest autorytatywny i zapisuje wyniki. Walidacja wiadomości chroni kształt danych, nie uczciwość hosta.
6. **Brak ponownego dołączenia** do trwającego meczu — gracz, który odświeży kartę, zostaje DNF; może wrócić do lobby na rewanż.
7. **Migracja przy jednoczesnej utracie hosta i następcy** — klienci po 3,5 s wykluczają następcę i wybierają kolejnego; w tym czasie gra stoi z nakładką „Migracja hosta…”.
8. **Ukryta karta hosta w prawdziwej przeglądarce** — Chrome dławi timery ukrytych kart do ~1 Hz, więc przekazanie planowane może nastąpić 1–2 s po ukryciu (test E2E symuluje ukrycie bez dławienia).
9. **Przekaźnik a krótkie wciśnięcia** — bity przycisków są łączone, ale przy 10 Hz celowanie i ruch klienta mają opóźnienie do 100 ms + interpolacja.
