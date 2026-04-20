# 0004. Habits NIE uczestniczą w Wins lock, są osobnym, równoległym systemem

- **Status:** Accepted
- **Date:** 2026-04-20
- **Source plan:** specs/plan.habits.md

## Context

Top5 ma system Wins lock: użytkownik "zamyka" na dziś wybrane taski
(<=5 z limitu), domknięcie wszystkich przed deadline = win, inaczej = loss.
Habits to drugi system, równoległy: długofalowe nawyki z własnym streakiem,
freeze (tarcza — nie-zrobione-ale-chain-bezpieczny), skip (urlop). Pytanie:
czy habity zaplanowane dziś mają wliczać się do kontraktu Wins lock?

## Decision

Wins lock dotyczy **tylko** QuickTasks i pinned tasks — jak dotychczas.
Scheduled-habits-dziś są pokazywane w `TodayView` w osobnej sekcji poniżej
tasków, z własnym licznikiem "N/M habits today", ale **nie** wpływają na
warunki win/loss. `checkWinCondition()` w `wins.ts` pozostaje bez zmian
(nie widzi habbitów).

## Alternatives considered

- **A: Habity wliczane do Wins lock (jako dodatkowe locked tasks).** Odrzucone:
  co z freeze/skip? Freeze = nie-zrobione-ale-chain-bezpieczny; w lock
  musielibyśmy albo traktować freeze jako "zrobione" (fałszowałoby Wins
  history), albo jako "nie zrobione" (niszczyłoby sens freeze jako tarczy).
  Sklejanie dwóch semantyk rozbija oba.
- **C: Osobny "habits-lock" niezależny od wins-lock (dzień wygrany dla habitów
  = wszystkie zaplanowane zrobione).** Odrzucone: dublowanie mechaniki lock
  bez realnego use-case. Lock istnieje dla tasków bo one znikają po zrobieniu;
  habit "pozostaje" i ma naturalny streak jako ciągły sygnał.
- **D: `todayIntegration` jako ustawienie w Settings (separate / mixed / none).**
  Odrzucone: KISS, jedna konfiguracja (separate) wystarczy; konfigurowalność
  to koszt konserwacyjny dla solo-projektu.

## Consequences

- **+** Czyste oddzielenie semantyk: Wins lock = kontrakt dzienny, Habits =
  ciągłość wieloletnia. Łatwiej rozumować o każdym z systemów.
- **+** Zero ryzyka regresji w istniejącym wins-lock flow (żadnych zmian w
  `wins.ts`, `checkWinCondition`, `checkDeadline`).
- **+** Habity zrobione w dzień przegrany nie psują chaina — user traci daily
  contract, ale chain trwa, co buduje morale długoterminowe.
- **−** Użytkownik nie ma trybu "dany habit jest moim obowiązkiem dziennym
  obok tasków z lock". Jeśli kiedyś zechce — można dodać opcjonalne
  "priority habit" wliczane do lock. YAGNI dla v1.
