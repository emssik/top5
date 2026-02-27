# Top5

Desktop app for attention management. Configurable project limit (default 5), minimizes context-switching friction.

## Features

- **Project limit** — configurable active project cap (1–20, default 5), forces prioritization
- **Sidebar navigation** — fixed sidebar with color-coded project dots, collapsible suspended/archived sections, drag-and-drop between states
- **Today view** — default landing page grouping tasks into Focus, Scheduled, In Progress, Up Next, Overflow, and Done sections
- **Project colors** — 8 color options auto-assigned to new projects
- **Project links** — flexible label+URL pairs supporting vscode://, iterm://, obsidian://, mailto://, http(s):// protocols
- **Quick tasks** — standalone task list + pinned "To Do Next" tasks from projects, configurable limit (default 5)
- **In-progress status** — mark tasks as in-progress with visual amber indicators
- **Quick Add** — global overlay (`Cmd+Shift+N`) for rapidly adding tasks, projects, and repeating tasks without opening the main window; keyboard-driven with Tab to switch modes, `Cmd+1-9` to select project, due date picker, Enter to submit
- **Tasks per project** — full-screen detail view with task list, inline editing, completion, deletion, time tracking
- **Focus mode** — compact always-on-top bar with session timer and context menu (project links, open project, manual time entry, complete, exit), plus double-click to copy task title
- **Focus check-ins** — every 15 min asks if you're still working; tracks time per project and task
- **Repeating tasks** — recurring task definitions with schedules (daily, specific weekdays, every N days, N days after completion, monthly day-of-month, Nth weekday, every N months) and optional date ranges; can be associated with a project; due tasks appear as proposals in Today view
- **5 Wins system** — lock today's tasks and resolve the day as win/loss; track daily, weekly, monthly, and yearly streaks with grace rules
- **Clean view** — distraction-free notebook style with configurable handwriting font (Caveat, Patrick Hand, Kalam, Architects Daughter), dot grid background, and today's focus time in the header
- **Work stats** — per-project focus time table with selectable time ranges (7d / 14d / month / prev month / 6m / 12m) and 5 Wins streak cards
- **Activity log** — persistent operation log tracking task creates/completes/deletes, project events, and focus check-ins
- **Drag-and-drop** — reorder projects and tasks, move projects between active/suspended/archived states
- **Project archiving** — archive instead of delete, restore anytime
- **Project suspend** — temporarily pause projects without archiving, excluded from the active limit; new projects auto-suspend when limit is reached
- **Light/dark theme** — warm notebook palette (light) or OLED-friendly dark, persisted across sessions
- **Quick notes** — global scratchpad in a slide-in panel
- **Shortcuts** — `Cmd+Shift+Space` (global) to toggle app; `Cmd+Shift+N` (global) for Quick Add; `Cmd+1-5` to jump to project and `Cmd+Shift+F` to toggle focus (local, configurable)
- **Obsidian journal** — auto-generated daily/weekly/monthly notes in Obsidian vault with completed tasks, focus time, and 5 Wins results; preserves user-written reflections on re-generation; project dictionary for autocomplete via Various Complements plugin ([docs](docs/journal.md))
- **Deep links** — `top5://project/<id>` links open projects from Obsidian notes or terminal; single instance lock ensures the running app handles the navigation
- **HTTP API** — local REST API (Fastify, `127.0.0.1:15055`) for automations and AI agents; Bearer token auth, full CRUD for projects, quick tasks, and repeating tasks ([docs](docs/API.md))
- **Task IDs and project codes** — projects have short codes (e.g., `PROJ`), tasks get structured IDs (`PROJ-1`, `QT-1`) displayed as badges; used in journal notes and Obsidian storage paths
- **Due dates** — tasks can have due dates; scheduled tasks appear in a dedicated section in Today view with reschedule options
- **Sweep & Promote** — sweep unfinished tasks below the limit into an overflow section; multi-select and promote overflow tasks back to the top
- **Split & Continue** — complete a task and automatically create a continuation copy with an incremented prefix (`(✂1)`, `(✂2)`, ...)
- **Clickable URLs in tasks** — URLs in task titles are auto-detected and rendered as clickable links
- **Right-click project links** — context menu in Today and Clean views showing all active project links for quick access
- **Dev mode isolation** — separate data directory in development, preventing dev sessions from modifying production data
- **Persistent storage** — YAML config + JSONL check-ins + JSONL operation log + JSONL wins history, synced via iCloud Drive with daily backups

## Stack

- Electron 40 + electron-vite 5
- React 18 + TypeScript
- Tailwind CSS v4
- Zustand v5 (state management)
- Fastify (HTTP API)
- js-yaml (YAML file persistence)
- nanoid (ID generation)

## Getting started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Tests

```bash
npm test
npm run test:api
```

## Documentation

- `docs/CODING_GUIDE.md` — coding conventions and patterns
- `docs/API.md` — HTTP API reference
- `docs/wins.md` — 5 Wins rules, hierarchy, and streak definitions
- `docs/journal.md` — Obsidian journal integration, deep links, and project dictionary

## Keyboard shortcuts

| Shortcut | Scope | Action |
|---|---|---|
| `Cmd+Shift+Space` | Global | Toggle app |
| `Cmd+1..5` | Local | Switch to project (configurable) |
| `Cmd+Shift+F` | Local | Toggle focus mode (configurable) |
| `Cmd+Shift+N` | Global | Quick Add window (configurable) |
| `Tab` | Quick Add | Switch between Task / Project / Repeat modes |
| `n` | Local | Add quick task / focus add-task input (context-dependent) |
| `j` | Local | Generate and open today's journal note in Obsidian |

Global shortcuts work system-wide. Local shortcuts work only when the app window is focused. Shortcut bindings are stored in `config.actionShortcuts`.

## Project structure

```
src/
  main/
    index.ts           # BrowserWindow, app lifecycle, IPC registration, deep link protocol
    store.ts           # YAML/JSONL storage, iCloud sync, daily backups, IPC handlers, wins lock/deadline checks
    api/
      server.ts        # Fastify HTTP API server (start/stop/restart)
      routes/          # REST endpoints: projects, quick-tasks, repeating-tasks, meta
    service/           # Business logic layer (projects, quick-tasks, repeating-tasks, wins, journal)
    launchers.ts       # VS Code, iTerm, Obsidian, browser launchers
    focus-window.ts    # Focus mode window, check-in popups, session tracking
    quick-add-window.ts # Quick Add overlay window
    shortcuts.ts       # Global and local keyboard shortcuts
  shared/
    types.ts           # Unified TypeScript interfaces (single source of truth)
    schedule.ts        # Repeating task schedule engine
    wins.ts            # Win/loss hierarchy and streak calculations
    taskId.ts          # Task ID formatting and Obsidian note path computation
    constants.ts       # Shared constants (colors, link labels)
    quick-add.ts       # Quick Add shared utilities
  preload/
    index.ts           # contextBridge IPC api
  renderer/
    App.tsx            # Root — routes between Dashboard, FocusMode, and auxiliary views
    components/
      Dashboard.tsx      # Main layout: sidebar + content panel
      Sidebar.tsx        # Fixed sidebar with project dots, drag-and-drop, collapsible sections
      TodayView.tsx      # Default view: Focus, Scheduled, In Progress, Up Next, Overflow, Done sections
      ProjectDetailView.tsx # Full-screen project view with tasks, links, metadata
      ProjectEditor.tsx  # Modal editor with color picker and links management
      FocusMode.tsx      # Focus bar UI with session timer and quick actions
      FocusMenuPopup.tsx # Focus context menu rendered in a separate popup window
      CheckInPopup.tsx   # Focus check-in popup (yes/no/a little)
      InlineStatsView.tsx # Work stats table with time range selection
      OperationLogView.tsx # Activity log with date grouping
      QuickTasksView.tsx # Merged standalone + pinned tasks view
      QuickAddWindow.tsx # Quick Add overlay for rapid task/project/repeat creation
      RepeatView.tsx     # Repeating tasks wrapped in sidebar layout
      RepeatUpdateModal.tsx # Modal for updating repeating task template title
      Linkify.tsx        # Auto-detect and render clickable URLs in text
      TaskIdBadge.tsx    # Task ID badge component (PROJ-1, QT-1)
      ProjectCodeMigration.tsx # Migration wizard for assigning project codes
      ProjectLinksMenu.tsx # Right-click context menu with project links
      CleanViewHeader.tsx # Header for clean/notebook view mode
      QuickNotesPanel.tsx # Slide-in quick notes panel
      Settings.tsx       # App configuration and shortcuts reference
    hooks/
      useProjects.ts   # Zustand store (single source of truth)
      useTaskList.ts   # Merged task list logic (active, repeating, completed, proposals)
    utils/
      checkInTime.ts   # Focus time calculations and formatting
      projects.ts      # Project normalization (colors, links, migration)
      launchers.ts     # Launcher metadata and dispatch helpers
      constants.ts     # Shared constants and configuration defaults
    types/
      index.ts         # TypeScript interfaces
```

## Data storage

Data lives in iCloud Drive (`~/Library/Mobile Documents/com~apple~CloudDocs/top5/`) with a symlink at `~/.config/top5`. On first launch, existing data from `~/.config/top5/` or legacy electron-store is migrated automatically.

In development mode (`npm run dev`), storage is isolated in `~/.config/top5-dev`.

| File | Content |
|---|---|
| `data.yaml` | Projects, quick tasks, repeating tasks, quick notes, config, API settings |
| `checkins.jsonl` | Focus check-in log (append-only, one JSON per line) |
| `operations.jsonl` | Activity operation log (task creates/completes/deletes, project events) |
| `wins.jsonl` | Win/loss history used by 5 Wins streak calculations |
| `backups/` | Daily auto-backups (max 7 days, skipped if no changes) |

## License

MIT
