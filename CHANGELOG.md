# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.6.1] - 2026-02-11

### Fixed

- Focus window now opens on primary display and uses `floating` level instead of `screen-saver`, allowing it to be moved between monitors

### Changed

- Dashboard toolbar buttons replaced with SVG icons for consistent appearance across themes
- Toolbar button styling unified with muted-to-primary hover transitions
- Added visual separator before "Add Project" button

## [1.6.0] - 2026-02-11

### Added

- iCloud Drive sync: data directory moved to `~/Library/Mobile Documents/com~apple~CloudDocs/top5/` with symlink at `~/.config/top5` (macOS)
- Automatic migration of existing `~/.config/top5/` data to iCloud directory
- Daily auto-backups with hash-based deduplication (max 7 days, skipped when unchanged)
- Focus check-ins stored in append-only JSONL file (`checkins.jsonl`) instead of YAML
- Migration of existing YAML check-ins to JSONL format on first launch
- Countdown timer in focus mode widget showing time remaining until next check-in
- `onCheckInCountdown` preload API for real-time countdown updates from main process

### Changed

- Check-in timer now starts only after user responds to the popup (no longer fires on a fixed interval)
- `focusCheckIns` removed from `AppData` type and YAML storage; check-ins loaded independently via IPC
- `useProjects` hook now fetches check-ins in parallel with app data on load
- README updated with iCloud sync details, new features, and revised project structure

## [1.5.0] - 2026-02-11

### Added

- Light/dark theme toggle: button in the dashboard header switches between dark and light mode
- CSS custom property theming system with semantic color tokens (`bg-base`, `bg-card`, `bg-surface`, `text-t-primary`, etc.)
- Light theme palette defined via `[data-theme="light"]` CSS selector
- Theme preference persisted in app config and applied to all windows (main, check-in, stats)
- "Today" label shown next to the current date row in the stats heatmap
- Stats window now displays rows in reverse chronological order (newest first)

### Changed

- All UI components migrated from hardcoded Tailwind `neutral-*` color classes to semantic theme tokens
- Stats window now toggles on re-click (closes if already open) and properly cleans up on close
- Heatmap cell colors use semantic tokens (`bg-cell-lo`, `bg-cell-mid`, `bg-cell-hi`) for theme awareness

## [1.4.0] - 2026-02-10

### Added

- Work Stats window: heatmap-style grid showing focus time per project across selectable time ranges (today, 7 days, 14 days, month, previous month, 6 months, 12 months)
- StatsView component rendered in a dedicated Electron window via `#stats` hash route
- `openStatsWindow` IPC handler and preload bridge for launching the stats window from the dashboard
- Shared `checkInTime` utility module with helpers to calculate and format time from focus check-in data
- Per-task time display in TaskList derived from check-in responses

### Changed

- Project time tracking now derived from focus check-in responses instead of manual start/stop timers
- Removed `toggleTimer` action and per-project timer UI (play/pause button) from ProjectTile
- Check-in interval corrected from 30-second debug value to production 15-minute interval

### Removed

- Manual per-project timer (start/stop/accumulate) replaced by check-in-based time calculation

## [1.3.0] - 2026-02-10

### Added

- Focus check-in popup: periodic prompt (every 15 min) asking if you are still working on the focused task
- Check-in responses (yes / no / a little) stored persistently in app data
- Pause focus mode button on the focus bar that exits focus without revealing the main window
- CheckInPopup component rendered in a separate frameless Electron window via hash routing
- IPC handlers for `pause-focus-mode`, `dismiss-checkin`, `save-focus-checkin`, `get-focus-checkins`
- `FocusCheckIn` type in renderer types and main store

### Changed

- Compact bar window height now dynamically sized based on active project count instead of full screen height
- Launcher icons updated to text-based glyphs and emoji in CompactBar and ProjectTile

## [1.2.0] - 2026-02-10

### Added

- Compact mode: always-on-top slim sidebar showing projects and launchers, toggled from dashboard
- Project archiving: archive projects instead of deleting, with restore from archive view
- Archive view in dashboard with restore functionality and active-project limit enforcement
- CompactBar component with per-project quick launchers and expand button
- `Cmd+1-5` shortcuts now exit compact mode and expand the selected project
- IPC handlers for `enter-compact-mode`, `exit-compact-mode`, `archive-project`, `unarchive-project`

### Changed

- Dashboard now separates active and archived projects, with archive tab when archived projects exist
- Project count limit (5) now applies only to active (non-archived) projects
- Updated README with compact mode, archiving, and drag-and-drop documentation

## [1.1.0] - 2026-02-10

### Added

- Drag-and-drop reordering for project tiles in the dashboard
- Configurable action shortcuts for project selection (Cmd+1-5), quick notes, and focus toggle
- IPC bridge for shortcut-driven UI actions (`onShortcutAction` preload API)
- Expand/collapse state for project tiles lifted to Dashboard for external control

### Changed

- Replaced `electron-store` with YAML-based file storage at `~/.config/top5/data.yaml` using `js-yaml`
- Automatic migration from legacy electron-store JSON format on first launch
- Refactored store module to use in-memory cache with file-backed persistence
- Extracted `showAndFocus` helper in shortcuts module for consistent window activation

## [1.0.0] - 2026-02-10

### Added

- Electron + React 18 + TypeScript application scaffold with electron-vite
- Dashboard view with project grid limited to 5 projects
- Project tiles with integrated launchers (VS Code, iTerm, Obsidian, browser)
- Inline project editor with native macOS file pickers
- Focus mode: frameless always-on-top mini-widget visible on all Spaces
- Per-project time tracking with start/stop, survives app restart
- Per-project task list with focus-on-task support
- Global quick notes scratchpad
- Configurable global keyboard shortcuts (Cmd+Shift+Space toggle, Cmd+1-5 project switch)
- Settings panel for shortcut configuration
- Persistent local storage via electron-store
- Zustand state management with electron-store bridge
- Tailwind CSS v4 styling
- macOS DMG build target via electron-builder
