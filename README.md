# Top5

Desktop app for attention management. Forces a limit of 5 projects, minimizes context-switching friction.

## Features

- **5 project limit** — forces prioritization, no infinite backlog
- **Quick tasks** — standalone task list + pinned "To Do Next" tasks from projects, configurable limit (default 5)
- **Tasks per project** — simple task list with inline editing, completion, time tracking
- **Focus mode** — dedicated always-on-top window with countdown timer, launcher buttons, and double-click to copy task title
- **Focus check-ins** — every 15 min asks if you're still working; tracks time per project and task
- **Repeating tasks** — recurring task definitions with schedules (daily, specific weekdays, every N days, N days after completion); due tasks appear as proposals below active quick tasks
- **Clean view** — distraction-free notebook style with configurable handwriting font (Caveat, Patrick Hand, Kalam, Architects Daughter) and dot grid background
- **Compact mode** — always-on-top slim sidebar with project launchers and quick tasks
- **Work stats** — heatmap of focus time per project (today / 7d / 14d / month / 6m / 12m)
- **Quick launchers** — one-click open VS Code, iTerm, Obsidian (specific note), browser per project
- **Native file pickers** — system dialogs for selecting folders and Obsidian notes
- **Drag-and-drop reordering** — arrange projects and quick tasks by priority
- **Project archiving** — archive instead of delete, restore anytime
- **Project suspend** — temporarily pause projects without archiving, excluded from the 5-project limit
- **Light/dark theme** — warm notebook palette (light) or OLED-friendly dark, persisted across sessions
- **Quick notes** — global scratchpad
- **Global shortcuts** — `Cmd+Shift+Space` to toggle app, `Cmd+1-5` to jump to project, all configurable
- **Dev mode isolation** — separate data directory in development, preventing dev sessions from modifying production data
- **Persistent storage** — YAML config + JSONL check-ins, synced via iCloud Drive with daily backups

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

| Shortcut | Action |
|---|---|
| `Cmd+Shift+Space` | Toggle app |
| `Cmd+1..5` | Switch to project (configurable) |
| `Cmd+Shift+F` | Toggle focus mode (configurable) |
| `Cmd+Shift+N` | Quick notes (configurable) |
| `n` | Add quick task / focus add-task input (context-dependent) |

All shortcuts are configurable in Settings.

## Project structure

```
src/
  main/
    index.ts           # BrowserWindow, app lifecycle, IPC registration
    store.ts           # YAML/JSONL storage, iCloud sync, daily backups, IPC handlers
    launchers.ts       # VS Code, iTerm, Obsidian, browser launchers
    focus-window.ts    # Focus mode window, check-in popups, countdown timer, stats window
    shortcuts.ts       # Global keyboard shortcuts
  preload/
    index.ts           # contextBridge IPC api
    index.d.ts         # TypeScript types for the bridge API
  renderer/
    App.tsx            # Root — routes between Dashboard and FocusMode
    components/
      Dashboard.tsx      # Main view with tabbed interface (Tasks/Projects/Suspended/Archive)
      DashboardToolbar.tsx # Top toolbar with view toggles and actions
      TabBar.tsx         # Reusable tab bar component
      ProjectTile.tsx    # Project card with launchers, timer, tasks
      ProjectEditor.tsx  # Modal editor with native file pickers
      FocusMode.tsx      # Dedicated focus window with countdown and launchers
      CheckInPopup.tsx   # Focus check-in popup (yes/no/a little)
      CompactBar.tsx     # Compact mode sidebar (260px, always-on-top)
      StatsView.tsx      # Work stats heatmap across time ranges
      TaskList.tsx       # Per-project task CRUD with focus action
      QuickTasksView.tsx # Merged standalone + pinned tasks view
      RepeatingTasksTab.tsx # Repeating task CRUD with schedule picker and reorder
      CleanViewHeader.tsx # Header for clean/notebook view mode
      QuickNotes.tsx     # Global notes modal
      Settings.tsx       # Shortcut and quick tasks limit configuration
    hooks/
      useProjects.ts   # Zustand store (single source of truth)
      useTaskList.ts   # Merged task list logic (active, repeating, completed, proposals)
      useTimer.ts      # Live timer hook
    utils/
      checkInTime.ts   # Focus time calculations and formatting
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
| `backups/` | Daily auto-backups (max 7 days, skipped if no changes) |

## License

MIT
