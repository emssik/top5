# 0008. Ścieżki w Zrzucie: tylko bezwzględne, spacje wyłącznie w cudzysłowie lub backtickach

- **Status:** Accepted
- **Date:** 2026-10-31
- **Source plan:** specs/board-F003-sciezki-w-zrzucie-jako-linki.plan.md

## Context

Zrzut (edytor CodeMirror w `DumpEditor.tsx`) wyróżnia ścieżki do plików jako linki otwierane Cmd+klikiem (F003).
Trzeba ustalić, który fragment tekstu jest ścieżką: gdzie się zaczyna, gdzie kończy i co z plikami ze spacjami
w nazwie (iCloud „Mobile Documents”, dokumenty). Wykrywanie robi czysta funkcja `findDumpPaths` w `src/shared/dump.ts`,
używana zarówno do dekoracji, jak i do obsługi kliknięcia.

## Decision

Ścieżka zaczyna się od `/` albo `~/` na początku słowa (początek linii, biały znak albo `(`). Bez cudzysłowu kończy się
na pierwszym białym znaku, a końcowe `.` `,` `)` `:` do niej nie należą. W `"…"` lub `` `…` `` (zamknięte w tej samej
linii) może zawierać spacje; zakres bez znaków cudzysłowu. Linie zaczynające się od `#` są pomijane (jak tagi).
Po `/` lub `~/` musi stać znak inny niż `/` i biały znak (`/`, `~/`, `//` nie są ścieżką). Ścieżki względne i URL-e
nie są wykrywane.

## Alternatives considered

- **Ścieżka zawsze kończy się na spacji** — odrzucone: Daniel ma pliki ze spacjami w nazwach.
- **Escapowanie spacji `\ ` jak w shellu** — odrzucone: nienaturalne przy pisaniu notatki, trudniejsze do wykrycia.
- **Ścieżka do pierwszego rozszerzenia (`….md`)** — odrzucone: zgadywanie końca psuje się na katalogach z kropką
  i plikach bez rozszerzenia.
- **Ścieżki względne (`./plik`, `plik.md`)** — odrzucone: Zrzut nie ma katalogu bazowego, a `plik.md` w zwykłym zdaniu
  dawałby fałszywe trafienia.

## Consequences

- **+** Proste, przewidywalne reguły; regex testowalny bez DOM. Wymóg „początek słowa” sam wyklucza URL-e i `km/h`.
- **−** Niezamknięty cudzysłów = brak linku.
- **−** Ścieżka kończąca się legalnie na `)` (np. `plik(1)`) bez cudzysłowu traci `)` — trzeba ją ująć w cudzysłów.
