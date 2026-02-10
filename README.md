# Top5

Desktop app for attention management. Forces a limit of 5 projects, minimizes context-switching friction.

## Features

- **5 project limit** — forces prioritization, no infinite backlog
- **Drag-and-drop reordering** — arrange projects by priority
- **Quick launchers** — one-click open VS Code, iTerm, Obsidian (specific note), browser per project
- **Native file pickers** — system dialogs for selecting folders and Obsidian notes
- **Focus mode** — frameless always-on-top mini-widget showing current task, visible on all macOS Spaces
- **Time tracking** — per-project timer with start/stop, survives app restart
- **Tasks** — simple task list per project with focus-on-task support
- **Quick notes** — global scratchpad
- **Global shortcuts** — `Cmd+Shift+Space` to toggle app, `Cmd+1-5` to jump to project, all configurable
- **Persistent storage** — YAML-based local storage at `~/.config/top5/data.yaml`

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
    store.ts           # YAML file storage, IPC handlers, native dialogs
    launchers.ts       # VS Code, iTerm, Obsidian, browser launchers
    focus-window.ts    # Frameless focus mode window
    shortcuts.ts       # Global keyboard shortcuts
  preload/
    index.ts           # contextBridge IPC api
  renderer/
    App.tsx            # Root — routes between Dashboard and FocusMode
    components/
      Dashboard.tsx    # Main view with project grid
      ProjectTile.tsx  # Project card with launchers, timer, tasks
      ProjectEditor.tsx # Inline editor with native file pickers
      FocusMode.tsx    # Compact always-on-top task widget
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

Data is stored in `~/.config/top5/data.yaml`. On first launch, legacy data from `~/Library/Application Support/top5/config.json` is migrated automatically.

## License

MIT
