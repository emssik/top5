STATUS: PASS

Tryb: solo. `delegate quick`: PASS (dla zmienionych plików nie ma testów, bo projekt nie ma testów renderera). `full_suite_green: true`. Sam uruchomiłem `npm run typecheck` i `npm run build`: oba przechodzą.

| Kryterium / przykład | Ocena | Dowód |
| --- | --- | --- |
| Ścieżki z `findDumpPaths` dostają znacznik `.dump-path`, linie `#` nie dostają | 9 | `src/renderer/components/DumpEditor.tsx:67`. Pomijanie linii `#` i zdejmowanie cudzysłowów robi `src/shared/dump.ts:158-163` (testy tej funkcji pochodzą z poprzedniego zadania). Przykłady 1–3 spełnione. Testu renderera nie ma, zgodnie z zadaniem. |
| `mousedown`: otwiera tylko przy Cmd + lewym przycisku na `.dump-path`, w każdym innym przypadku zwraca `false` | 9 | `DumpEditor.tsx:339-349`. Bierze `closest('.dump-path')`, potem `posAtDOM(el)`, `lineAt` i `findDumpPaths(line.text)`, czyli działa po linii logicznej, więc także na obu wierszach zawiniętej ścieżki. Woła `preventDefault` i `openDumpPath` raz, a potem zwraca `true`. Nie używa `posAtCoords`. Handler jest w `Prec.highest` i nie sprawdza trybu tylko do odczytu, więc działa także w nim. Przykłady 4–6 spełnione. |
| Przełączanie klasy `dump-cmd` i sprzątanie nasłuchów na `window` | 9 | `DumpEditor.tsx:380` (`mousemove`), `:429-433` (`keydown`/`keyup`/`blur`), `:435-437` (usuwanie nasłuchów w funkcji sprzątającej efektu). Przykład 7 spełniony. |
| Reguły CSS | 9 | `src/renderer/styles.css:2102-2111`. Podkreślenie ma kolor z `color-mix(in oklch, currentColor 40%, transparent)` i odsunięcie 2px. `cursor: pointer` jest pod `.dump-cm.dump-cmd`. Nie ma stylu `:hover` ani animacji, więc zgodnie z `good-css`. |
| typecheck, build, istniejące testy | 10 | Oba polecenia uruchomiłem sam, a `full_suite_green` pochodzi z bramki. |

MUTANTS:
- `src/renderer/components/DumpEditor.tsx:340` (warunek Cmd / lewy przycisk): mutant przeżył, ale zadanie wprost nie wymaga testów, bo projekt nie ma testów renderera. Kod jest zgodny z umową. To nie jest luka tego zadania.
- `src/renderer/components/DumpEditor.tsx:344` (sprawdzanie zakresu `line.from + m.start <= pos && pos <= line.from + m.end`): mutant przeżył z tego samego powodu. Logikę omawiam w TASK DOUBTS.
- `src/renderer/components/DumpEditor.tsx:348` (`return true`): mutant przeżył, bo nie ma testu renderera. Wynik zależy od zachowania CodeMirror: przy `false` po `preventDefault` CodeMirror nadal może przesunąć kursor. Zadanie przyjmuje sprawdzenie przez czytanie kodu i późniejsze uruchomienie aplikacji.

TASK DOUBTS:
- Do `src/renderer/components/DumpEditor.tsx` nie dociera żaden test. Jedyna logika na danych to dopasowanie trafienia w `DumpEditor.tsx:342-344`: pozycja i tekst linii dają ścieżkę albo nic. Dałoby się ją wydzielić jako czystą funkcję w `src/shared/dump.ts`, np. `dumpPathAt(lineText, offset)`, i przetestować w vitest. Zadanie świadomie z tego zrezygnowało (minimalny diff), więc to tylko propozycja, nie luka.
