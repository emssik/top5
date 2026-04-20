# 0007. Habits streak liczony w pamięci przy każdym odczycie (bez cache)

- **Status:** Accepted
- **Date:** 2026-04-20
- **Source plan:** specs/plan.habits.md

## Context

`computeStreak(habit)` iteruje po `habit.log` od `createdAt` do dziś. Dla
daily schedule to może być ~730 iteracji (2 lata). Renderer wywołuje ją w
wielu miejscach: stat grid, HabitRow (lista), HabitDetail, TodayHabitRow,
Stats view tabela 14 dni. Decyzja: cachować wynik czy liczyć on-the-fly.

## Decision

`computeStreak` jest czystą funkcją bez cache. Wywoływana przy każdym renderze
komponentu i przy każdym requeście AI getter'a. Nie ma pola `streakCache` w
`Habit`, nie ma memoizacji na poziomie service'u.

## Alternatives considered

- **Cache w `habit.streakCache: { value, computedAt }` inwalidowany przy tick /
  retro / edit / delete.** Odrzucone: invalidation przy każdej mutacji (a tick
  jest częsty) i tak zeruje cache, więc korzyść marginalna. Plus: invalidation
  łatwo pomylić → manifestuje się jako "streak się nie odświeżył" = najgorszy
  UX dla feature'u opartego na feedback'u.
- **React `useMemo` per-komponent na `habit.log`.** Odrzucone w v1: premature
  optimization. Można dodać punktowo w HabitRow jeśli profilowanie pokaże
  problem w renderingu listy (to nie wymaga ADR — to lokalny tuning).
- **Background-job liczący streaki i zapisujący do store.** Odrzucone:
  overkill, wprowadza asynchroniczność i stale-state.

## Consequences

- **+** Zero stale-cache błędów. Streak zawsze odzwierciedla stan `log`.
- **+** Prosty model mentalny — funkcja in → funkcja out, nic do
  zapamiętania.
- **+** Trywialnie testowalna (Step 3 w planie).
- **−** Jeśli user stworzy 100 habbitów przez 5 lat, re-render widoku Habits
  (100 × 1825 iteracji = 180 000 operacji) może zauważalnie spowolnić
  (oszacowanie: ~20-50 ms z `Object[key]` lookups). Próg reakcji: jeśli
  filozofowie kiedyś policzą perf > 100 ms — dodać `useMemo`. YAGNI dziś.
- **−** Streak liczony 2× jeśli ten sam habit jest wyświetlany w 2 miejscach
  w jednym renderze. Też akceptowalne (to mikroskopijny koszt).
