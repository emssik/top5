# CLAUDE Notes

W projekcie jest krótki przewodnik zasad kodowania:

- `docs/CODING_GUIDE.md`

Przeczytaj go przed większymi zmianami.

## Git workflow

Przed rozpoczęciem nowej funkcjonalności, refaktoryzacji lub większych zmian — upewnij się, że użytkownik jest na osobnym branchu. Jeśli jest na `main`, przypomnij mu o stworzeniu nowego brancha. **NIE twórz branchy samodzielnie** — tylko daj znać.

## Electron sandbox

W tym projekcie **nie zmieniaj** `webPreferences.sandbox` na `true` (main/focus/quick-add/check-in/operation-log), bo historycznie kończy się to białym oknem.
Sandbox można ruszyć tylko po wyraźnej decyzji użytkownika i osobnej, pełnej migracji preload/IPC z testem runtime.
