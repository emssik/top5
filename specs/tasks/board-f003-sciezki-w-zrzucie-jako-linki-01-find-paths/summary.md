## Cel
Zrzut ma rozpoznawać wpisane ścieżki do plików (`/Users/…`, `~/…`), żeby edytor mógł je podkreślić i otwierać Cmd+klikiem.
## Zrobione
- Nowa funkcja `findDumpPaths` znajduje ścieżki bezwzględne w tekście Zrzutu i podaje ich dokładne położenie.
- Ścieżka w cudzysłowie albo w backtickach może mieć spacje; bez cudzysłowu kończy się na spacji, a kropka, przecinek, nawias czy dwukropek na końcu do niej nie należą.
- Linie zaczynające się od `#` są pomijane, tak samo jak przy tagach projektów; adresy `https://…` i ułamki typu `km/h` nie są brane za ścieżki.
