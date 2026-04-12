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
