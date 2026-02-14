# Plan: HTTP API dla Top5 — v2

## Scope v2

Rozszerzenie API o pozostałe operacje na danych: **focus check-ins, config, quick notes, operation log**. Wyekstrahowanie pozostałej logiki ze `store.ts` do warstwy serwisowej.

**Wymagania wstępne:** v1 ukończone (service layer, Fastify server, auth).

## Nowe serwisy

### `service/focus.ts` — 2 funkcje

- `saveFocusCheckIn(checkIn)` → `FocusCheckIn[]`
- `getFocusCheckIns(taskId?)` → `FocusCheckIn[]`

### `service/config.ts` — 3 funkcje

- `getConfig()` → `AppConfig`
- `saveConfig(config)` → `AppConfig`
- `saveQuickNotes(notes)` → `string`

### `service/operations.ts` — 1 funkcja

- `getOperations(since?)` → `OperationLogEntry[]`

## Nowe endpointy REST

Prefix: `/api/v1`

**Focus Check-ins:**
| Method | Path | Serwis | Błędy |
|--------|------|--------|-------|
| `GET` | `/focus/check-ins?taskId=X` | `getFocusCheckIns` | — |
| `POST` | `/focus/check-ins` | `saveFocusCheckIn` | 400 validation |

**Config:**
| Method | Path | Serwis | Błędy |
|--------|------|--------|-------|
| `GET` | `/config` | `getConfig` | — |
| `PUT` | `/config` | `saveConfig` | 400 validation |

**Quick Notes:**
| Method | Path | Serwis | Błędy |
|--------|------|--------|-------|
| `GET` | `/quick-notes` | zwraca `quickNotes` z AppData | — |
| `PUT` | `/quick-notes` | `saveQuickNotes` | 400 validation |

**Operation Log:**
| Method | Path | Serwis | Błędy |
|--------|------|--------|-------|
| `GET` | `/operations?since=ISO` | `getOperations` | 400 invalid date |

## Nowe pliki

| Plik | Zmiana |
|------|--------|
| `src/main/service/focus.ts` | **NOWY** — logika check-inów |
| `src/main/service/config.ts` | **NOWY** — logika config + quick notes |
| `src/main/service/operations.ts` | **NOWY** — logika operation log |
| `src/main/api/routes/focus.ts` | **NOWY** — HTTP adapter |
| `src/main/api/routes/config.ts` | **NOWY** — HTTP adapter |
| `src/main/api/routes/operations.ts` | **NOWY** — HTTP adapter |
| `src/main/store.ts` | IPC handlery focus/config/notes/operations → cienkie adaptery |

## Poza scope (IPC-only, Electron-specific)

Te operacje nie mają sensu przez HTTP — wymagają okien Electrona:

| IPC handler | Powód |
|-------------|-------|
| `enter-focus-mode` | Otwiera BrowserWindow z timerem |
| `exit-focus-mode` | Zamyka BrowserWindow |
| `switch-focus-task` | Zmienia task w oknie focus |
| `get-focus-unsaved-ms` | Timer state okna focus |
| `dismiss-checkin` | Zamyka popup check-in |
| `resize-focus-window` | Zmiana rozmiaru okna |
| `enter-clean-view` / `exit-clean-view` | Zmiana trybu okna głównego |
| `set-traffic-lights-visible` | macOS window controls |
| `launch-vscode` / `launch-iterm` / `launch-obsidian` / `launch-browser` | Otwieranie lokalnych aplikacji |
| `open-external` | Otwieranie URL w przeglądarce |
| `open-operation-log-window` | Otwiera osobne okno |
| `close-quick-add-window` | Zamyka popup |
| `get-is-dev` | Flaga developerska, irrelevant dla API |

## Weryfikacja

1. `npm run build` — kompilacja
2. `curl -H "Authorization: Bearer <key>" http://localhost:15055/api/v1/focus/check-ins` — lista check-inów
3. `curl -H "Authorization: Bearer <key>" http://localhost:15055/api/v1/config` — config
4. `curl -X PUT -H "Authorization: Bearer <key>" -H "Content-Type: application/json" -d '{"text":"test"}' http://localhost:15055/api/v1/quick-notes` — zapis notatki
5. `curl -H "Authorization: Bearer <key>" "http://localhost:15055/api/v1/operations?since=2025-01-01"` — log operacji
