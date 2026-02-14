# Plan: HTTP API dla Top5

## Kontekst

Top5 to Electron desktop app do zarządzania projektami/zadaniami. Obecnie cała komunikacja idzie przez Electron IPC (renderer → preload bridge → main process). Cel: udostępnić zewnętrzne HTTP API pokrywające wszystkie operacje dostępne z UI, żeby skrypty/narzędzia zewnętrzne mogły zarządzać zadaniami. Obie ścieżki (IPC + HTTP) będą współdzielić tę samą warstwę serwisową (business logic).

## Architektura

```
Renderer ──IPC──→ ipcMain.handle() ──→ service functions ──→ persistence (YAML/JSONL)
External ──HTTP──→ Fastify routes   ──→ service functions ──→ persistence (YAML/JSONL)
                                              ↓
                                     notifyAllWindows() → UI auto-reload
```

- **Serwer HTTP w main process** Electrona — współdzieli in-memory cache (`cachedData`), zero dodatkowego IPC
- **UI nadal używa IPC** — szybsze od HTTP localhost, zero zmian w rendererze
- **Wspólna warstwa serwisowa** — ta sama logika dla obu ścieżek
- **Framework: Fastify** — lekki, TypeScript-first, wbudowane parsowanie JSON i routing

## Kroki implementacji

### Krok 1: Zunifikowane typy (`src/shared/types.ts`)

Przenieść wszystkie typy z `src/main/store.ts` (linie 22-150) do nowego `src/shared/types.ts`. Zmienić:
- `src/main/store.ts` → importuje z `../shared/types`
- `src/renderer/types/index.ts` → re-exportuje z `../../shared/types`
- `tsconfig.node.json` → dodać `"src/shared/**/*"` do `include`

Typy do przeniesienia: `Task`, `RepeatSchedule`, `RepeatingTask`, `QuickTask`, `ProjectColor`, `ProjectLink`, `Project`, `AppConfig`, `FocusCheckIn`, `OperationType`, `OperationLogEntry`, `AppData`

Nowy typ `ApiConfig`:
```ts
interface ApiConfig {
  enabled: boolean
  apiKey: string
  port: number // default 15055
}
```

Dodać `apiConfig?: ApiConfig` do `AppData`.

### Krok 2: Eksport funkcji z `store.ts`

Wyeksportować z `store.ts` (dodać `export`):
- `getData()`, `setData()`, `notifyAllWindows()`
- `appendOperation()`, `appendCheckIn()`, `loadCheckIns()`, `loadOperations()`
- Walidatory: `isValidProject`, `isValidQuickTask`, `isValidRepeatingTask`, `isValidAppConfig`, `toFocusCheckIn`, `isValidRepeatSchedule`
- Helpery: `normalizeProject`, `assignMissingProjectColors`, `getActiveProjectsLimit`, `taskTimeMinutes`

### Krok 3: Warstwa serwisowa (`src/main/service/`)

Wyciągnąć logikę biznesową z callbacków `ipcMain.handle()` do czystych funkcji. Każda funkcja:
- Przyjmuje już zwalidowane parametry
- Wywołuje `getData()`/`setData()`/`appendOperation()`
- Zwraca wynik
- NIE wywołuje `notifyAllWindows()` (to robi caller — IPC handler lub HTTP route)

Pliki:

**`service/projects.ts`** — 10 funkcji:
- `saveProject(project)` → `Project[]`
- `deleteProject(id)` → `Project[]`
- `archiveProject(id)` → `Project[]`
- `unarchiveProject(id)` → `{projects} | {error}`
- `suspendProject(id)` → `Project[]`
- `unsuspendProject(id)` → `{projects} | {error}`
- `reorderProjects(orderedIds)` → `Project[]`
- `reorderPinnedTasks(updates)` → `Project[]`
- `toggleTaskInProgress(projectId, taskId)` → `Project[]`
- `toggleTaskToDoNext(projectId, taskId)` → `Project[]`

**`service/quick-tasks.ts`** — 6 funkcji:
- `saveQuickTask`, `removeQuickTask`, `completeQuickTask`, `uncompleteQuickTask`, `reorderQuickTasks`, `toggleQuickTaskInProgress`

**`service/repeating-tasks.ts`** — 5 funkcji:
- `saveRepeatingTask`, `removeRepeatingTask`, `reorderRepeatingTasks`, `acceptRepeatingProposal`, `dismissRepeatingProposal`

**`service/focus.ts`** — 2 funkcje:
- `saveFocusCheckIn(checkIn)` → `FocusCheckIn[]`
- `getFocusCheckIns(taskId?)` → `FocusCheckIn[]`

**`service/config.ts`** — 2 funkcje:
- `saveConfig(config)`, `saveQuickNotes(notes)`

Po ekstrakcji, `ipcMain.handle()` callbacki stają się cienkimi wrapperami:
```ts
ipcMain.handle('save-project', (_event, project: unknown) => {
  if (!isValidProject(project)) return getData().projects
  const result = projectService.saveProject(project)
  notifyAllWindows()
  return result
})
```

### Krok 4: Serwer HTTP (`src/main/api/`)

**`api/server.ts`** — setup Fastify:
- Bind `127.0.0.1` only (bezpieczeństwo)
- Port z `apiConfig.port` (default `15055`), override przez `TOP5_API_PORT` env
- Auth: Bearer token (`Authorization: Bearer <apiKey>`) — hook `onRequest`, exempt: `/api/v1/health`
- CORS: `*` (localhost-only i tak)
- Start po `app.whenReady()` w `src/main/index.ts`

**`api/routes/*.ts`** — route files, każdy wywołuje serwis + `notifyAllWindows()`.

### Krok 5: Endpointy REST

Prefix: `/api/v1`

**Projects:**
| Method | Path | Serwis |
|--------|------|--------|
| `GET` | `/projects` | lista projektów |
| `GET` | `/projects/:id` | jeden projekt |
| `POST` | `/projects` | `saveProject` (create) |
| `PUT` | `/projects/:id` | `saveProject` (update) |
| `DELETE` | `/projects/:id` | `deleteProject` |
| `POST` | `/projects/:id/archive` | `archiveProject` |
| `POST` | `/projects/:id/unarchive` | `unarchiveProject` |
| `POST` | `/projects/:id/suspend` | `suspendProject` |
| `POST` | `/projects/:id/unsuspend` | `unsuspendProject` |
| `PUT` | `/projects/reorder` | `reorderProjects` |
| `POST` | `/projects/:pid/tasks/:tid/toggle-in-progress` | `toggleTaskInProgress` |
| `POST` | `/projects/:pid/tasks/:tid/toggle-to-do-next` | `toggleTaskToDoNext` |
| `PUT` | `/projects/pinned-tasks/reorder` | `reorderPinnedTasks` |

**Quick Tasks:**
| Method | Path | Serwis |
|--------|------|--------|
| `GET` | `/quick-tasks` | lista |
| `POST` | `/quick-tasks` | `saveQuickTask` |
| `PUT` | `/quick-tasks/:id` | `saveQuickTask` |
| `DELETE` | `/quick-tasks/:id` | `removeQuickTask` |
| `POST` | `/quick-tasks/:id/complete` | `completeQuickTask` |
| `POST` | `/quick-tasks/:id/uncomplete` | `uncompleteQuickTask` |
| `POST` | `/quick-tasks/:id/toggle-in-progress` | `toggleQuickTaskInProgress` |
| `PUT` | `/quick-tasks/reorder` | `reorderQuickTasks` |

**Repeating Tasks:**
| Method | Path | Serwis |
|--------|------|--------|
| `GET` | `/repeating-tasks` | lista |
| `POST` | `/repeating-tasks` | `saveRepeatingTask` |
| `PUT` | `/repeating-tasks/:id` | `saveRepeatingTask` |
| `DELETE` | `/repeating-tasks/:id` | `removeRepeatingTask` |
| `PUT` | `/repeating-tasks/reorder` | `reorderRepeatingTasks` |
| `POST` | `/repeating-tasks/:id/accept` | `acceptRepeatingProposal` |
| `POST` | `/repeating-tasks/:id/dismiss` | `dismissRepeatingProposal` |

**Focus:**
| Method | Path | Serwis |
|--------|------|--------|
| `GET` | `/focus/status` | focusProjectId/TaskId z config |
| `POST` | `/focus/enter` | enter focus mode |
| `POST` | `/focus/exit` | exit focus mode |
| `POST` | `/focus/switch-task` | `switchFocusTask` |
| `POST` | `/focus/check-in` | `saveFocusCheckIn` |
| `GET` | `/focus/check-ins?taskId=X` | `getFocusCheckIns` |

**Config & Notes:**
| Method | Path | Serwis |
|--------|------|--------|
| `GET` | `/config` | config z AppData |
| `PUT` | `/config` | `saveConfig` |
| `GET` | `/quick-notes` | quickNotes |
| `PUT` | `/quick-notes` | `saveQuickNotes` |

**Meta:**
| Method | Path | Opis |
|--------|------|------|
| `GET` | `/health` | status + wersja (public, bez auth) |
| `GET` | `/app-data` | pełny dump AppData |
| `GET` | `/operations?since=ISO` | log operacji |

**Format odpowiedzi:**
```json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": "message" }
```

HTTP status: 200 (OK), 201 (Created), 400 (validation), 401 (no auth), 404 (not found), 500 (error)

### Krok 6: UI w Settings

Dodać sekcję "API" w Settings:
- Toggle enabled/disabled
- Wyświetlanie portu
- Wyświetlanie API key z przyciskiem "Copy"
- Przycisk "Regenerate key"

### Krok 7: Generowanie API key

Przy pierwszym włączeniu API:
- `apiKey = "top5_" + crypto.randomUUID()` — prefix ułatwia identyfikację
- Zapisywane w `data.yaml` pod `apiConfig`
- Key nie jest wysyłany do renderera przez `getAppData()` — osobny IPC `get-api-config` / `save-api-config`

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `src/shared/types.ts` | **NOWY** — zunifikowane typy + `ApiConfig` |
| `src/main/store.ts` | Usunąć lokalne typy, importować ze shared, eksportować funkcje, IPC handlery → cienkie wrappery |
| `src/main/service/projects.ts` | **NOWY** — logika projektów |
| `src/main/service/quick-tasks.ts` | **NOWY** — logika quick tasks |
| `src/main/service/repeating-tasks.ts` | **NOWY** — logika repeating tasks |
| `src/main/service/focus.ts` | **NOWY** — logika check-inów |
| `src/main/service/config.ts` | **NOWY** — logika config/notes |
| `src/main/api/server.ts` | **NOWY** — Fastify setup + auth |
| `src/main/api/routes/projects.ts` | **NOWY** |
| `src/main/api/routes/quick-tasks.ts` | **NOWY** |
| `src/main/api/routes/repeating-tasks.ts` | **NOWY** |
| `src/main/api/routes/focus.ts` | **NOWY** |
| `src/main/api/routes/config.ts` | **NOWY** |
| `src/main/api/routes/meta.ts` | **NOWY** — health, app-data, operations |
| `src/main/index.ts` | Dodać start HTTP serwera po `app.whenReady()` |
| `src/main/focus-window.ts` | Użyć serwisów z `service/focus.ts` dla danych |
| `src/renderer/types/index.ts` | Re-export z `../../shared/types` |
| `tsconfig.node.json` | Dodać `"src/shared/**/*"` do include |
| `package.json` | Dodać `fastify` do dependencies |

## Bezpieczeństwo

- Bind wyłącznie na `127.0.0.1` — zero ekspozycji sieciowej
- Bearer token (API key) na każdym requeście (oprócz `/health`)
- API key z prefixem `top5_` — łatwo rozpoznać w logach
- Walidacja inputów — istniejące walidatory reużywane
- Brak `apiKey` w standardowym `getAppData()` response

## Weryfikacja

1. `npm run build` — sprawdzić, że się kompiluje
2. `npm run dev` — uruchomić apkę, sprawdzić że UI działa jak wcześniej
3. `curl http://localhost:15055/api/v1/health` — serwer żyje
4. `curl -H "Authorization: Bearer <key>" http://localhost:15055/api/v1/projects` — lista projektów
5. `curl -X POST -H "Authorization: Bearer <key>" -H "Content-Type: application/json" -d '{"title":"Test"}' http://localhost:15055/api/v1/quick-tasks` — create + sprawdzić że pojawia się w UI
6. Sprawdzić że operacja z API tworzy wpis w operation log
7. Sprawdzić 401 bez tokena, 400 z invalid data
