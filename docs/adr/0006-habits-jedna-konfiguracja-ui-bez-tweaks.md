# 0006. Habits — jedna konfiguracja UI (list + heatmap + onepager + separate), brak Tweaks panelu

- **Status:** Accepted
- **Date:** 2026-04-20
- **Source plan:** specs/plan.habits.md

## Context

Design handoff dla modułu Habits (`working/design_handoff_habits/`) oferuje 4
wymiary tweaks: `habitsLayout` (list / grid / timeline), `chainStyle`
(heatmap / dots / progress), `editorMode` (onepager / wizard),
`todayIntegration` (separate / mixed / none) — razem 3×3×2×3 = 54 kombinacje.
Prototyp dostarcza to jako playground dla designera, żeby wybrać wariant.
Dla produkcji trzeba zdecydować: które warianty implementujemy?

## Decision

Implementujemy **tylko jedną** kombinację: `layout=list`, `chainStyle=heatmap`,
`editorMode=onepager`, `todayIntegration=separate`, `confetti=on`. Brak panelu
Tweaks w aplikacji. Użytkownik nie wybiera — ta kombinacja jest hardcoded.

## Alternatives considered

- **Zbudować wszystkie 4 wymiary jak w prototypie.** Odrzucone: 4× więcej kodu,
  4× więcej gałęzi w komponentach, 4× więcej scenariuszy do przetestowania.
  Solo-user i solo-dev — każdy dodatkowy wymiar to koszt konserwacyjny bez
  wyraźnej korzyści.
- **Dodać tweaks tylko dla `todayIntegration` (separate/none).** Odrzucone:
  user i tak będzie trzymał "separate" (to jedyny sensowny tryb po to, by
  habity miały miano motywatora w Today). "none" oznaczałoby że user ma iść do
  widoku Habits osobno — osiągalne po prostu przez brak użycia sekcji (to nie
  wymaga flagi, wystarczy przestać patrzeć).
- **Dodać tweaks tylko dla `chainStyle` (heatmap/dots).** Odrzucone: heatmapa
  daje pełniejszy obraz, dots/progress to wariacje. Dodawać konfigurację
  wizualną dla wariantu, który może się spodobać jednemu-dwóm użytkownikom
  (a tu jest 1) — nieuzasadnione.

## Consequences

- **+** Znacząco mniej kodu (w przybliżeniu 1/4 tego, co pełny prototyp).
- **+** Jeden happy path do przetestowania i utrzymania.
- **+** Spójne UX — brak paradoksu wyboru, jedna przewidywalna prezentacja
  habbitów w całej apce.
- **−** Jeśli Daniel zechce dots / timeline / wizard — trzeba będzie dodać.
  Ale taka zmiana to ~30-50 LOC per wariant, tańsza niż ciągłe utrzymywanie
  wszystkich czterech.
- **−** Brak elastyczności "zmień zdanie jednym klikiem" — akceptowalne w
  projekcie solo, gdzie developer = user.
