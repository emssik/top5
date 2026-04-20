# 0002. Habits jako osobny typ obok `RepeatingTask`, NIE rozszerzenie

- **Status:** Accepted
- **Date:** 2026-04-20
- **Source plan:** specs/plan.habits.md

## Context

W top5 istnieje już system `RepeatingTask`, który generuje jednorazowe
QuickTaski (accept / dismiss). Nowy moduł Habits ("Don't break the chain")
ma zupełnie inną mechanikę: streak, freeze (tarcza), skip (urlop), retroaktywne
oznaczanie, 6 typów harmonogramu (w tym `nPerWeek`, `dailyMinutes`,
`weeklyMinutes`, których `RepeatingTask` nie obsługuje). Trzeba zdecydować:
rozszerzyć istniejący `RepeatingTask` czy stworzyć osobny typ.

## Decision

Dodajemy nowy typ `Habit` w `src/shared/types.ts` z własnym `HabitSchedule`
(`daily`, `weekdays`, `nPerWeek`, `interval`, `dailyMinutes`, `weeklyMinutes`).
Nowy engine: `src/shared/habit-schedule.ts`. Niezależny service
`src/main/service/habits.ts`.

## Alternatives considered

- **Rozszerzyć `RepeatingTask` o 3 nowe typy schedule + opcjonalne `log`,
  `freezeAvailable`.** Odrzucone: muli istniejący kod ("if habit then…"),
  wymieszałoby proposal-flow (accept → QuickTask) z chain-flow (tick →
  log entry). Złamałoby KISS i zmusiłoby do flag w każdym miejscu logiki,
  często tylko po to by przekazać "ta gałąź dla habita/taska nie ma sensu".
- **Habits jako subtyp QuickTask.** Odrzucone: QuickTask to pojedynczy akt
  zrobienia ("zrobione / nie zrobione"); habit to sekwencja zdarzeń na
  przestrzeni tygodni z freeze/skip/retro. Zupełnie inny model mental i cykl
  życia.

## Consequences

- **+** Czyste modele, łatwo testować w izolacji, łatwo rozszerzyć jeden bez
  dotykania drugiego.
- **+** Zero ryzyka regresji w istniejącym flow Repeat → QuickTask.
- **−** Trochę powtórzonej mechaniki (np. `dateKey`, `isScheduledOn` per-day).
  Akceptowalne, bo obliczenia są proste i różnią się semantycznie — `RepeatSchedule`
  nie zna `nPerWeek`, a `HabitSchedule` nie zna `afterCompletion` ani monthly
  variantów.
