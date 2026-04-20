# 0005. Habits read-only API przez rozszerzenie `/api/v1/today` (bez pełnego CRUD)

- **Status:** Accepted
- **Date:** 2026-04-20
- **Source plan:** specs/plan.habits.md

## Context

Użytkownik (Daniel) pracuje z modelem AI, który konsumuje HTTP API top5 po to,
by wiedzieć "co robi danego dnia". Habity są częścią tego kontekstu (co robi
dziś). Jednocześnie pełne CRUD habbitów przez HTTP nie jest obecnie potrzebne —
UI wystarczy. Dylemat: jak zapewnić "AI widzi habity" bez overhead'u pełnego
API CRUD.

## Decision

Logika habbitów w `src/main/service/habits.ts` jest czysta (bez zależności od
`ipcMain`/`electron`), analogicznie do `service/repeating-tasks.ts`. Funkcja
`getTodayHabits()` zwraca `HabitTodayEntry[]` — per-habit: `id, name, icon,
projectId, schedule, isScheduled, status, streak, streakUnit, minutesToday?,
minutesGoal?`. Endpoint **`/api/v1/today` (istniejący)** rozszerza odpowiedź
o pole `habits: HabitTodayEntry[]` obok `data`. Żadnych nowych endpointów,
żadnego CRUD dla habbitów przez HTTP w v1. Service-layer jest tak napisany,
że przyszły pełny CRUD to trywialna kopia wzorca `repeating-tasks.ts`.

## Alternatives considered

- **Pełne CRUD przez HTTP (`/api/v1/habits`) w v1.** Odrzucone: użytkownik
  jawnie powiedział "nie ma potrzeby tworzenia API do habbitów". Dodawanie
  featurów na zapas narusza CLAUDE.md (simplicity beats flexibility unless
  flexibility is needed now).
- **Osobny endpoint `/api/v1/habits/today`.** Odrzucone: fragmentuje "co Daniel
  robi dziś" na dwa zapytania. Jeden `/today` z pełnym obrazem dnia (taski +
  habity) jest lepszy dla konsumenta AI — mniej round-tripów, atomowy snapshot.
- **Przekazać pełny `Habit` z całym `log` (bez DTO `HabitTodayEntry`).**
  Odrzucone: rozmiar — dla 10 habbitów × kilkaset wpisów w log to kilkaset KB
  payloadu przy każdym polling'u. AI potrzebuje "co jest dzisiaj", a streak
  jest już skompresowany do jednej liczby.
- **Feature flag `TOP5_HABITS_API=1` odblokowujący pełne CRUD HTTP.**
  Odrzucone: feature flag "na zapas" to anti-pattern w projekcie solo
  (CLAUDE.md). Dodanie endpointów gdy się pojawi realny use-case to kwestia
  ~50 LOC.

## Consequences

- **+** User dostaje dokładnie to, czego potrzebuje (AI widzi habits dnia)
  przy zerowym dodatkowym endpoint'cie.
- **+** Pełny CRUD w przyszłości to trywialna kopia wzorca `repeating-tasks.ts`
  (service już istnieje i jest clean).
- **+** Kontrakt `/api/v1/today` pozostaje zwarty i atomic — jedno zapytanie
  daje cały obraz dnia.
- **−** Jeśli w przyszłości AI będzie potrzebować zapisywać tick habitu (np.
  głosem "odhacz medytację"), trzeba będzie dodać POST route. Na dziś nie jest
  wymagane.
- **−** Mały narzut kognitywny: konsumenci muszą wiedzieć, że habits są
  podpięte pod `/today`, a nie `/habits`. Mitigacja: dokumentacja /today
  w odpowiedzi schema.
