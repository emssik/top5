# Plan: Habits module — "Don't break the chain" w top5

> Dodanie modułu Habits do top5: powtarzalne nawyki (6 typów harmonogramu), rozliczanie
> serii (streaks), freeze/skip, retroaktywne oznaczanie dni, heatmapa, timer dla nawyków
> czasowych. Nawyki są **równoległym** systemem do tasków — widoczne w osobnej sekcji
> Today i osobnym widoku `Habits` (ikona 🔥 w sidebarze), NIE uczestniczą w Wins lock,
> ale są serwowane przez kanał read-only dla zewnętrznego AI (IPC + wewnętrzna funkcja
> łatwa do eksponowania jako HTTP API w przyszłości).

## Context & Motivation

Wins lock w top5 to kontrakt dzienny na <=5 tasków. Ale Daniel chce obok tego utrzymywać
długofalowe nawyki (speak drill codziennie, siłownia 3×/tydz., medytacja 10 min/dzień,
czytanie 180 min/tydz.) z mechaniką "don't break the chain" — streak, freeze jako tarcza,
skip jako urlop, retro-tick na zapomniany dzień.

Handoff `working/design_handoff_habits/README.md` zawiera gotowy high-fidelity prototyp
w HTML/React z pełnym schematem danych (`Habit`, 6 typów schedule, `computeStreak`,
`dayStatus`, `isScheduledOn`, `weeklyProgress`) i komplet UI: sidebar entry, HabitsView
(lista kart + heatmapa), HabitDetail, HabitEditor (one-pager), TimerModal, RetroModal,
integrację w Today i Stats.

Wymaganie dodatkowe od użytkownika (Q2): HTTP API dla habbitów **nie** jest potrzebne
**teraz**, ale:
- kod musi być napisany tak, aby wystawienie habbitów przez HTTP było trywialne
  (wzorzec: service + route, jak `repeating-tasks`)
- **konieczny jest read-only getter** zwracający nawyki aktywne/zaplanowane danego dnia —
  model AI asystujący Danielowi musi wiedzieć, co on dziś robi. W v1 eksponowany przez
  IPC (`habits-today`) i przez endpoint `/api/v1/today` (rozszerzenie istniejącej odpowiedzi
  o sekcję `habits`), bez pełnego CRUD przez HTTP.

## Scope

### In scope
- Nowy typ `Habit` w `src/shared/types.ts` + rozszerzenie `AppData` o `habits: Habit[]`.
- Persystencja: w tym samym `data.yaml` (iCloud sync) — **nie** w osobnym pliku. Log
  dzienny per habit trzyma się wewnątrz obiektu `Habit.log`.
- Shared schedule engine dla habbitów: `src/shared/habit-schedule.ts` — 6 typów:
  `daily`, `weekdays`, `nPerWeek`, `interval`, `dailyMinutes`, `weeklyMinutes` —
  plus funkcje `isScheduledOn`, `dayStatus`, `computeStreak`, `weeklyProgress`,
  `scheduleLabel` (kopia semantyki z `data.jsx` handoffu, ale w TS).
- Testy jednostkowe dla schedule engine (`tests/habit-schedule.test.ts`) — pokrycie
  wszystkich 6 typów, edge-case'y freeze/skip, streak przerywany przez 'empty',
  nPerWeek vs. weeklyMinutes rollup tygodniowy.
- Service layer: `src/main/service/habits.ts` — CRUD, tick (done/freeze/skip/undo),
  retro-tick, timer-log, `getTodayHabits()` (read-only getter dla AI: co jest
  zaplanowane dziś + status).
- IPC handlery w `src/main/store.ts` + preload w `src/preload/index.ts`:
  `save-habit`, `remove-habit`, `reorder-habits`, `habit-tick`, `habit-retro-tick`,
  `habit-log-minutes`, `habits-today`.
- Renderer store: rozszerzenie `useProjects.ts` o `habits` + akcje.
- Komponenty (w `src/renderer/components/habits/`):
  - `HabitsView.tsx` — lista kart, stat grid, sub-tabs (wszystkie / do zrobienia dziś
    / aktywne chainy), CTA "Nowy nawyk".
  - `HabitRow.tsx` — karta listy z heatmapą, tytułem, streak chipem, CTA.
  - `Heatmap.tsx` + `HeatmapLegend.tsx` — 32 tygodnie grid, kliknięcie kafelka →
    RetroModal.
  - `HabitDetail.tsx` — pełny widok z 5-kolumnowym stat gridem i akcjami.
  - `HabitEditor.tsx` — modal one-pager (basics + schedule + advanced), wybór ikony
    z lucide/SVG.
  - `TimerModal.tsx` — dla nawyków czasowych, quick picks 5/10/15/25/30/45/60 min.
  - `RetroModal.tsx` — done/freeze/skip/clear dla wybranego dnia.
  - `TodayHabitsSection.tsx` — sekcja pod taskami w TodayView: "Habits today · N/M"
    + lista `TodayHabitRow`.
- Sidebar: nowy entry "Habits" (🔥) między `Repeat` a `Stats`, kieruje na
  `activeView === 'habits'`.
- Stats: rozszerzenie `InlineStatsView.tsx` o sekcję "Habit Stats" (4 stat cards +
  tabela 14 dni × habit).
- Obsidian journal: w `generateDailyMarkdown` sekcja "Nawyki" po "Zrobione" —
  lista nawyków zaplanowanych dziś z symbolem ✓/⏸/🛡/·.
- Styling: klasy `.habit-*`, `.heat-cell`, `.streak-chip`, `.confetti`, `.toast`
  w `src/renderer/styles.css` — używając istniejących CSS variables (light/dark).
- Ikony: nowy helper `HabitIcon.tsx` z 10 ikonami inline SVG w stylu lucide.
- Edge-case ochrony: przy zmianie strefy czasowej/podróży — wszystkie operacje używają
  lokalnego `dateKey(new Date())` (tak jak istniejące `schedule.ts`).

### Out of scope
- Pełen HTTP CRUD dla habbitów (tylko read-only getter przez rozszerzenie `/today`).
- Konfetti i toast animacje — **w scope** (MVP prototypu), ale prosta implementacja
  (CSS animation + krótko-żywy div), bez biblioteki.
- Sandbox Electron — nie ruszamy (CLAUDE.md).
- Migracja starych danych (brak starych danych — feature nowy).
- Drag-and-drop zmiany kolejności habbitów — tylko pole `order` + reorder przez
  strzałki/API, bez DnD w v1 (prototyp też nie pokazuje DnD na kartach).
- Tryb wizard w HabitEditor — tylko one-pager (KISS, jedna ścieżka edycji).
- Warianty Tweaks (layout list/grid/timeline, chainStyle dots/progress) — tylko
  `list` + `heatmap` (KISS; prototyp oferował 3 warianty dla review, finalnie
  trzymamy jeden).
- Klonowanie / archiwizacja habbitów (na razie delete + kreowanie od nowa).
- Integracja z FocusMode (timer habit-u NIE uruchamia focus mode top5 — to osobny,
  lżejszy timer).
- CLI `top5 habits` — poza scope; skill top5 nie dostaje habbitów w v1.

### Constraints
- **TypeScript strict** — typy zunifikowane w `src/shared/types.ts`.
- **Build**: `npm run build` (clean + typecheck + electron-vite build) musi przechodzić.
- **Testy**: `npm run test` (tsc + node --test) dla `habit-schedule.test.ts` musi zielony.
- **Electron sandbox**: NIE zmieniać (CLAUDE.md).
- **Single developer / solo project** — bez feature flagów, bez warstw walidacji
  "na zapas"; walidacja IPC minimalna (type guards jak w istniejącym `isValidRepeatingTask`).
- **iCloud**: `data.yaml` rośnie o tablicę habbitów — log może z czasem być duży
  (codziennie 1 wpis × N habbitów × 365 dni). Dla 10 habbitów przez 2 lata to ~7300
  wpisów YAML. Akceptowalne; jeśli kiedyś obciąży — można wyciąć do JSONL osobno
  (patrz Decision 2 + ADR).
- **Nie duplikować semantyki** istniejącego `RepeatSchedule` — habity mają **inny**
  typ schedule (bo zawierają `nPerWeek`, `dailyMinutes`, `weeklyMinutes` których
  Top5 Repeat nie ma), więc to osobny typ, osobny engine. Nie próbujemy łączyć.

## Key Decisions

### Decision 1: Habits jako osobny typ obok `RepeatingTask`, NIE rozszerzenie

- **Choice:** Dodajemy nowy typ `Habit` w `src/shared/types.ts` z własnym
  `HabitSchedule` (`daily`, `weekdays`, `nPerWeek`, `interval`, `dailyMinutes`,
  `weeklyMinutes`). Nowy engine: `src/shared/habit-schedule.ts`. Niezależny service
  `src/main/service/habits.ts`.
- **Why:** `RepeatingTask` generuje jednorazowe QuickTasks (accept / dismiss);
  jego celem jest uruchamianie tasków kontraktu dziennego. Habit to **długofalowy
  chain** z freeze/skip/retro-tick — inny model mental: zamiast "taska do zrobienia"
  mamy "pole w logu dnia". 3 z 6 typów harmonogramu habita (`nPerWeek`,
  `dailyMinutes`, `weeklyMinutes`) nie mają sensu w `RepeatSchedule`. Próba
  unifikacji zmusiłaby nas do wstawiania flag w każde miejsce logiki i połowiczne
  zachowania (bo freeze nie ma sensu dla tasków). KISS: dwa systemy, każdy prosty.
- **Alternatives considered:**
  - **Rozszerzyć `RepeatingTask` o 3 nowe typy schedule + opcjonalne `log`, `freezeAvailable`** —
    odrzucone: muli istniejący kod ("if habit then…"), wymieszałoby proposal-flow
    (accept → QuickTask) z chain-flow (tick → log entry). Złamałoby KISS.
  - **Habits jako subtyp QuickTask** — odrzucone: QuickTask to pojedynczy akt
    zrobienia, habit to sekwencja zdarzeń na przestrzeni tygodni.
- **Trade-offs:** + czyste modele, łatwo testować w izolacji, łatwo rozszerzyć
  jeden bez dotykania drugiego. − trochę powtórzonej mechaniki (np. `dateKey`,
  `isScheduledOn` per-day) — akceptowalne, bo obliczenia są proste i różnią się
  semantycznie.

### Decision 2: Persystencja w `data.yaml` pod kluczem `habits`, log inline wewnątrz `Habit.log`

- **Choice:** Habits lądują w istniejącym `data.yaml` jako `habits: Habit[]` na
  poziomie `AppData`. Log per-day trzymany jest **inline** w `Habit.log:
  Record<string, { done?, minutes?, freeze?, skip? }>`. Bez osobnego pliku JSONL.
- **Why:** (1) iCloud sync działa dla `data.yaml` — jeden plik to jeden punkt sync;
  dorzucenie drugiego (habits.jsonl) wymagałoby replikacji logiki backup/sync.
  (2) Rozmiar: dla 10 habbitów × 365 dni × ~40 bajtów/wpis = ~146 KB/rok — nieistotne
  w YAMLu, który już dziś ma projekty + quickTasks. (3) Atomowość zapisu: wszystko
  w jednym `saveData` — bez kombinacji "najpierw yaml, potem jsonl, a jak coś padnie…".
  (4) Odczyt dla getter-a/streak — wszystko w pamięci, bez I/O.
- **Alternatives considered:**
  - **Osobny `habits.yaml`** — odrzucone: drugi plik to drugi backup, drugi
    reload, brak atomowości zapisu między nimi, marginalna wartość (brak wyraźnego
    use-case).
  - **`habits.jsonl` dla logu + `habits.yaml` dla definicji** — odrzucone:
    trzeci plik, rozszczepienie "czytanie streaka" na dwa źródła, brak zysku
    (log jest mały; nie strumieniujemy go linia-po-linii jak check-ins/operations
    które mogą być tysiącami). Check-iny/operations są JSONL bo są append-only
    i mogą rosnąć szybko (co minutę ping focus); log habitów to jeden wpis/dzień/habit
    — inny profil.
  - **JSONL dla logu z jednym plikiem globalnym `habits.jsonl` (event-sourced)** —
    odrzucone: wymaga rebuilda stanu przy każdym odczycie, komplikuje retro-tick
    (nadpisywanie wpisów ⇒ append nowych i "wygaszanie" starych, jak w event
    sourcingu), overkill dla 1 usera.
- **Trade-offs:** + prostota, atomic write, jeden backup. − jeśli user kiedyś
  będzie miał 50 habbitów × 5 lat, YAML się rozrośnie (~3-4 MB) i load/save
  stanie się zauważalnie wolny. Wtedy można wtedy wydzielić log do JSONL bez
  zmiany kontraktu zewnętrznego. Na dzień dzisiejszy — YAGNI.

### Decision 3: Habits NIE uczestniczą w Wins lock, są osobnym, równoległym systemem

- **Choice:** Wins lock (5-task daily contract) dotyczy **tylko** QuickTasks i
  pinned tasks — jak dotychczas. Scheduled-habits-dziś są pokazywane w TodayView
  w osobnej sekcji poniżej tasków, mają własny postęp "N/M habits today", ale
  **nie** wpływają na warunki win/loss. Użytkownik wyraził opcję "B (inna —
  doprecyzować)" — doprecyzowujemy tu.
- **Why:** (1) Wins lock to kontrakt typu "do końca dnia zrobię te 5 rzeczy".
  Habit to "ciągłość przez miesiące", mierzony streakiem, z freeze/skip — inne
  ramy czasowe i semantyka. (2) Jeśli habit uczestniczyłby w lock, to co z
  freeze/skip? Freeze = nie-zrobione-ale-chain-bezpieczny; w lock musielibyśmy
  albo traktować freeze jako "zrobione" (fałszowałoby wins history), albo jako
  "nie zrobione" (niszczyłoby sens freeze jako tarczy). (3) Wins streak i habit
  streak są ortogonalne — możliwe kombinacje: dzień wygrany + habit streak OK;
  dzień wygrany + habit chain pęknie; dzień przegrany + habit OK dzięki
  freeze'owi. Wartość motywacyjna oddzielnych wskaźników > wartość jednego.
  (4) Implementacyjnie: `checkWinCondition()` w `wins.ts` pozostaje bez zmian
  (nie widzi habbitów), co minimalizuje ryzyko regresji.
- **Alternatives considered:**
  - **A: Habity wliczane do lock** (handoff "integration=mixed/separate" implicit) —
    odrzucone z powodów wyżej (freeze/skip + semantyka).
  - **C: Habity w osobnej sekcji, ale dodatkowy "habits-lock" niezależny od
    wins-lock** — odrzucone: dublowanie mechaniki lock bez realnego use-case
    (lock istnieje dla tasków bo one znikają po zrobieniu; habit "pozostaje"
    i ma naturalny streak).
  - **D: `todayIntegration` jako ustawienie w Settings (separate / mixed / none)** —
    odrzucone: KISS, jedna konfiguracja (separate) wystarczy; ustawienia to koszt
    konserwacyjny.
- **Trade-offs:** + czyste oddzielenie semantyk, brak regresji w wins-lock, łatwiej
  rozumować o każdym z systemów. − user nie ma trybu "habits are my mandatory
  daily commitment" — jeśli kiedyś będzie chciał, można dodać opcjonalne
  "priority habit" wliczane do lock. YAGNI.

### Decision 4: Service-layer z read-only getterem `getTodayHabits()` gotowym do eksponowania przez HTTP

- **Choice:** Logika w `src/main/service/habits.ts` jest czysta (bez `ipcMain`
  / `electron` dependencji), analogicznie do `service/repeating-tasks.ts`.
  `getTodayHabits()` zwraca `{ habits: HabitTodayEntry[] }` — per-habit: id, name,
  icon, projectId, schedule, isScheduled (true gdy dziś zaplanowany), status
  ('done'|'freeze'|'skip'|'pending'), streak, minutes (dla time-based). IPC
  handler `habits-today` wywołuje getter i zwraca surowy wynik. Endpoint
  `/api/v1/today` (istniejący) rozszerza swoją odpowiedź o pole `habits:
  HabitTodayEntry[]` obok `data` (current tasks).
- **Why:** User explicite wymaga: "możliwość pobrania informacji o habbitach (że
  są i jakie są aktywne danego dnia), bo bez tego model AI wspierający użytkownika
  nie będzie miał pełnej wiedzy o tym co robi danego dnia." Rozszerzenie `/today`
  (zamiast nowego endpointu `/habits/today`) to minimalna zmiana kontraktu:
  wszystko, co AI dziś pyta o Today, już ląduje w jednej odpowiedzi. Osobny
  endpoint zwiększyłby liczbę round-tripów dla AI.
- **Alternatives considered:**
  - **Pełne CRUD przez HTTP (`/api/v1/habits`)** — odrzucone: user jawnie
    powiedział "nie ma potrzeby tworzenia API do habbitów".
  - **Osobny endpoint `/api/v1/habits/today`** — odrzucone: fragmentuje
    "co Daniel robi dziś" na 2 zapytania. Jeden endpoint /today z pełnym
    obrazem dnia jest lepszy dla AI.
  - **Przekazać pełny `Habit` z całym `log`** — odrzucone: rozmiar (kilkaset
    wpisów per habit × N habitów) niepotrzebnie rośnie na drucie; AI potrzebuje
    "co jest dzisiaj", nie "cała historia". Streak już skompresowany jest w
    jednej liczbie.
  - **Dodać CRUD habbitów przez HTTP z flagą `TOP5_HABITS_API=1`** —
    odrzucone: feature flag "na zapas" (CLAUDE.md: simplicity beats flexibility).
- **Trade-offs:** + user dostaje dokładnie to, czego potrzebuje (AI widzi habits
  dnia) przy zerowym dodatkowym endpointzie. + pełny CRUD w przyszłości to
  trywialna kopia wzorca `repeating-tasks.ts` (service już istnieje). − jeśli
  kiedyś AI będzie potrzebowało zapisywać tick habitu (np. głosem), będzie
  trzeba dodać POST. Na dziś nie jest to wymagane.

### Decision 5: Jedna konfiguracja UI (KISS) — brak Tweaks panelu, tylko wariant `list` + `heatmap` + `onepager` + `separate`

- **Choice:** Z prototypu eliminujemy 3 wymiary tweaks-ów (layout grid/timeline,
  chainStyle dots/progress, editorMode wizard, todayIntegration mixed/none).
  Implementujemy tylko: layout=list, chainStyle=heatmap, editorMode=onepager,
  todayIntegration=separate, confetti=on.
- **Why:** Prototyp oferuje tweaks jako playground dla designera, żeby wybrać
  wariant. Daniel jako solo-user i solo-dev potrzebuje jednej, przemyślanej
  implementacji (CLAUDE.md: simplicity beats flexibility unless flexibility is
  needed now). Dodanie 4 wymiarów tweaks to 4× więcej kodu, gałęzi i testów.
- **Alternatives considered:**
  - **Zbudować wszystkie 4 wymiary jak w prototypie** — odrzucone: 4× wysiłek,
    1× korzyść, jeśli wariant przestanie się podobać można zmienić jeden komponent.
  - **Dodać tweaks tylko dla todayIntegration (separate/none)** — odrzucone:
    i tak user będzie trzymał "separate" (inaczej po co habit?). "none" to po
    prostu widok Habits bez linku z Today — osiągalne przez przestanie-otwierania-Today.
- **Trade-offs:** + znacznie mniej kodu, jeden happy path do przetestowania.
  − jeśli Daniel zechce dots / timeline w widoku Habits, trzeba będzie dodać.
  Ale taka zmiana to ~30 LOC per wariant; tańsza niż ciągłe utrzymywanie
  wszystkich czterech.

### Decision 6: Streak algorithm działa w pamięci przy każdym odczycie (bez cache)

- **Choice:** `computeStreak(habit)` jest czystą funkcją: iteruje po `habit.log`
  od `createdAt` do dziś. Wywoływana przy każdym renderze komponentu / getter-a
  AI. Bez cachowania.
- **Why:** Koszt: max ~730 iteracji (2 lata) × ~10 habbitów = 7300 operacji,
  każda O(1) lookup w obiekcie. Wykonanie: <1ms. Cache to komplikacja:
  invalidation przy tick/retro/delete/edit — łatwo pomylić, błędy manifestują
  się jako "streak się nie odświeżył" (najgorszy UX dla feature opartego na
  feedback'u). KISS.
- **Alternatives considered:**
  - **Cache streak w `habit.streakCache: {value, computedAt}`** — odrzucone:
    invalidation przy każdym tick-u i tak zeruje cache, więc korzyść marginalna.
  - **Memoizacja w React (useMemo po `habit.log`)** — można dodać w HabitRow jeśli
    profilowanie pokaże problem. Na start nie.
- **Trade-offs:** + zero stale-cache błędów. − jeśli user stworzy 100 habbitów
  przez 5 lat, re-render Today może się zauważalnie spowolnić. YAGNI; jeśli
  dotrze — useMemo albo cache.

## Implementation Steps

> Convention: `[x]` na końcu headera = krok ukończony; `- [ ]` / `- [x]` dla
> acceptance criteria.

### Step 1: Dodaj typy `Habit`, `HabitSchedule`, `HabitLogEntry`, `HabitTodayEntry` w `src/shared/types.ts` [x]

- **What:** Dodać nowe typy i rozszerzyć `AppData` o `habits?: Habit[]`.
- **How:**
  - W `src/shared/types.ts` dodać:
    ```ts
    export type HabitSchedule =
      | { type: 'daily' }
      | { type: 'weekdays'; days: number[] }  // 0=Sun..6=Sat, Mon-based w UI
      | { type: 'nPerWeek'; count: number }
      | { type: 'interval'; every: number }
      | { type: 'dailyMinutes'; minutes: number }
      | { type: 'weeklyMinutes'; minutes: number }

    export interface HabitLogEntry {
      done?: boolean
      minutes?: number
      freeze?: boolean
      skip?: boolean
    }

    export interface Habit {
      id: string
      name: string
      projectId?: string | null  // nullable, bo habit może być bez projektu
      icon: string               // nazwa ikony z HABIT_ICONS
      note: string
      createdAt: string          // 'YYYY-MM-DD'
      freezeAvailable: number    // ile tarcz zostało
      order: number
      schedule: HabitSchedule
      log: Record<string, HabitLogEntry>  // 'YYYY-MM-DD' -> entry
      archivedAt?: string | null
    }

    export interface HabitTodayEntry {
      id: string
      name: string
      icon: string
      projectId: string | null
      schedule: HabitSchedule
      isScheduled: boolean
      status: 'done' | 'freeze' | 'skip' | 'pending'
      streak: number              // aktualny streak
      streakUnit: 'dni' | 'tyg'
      minutesToday?: number       // tylko dla dailyMinutes
      minutesGoal?: number        // tylko dla time-based
    }
    ```
  - Dopisać `habits?: Habit[]` do `AppData`.
  - Re-export w `src/renderer/types/index.ts` (jak dla pozostałych typów).
- **Why this approach:** Single source of truth — bez typów nic dalej się nie
  skompiluje. Osobny `HabitTodayEntry` (DTO) chroni API przed wyciekaniem
  pełnego `log` (privacy + bandwidth).
- **Confidence: 10/10**
- **Acceptance criteria:**
  - [x] `src/shared/types.ts` zawiera wszystkie nowe typy i `habits?` w `AppData`
  - [x] `npm run typecheck` przechodzi
  - [x] Re-export w `src/renderer/types/index.ts` dodany (Habit, HabitSchedule,
        HabitLogEntry, HabitTodayEntry)
- **Notes:** `weekdays.days` — prototyp używa 0=Mon..6=Sun, istniejący
  `RepeatSchedule.weekdays` używa 0=Sun..6=Sat (JS Date convention). Trzymamy
  **JS convention 0=Sun..6=Sat** dla spójności z `schedule.ts` (zamienić konwencję
  względem prototypu — w UI i tak mapujemy na etykiety Pn/Wt/…). Dopisać w
  komentarzu przy typie.

### Step 2: Zaimplementuj shared schedule engine `src/shared/habit-schedule.ts` [x]

- **What:** Czysty TS moduł z funkcjami: `isScheduledOn(habit, date) -> boolean`,
  `dayStatus(habit, dateKey) -> 'empty'|'l1'|'l2'|'l3'|'l4'|'freeze'|'skip'`,
  `computeStreak(habit, today?) -> { streak, best, unit }`, `weeklyProgress(habit,
  weekStart?) -> { got, goal }`, `scheduleLabel(schedule) -> string`.
- **How:**
  - Port logiki z `working/design_handoff_habits/src/data.jsx` (`data.jsx`
    linie 65-153).
  - Zmień konwencję `weekdays.days` na 0=Sun..6=Sat (dostosuj filtr w
    `isScheduledOn`).
  - Użyj `dateKey` z `src/shared/schedule.ts` (DRY).
  - Export `HABIT_ICONS: readonly string[]` = 10 nazw ikon.
  - Export `DEFAULT_FREEZE_AVAILABLE = 1`.
- **Why this approach:** Shared (main + renderer) — streak liczy się identycznie
  po obu stronach. Czysty TS = trywialnie testowalny w `tests/`.
- **Confidence: 9/10**
- **Acceptance criteria:**
  - [x] Plik `src/shared/habit-schedule.ts` istnieje, eksportuje wszystkie
        wymienione funkcje i stałe
  - [x] Brak importów z `electron`, `fs`, `path` (czysty shared)
  - [x] `npm run typecheck` przechodzi
- **Notes:** W prototypie `isScheduledOn` dla `nPerWeek` i `weeklyMinutes`
  **zawsze zwraca true** — bo te schedule są tygodniowe, nie dzienne. Utrzymać
  to zachowanie (dla UI "habit jest w grze dziś" = true); realny warunek sukcesu
  rozpatrujemy w `computeStreak` (tygodniowy rollup).

### Step 3: Testy jednostkowe `tests/habit-schedule.test.ts` [x]

- **What:** Test suite używająca `node --test` (spójne z `tests/schedule.test.ts`).
- **How:**
  - Pokryć wszystkie 6 typów schedule: `isScheduledOn` na datach near edges
    (sąsiad niedzieli dla interval, 1-szy dzień miesiąca, dzień utworzenia).
  - `computeStreak` dla:
    - daily: pełne chaine, chain przerwany przez 'empty' w środku, chain
      uratowany przez freeze (nie-empty).
    - weekdays: dni poza listą nie resetują streak.
    - interval(every=3): scheduled co trzeci dzień, pominięty dzień scheduled
      resetuje.
    - nPerWeek(3): tydzień z 2 done → wCur=0 po zamknięciu tygodnia; tydzień
      z 3+ done → wCur++; weeklyBest = max.
    - dailyMinutes(10): minuty akumulowane, done=true gdy >=10.
    - weeklyMinutes(180): suma minut w tygodniu >=180 → week++.
  - `dayStatus`: pct 0.5 → l1, 1.0 → l2, 1.2 → l3, 1.5 → l4, entry.freeze → 'freeze'.
  - Edge: `createdAt === today` → streak=0 lub 1 zależnie od done.
- **Why this approach:** Streak engine to serce featuru i ma nietrywialne
  rollupy tygodniowe — bez testów każda zmiana to ryzyko regresji.
- **Confidence: 9/10**
- **Acceptance criteria:**
  - [x] `npm run test` (= tsc build + node --test tests/*.test.ts) przechodzi
  - [x] Minimum 20 assertions pokrywających 6 typów schedule + freeze/skip + retro
  - [x] `computeStreak` zwraca oczekiwane wartości dla wszystkich typów
- **Notes:** Tests nie mockują Date; fabrykują `createdAt` względne do konkretnej
  daty przekazanej jako argument `computeStreak(habit, today)` — parametr `today`
  musi być opcjonalny w signature (default `new Date()`).

### Step 4: Service layer `src/main/service/habits.ts` [x]

- **What:** CRUD + mutacje logu + getter `getTodayHabits()`. Wzorzec:
  `service/repeating-tasks.ts`.
- **How:**
  - Funkcje:
    ```ts
    getHabits(): Habit[]
    saveHabit(input: unknown): Habit[] | ServiceError    // upsert, order = max+1 dla nowych
    removeHabit(id: string): Habit[] | ServiceError
    reorderHabits(orderedIds: unknown): Habit[] | ServiceError
    tickHabit(id: string, mode: 'done'|'freeze'|'skip'|'undo'): Habit[] | ServiceError
    retroTickHabit(id: string, dateKey: string, action: 'done'|'freeze'|'skip'|'clear'): Habit[] | ServiceError
    logHabitMinutes(id: string, minutes: number): Habit[] | ServiceError
    getTodayHabits(date?: Date): HabitTodayEntry[]
    ```
  - Walidator `isValidHabit(v): v is Habit` — minimalne sprawdzenie pól
    (spójne z `isValidRepeatingTask`).
  - Integracja z `store.ts`: `getData().habits ?? []` (fallback dla starych
    instalacji bez pola).
  - `appendOperation({ type: 'habit_ticked', ... })` — ale **nie** rozszerzamy
    `OperationType` union (to pollutes existing enum). Zamiast tego: przy tick
    po prostu `console.log` + optional `details` string w istniejącym wpisie
    `task_completed`. Alternatywa: dodać `'habit_ticked'` do unii — OK, bo
    `OperationLogEntry` jest flexibly opisywany. **Decyzja**: dodajemy `'habit_ticked'`,
    `'habit_freeze'`, `'habit_skip'` do union (jeden-liniowy commit).
  - `tickHabit('freeze')`: wymaga `freezeAvailable > 0`; dekrementuje licznik.
    `tickHabit('skip')`: nie dekrementuje niczego. `tickHabit('done')`: zapisuje
    `{done: true}` (lub merge z `{minutes: X}` jeśli juz było).
  - `getTodayHabits` używa `habit-schedule.ts`: dla każdego habitu sprawdza
    `isScheduledOn(today)`, wyznacza `status` z `log[todayKey]`, `streak` z
    `computeStreak`, dla `dailyMinutes` zwraca `minutesToday` i `minutesGoal`.
- **Why this approach:** Wzorzec już istnieje (`service/repeating-tasks.ts`).
  Pure TS, testowalny, łatwo jutro podpiąć do HTTP route bez refaktoru.
- **Confidence: 9/10**
- **Acceptance criteria:**
  - [x] `src/main/service/habits.ts` eksportuje wszystkie funkcje z powyższej
        listy
  - [x] `saveHabit` przydziela `order = max + 1` dla nowego habitu, preservuje
        `order` przy update
  - [x] `tickHabit('freeze')` zwraca `ServiceError {error:'validation'}` gdy
        `freezeAvailable <= 0`
  - [x] `getTodayHabits()` dla habita zaplanowanego dziś z entry `{done:true}`
        zwraca `status: 'done'` i `streak` zgodny z `computeStreak`
- **Notes:** `removeHabit` — hard delete (bez soft). Jeśli user przypadkiem usunie,
  może odtworzyć z backupu (istniejący dailyBackup obejmuje `data.yaml`).

### Step 5: IPC handlery w `src/main/store.ts` + preload API [x]

- **What:** Podpięcie service pod IPC + wystawienie metod w `window.api`.
- **How:**
  - `src/main/store.ts`:
    ```ts
    ipcMain.handle('save-habit', (_e, habit) => { ... habitService.saveHabit(habit) ... notifyAllWindows(); return result })
    ipcMain.handle('remove-habit', (_e, id) => { ... })
    ipcMain.handle('reorder-habits', (_e, ids) => { ... })
    ipcMain.handle('habit-tick', (_e, id, mode) => { ... })
    ipcMain.handle('habit-retro-tick', (_e, id, dateKey, action) => { ... })
    ipcMain.handle('habit-log-minutes', (_e, id, minutes) => { ... })
    ipcMain.handle('habits-today', () => habitService.getTodayHabits())
    ```
  - `loadData()` → dołącz `habits: parsed?.habits ?? []` do `AppData`.
  - `defaultData` → `habits: []`.
  - `src/preload/index.ts` → dodać metody na `api`:
    ```ts
    saveHabit: (h: Habit) => ipcRenderer.invoke('save-habit', h),
    removeHabit: (id: string) => ipcRenderer.invoke('remove-habit', id),
    reorderHabits: (ids: string[]) => ipcRenderer.invoke('reorder-habits', ids),
    habitTick: (id: string, mode: 'done'|'freeze'|'skip'|'undo') => ipcRenderer.invoke('habit-tick', id, mode),
    habitRetroTick: (id: string, dateKey: string, action: 'done'|'freeze'|'skip'|'clear') => ipcRenderer.invoke('habit-retro-tick', id, dateKey, action),
    habitLogMinutes: (id: string, minutes: number) => ipcRenderer.invoke('habit-log-minutes', id, minutes),
    habitsToday: (): Promise<HabitTodayEntry[]> => ipcRenderer.invoke('habits-today')
    ```
  - Każdy handler po mutacji woła `notifyAllWindows()`.
- **Why this approach:** Wzorzec identyczny z repeating-tasks / quick-tasks.
  `notifyAllWindows()` synchronizuje sidebar counters i Today section.
- **Confidence: 9/10**
- **Acceptance criteria:**
  - [x] Wszystkie 7 IPC kanałów zarejestrowane w `registerStoreHandlers`
  - [x] Wszystkie 7 metod dostępnych w `window.api`
  - [x] `getData()` z fresh data.yaml bez `habits` zwraca `habits: []`
        (nie undefined)
  - [x] Po `save-habit` z nowego okna następuje `notifyAllWindows` (log widać w
        konsoli)
- **Notes:** `save-api-config` ma dodatkową logikę restart servera — dla habbitów
  nic nie restartujemy. Trzymaj walidację minimalną (jak
  `isValidRepeatingTask` — type + required fields).

### Step 6: Rozszerz `src/renderer/hooks/useProjects.ts` o habits

- **What:** Dodać `habits: Habit[]` do store + akcje analogiczne do
  `repeatingTasks`.
- **How:**
  - W `ProjectsState`:
    ```ts
    habits: Habit[]
    saveHabit(h: Habit): Promise<void>
    removeHabit(id: string): Promise<void>
    reorderHabits(ids: string[]): Promise<void>
    habitTick(id: string, mode): Promise<void>
    habitRetroTick(id: string, dateKey: string, action): Promise<void>
    habitLogMinutes(id: string, minutes: number): Promise<void>
    ```
  - `loadData` → `habits: data.habits ?? []`.
  - Każda akcja: invoke IPC → `set({ habits: updated })`.
- **Why this approach:** Single store, jeden sposób aktualizacji danych. Spójnie
  z `repeatingTasks` i `quickTasks`.
- **Confidence: 10/10**
- **Acceptance criteria:**
  - [ ] `useProjects().habits` zwraca poprawnie tablicę z YAML
  - [ ] `saveHabit({...})` aktualizuje store i powoduje re-render konsumenta
  - [ ] `reload-data` event z main (po save w innym oknie) odświeża `habits`
- **Notes:** Reload-data listener już jest zbiorczy — nie wymaga rozszerzeń.

### Step 7: Shared constants + ikony habbitów

- **What:** Helper do ikon inline SVG w stylu lucide (10 ikon: flame, book,
  dumbbell, leaf, mic, pen, code, no-sugar, note, clock).
- **How:**
  - `src/renderer/components/habits/HabitIcon.tsx` — `function HabitIcon({name,
    size=16, stroke='currentColor'})` z switch dla 10 ikon (port z
    `data.jsx:155-185`).
  - W `src/shared/habit-schedule.ts` (Step 2) już eksportuje `HABIT_ICONS`
    jako `readonly string[]` — UI pill-picker używa tej listy.
- **Why this approach:** Inline SVG = zero dependency bloat, zero network
  request. Prototyp to już pokazał. Używać `currentColor` dla łatwego
  dopasowania do theme.
- **Confidence: 9/10**
- **Acceptance criteria:**
  - [ ] Komponent `HabitIcon` renderuje każdą z 10 ikon bez błędów
  - [ ] Fallback "default" gdy nazwa nieznana (prosty circle)
- **Notes:** Alternatywa: `lucide-react` (package już w projekcie? sprawdzić
  package.json). **Jeśli tak** — użyj `lucide-react` zamiast inline, mniej kodu.
  Jeśli nie — inline SVG. Założenie w planie: inline (minimize deps).

### Step 8: Komponenty habits — Heatmap + HeatmapLegend

- **What:** `src/renderer/components/habits/Heatmap.tsx` + `HeatmapLegend.tsx`.
- **How:**
  - Heatmap: grid 7×N, gdzie N=weeks (default 32 dla detail, 26 dla row).
    Każda komórka: `<div class="heat-cell {levelClass}">` z tooltip={dateKey}.
    Props: `{ habit, weeks, onCellClick?(dateKey) }`. Port z
    `working/design_handoff_habits/src/chain.jsx`.
  - HeatmapLegend: statyczna legenda "mniej → [l1][l2][l3][l4] → więcej" + freeze,
    skip, miss.
  - CSS: `.heat-cell`, `.heat-cell.l1..l4`, `.heat-cell.freeze`, `.heat-cell.skip`,
    `.heat-cell.miss`, `.heat-cell.future` w `src/renderer/styles.css`.
  - Kolory z handoffu (Design Tokens) zmapowane na CSS variables (jeśli nie
    ma odpowiedników → hardcode w klasach `.heat-cell.*`).
- **Why this approach:** Bez zewnętrznej biblioteki kalendarza — 200 LOC z CSS,
  trivialne do dostosowania.
- **Confidence: 8/10**
- **Acceptance criteria:**
  - [ ] Heatmap renderuje 32 tygodnie × 7 dni = 224 komórki bez błędów
  - [ ] Klik komórki wywołuje `onCellClick(dateKey)` (gdy callback przekazany)
  - [ ] Każdy status (empty/done/freeze/skip/miss/future) ma inny kolor
        zgodny z Design Tokens
- **Notes:** Dark theme — upewnij się że heat levels są widoczne (jaśniejsze
  kolory na ciemnym tle). W razie potrzeby — oddzielna zmienna
  `--heat-l1` w `.dark` prefix.

### Step 9: Komponenty habits — HabitRow, HabitsView, HabitDetail

- **What:** Trzy komponenty w `src/renderer/components/habits/`.
- **How:**
  - `HabitRow.tsx` ({habit, onTick, onOpen, onEdit}): karta z heatmapą i CTA.
    Port z `views.jsx:29-59`.
  - `HabitsView.tsx` ({}): pobiera `habits` ze store, renderuje stat grid
    + sub-tabs + listę `HabitRow`. Port z `views.jsx:96-137`, ale bez tweaks
    (zawsze `list`+`heatmap`).
  - `HabitDetail.tsx` ({habit, onClose, onEdit, onRetroCell}): 5-kolumnowy
    stat grid + heatmapa 32w + action buttons (tick / undo / freeze / skip /
    timer). Port z `detail.jsx:1-66`.
  - Po kliknięciu "Oznacz dziś" → `habitTick(id, 'done')` z efektem konfetti
    (CSS animacja na divach tworzonych na fly — port z `views.jsx:14-27`).
- **Why this approach:** Prosta hierarchia: HabitsView → HabitRow / HabitDetail.
  Dekompozycja z handoffu jest rozsądna, nie trzeba jej zmieniać.
- **Confidence: 8/10**
- **Acceptance criteria:**
  - [ ] `HabitsView` renderuje stat grid: Dziś / Aktywne chainy / Total / Best
  - [ ] Sub-tabs filtrują: all / today-pending / active-streaks
  - [ ] `HabitRow` klik na CTA → tick z konfetti (toast "Chain nie pęka. ✓")
  - [ ] `HabitDetail` otwiera się po kliknięciu karty, pokazuje 32w heatmapę
  - [ ] Klik kafelka w heatmapie w detail → otwiera RetroModal
- **Notes:** Konfetti — najprościej: przy kliknięciu tworzymy 14 divów
  `className="confetti"` z CSS `@keyframes fall`, po 1100ms `.remove()`.
  Bez bibliotek.

### Step 10: Komponenty habits — HabitEditor (one-pager), TimerModal, RetroModal

- **What:** Modal edytora + timer + retro.
- **How:**
  - `HabitEditor.tsx` ({habit?, onSave, onCancel, onDelete}): one-pager:
    Basics (nazwa, projekt select, ikona pill-grid) → divider → Schedule
    (pill-group 6 typów + dynamiczne inputy) → divider → Advanced (freeze,
    notatka). Port z `editor.jsx:1-138`, usuwając `mode==='wizard'` branch.
  - `TimerModal.tsx` ({habit, onSave, onCancel}): port z
    `detail.jsx:68-116`, tick co 1s (useEffect + setInterval), progress bar,
    quick picks 5/10/15/25/30/45/60 min. Po Zapisz → `habitLogMinutes(id, N)`.
  - `RetroModal.tsx` ({habit, dateKey, onApply, onCancel}): port z
    `detail.jsx:118-139`. `onApply(action)` → `habitRetroTick(habit.id, dateKey, action)`.
- **Why this approach:** Osobne pliki modali = łatwo testować i zmieniać jeden
  bez drugiego.
- **Confidence: 8/10**
- **Acceptance criteria:**
  - [x] `HabitEditor` zapisuje nowy habit (bez id → service nadaje `randomUUID().slice(0,21)`)
  - [x] Zmiana typu schedule w editor aktualizuje odpowiednie dodatkowe pola
        (dni tyg / N / every / minutes)
  - [x] `TimerModal` po zapisie z 25 min akumuluje w log (`minutes: 25`),
        `done=true` gdy suma >= `schedule.minutes` (dla dailyMinutes)
  - [x] `RetroModal` 'freeze' zmniejsza `freezeAvailable` tylko gdy
        poprzedni stan NIE był freeze (unikamy double-decrement)
- **Notes:** Generowanie id habitu — **w service** (`randomUUID().slice(0,21)`,
  identycznie jak QuickTask). UI wysyła `habit` bez `id` dla nowego, service
  doda.

### Step 11: TodayView — integracja sekcji "Habits today · N/M"

- **What:** Dodać `TodayHabitsSection.tsx` i osadzić w `TodayView.tsx` poniżej
  głównej listy tasków.
- **How:**
  - `TodayHabitsSection.tsx`: pobiera `habits` ze store (nie ze `habitsToday`
    IPC — unikamy double round-trip), filtruje `habits.filter(h =>
    isScheduledOn(h, new Date()))`, dzieli na `done`/`pending`, renderuje
    `TodayHabitRow` (prosta karta: check + ikona + HB-ID + tytuł + streak chip).
    Sekcja zawiera header: "Habits today · {done}/{total}" z linkiem
    "all habits →" (onclick → setActiveView('habits')).
  - Dodać do `TodayView.tsx` po głównym bloku tasków (po `overflow section`,
    przed `add-task row`).
  - Klik check → `habitTick(id, 'done')` z krótkim konfetti na anchor-ze.
  - Klik tytułu → navigate do Habits view + open detail (można zrobić w
    późniejszej iteracji; w v1 klik anywhere → open view).
- **Why this approach:** Habits w Today = Daniel od razu widzi "co dziś do
  domknięcia". Lewy margines: nie obciążamy store o jeszcze jeden słownik
  (habitsToday) — wszystko liczone z `habits` które już są w store.
- **Confidence: 8/10**
- **Acceptance criteria:**
  - [x] Sekcja pojawia się TYLKO gdy `scheduledToday.length > 0`
  - [x] Header pokazuje `done/total` zgodny ze stanem `log[todayKey]?.done`
  - [x] Tick → natychmiastowa aktualizacja countera (bez reload)
  - [x] Klik "all habits →" zmienia `activeView` na `'habits'`
- **Notes:** Sekcja jest **poza** Wins lock scope — nie wołamy
  `lockWinsTasks` przy tick. Zgodnie z Decision 3.

### Step 12: Sidebar — entry "Habits" z ikoną 🔥

- **What:** Dodać pozycję Habits w dolnej sekcji sidebaru, między Repeat a Stats.
- **How:**
  - `src/renderer/components/Sidebar.tsx`, w `.sidebar-bottom` > `.sidebar-section`:
    ```tsx
    <SidebarItem active={activeView === 'repeat'} icon="↻" label="Repeat" onClick={() => onSelectView('repeat')} />
    <SidebarItem active={activeView === 'habits'} icon="🔥" label="Habits" onClick={() => onSelectView('habits')} />
    <SidebarItem active={activeView === 'stats'} icon="📊" label="Stats" onClick={() => onSelectView('stats')} />
    ```
  - `Dashboard.tsx`: dodać `{activeView === 'habits' && <HabitsView />}`.
- **Why this approach:** Spójne z Repeat/Stats. Emoji 🔥 jako prosty fallback
  (inne itemy też emoji). Jeśli user chce "lucide flame", można zamienić na
  `<HabitIcon name="flame"/>`.
- **Confidence: 10/10**
- **Acceptance criteria:**
  - [x] Klik "Habits" w sidebarze zmienia widok na `HabitsView`
  - [x] Item jest w kolejności Repeat / Habits / Stats
  - [x] Aktywny stan (podświetlenie) działa identycznie jak Repeat/Stats

### Step 13: InlineStatsView — sekcja "Habit Stats"

- **What:** Dodać sekcję ze statystykami habbitów w istniejącym Stats view.
- **How:**
  - `src/renderer/components/InlineStatsView.tsx`: dolepiamy po istniejących
    statach sekcję: 4 stat cards (Today done/total, Suma streaków, Total habits,
    Longest ever) + tabela 14 dni × habits grid z heat-cells per dzień (jak
    w `app.jsx:77-141`).
  - Tabela: `grid-template-columns: 180px repeat(14, 1fr) 60px`. Ostatnia
    kolumna: streak habitu.
- **Why this approach:** Stats już istnieje — rozszerzenie, nie nowy widok.
- **Confidence: 8/10**
- **Acceptance criteria:**
  - [x] Sekcja "Habit Stats" pojawia się PO istniejących statach
  - [x] Gdy `habits.length === 0` → sekcja pokazuje placeholder "Dodaj pierwszy
        nawyk" (albo ukryć całkowicie — UX call; preferuj ukrycie)
  - [x] Dla każdego habita ostatnia kolumna pokazuje aktualny streak zgodny
        z `computeStreak`
- **Notes:** Jeśli `InlineStatsView` nie istnieje lub ma inną strukturę niż
  zakładam — przy implementacji dostosuj się do aktualnej wersji. Plik to
  najpewniej <200 LOC, trywialne rozszerzenie.

### Step 14: Styling w `src/renderer/styles.css`

- **What:** Klasy CSS dla wszystkich komponentów habits — zmapowane na
  istniejące CSS variables theme'u gdzie to możliwe.
- **How:**
  - Dopisać sekcję `/* Habits */` w `styles.css`:
    - `.habit-card`, `.habit-head`, `.habit-title`, `.habit-schedule`
    - `.habit-bullet` (kolorowa kropka projektu)
    - `.streak-chip`, `.streak-chip.cold`
    - `.heat-cell` + modyfikatory (l1-l4, freeze, skip, miss, future, today)
    - `.today-habit-row`, `.today-habit-row.done`
    - `.stat-card` (jeśli już nie istnieje) + `.stat-num`, `.stat-label`, `.stat-sub`
    - `.sub-tabs`, `.sub-tab`, `.sub-tab.active`
    - `.pill-group`, `.pill-btn`, `.pill-btn.selected`
    - `.field-label`, `.modal`, `.modal-overlay`, `.modal-actions` (jeśli już
      nie istnieją)
    - `.confetti` + `@keyframes confetti-fall`
    - `.toast` + `@keyframes toast-in`
    - `.divider` (jeśli nie istnieje)
  - Kolory: heat levels (l1-l4), freeze (#f5e6b0), skip (repeating-linear-gradient),
    miss, accent (#e9a825) — jeśli istnieją odpowiedniki w `--accent-*`, użyć;
    jeśli nie — dodać `--habit-*` variables w `:root` i `.dark`.
- **Why this approach:** Istniejący `styles.css` używa Tailwind-style custom
  klas + CSS vars. Zachowujemy konwencję. Nie używamy CSS-in-JS.
- **Confidence: 7/10**
- **Acceptance criteria:**
  - [x] Light theme: heat levels czytelne (l1 jasnozielony, l4 ciemnozielony)
  - [x] Dark theme: heat levels czytelne (jaśniejsze odcienie, nie mergują się z tłem)
  - [x] Heatmap cell hover → `transform: scale(1.25)` 100ms (z design tokens)
  - [x] Card hover → soft shadow (z design tokens)
  - [x] Confetti animacja nie powoduje layout shiftu (position: fixed)
- **Notes:** Kolory w handoffie są dla jasnego theme'u — dark theme wymaga
  adaptacji. Sprawdzić istniejące dark overrides w styles.css i dodać analogiczne.

### Step 15: Obsidian journal — sekcja "Nawyki" w daily note [x]

- **What:** Rozszerzyć `generateDailyMarkdown` o sekcję z listą habbitów
  zaplanowanych danego dnia.
- **How:**
  - `src/main/service/journal.ts`, `gatherDayStats` → rozszerzyć o
    `habitsToday: { name: string; icon: string; status: 'done'|'freeze'|'skip'|'pending'; streak: number }[]`.
  - `generateDailyMarkdown` → po sekcji "Zrobione", przed "Notatki":
    ```md
    ## Nawyki

    - [x] 🔥 Speak drill (streak 42 dni)
    - [ ] 💪 Siłownia — pending (streak 3 tyg)
    - [🛡] 🧘 Medytacja — freeze (streak 18 dni)
    - [⏸] 📖 Czytanie — skip (streak 5 tyg)
    ```
  - Przy re-generowaniu: parser `parseExistingNote` już preservuje tylko
    Refleksja + Notatki — nawyki zostaną nadpisane świeżym stanem (OK, bo to
    snapshot).
- **Why this approach:** User chce mieć historię; journal to naturalne miejsce.
  Nie trzeba osobnego raportu habbitów.
- **Confidence: 7/10**
- **Acceptance criteria:**
  - [x] Dla dnia z 3 habbitami zaplanowanymi, notka zawiera 3 bullets w sekcji
        "Nawyki"
  - [x] Re-generowanie notki nie nadpisuje "Refleksja" i "Notatki"
  - [x] Gdy brak habbitów zaplanowanych → sekcja nie pojawia się (nie pustka)
- **Notes:** W testach wins.ts `resolveDay()` woła `generateDailyNote()` —
  musi dalej działać po naszym rozszerzeniu (żadnych rzuconych wyjątków).

### Step 16: HTTP API — rozszerz `/api/v1/today` o pole `habits` [x]

- **What:** W `src/main/api/routes/today.ts` dorzucić `habits: HabitTodayEntry[]`
  do odpowiedzi.
- **How:**
  - Zmiana minimal: `return { ok: true, data: result.allVisible, habits: habitService.getTodayHabits() }`.
  - Zaktualizować test `tests/api/today.test.ts` (jeśli istnieje — jeśli nie,
    dodać krótki test sprawdzający shape odpowiedzi).
- **Why this approach:** User chce "jedno miejsce które AI pyta o dzisiejszy
  dzień". Jedno rozszerzenie kontraktu, zero nowych endpointów.
- **Confidence: 9/10**
- **Acceptance criteria:**
  - [x] `GET /api/v1/today` zwraca `{ ok: true, data: [...], habits: [...] }`
  - [x] `habits` zawiera tylko habity zaplanowane dziś (`isScheduled: true`)
  - [x] `npm run test:api` przechodzi
- **Notes:** Jeśli AI kiedyś będzie chciało **wszystkie** habity (nie tylko
  dziś) — dopisać endpoint później. Teraz YAGNI.

### Step 17: Build check + smoke test manualny

- **What:** Upewnić się że całość buduje się i działa end-to-end.
- **How:**
  - `npm run clean && npm run build` — musi przejść bez błędów.
  - `npm run test && npm run test:api` — oba zielone.
  - Dev run: `npm run dev`. Kliknij "Habits" w sidebar, dodaj habit "Speak drill"
    daily, kliknij tick → konfetti + toast. Dodaj dailyMinutes=10 habit, otwórz
    detail, uruchom timer, wpisz 25 min, zapisz → log ma 25 min + done=true.
    RetroModal: klik kafelka sprzed 3 dni → done → heatmapa pokazuje zielony.
    Zamknij i otwórz app → dane w data.yaml, nic nie znika.
- **Why this approach:** Prototyp jest interactive, warto się zgodność zweryfikować.
  Build check eliminuje typowe błędy stale .js.
- **Confidence: 9/10**
- **Acceptance criteria:**
  - [ ] `npm run build` zielony
  - [ ] `npm run test` zielony (schedule + habit-schedule + filename)
  - [ ] `npm run test:api` zielony (69+ testów)
  - [ ] Manualny smoke: create habit → tick → confetti → reload app → habit+log
        persists
- **Notes:** Pamiętać o `npm run clean` przed build (stale .js z tsc — CLAUDE.md).

## Dependencies & Order

```
Step 1 (typy shared)                               → blokuje wszystko
  ├── Step 2 (habit-schedule engine)               → blokuje 3, 4, 8, 11, 15, 16
  │    └── Step 3 (testy schedule)                 → blokuje 17
  ├── Step 4 (service/habits)                      → blokuje 5
  │    └── Step 5 (IPC + preload)                  → blokuje 6, 16
  │         └── Step 6 (useProjects store)         → blokuje 9, 10, 11, 13
  ├── Step 7 (HabitIcon helper)                    → blokuje 9, 10, 11
  └── Step 8 (Heatmap + Legend)                    → blokuje 9, 13
       └── Step 9 (HabitsView, HabitRow, Detail)   → blokuje 12, 17
            └── Step 10 (Editor, Timer, Retro modals)
                 └── Step 11 (TodayHabitsSection)
                      └── Step 12 (Sidebar entry)
                           └── Step 13 (Stats extension)
                                └── Step 14 (CSS)
                                     └── Step 15 (journal)
                                          └── Step 16 (HTTP /today extension)
                                               └── Step 17 (build + smoke)
```

Critical path: 1 → 2 → 4 → 5 → 6 → 9 → 10 → 11 → 14 → 17. Pozostałe kroki
(7, 8, 12, 13, 15, 16) są odpowiednio nieblokowane i mogą iść równolegle.

## Team Design

### Team Composition

| Agent | Model | Role | Tasks | TDD |
|-------|-------|------|-------|-----|
| lead | Opus | Coordination, decisions | — | — |
| dev-1 (shared+backend) | Sonnet | shared types + engine + service + IPC + HTTP | Steps 1, 2, 3, 4, 5, 16 | yes (Step 3) |
| dev-2 (frontend-core) | Sonnet | hooks, shared UI, views | Steps 6, 7, 8, 9 | no |
| dev-3 (frontend-modals+integration) | Sonnet | modale, Today integration, sidebar, stats, CSS | Steps 10, 11, 12, 13, 14 | no |
| dev-4 (journal) | Sonnet | journal extension | Step 15 | no |
| reviewer | Opus | Review only | Full diff | — |
| verifier | Opus | Acceptance check (clean context) | All criteria + DoD | — |

> **Reviewer** tylko review — nie pisze poprawek. Proste uwagi (typo, formatowanie)
> idą do odpowiedniego dev-agenta. Kompleksowe (architektura, zmiana podejścia)
> do lead/planner.
>
> **Verifier** w osobnym agencie z czystym kontekstem, po dev + review.
> Sprawdza każde acceptance criterion + każdy punkt Definition of Done.
> Nie modyfikuje kodu. Raport pass/fail. Format: `references/verification-format.md`.

### Execution Order

```
Step 1 (shared types)                                                              [dev-1]
  ├── Step 2 (habit-schedule)                                                      [dev-1]
  │    └── Step 3 (tests)                                                          [dev-1, TDD]
  ├── Step 4 (service/habits)                                                      [dev-1]
  │    └── Step 5 (IPC + preload)                                                  [dev-1]
  │         ├── Step 6 (useProjects)                                               [dev-2]
  │         │    ├── Step 7 (HabitIcon)                                            [dev-2]
  │         │    ├── Step 8 (Heatmap + Legend)                                     [dev-2]
  │         │    └── Step 9 (HabitsView, HabitRow, HabitDetail)                    [dev-2]
  │         │         ├── Step 10 (Editor, Timer, Retro modals)                    [dev-3]
  │         │         ├── Step 11 (TodayHabitsSection w TodayView)                 [dev-3]
  │         │         ├── Step 12 (Sidebar entry)                                  [dev-3]
  │         │         ├── Step 13 (Stats extension)                                [dev-3]
  │         │         └── Step 14 (CSS)                                            [dev-3]
  │         ├── Step 15 (journal extension)                                        [dev-4] (równolegle od Step 5)
  │         └── Step 16 (HTTP /today)                                              [dev-1] (równolegle od Step 5)
  └── Step 17 (build + smoke)                                                      [lead, końcowo]
```

Parallelizacja po Step 5: dev-2 (frontend-core path 6→9), dev-3 czeka na 9
i idzie 10→14, dev-4 robi journal niezależnie, dev-1 dopina 16.

### Execute

```
/ems-team specs/plan.habits.md
```

## Risks & Mitigations

- **Ryzyko R1: `weekdays.days` konwencja (0=Mon vs 0=Sun) — łatwo pomylić.**
  Mitigation: w Step 1 komentarz przy typie; w Step 3 test case który jawnie
  ustawia `days: [1, 2, 3, 4, 5]` (pon-pt wg JS) i sprawdza `isScheduledOn`
  dla poniedziałku.
- **Ryzyko R2: YAML rośnie wykładniczo przy wielu habitach × lata.**
  Mitigation: Decision 2 wyjaśnia; próg migracji do JSONL = subjective (jeśli
  `data.yaml > 5 MB` lub load > 100ms). Dziś YAGNI.
- **Ryzyko R3: Re-generowanie daily note — utrata sekcji Nawyki jeśli user
  ręcznie ją zmodyfikuje.**
  Mitigation: sekcja Nawyki jest **generowana** (nie-editowalna), user wie że
  to stan automatyczny. Refleksja i Notatki pozostają jedynymi sekcjami
  preservowanymi przez parser.
- **Ryzyko R4: Stale cache w useProjects jeśli dwóch okien edytuje równocześnie.**
  Mitigation: `notifyAllWindows()` po każdej mutacji (jak w repeating-tasks).
  Plus renderer polega na `reload-data` handler → reload pełnego AppData.
- **Ryzyko R5: Dark theme heat levels niewidoczne.**
  Mitigation: Step 14 wymaga explicit verification na obu themach. Jeśli
  trzeba — osobne zmienne `--heat-l1..l4` w `.dark`.
- **Ryzyko R6: Testy `node --test` nie obsługują top-level await albo mają inne
  quirki z habit-schedule.ts.**
  Mitigation: Step 3 wzoruje się na `tests/schedule.test.ts` który już działa.
  Jeśli breakage — fallback na `vitest` (już używany w `tests/api/`).
- **Ryzyko R7: Konfetti blokuje UI gdy user klika szybko wiele razy.**
  Mitigation: każdy div ma `setTimeout remove` po 1100ms; nawet 100 kliknięć
  to 1400 DOM nodes (nic dramatycznego). Jeśli profilowanie pokaże — debounce.

## Definition of Done

Zadanie jest ukończone gdy WSZYSTKIE poniższe są prawdą:

- [ ] Wszystkie 17 kroków ma `[x]` w heading i wszystkie ich acceptance criteria
      są zaznaczone
- [ ] `npm run build` przechodzi bez błędów i warningów
- [ ] `npm run test` zielony (nowy `habit-schedule.test.ts` dołączony)
- [ ] `npm run test:api` zielony (rozszerzony `/api/v1/today` test, jeśli dodany)
- [ ] Manualny smoke test (Step 17) udany: create → tick → persist → reload
      → heatmapa poprawna
- [ ] Dark i light theme — heatmapa, konfetti, toast czytelne na obu
- [ ] `data.yaml` zawiera klucz `habits` po pierwszej mutacji; deserializacja
      bez `habits` (stare installs) daje pustą tablicę, nie crash
- [ ] Obsidian journal dla dnia z habbitami zaplanowanymi zawiera sekcję
      "Nawyki"
- [ ] `GET /api/v1/today` (gdy API enabled) zwraca pole `habits` — AI ma wgląd
      w to co user dziś robi
- [ ] Żadna istniejąca ścieżka (projekt create/edit, task complete, wins
      lock/unlock, repeat accept/dismiss, focus mode, quick add, journal daily)
      nie zepsuta — regression-free

## Verification

Verifier musi zweryfikować każde acceptance criterion z każdego kroku oraz
każdy punkt Definition of Done. Procedura i format raportu:
`references/verification-format.md`.

**Team plan:** verifier to dedykowany Opus agent w Team Composition.
**Solo fallback:** po implementacji uruchom w osobnym agencie:
> "Przeczytaj plan z specs/plan.habits.md. Sprawdź każde kryterium akceptacji
> z każdego kroku oraz każdy punkt Definition of Done. Wygeneruj raport
> pass/fail."
