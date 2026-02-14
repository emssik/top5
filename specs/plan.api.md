# Plan: HTTP API dla Top5 — v1

## Scope v1

Operacje na **projektach i zadaniach** (projects, quick tasks, repeating tasks). Poza scope v1: focus mode, config, quick notes, window control, operation log.

## Kontekst

Top5 to Electron desktop app do zarządzania projektami/zadaniami. Obecnie cała komunikacja idzie przez Electron IPC (renderer → preload bridge → main process). Cel: udostępnić zewnętrzne HTTP API żeby skrypty/narzędzia zewnętrzne mogły zarządzać zadaniami. Obie ścieżki (IPC + HTTP) współdzielą tę samą warstwę serwisową (business logic).

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

Typy do przeniesienia: `Task`, `RepeatSchedule`, `RepeatingTask`, `QuickTask`, `ProjectColor`, `ProjectLink`, `Project`, `AppConfig`, `FocusCheckIn`, `OperationType`, `OperationLogEntry`, `AppData`

Nowe typy:
```ts
interface ApiConfig {
  enabled: boolean
  apiKey: string
  port: number // default 15055
}

// Wersja bez apiKey — do getAppData() i renderera
interface ApiConfigPublic {
  enabled: boolean
  port: number
}
```

Dodać `apiConfig?: ApiConfigPublic` do `AppData` (publiczny typ bez klucza).
Pełny `ApiConfig` dostępny tylko przez osobny IPC `get-api-config`.

**Uwaga:** `tsconfig.node.json` już zawiera `"src/shared/**/*"` — nie wymaga zmian.

### Krok 2: Eksport funkcji z `store.ts`

Wyeksportować z `store.ts` (dodać `export`):
- `getData()`, `setData()`, `notifyAllWindows()`
- `appendOperation()`
- Walidatory: `isValidProject`, `isValidQuickTask`, `isValidRepeatingTask`, `isValidRepeatSchedule`
- Helpery: `normalizeProject`, `assignMissingProjectColors`, `getActiveProjectsLimit`, `taskTimeMinutes`

### Krok 3: Warstwa serwisowa (`src/main/service/`)

Wyciągnąć logikę biznesową z callbacków `ipcMain.handle()` do funkcji serwisowych. Każda funkcja:
- Przyjmuje surowe parametry (walidacja wewnątrz serwisu)
- Wywołuje `getData()`/`setData()`/`appendOperation()`
- Zwraca wynik lub `{ error: string }`
- NIE wywołuje `notifyAllWindows()` (to robi caller — IPC handler lub HTTP route)

Callery (IPC handler, HTTP route) to cienkie adaptery — tylko parsują input z danego transportu, przekazują do serwisu i zwracają wynik. Zero logiki biznesowej, zero walidacji.

Pliki:

**`service/projects.ts`** — 13 funkcji:
- `getProjects()` → `Project[]`
- `getProject(id)` → `Project | { error: 'not_found' }`
- `createProject(project)` → `Project[]` (nowy projekt; przy limicie aktywnych — auto-suspend)
- `updateProject(id, project)` → `Project[] | { error: 'not_found' }` (strict update, 404 jeśli nie istnieje)
- `deleteProject(id)` → `Project[] | { error: 'not_found' }`
- `archiveProject(id)` → `Project[] | { error: 'not_found' }`
- `unarchiveProject(id)` → `{ projects: Project[] } | { error: 'not_found' | 'active_limit' }`
- `suspendProject(id)` → `Project[] | { error: 'not_found' }`
- `unsuspendProject(id)` → `{ projects: Project[] } | { error: 'not_found' | 'active_limit' }`
- `reorderProjects(orderedIds)` → `Project[] | { error: 'validation' }`
- `reorderPinnedTasks(updates)` → `Project[] | { error: 'validation' }`
- `toggleTaskInProgress(projectId, taskId)` → `Project[] | { error: 'not_found' }`
- `toggleTaskToDoNext(projectId, taskId)` → `Project[] | { error: 'not_found' }`

**`service/quick-tasks.ts`** — 7 funkcji:
- `getQuickTasks()` → `QuickTask[]`
- `saveQuickTask(task)` → `QuickTask[] | { error: 'not_found' | 'validation' }`
- `removeQuickTask(id)` → `QuickTask[] | { error: 'not_found' }`
- `completeQuickTask(id)` → `QuickTask[] | { error: 'not_found' }`
- `uncompleteQuickTask(id)` → `QuickTask[] | { error: 'not_found' }`
- `reorderQuickTasks(orderedIds)` → `QuickTask[] | { error: 'validation' }`
- `toggleQuickTaskInProgress(id)` → `QuickTask[] | { error: 'not_found' }`

**`service/repeating-tasks.ts`** — 6 funkcji:
- `getRepeatingTasks()` → `RepeatingTask[]`
- `saveRepeatingTask(task)` → `RepeatingTask[] | { error: 'not_found' | 'validation' }`
- `removeRepeatingTask(id)` → `RepeatingTask[] | { error: 'not_found' }`
- `reorderRepeatingTasks(orderedIds)` → `RepeatingTask[] | { error: 'validation' }`
- `acceptRepeatingProposal(id)` → `{ quickTasks: QuickTask[], repeatingTasks: RepeatingTask[] } | { error: 'not_found' }`
- `dismissRepeatingProposal(id)` → `void | { error: 'not_found' }`

Po ekstrakcji, `ipcMain.handle()` callbacki stają się cienkimi adapterami.

Serwis zwraca wynik lub `{ error: 'not_found' | 'validation' | ... }`. Adapter decyduje jak to przekazać:
- **IPC adapter** — ignoruje error, zwraca aktualną listę (backward compat z obecnym UI)
- **HTTP adapter** — mapuje error na HTTP status (not_found → 404, validation → 400, active_limit → 409)

```ts
// IPC adapter — save-project robi upsert (backward compat z UI)
ipcMain.handle('save-project', (_event, project: unknown) => {
  const exists = getData().projects.some(p => p.id === project.id)
  const result = exists
    ? projectService.updateProject(project.id, project)
    : projectService.createProject(project)
  if ('error' in result) return getData().projects
  notifyAllWindows()
  return result
})

// HTTP adapter — osobne endpointy, error → HTTP status code
fastify.post('/api/v1/projects', (req, reply) => {
  const result = projectService.createProject(req.body)
  if ('error' in result) return reply.status(400).send({ ok: false, error: result.error })
  notifyAllWindows()
  reply.status(201).send({ ok: true, data: result })
})

fastify.put('/api/v1/projects/:id', (req, reply) => {
  const result = projectService.updateProject(req.params.id, req.body)
  if ('error' in result) return reply.status(errorToStatus(result.error)).send({ ok: false, error: result.error })
  notifyAllWindows()
  reply.send({ ok: true, data: result })
})
```

### Krok 4: Serwer HTTP (`src/main/api/`)

**`api/server.ts`** — setup Fastify:
- Bind `127.0.0.1` only (bezpieczeństwo)
- Port z `apiConfig.port` (default `15055`), override przez `TOP5_API_PORT` env
- Auth: Bearer token (`Authorization: Bearer <apiKey>`) — hook `onRequest`, exempt: `/api/v1/health`
- CORS: `*` (localhost-only)
- Start po `app.whenReady()` w `src/main/index.ts`

**Lifecycle serwera:**
- `apiConfig.enabled === false` → serwer nie startuje
- Zmiana portu/klucza → restart serwera (`server.close()` + `server.listen()`)
- `EADDRINUSE` → log error do konsoli, app działa dalej bez API (nie crashuje)
- Regeneracja klucza → restart serwera z nowym kluczem w auth hook

**`api/routes/*.ts`** — route files, każdy wywołuje serwis + `notifyAllWindows()`.

### Krok 5: Endpointy REST

Prefix: `/api/v1`

**Projects:**
| Method | Path | Serwis | Błędy |
|--------|------|--------|-------|
| `GET` | `/projects` | lista projektów | — |
| `GET` | `/projects/:id` | jeden projekt | 404 |
| `POST` | `/projects` | `createProject` (przy limicie → auto-suspend) | 400 validation |
| `PUT` | `/projects/:id` | `updateProject` (strict, nie tworzy) | 400 validation, 404 |
| `DELETE` | `/projects/:id` | `deleteProject` | 404 |
| `POST` | `/projects/:id/archive` | `archiveProject` | 404 |
| `POST` | `/projects/:id/unarchive` | `unarchiveProject` | 404, 409 active limit |
| `POST` | `/projects/:id/suspend` | `suspendProject` | 404 |
| `POST` | `/projects/:id/unsuspend` | `unsuspendProject` | 404, 409 active limit |
| `PUT` | `/projects/reorder` | `reorderProjects` | 400 validation |
| `POST` | `/projects/:pid/tasks/:tid/toggle-in-progress` | `toggleTaskInProgress` | 404 |
| `POST` | `/projects/:pid/tasks/:tid/toggle-to-do-next` | `toggleTaskToDoNext` | 404 |
| `PUT` | `/projects/pinned-tasks/reorder` | `reorderPinnedTasks` | 400 validation |

**Quick Tasks:**
| Method | Path | Serwis | Błędy |
|--------|------|--------|-------|
| `GET` | `/quick-tasks` | lista | — |
| `POST` | `/quick-tasks` | `saveQuickTask` | 400 validation |
| `PUT` | `/quick-tasks/:id` | `saveQuickTask` | 400 validation, 404 |
| `DELETE` | `/quick-tasks/:id` | `removeQuickTask` | 404 |
| `POST` | `/quick-tasks/:id/complete` | `completeQuickTask` | 404 |
| `POST` | `/quick-tasks/:id/uncomplete` | `uncompleteQuickTask` | 404 |
| `POST` | `/quick-tasks/:id/toggle-in-progress` | `toggleQuickTaskInProgress` | 404 |
| `PUT` | `/quick-tasks/reorder` | `reorderQuickTasks` | 400 validation |

**Repeating Tasks:**
| Method | Path | Serwis | Błędy |
|--------|------|--------|-------|
| `GET` | `/repeating-tasks` | lista | — |
| `POST` | `/repeating-tasks` | `saveRepeatingTask` | 400 validation |
| `PUT` | `/repeating-tasks/:id` | `saveRepeatingTask` | 400 validation, 404 |
| `DELETE` | `/repeating-tasks/:id` | `removeRepeatingTask` | 404 |
| `PUT` | `/repeating-tasks/reorder` | `reorderRepeatingTasks` | 400 validation |
| `POST` | `/repeating-tasks/:id/accept` | `acceptRepeatingProposal` | 404 |
| `POST` | `/repeating-tasks/:id/dismiss` | `dismissRepeatingProposal` | 404 |

**Meta:**
| Method | Path | Opis |
|--------|------|------|
| `GET` | `/health` | status + wersja (public, bez auth) |

**Format odpowiedzi:**
```json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": "message" }
```

**HTTP status codes:**
| Status | Kiedy |
|--------|-------|
| 200 | OK |
| 201 | Created (POST tworzący nowy zasób) |
| 400 | Validation error (niepoprawne dane) |
| 401 | Brak/niepoprawny Bearer token |
| 404 | Zasób nie istnieje |
| 409 | Conflict (np. limit aktywnych projektów) |
| 500 | Unexpected error |

### Krok 6: UI w Settings

Dodać sekcję "API" w Settings:
- Toggle enabled/disabled
- Wyświetlanie portu
- Wyświetlanie API key z przyciskiem "Copy" (masked by default)
- Przycisk "Regenerate key"

### Krok 7: Generowanie API key

Przy pierwszym włączeniu API:
- `apiKey = "top5_" + crypto.randomUUID()` — prefix ułatwia identyfikację
- Zapisywane w `data.yaml` pod `apiConfig`
- Key NIE jest wysyłany przez `getAppData()` — osobny IPC `get-api-config` / `save-api-config`

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `src/shared/types.ts` | **NOWY** — zunifikowane typy + `ApiConfig` |
| `src/main/store.ts` | Usunąć lokalne typy, importować ze shared, eksportować funkcje, IPC handlery → cienkie wrappery |
| `src/main/service/projects.ts` | **NOWY** — logika projektów |
| `src/main/service/quick-tasks.ts` | **NOWY** — logika quick tasks |
| `src/main/service/repeating-tasks.ts` | **NOWY** — logika repeating tasks |
| `src/main/api/server.ts` | **NOWY** — Fastify setup + auth + lifecycle |
| `src/main/api/routes/projects.ts` | **NOWY** |
| `src/main/api/routes/quick-tasks.ts` | **NOWY** |
| `src/main/api/routes/repeating-tasks.ts` | **NOWY** |
| `src/main/api/routes/meta.ts` | **NOWY** — health |
| `src/main/index.ts` | Dodać start HTTP serwera po `app.whenReady()` |
| `src/renderer/types/index.ts` | Re-export z `../../shared/types` |
| `package.json` | Dodać `fastify` do dependencies |

## Bezpieczeństwo

- Bind wyłącznie na `127.0.0.1` — zero ekspozycji sieciowej
- Bearer token (API key) na każdym requeście (oprócz `/health`)
- API key z prefixem `top5_` — łatwo rozpoznać w logach
- Walidacja inputów — istniejące walidatory reużywane
- `getAppData()` sanityzuje `apiConfig` — usuwa `apiKey`, zostawia `enabled` + `port`. Osobny IPC `get-api-config` zwraca pełny obiekt (tylko dla Settings UI)

## Testy

### Izolacja danych — trzy środowiska

```
Produkcja:   ~/.config/top5      → iCloud (nigdy dotykane przez testy)
Dev:         ~/.config/top5-dev  → local  (nigdy dotykane przez testy)
Testy:       /tmp/top5-test-XXX  → temp dir, tworzony per test run, usuwany po
```

**Mechanizm:** env var `TOP5_DATA_DIR` override'uje `ensureDataDir()`. Jeśli ustawiony — używany bezpośrednio, bez iCloud/symlink logiki.

Zmiana w `store.ts`:
```ts
function ensureDataDir(): string {
  // Test/override: explicit data directory
  if (process.env.TOP5_DATA_DIR) {
    mkdirSync(process.env.TOP5_DATA_DIR, { recursive: true })
    return process.env.TOP5_DATA_DIR
  }
  // ... reszta bez zmian (IS_DEV / iCloud / fallback)
}
```

### Framework i uruchamianie

- **Framework:** vitest (Vite-native, zero konfiguracji z istniejącym setupem)
- **Bez Electrona:** testy importują Fastify server + serwisy bezpośrednio, bez `app.whenReady()`
- **`fastify.inject()`** — in-process HTTP, zero realnych portów, szybkie
- **Uruchamianie:** `npm run test:api`

### Setup per test file

```ts
import { beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let testDir: string

beforeAll(() => {
  testDir = mkdtempSync(join(tmpdir(), 'top5-test-'))
  process.env.TOP5_DATA_DIR = testDir
  // import server + services AFTER setting env
})

beforeEach(() => {
  // reset data.yaml to known seed state
})

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true })
  delete process.env.TOP5_DATA_DIR
})
```

### Pokrycie testowe — wszystkie endpointy

**`tests/api/auth.test.ts`** — 3 testy:
- 401 bez tokena
- 401 z niepoprawnym tokenem
- 200 z poprawnym tokenem

**`tests/api/projects.test.ts`** — 12 testów:
- GET /projects — pusta lista
- POST /projects — create, zwraca 201
- POST /projects — auto-suspend przy limicie
- GET /projects/:id — istniejący → 200
- GET /projects/:id — nieistniejący → 404
- PUT /projects/:id — update → 200
- PUT /projects/:id — nieistniejący → 404
- DELETE /projects/:id — 200
- DELETE /projects/:id — nieistniejący → 404
- POST archive/unarchive/suspend/unsuspend — cykl życia
- PUT /projects/reorder — poprawna kolejność
- POST toggle-in-progress / toggle-to-do-next

**`tests/api/quick-tasks.test.ts`** — 9 testów:
- GET /quick-tasks — pusta lista
- POST — create → 201
- POST — invalid data → 400
- PUT — update → 200
- PUT — nieistniejący → 404
- DELETE — 200
- POST complete/uncomplete — cykl
- POST toggle-in-progress
- PUT reorder

**`tests/api/repeating-tasks.test.ts`** — 8 testów:
- GET — pusta lista
- POST — create → 201
- POST — invalid data → 400
- PUT — update → 200
- DELETE — 200
- PUT reorder
- POST accept — tworzy quick task
- POST dismiss

**`tests/api/health.test.ts`** — 2 testy:
- 200 bez auth
- zwraca wersję

### Pliki

| Plik | Opis |
|------|------|
| `tests/api/auth.test.ts` | **NOWY** |
| `tests/api/projects.test.ts` | **NOWY** |
| `tests/api/quick-tasks.test.ts` | **NOWY** |
| `tests/api/repeating-tasks.test.ts` | **NOWY** |
| `tests/api/health.test.ts` | **NOWY** |
| `tests/api/setup.ts` | **NOWY** — shared setup (temp dir, server init, seed data) |
| `vitest.config.ts` | **NOWY** — konfiguracja vitest |
| `package.json` | dodać vitest do devDependencies, script `test:api` |
| `src/main/store.ts` | dodać `TOP5_DATA_DIR` override w `ensureDataDir()` |

## Weryfikacja

1. `npm run build` — kompilacja
2. `npm run dev` — UI działa jak wcześniej
3. `npm run test:api` — wszystkie testy przechodzą (34 testy)
4. Smoke test manualny: `scripts/api-smoke-test.sh <api-key>` (opcjonalny, na działającej apce)

## Semantyka błędów — IPC vs HTTP

Serwis zwraca ujednolicone błędy (`{ error: 'not_found' | 'validation' | 'active_limit' }`). Adaptery tłumaczą je na swój transport:

| Serwis error | IPC adapter | HTTP adapter |
|-------------|-------------|-------------|
| `not_found` | zwraca aktualną listę (no-op, backward compat) | 404 |
| `validation` | zwraca aktualną listę (no-op, backward compat) | 400 |
| `active_limit` | zwraca `{ error: "..." }` (obecne zachowanie) | 409 |
| brak błędu | zwraca wynik + `notifyAllWindows()` | 200/201 + `notifyAllWindows()` |

**Dlaczego IPC zwraca listę zamiast błędu:** obecne UI nie obsługuje błędów z IPC — oczekuje zawsze listy. Zmiana tego wymaga zmian w rendererze, co jest poza scope.

## Poza scope v1 (future)

- Focus mode (enter/exit/switch-task/check-ins)
- Config management (save config)
- Quick notes
- `/app-data` dump (wymaga maskowania apiKey)
- `/operations` log
- Window control (launch-*, resize, traffic lights)
