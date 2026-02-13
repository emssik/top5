# Top5

Desktop app for attention management. Configurable project limit (default 5), minimizes context-switching friction.

## Features

- **Project limit** — configurable active project cap (1–20, default 5), forces prioritization
- **Sidebar navigation** — fixed sidebar with color-coded project dots, collapsible suspended/archived sections, drag-and-drop between states
- **Today view** — default landing page grouping tasks into Focus, In Progress, Up Next, and Done sections
- **Project colors** — 8 color options auto-assigned to new projects
- **Project links** — flexible label+URL pairs supporting vscode://, iterm://, obsidian://, mailto://, http(s):// protocols
- **Quick tasks** — standalone task list + pinned "To Do Next" tasks from projects, configurable limit (default 5)
- **In-progress status** — mark tasks as in-progress with visual amber indicators
- **Quick Add** — global overlay (`Cmd+Shift+N`) for rapidly adding tasks, projects, and repeating tasks without opening the main window; keyboard-driven with Tab to switch modes, `Cmd+1-9` to select project, Enter to submit
- **Tasks per project** — full-screen detail view with task list, inline editing, completion, deletion, time tracking
- **Focus mode** — dedicated always-on-top window with countdown timer, launcher buttons, and double-click to copy task title
- **Focus check-ins** — every 15 min asks if you're still working; tracks time per project and task
- **Repeating tasks** — recurring task definitions with schedules (daily, specific weekdays, every N days, N days after completion, monthly day-of-month, Nth weekday, every N months) and optional date ranges; due tasks appear as proposals in Today view
- **Clean view** — distraction-free notebook style with configurable handwriting font (Caveat, Patrick Hand, Kalam, Architects Daughter) and dot grid background
- **Work stats** — per-project focus time table with selectable time ranges (7d / 14d / month / prev month / 6m / 12m)
- **Activity log** — persistent operation log tracking task creates/completes/deletes, project events, and focus check-ins
- **Drag-and-drop** — reorder projects and tasks, move projects between active/suspended/archived states
- **Project archiving** — archive instead of delete, restore anytime
- **Project suspend** — temporarily pause projects without archiving, excluded from the active limit; new projects auto-suspend when limit is reached
- **Light/dark theme** — warm notebook palette (light) or OLED-friendly dark, persisted across sessions
- **Quick notes** — global scratchpad in a slide-in panel
- **Shortcuts** — `Cmd+Shift+Space` (global) to toggle app; `Cmd+1-5` to jump to project, `Cmd+Shift+F` to toggle focus, `Cmd+Shift+N` for Quick Add (local, configurable)
- **Dev mode isolation** — separate data directory in development, preventing dev sessions from modifying production data
- **Persistent storage** — YAML config + JSONL check-ins + JSONL operation log, synced via iCloud Drive with daily backups

## Stack

- Electron 28 + electron-vite
- React 18 + TypeScript
- Tailwind CSS v4
- Zustand (state management)
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

## Coding guide

See `docs/CODING_GUIDE.md` for coding conventions and patterns used in this project.

## Keyboard shortcuts

| Shortcut | Scope | Action |
|---|---|---|
| `Cmd+Shift+Space` | Global | Toggle app |
| `Cmd+1..5` | Local | Switch to project (configurable) |
| `Cmd+Shift+F` | Local | Toggle focus mode (configurable) |
| `Cmd+Shift+N` | Local | Quick Add window (configurable) |
| `Tab` | Quick Add | Switch between Task / Project / Repeat modes |
| `n` | Local | Add quick task / focus add-task input (context-dependent) |

Global shortcuts work system-wide. Local shortcuts work only when the app window is focused. All shortcuts are configurable in Settings.

## Project structure

```
src/
  main/
    index.ts           # BrowserWindow, app lifecycle, IPC registration
    store.ts           # YAML/JSONL storage, iCloud sync, daily backups, IPC handlers
    launchers.ts       # VS Code, iTerm, Obsidian, browser launchers
    focus-window.ts    # Focus mode window, check-in popups, countdown timer
    quick-add-window.ts # Quick Add overlay window
    shortcuts.ts       # Global and local keyboard shortcuts
  preload/
    index.ts           # contextBridge IPC api
  renderer/
    App.tsx            # Root — routes between Dashboard, FocusMode, and auxiliary views
    components/
      Dashboard.tsx      # Main layout: sidebar + content panel
      Sidebar.tsx        # Fixed sidebar with project dots, drag-and-drop, collapsible sections
      TodayView.tsx      # Default view: Focus, In Progress, Up Next, Done sections
      ProjectDetailView.tsx # Full-screen project view with tasks, links, metadata
      ProjectEditor.tsx  # Modal editor with color picker and links management
      FocusMode.tsx      # Dedicated focus window with countdown and launchers
      CheckInPopup.tsx   # Focus check-in popup (yes/no/a little)
      InlineStatsView.tsx # Work stats table with time range selection
      OperationLogView.tsx # Activity log with date grouping
      QuickTasksView.tsx # Merged standalone + pinned tasks view
      QuickAddWindow.tsx # Quick Add overlay for rapid task/project/repeat creation
      RepeatView.tsx     # Repeating tasks wrapped in sidebar layout
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

| File | Content |
|---|---|
| `data.yaml` | Projects, quick tasks, repeating tasks, quick notes, config |
| `checkins.jsonl` | Focus check-in log (append-only, one JSON per line) |
| `operations.jsonl` | Activity operation log (task creates/completes/deletes, project events) |
| `backups/` | Daily auto-backups (max 7 days, skipped if no changes) |

## License

MIT
