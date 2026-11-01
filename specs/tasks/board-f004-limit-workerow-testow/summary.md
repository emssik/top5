## Cel
Testy top5 mają brać najwyżej 2 rdzenie na raz zamiast 11, żeby kilka równoległych biegów (bramka, weryfikator, mutanty, klony boardu) nie dobijało procesora.
## Zrobione
- Vitest w głównym repo i w `cli/` uruchamia najwyżej 2 workery.
- `node --test` w `npm test` uruchamia najwyżej 2 pliki naraz.
- W `cli/` dodatkowo `minWorkers: 1`, bo Vitest 2.x w tym pakiecie bez tego się wywraca.
- Zmienna środowiska `VITEST_MAX_WORKERS` (sesje boardu mają 3) nadal ma pierwszeństwo nad konfiguracją.
