# CLAUDE Notes

W projekcie jest krótki przewodnik zasad kodowania:

- `docs/CODING_GUIDE.md`

Przeczytaj go przed większymi zmianami.

This repository is a small, solo-maintained app.

## Working assumptions

- One primary developer and one primary user.
- Local-first workflows are preferred.
- Simplicity beats flexibility unless flexibility is needed now.

## Decision rules

- Choose the smallest solution that solves the current problem well.
- Avoid heavy process overhead (big specs, broad test matrices, complex architecture) unless explicitly requested.
- Keep code readable and easy to change quickly.
- Favor pragmatic tradeoffs over completeness for completeness' sake.

## Electron sandbox

W tym projekcie **nie zmieniaj** `webPreferences.sandbox` na `true` (main/focus/quick-add/check-in/operation-log), bo historycznie kończy się to białym oknem.
Sandbox można ruszyć tylko po wyraźnej decyzji użytkownika i osobnej, pełnej migracji preload/IPC z testem runtime.

## Decision records

Zanim modyfikujesz obszar pokryty przez ADR — przeczytaj plik.

- [ADR-0001](docs/adr/0001-brak-cache-projektow-w-skillu-top5-cli.md) — Nie cache'ujemy wyników `top5 projects --json` w skillu; odpytujemy bezpośrednio przy ~60ms latency
- [ADR-0002](docs/adr/0002-habits-jako-osobny-typ-obok-repeatingtask.md) — Habits jako osobny typ obok `RepeatingTask`, nie rozszerzenie
- [ADR-0003](docs/adr/0003-persystencja-habits-w-data-yaml-log-inline.md) — Persystencja habits w `data.yaml` pod kluczem `habits`, log inline wewnątrz `Habit.log`
- [ADR-0004](docs/adr/0004-habits-nie-uczestnicza-w-wins-lock.md) — Habits NIE uczestniczą w Wins lock, są osobnym równoległym systemem
- [ADR-0005](docs/adr/0005-habits-read-only-api-przez-rozszerzenie-today.md) — Habits read-only API przez rozszerzenie `/api/v1/today` + dedykowany `/api/v1/habits` (bez CRUD)
- [ADR-0006](docs/adr/0006-habits-jedna-konfiguracja-ui-bez-tweaks.md) — Habits: jedna konfiguracja UI (list + heatmap + onepager + separate), bez Tweaks panelu
- [ADR-0007](docs/adr/0007-habits-streak-liczony-w-pamieci-bez-cache.md) — Habits streak liczony w pamięci przy każdym odczycie, bez cache
