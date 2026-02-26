# Top5 Project Context

Architecture and pitfalls every agent must know.

## Architecture

Electron app with 3 layers:

```
src/main/          → Electron main process (Node.js)
  store.ts         → IPC handlers + data persistence (1243 LOC, large)
  service/         → Business logic (projects, quick-tasks, repeating-tasks, wins, journal)
  api/             → Fastify HTTP API (local only, Bearer auth, port 15055)
  index.ts         → Window lifecycle, deep links

src/preload/       → IPC bridge
  index.ts         → contextBridge with ~85 methods

src/renderer/      → React UI
  components/      → 20+ components (TodayView: 1375 LOC, large)
  hooks/           → Zustand stores (useProjects, useTaskList)
  types/index.ts   → Re-exports from shared/types
  utils/           → Helpers, constants

src/shared/        → Shared between main and renderer
  types.ts         → SINGLE SOURCE OF TRUTH for all types
  schedule.ts      → Repeating task schedule engine
  constants.ts     → Colors, measurements, labels
```

## Data Flow

```
User action → React component → window.api.* (preload) → IPC → store.ts handler → service layer → data.yaml/JSONL
```

## Critical Pitfalls

### 1. Stale Closure Bug (HIGHEST PRIORITY)
In React components, NEVER use `projects` from props or closure.
ALWAYS use `useProjects.getState().projects.find(...)` for fresh data.

### 2. Stale .js Artifacts
`tsc --build` emits .js alongside .ts in src/. Vite resolves .js before .ts.
ALWAYS run `npm run clean` before `npm run build`.

### 3. Electron Sandbox
NEVER set `webPreferences.sandbox: true`. Causes white screen.
Only change with explicit user permission + full migration.

### 4. Vite + require()
`require()` does NOT work in bundled main process. Use ONLY static imports.

### 5. IPC Contract
When adding/changing IPC methods, update ALL 3 layers:
1. Handler in `src/main/store.ts`
2. Bridge in `src/preload/index.ts`
3. Type declaration in `src/renderer/types/index.ts`

## Build & Test

```bash
npm run build      # clean + typecheck + electron-vite build
npm run test:api   # 34 vitest tests (API routes)
npm run test       # Node test runner (schedule tests)
npm run clean      # Remove stale .js artifacts
```

## Conventions

- TypeScript strict, no `any`
- Tailwind CSS, small single-purpose components
- KISS: simplest solution that works
- DRY: shared logic in utils/hooks
- Types only in `src/shared/types.ts`
- Validate IPC payloads in main process
- Use `spawn` not `exec` for user input
- Git: user creates branches, agents do NOT auto-create
