# Brief: Ścieżki w Zrzucie jako klikalne linki (F003)

**Cel.** Bezwzględna ścieżka (`/…`, `~/…`) w Zrzucie jest podkreślona; Cmd+klik otwiera plik w domyślnej aplikacji,
zwykły klik dalej tylko stawia kursor.

**Podejście.** Jedna czysta funkcja `findDumpPaths` (shared) służy i do podkreślenia, i do trafienia kliknięcia —
co podkreślone, to się otwiera. Renderer niczego nie otwiera: wysyła ścieżkę kanałem `open-dump-path`, a main
rozwija `~`, robi `realpath` + `stat` i otwiera tylko zwykły, niewykonywalny plik. Ścieżka jest niezaufana (Zrzut
dostaje treść z maili).

**Kluczowe decyzje:**
- Format → tylko `/…` i `~/…` na początku słowa; spacje tylko w `"…"` / `` `…` ``; końcowe `. , ) :` odcinane; linie `#` pomijane (ADR-0008).
- Blokada w main → nie-plik, dowolny bit `x`, rozszerzenia `.app .command .sh .tool .workflow .terminal` + spoza ticketu `.jar .fileloc .webloc .inetloc .pkg .mpkg`; sprawdzane na ścieżce po `realpath` (symlink nie obejdzie) (ADR-0009).
- Trafienie kliknięcia → `.closest('.dump-path')`, nie samo `posAtCoords` (klik za końcem linii nic nie otwiera).
- Kursor `pointer` tylko z wciśniętym Cmd → klasa `dump-cmd` na hoście, przełączana nasłuchem klawiszy.
- Brak pliku / blokada → cisza, bez logów i komunikatu.

**Zakres:** bez ścieżek względnych, URL-i, katalogów (też bez „pokaż w Finderze”), HTTP API i CLI.

**Główne ryzyka:**
- Lista zakazów niepełna → plik i tak musi już być na dysku; nowe rozszerzenie dopisuje się jedną linią.
- Pliki z exFAT/SMB mają bit `x` na wszystkim → stamtąd nic się nie otworzy (oznaczone `ponytail:`).

**Pełny plan:** [board-F003-sciezki-w-zrzucie-jako-linki.plan.md](board-F003-sciezki-w-zrzucie-jako-linki.plan.md)
