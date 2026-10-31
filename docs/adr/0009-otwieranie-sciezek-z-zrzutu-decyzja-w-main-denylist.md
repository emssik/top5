# 0009. Otwieranie ścieżek z Zrzutu: decyzja w main, blokada nie-plików i plików wykonywalnych

- **Status:** Accepted
- **Date:** 2026-10-31
- **Source plan:** specs/board-F003-sciezki-w-zrzucie-jako-linki.plan.md

## Context

Cmd+klik na ścieżce w Zrzucie otwiera plik przez `shell.openPath` (F003). Treść Zrzutu może pochodzić z maili
(`src/main/mail-to-dump.ts`), więc ścieżka jest niezaufana, a `shell.openPath` na `.app`, `.command` czy `.sh`
uruchamia program. Daniel: „chodzi tylko o klasyczne pliki tekstowe czy obrazki, a nie pliki wykonywalne”.

## Decision

Renderer tylko wykrywa ścieżkę i wysyła ją kanałem IPC `open-dump-path`. Main (`openableDumpPath` w
`src/main/dump-path.ts`, bez importów Electrona) odrzuca nie-string, `\0` i wszystko spoza `/…`/`~/…`, rozwija `~/`,
robi `realpath` (symlinki, `..`), `stat` (asynchronicznie — wolumin sieciowy offline nie zamraża main) i odrzuca: nie-pliki (katalogi, pakiety `.app`), pliki z dowolnym
bitem wykonywania, pliki z rozszerzeniem ścieżki rzeczywistej w zbiorze
`.app .command .sh .tool .workflow .terminal .jar .fileloc .webloc .inetloc .afploc .ftploc .mailloc .newsloc .pkg .mpkg`. Odrzucenie i brak pliku
są ciche (bez logów, bez komunikatu). Przechodzi tylko zwykły plik → `shell.openPath(realPath)`.

## Alternatives considered

- **Allowlist rozszerzeń (md, txt, png, jpg, pdf…)** — odrzucone: każde nowe rozszerzenie (`.heic`, `.yaml`,
  `.drawio`) wymagałoby zmiany kodu; ticket definiuje blokadę przez listę zakazów i bit wykonywania.
- **Otwieranie bez sprawdzeń, jak `open-task-image`** — odrzucone: tam nazwa pliku pochodzi z aplikacji, tu z tekstu,
  który może przyjść mailem.
- **Katalogi przez `shell.showItemInFolder`** — odrzucone decyzją Daniela (bez Findera).
- **Sprawdzanie istnienia pliku w rendererze (styl zależny od istnienia)** — odrzucone: dostęp do dysku przy każdej
  zmianie tekstu, a renderer ma niczego nie otwierać ani nie sprawdzać sam.
- **Sprawdzanie rozszerzenia nazwy z tekstu zamiast ścieżki po `realpath`** — odrzucone: symlink `a.md → x.command`
  obchodziłby blokadę.

## Consequences

- **+** Mały kod, testowalny w vitest bez Electrona; zamyka znane sposoby uruchomienia programu kliknięciem.
- **−** Lista zakazów jest z natury niepełna — nowy „uruchamialny” typ trzeba dopisać ręcznie.
- **−** Woluminy bez uprawnień POSIX (exFAT/FAT, część SMB) mają bit `x` na wszystkim, więc pliki stamtąd się nie otworzą.
