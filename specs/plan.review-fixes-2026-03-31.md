# Plan: Code Review Fixes (2026-03-31)

> Fix 5 findings from the daily code review of diff 847c3c8..4905f05.
> Three important issues (off-by-one validation, duplicated types, duplicated formatSchedule)
> and two suggestions (CLI input validation, client-generated IDs).

## Context & Motivation

Nightly code review (2026-03-31) przeanalizowalo diff z ostatnich commitow
(repeating tasks CLI + monthlyLastDay). Znalazlo 3 important issues i 2 suggestions.
Wszystkie dotycza jakosci kodu i zapobiegaja driftowi miedzy CLI a glowna aplikacja.

Coding guide wymaga DRY i walidacji inputow. Ten plan adresuje te naruszenia.

## Scope

### In scope
- [I1] Fix off-by-one w walidacji weekday (d <= 7 -> d <= 6)
- [I2] Eliminate duplicated RepeatSchedule/RepeatingTask types in CLI
- [I3] Extract shared formatSchedule to src/shared/schedule.ts
- [S1] Add input validation for --interval, --after-done, --monthly-day in CLI
- [S2] Document client-generated ID contract (nie zmieniamy server behavior)

### Out of scope
- Linter setup (ESLint/Prettier) -- osobny task
- Dependency audit fixes -- pre-existing, nie z tego diffu
- Zmiana testow vitest config -- `npm test` juz uruchamia schedule.test.ts

### Constraints
- CLI jest osobnym pakietem (cli/) z wlasnym tsconfig i build
- CLI importuje typy statycznie -- nie moze bezposrednio importowac z src/shared/ bez zmian w build config
- Shared schedule.ts uzywa typu RepeatScheduleLike (subset), nie pelnego RepeatSchedule
- Renderer re-exportuje typy z src/renderer/types/index.ts

## Key Decisions

### Decision 1: Shared types for CLI via symlink/copy vs shared package vs re-export
- **Choice:** Export formatSchedule i potrzebne stale z src/shared/schedule.ts. CLI zaimportuje typy z zbudowanego shared (albo uzyje komentarza sync + manualnej kopii jesli build config jest za skomplikowany).
- **Why:** Pelny shared package (workspace, monorepo) to overengineering dla solo projektu. Ale wyciagniecie formatSchedule do shared eliminuje duplikacje w renderererze i pozwala CLI importowac z jednego zrodla w przyszlosci.
- **Alternatives considered:** (a) monorepo workspace -- za duzo procesu, (b) kopiowanie z komentarzem `// keep in sync` -- tymczasowe, ale akceptowalne jesli build config blokuje import.
- **Trade-offs:** Jesli CLI nie moze importowac z ../src/shared, musimy skopiowac typy z komentarzem sync. Formatowanie bedzie w jednym pliku (schedule.ts), ale CLI potrzebuje wlasnej kopii formatSchedule jesli import nie zadziala.

### Decision 2: CLI types -- co z brakujacymi polami (startDate/endDate)?
- **Choice:** Dodac brakujace pola startDate/endDate do kopii CLI types (albo usunac kopie na rzecz importu).
- **Why:** Drift typow powoduje runtime bugs gdy serwer zwraca pola ktorych CLI nie zna.
- **Alternatives considered:** Ignorowanie -- pogarsza drift.
- **Trade-offs:** Minimalny koszt, eliminuje ryzyko.

### Decision 3: S2 -- client-generated ID
- **Choice:** Dodac komentarz dokumentujacy kontrakt (klient generuje UUID, serwer akceptuje). Nie zmieniamy behavior.
- **Why:** Serwer juz akceptuje client-side ID i nadpisuje order. Zmiana na server-generated ID to breaking change dla CLI i potencjalnie UI. Dokumentacja kontraktu wystarczy.
- **Trade-offs:** Klient moze wyslac zly ID, ale walidacja UUID to osobny temat.

### Decision 4: Podejscie do importu shared w CLI
- **Choice:** Zbadac czy CLI moze importowac bezposrednio z `../../src/shared/schedule.ts` (lub zbudowanej wersji). Jesli nie -- skopiowac formatSchedule do CLI z komentarzem `// synced from src/shared/schedule.ts`.
- **Why:** CLI kompiluje z rootDir=./src i outDir=./dist. Import spoza rootDir wymaga zmian w tsconfig. Trzeba to zbadac w kroku implementacji.

## Implementation Steps

### Step 1: Fix off-by-one in weekday validation [I1]
- **What:** Zmienic `d <= 7` na `d <= 6` w src/main/store.ts:437
- **How:** Edycja jednej linii w `isValidRepeatSchedule`. Zmiana `d >= 0 && d <= 7` na `d >= 0 && d <= 6`.
- **Why this approach:** Poprawne wartosci JS weekday to 0-6. Sasiedni branch `monthlyNthWeekday` (linia 442) juz poprawnie uzywa `d <= 6`. normalizeWeekday mapuje 7->0, ale walidacja powinna odrzucac niepoprawne dane u zrodla.
- **Confidence: 10/10** -- jedna linia, oczywisty bug, zweryfikowany kontekst
- **Acceptance criteria:**
  - [ ] `isValidRepeatSchedule({ type: 'weekdays', days: [7] })` zwraca `false`
  - [ ] `isValidRepeatSchedule({ type: 'weekdays', days: [0,1,2,3,4,5,6] })` zwraca `true`
  - [ ] Istniejacy test w schedule.test.ts nadal przechodzi (normalizeWeekdays obsluguje legacy 7)
- **Notes:** To NIE lamie istniejacych danych -- normalizeRepeatSchedule jest wywolywane przy save i normalizuje 7->0. Walidacja tylko blokuje nowe zapisy z d=7.

### Step 2: Extract formatSchedule to shared [I3]
- **What:** Przeniesc formatSchedule + stale (DAY_LABELS, WEEKDAY_NAMES, ORDINAL, WEEKDAY_DEFAULT) do src/shared/schedule.ts
- **How:**
  1. Dodac do src/shared/schedule.ts: export stale + export function formatSchedule(schedule: RepeatScheduleLike): string
  2. W RepeatView.tsx: usunac lokalna formatSchedule i stale, zaimportowac z shared
  3. Uzyc RepeatScheduleLike (juz istniejacy typ w schedule.ts) jako parametr
- **Why this approach:** schedule.ts jest naturalnym domem dla logiki schedule. RepeatScheduleLike jest juz tam zdefiniowany i pokrywa wszystkie warianty. RepeatView i CLI uzywaja identycznej logiki.
- **Confidence: 9/10** -- proste przeniesienie, typy juz kompatybilne (RepeatSchedule extends RepeatScheduleLike)
- **Acceptance criteria:**
  - [ ] formatSchedule jest exportowane z src/shared/schedule.ts
  - [ ] RepeatView.tsx importuje formatSchedule z ../types lub bezposrednio z shared
  - [ ] Brak duplikacji formatSchedule w RepeatView.tsx
  - [ ] `npm run build` przechodzi
  - [ ] Wszystkie warianty schedule (daily, weekdays, interval, afterCompletion, monthlyDay, monthlyNthWeekday, everyNMonths, monthlyLastDay) formatuja poprawnie
- **Notes:** Stale DAY_LABELS, WEEKDAY_DEFAULT, ORDINAL, WEEKDAY_NAMES -- sprawdzic czy nazwy nie koliduja z istniejacymi eksportami z schedule.ts. MONDAY_TO_FRIDAY juz istnieje (= [1,2,3,4,5]), wiec WEEKDAY_DEFAULT jest redundantny.

### Step 3: Update CLI to use shared formatSchedule or synced copy [I2 + I3]
- **What:** Usunac zduplikowane typy i formatSchedule z CLI, zastapic importem lub synced copy
- **How:**
  1. Sprawdzic czy CLI moze importowac z `../../src/shared/schedule.js` -- cli/tsconfig.json ma rootDir=./src, wiec prawdopodobnie nie
  2. Jesli import nie dziala: skopiowac formatSchedule + typy z shared do cli/src/lib/schedule.ts z komentarzem `// Synced from src/shared/schedule.ts -- keep in sync`
  3. Jesli import dziala: usunac lokalne typy, importowac z shared
  4. W obu przypadkach: dodac brakujace pola startDate/endDate do CLI types
  5. Usunac zduplikowane stale i formatSchedule z cli/src/commands/repeating-tasks.ts
- **Why this approach:** CLI jest osobnym pakietem. Bezposredni import moze nie dzialac bez zmian w build. Synced copy z komentarzem to pragmatyczne rozwiazanie dla solo projektu.
- **Confidence: 7/10** -- nie jestem pewien czy CLI build pozwoli na import z ../src/shared. Potrzebna weryfikacja.
- **Acceptance criteria:**
  - [ ] CLI nie zawiera zduplikowanej definicji RepeatSchedule (albo import z shared, albo jedna kopia w cli/src/lib/ z komentarzem sync)
  - [ ] CLI nie zawiera zduplikowanej formatSchedule (import lub synced copy)
  - [ ] CLI types zawieraja startDate/endDate
  - [ ] `cd cli && npm run build` przechodzi
  - [ ] `top5 rt` wyswietla poprawne formatowanie schedule
- **Notes:** Jesli zdecydujemy sie na synced copy, warto dodac komentarz z data ostatniej synchronizacji. W przyszlosci mozna przejsc na monorepo/shared package.

### Step 4: Add CLI input validation [S1]
- **What:** Walidowac --interval, --after-done, --monthly-day w buildSchedule
- **How:** W cli/src/commands/repeating-tasks.ts, w funkcji buildSchedule:
  ```
  if (opts.interval) {
    const days = parseInt(opts.interval as string, 10)
    if (isNaN(days) || days < 1) die('--interval must be a positive number')
    return { type: 'interval', days }
  }
  if (opts.afterDone) {
    const days = parseInt(opts.afterDone as string, 10)
    if (isNaN(days) || days < 1) die('--after-done must be a positive number')
    return { type: 'afterCompletion', days }
  }
  if (opts.monthlyDay) {
    const day = parseInt(opts.monthlyDay as string, 10)
    if (isNaN(day) || day < 1 || day > 31) die('--monthly-day must be 1-31')
    return { type: 'monthlyDay', day }
  }
  ```
- **Why this approach:** parseWeekdays juz waliduje (linia 70). Te trzy flagi parsuja parseInt bez sprawdzenia NaN/zakresu. Uzytkownik dostaje generyczny 400 od serwera zamiast jasnego bledu.
- **Confidence: 10/10** -- prosta walidacja, wzorzec juz istnieje w parseWeekdays
- **Acceptance criteria:**
  - [ ] `top5 rt add "test" --interval foo` wyswietla jasny blad (nie 400)
  - [ ] `top5 rt add "test" --interval 0` wyswietla blad
  - [ ] `top5 rt add "test" --interval -1` wyswietla blad
  - [ ] `top5 rt add "test" --after-done abc` wyswietla blad
  - [ ] `top5 rt add "test" --monthly-day 32` wyswietla blad
  - [ ] `top5 rt add "test" --monthly-day 0` wyswietla blad
  - [ ] Poprawne wartosci nadal dzialaja
- **Notes:** Walidacja w edit tez korzysta z buildSchedule, wiec fix pokrywa oba.

### Step 5: Document client-generated ID contract [S2]
- **What:** Dodac komentarz w API route i CLI wyjasniajacy kontrakt ID
- **How:**
  1. W src/main/api/routes/repeating-tasks.ts POST handler: komentarz `// Client provides full RepeatingTask with client-generated UUID. Server validates and may override order.`
  2. W cli/src/commands/repeating-tasks.ts add command: komentarz `// Client generates UUID; server accepts it and may override order field`
- **Why this approach:** Minimalny koszt, jasnosc kontraktu. Zmiana na server-generated ID to breaking change.
- **Confidence: 10/10** -- tylko komentarze
- **Acceptance criteria:**
  - [ ] Komentarz w API route wyjasnia kontrakt
  - [ ] Komentarz w CLI add wyjasnia kontrakt
- **Notes:** W przyszlosci mozna rozwazyc endpoint ktory przyjmuje partial body i serwer generuje ID.

## Dependencies & Order

```
Step 1 (off-by-one fix) -- no deps, standalone
Step 2 (extract formatSchedule to shared) -- no deps
Step 3 (CLI types/formatSchedule) -- blocked by Step 2 (needs shared formatSchedule to exist)
Step 4 (CLI validation) -- no deps, can run parallel with 1-2
Step 5 (documentation) -- no deps, can run parallel with anything
```

Critical path: Step 2 -> Step 3

Parallel groups:
- Group A: Steps 1, 2, 4, 5 (all independent)
- Group B: Step 3 (after Step 2)

## Risks & Mitigations

### Risk 1: CLI cannot import from src/shared/
- **Probability:** Medium -- CLI tsconfig has rootDir=./src, import from ../../src/shared/ likely fails
- **Mitigation:** Create synced copy in cli/src/lib/schedule.ts. Comment with source path and date.

### Risk 2: RepeatScheduleLike vs RepeatSchedule type mismatch
- **Probability:** Low -- RepeatScheduleLike jest subset, formatSchedule uzywa tylko type discriminant
- **Mitigation:** formatSchedule przyjmuje RepeatScheduleLike. RepeatSchedule (z types.ts) jest kompatybilny bo ma te same pola type.

### Risk 3: Stale js artifacts break build
- **Probability:** Low -- npm run build wlacza clean
- **Mitigation:** Zawsze `npm run build` (ktory robi clean) po zmianach.

## Definition of Done

The task is complete when ALL of the following are true:

- [ ] All 5 findings addressed (I1, I2, I3, S1, S2)
- [ ] `npm run build` passes
- [ ] `cd cli && npm run build` passes
- [ ] `npm test` passes (schedule tests)
- [ ] `npm run test:api` passes (66 API tests)
- [ ] No new duplicated logic between CLI and renderer
- [ ] All step-level acceptance criteria are met

## Verification

1. **Automated:**
   - `npm run build` -- full Electron build
   - `npm test` -- schedule unit tests (node:test)
   - `npm run test:api` -- API integration tests (vitest)
   - `cd cli && npm run build` -- CLI build

2. **Manual:**
   - `top5 rt` -- verify formatSchedule output matches UI
   - `top5 rt add "test" --interval foo` -- verify friendly error
   - `top5 rt add "test" --monthly-last-day` -- verify new schedule type works

3. **Code inspection:**
   - grep for duplicated formatSchedule -- should exist only in shared (+ optional synced copy in CLI)
   - grep for `d <= 7` in store.ts -- should not exist

---

Zadanie jest proste -- zespol agentow to overkill. Zrealizuj w jednej sesji.
