# Coding Guide

Krótki zestaw zasad dla projektu `top5`.

## 1) KISS
- Trzymaj funkcje i komponenty małe oraz jednofunkcyjne.
- Preferuj proste przepływy danych i mało warunków zagnieżdżonych.
- Gdy moduł rośnie, dziel go na logiczne pliki (np. `storage`, `ipc`, `ui-utils`).

## 2) DRY
- Wspólną logikę przenoś do `utils`/hooków zamiast kopiować między komponentami.
- Trzymaj pojedyncze źródło prawdy dla typów i kontraktów IPC.
- Dla stałych (np. shortcuty, mapy launcherów) używaj jednej definicji współdzielonej.

## 3) Bezpieczeństwo (praktyczne minimum)
- Nie buduj komend shellowych przez interpolację stringów.
- Używaj `spawn`/argumentów zamiast `exec` tam, gdzie wejście pochodzi od użytkownika.
- Waliduj payloady IPC w `main` (typy + podstawowe reguły treści).
- Ograniczaj `openExternal` do jawnie dozwolonych protokołów.
- Nie wyłączaj izolacji bez silnego powodu (`contextIsolation`, `sandbox`).

## 4) Jakość kodu
- Unikaj `any`; preferuj jawne typy i helpery walidujące.
- Nie łam reguł React Hooks (hooki zawsze na top-level komponentu).
- Zmiany rób małe, lokalne i zgodne ze stylem istniejącego kodu.

## 5) Przed merge/release
- Uruchom `npm run build`.
- Sprawdź krytyczne ścieżki ręcznie: launchery, focus mode, compact mode, theme.
