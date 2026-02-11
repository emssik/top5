# Top5

Desktop app for attention management. Forces a limit of 5 projects, minimizes context-switching friction.

## Features

- **5 project limit** — forces prioritization, no infinite backlog
- **Drag-and-drop reordering** — arrange projects by priority
- **Quick launchers** — one-click open VS Code, iTerm, Obsidian (specific note), browser per project
- **Native file pickers** — system dialogs for selecting folders and Obsidian notes
- **Focus mode** — frameless always-on-top mini-widget with countdown timer to next check-in, visible on all macOS Spaces
- **Focus check-ins** — every 15 min asks if you're still working; next timer starts only after response
- **Compact mode** — always-on-top slim sidebar with project launchers
- **Work stats** — heatmap of focus time per project (today/7d/month/6m/12m)
- **Project archiving** — archive instead of delete, restore anytime
- **Light/dark theme** — toggle in dashboard header, persisted across sessions
- **Tasks** — simple task list per project with focus-on-task support
- **Quick notes** — global scratchpad
- **Global shortcuts** — `Cmd+Shift+Space` to toggle app, `Cmd+1-5` to jump to project, all configurable
- **Persistent storage** — YAML config + JSONL check-ins, synced via iCloud Drive with daily backups

## Stack

- Electron + electron-vite
- React 18 + TypeScript
- Tailwind CSS v4
- Zustand (state management)
- js-yaml (YAML file persistence)

## Getting started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+Shift+Space` | Toggle app |
| `Cmd+1..5` | Switch to project (configurable) |
| `Cmd+Shift+F` | Toggle focus mode (configurable) |
| `Cmd+Shift+N` | Quick notes (configurable) |

Shortcuts are configurable in Settings.

## Project structure

```
src/
  main/
    index.ts           # BrowserWindow, app lifecycle
    store.ts           # YAML/JSONL storage, iCloud sync, daily backups, IPC handlers
    launchers.ts       # VS Code, iTerm, Obsidian, browser launchers
    focus-window.ts    # Focus mode window, check-in popups, countdown timer
    shortcuts.ts       # Global keyboard shortcuts
  preload/
    index.ts           # contextBridge IPC api
  renderer/
    App.tsx            # Root — routes between Dashboard and FocusMode
    components/
      Dashboard.tsx    # Main view with project grid
      ProjectTile.tsx  # Project card with launchers, timer, tasks
      ProjectEditor.tsx # Inline editor with native file pickers
      FocusMode.tsx    # Always-on-top task widget with countdown
      CheckInPopup.tsx # Focus check-in popup (yes/no/a little)
      CompactBar.tsx   # Compact mode sidebar
      StatsView.tsx    # Work stats heatmap
      TaskList.tsx     # Task CRUD with focus action
      QuickNotes.tsx   # Global notes modal
      Settings.tsx     # Shortcut configuration
    hooks/
      useProjects.ts   # Zustand store
      useTimer.ts      # Live timer hook
    types/
      index.ts         # TypeScript interfaces
```

## Data storage

Data lives in iCloud Drive (`~/Library/Mobile Documents/com~apple~CloudDocs/top5/`) with a symlink at `~/.config/top5`.

| File | Content |
|---|---|
| `data.yaml` | Projects, config, quick notes |
| `checkins.jsonl` | Focus check-in log (append-only, one JSON per line) |
| `backups/` | Daily auto-backups (max 7 days, skipped if no changes) |

On first launch, existing data from `~/.config/top5/` or legacy electron-store is migrated automatically.

## License

MIT
