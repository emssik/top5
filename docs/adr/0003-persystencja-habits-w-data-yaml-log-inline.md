# 0003. Persystencja habits w `data.yaml` pod kluczem `habits`, log inline wewnątrz `Habit.log`

- **Status:** Accepted
- **Date:** 2026-04-20
- **Source plan:** specs/plan.habits.md

## Context

Habity potrzebują persystencji dwojakiej: (1) definicje (nazwa, schedule, ikona,
notatka) oraz (2) log dzienny (co dzień rekord done/freeze/skip/minutes). W top5
istnieją różne strategie: `data.yaml` dla projektów/quickTasks/config,
`checkins.jsonl` dla focus check-inów, `operations.jsonl` dla audit logu,
`wins.jsonl` dla dziennych rozstrzygnięć wins. Trzeba zdecydować, gdzie lądują
habity i ich log.

## Decision

Habits lądują w istniejącym `data.yaml` jako `habits: Habit[]` na poziomie
`AppData`. Log per-day trzymany jest **inline** w
`Habit.log: Record<string, { done?, minutes?, freeze?, skip? }>`. Bez osobnego
pliku JSONL dla logu.

## Alternatives considered

- **Osobny `habits.yaml`.** Odrzucone: drugi plik to drugi backup, drugi reload,
  brak atomowości zapisu między nimi, marginalna wartość (brak wyraźnego
  use-case jeden-plik-na-domenę w tym projekcie).
- **`habits.jsonl` dla logu + `habits.yaml` dla definicji.** Odrzucone: trzeci
  plik, rozszczepienie "czytanie streaka" na dwa źródła, brak zysku — log
  habitu to jeden wpis/dzień/habit (mały, niestreamowy), inny profil niż
  `checkins.jsonl` (co minutę ping focus) czy `operations.jsonl` (dowolne
  event-y).
- **JSONL dla logu z event-sourcingiem (jeden globalny `habits.jsonl`).**
  Odrzucone: wymaga rebuilda stanu przy każdym odczycie, komplikuje retro-tick
  (zamiast update musimy appendować wpisy "wygaszające" starsze). Overkill dla
  1 usera.

## Consequences

- **+** Prostota: jeden plik, jeden backup (istniejący `dailyBackup` obejmuje
  `data.yaml`), atomic write, jeden `reload-data` event.
- **+** Streak liczony w pamięci na podstawie `Habit.log` bez dodatkowego I/O.
- **−** Jeśli user kiedyś będzie miał 50+ habbitów przez 5+ lat, YAML się
  rozrośnie (~3-4 MB) i load/save stanie się zauważalnie wolny. Próg migracji
  do JSONL: gdy `data.yaml > 5 MB` lub `loadData() > 100ms`. Na dziś YAGNI.
- **−** Brak strumieniowania logu (nie można appendować jednej linii bez
  przepisania całego YAMLa). Akceptowalne — zapis YAMLa przy 10 habbitach
  × 2 lata to ~150 KB, < 5 ms.
