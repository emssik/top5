# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Focus Mode task picker now uses `useTaskList` hook for consistent task list with clean view (same ordering and filtering)
- Clean view hides repeating section header when no repeating tasks are active
- Clean view no longer shows repeating task proposals (accept/dismiss UI)
- Clean view completed section separator only shown when there are actual repeating active tasks (not just proposals)

### Removed

- `focus_checkin` operation type from activity log — focus check-ins are no longer logged as separate operations

## [1.27.1] - 2026-02-13

### Fixed

- Typed task parameter in Focus Mode completion handler (use `Task` type instead of inline `{ id: string }`)

## [1.27.0] - 2026-02-13

### Added

- Task completion from Focus Mode: checkmark button completes the current task (both quick tasks and pinned project tasks) without leaving focus
- Next task picker in Focus Mode: after completing a task, a popup lists available quick tasks and pinned project tasks to continue focusing
- `switch-focus-task` IPC handler to change the focused task, reset the check-in timer, and notify all windows
- `resize-focus-window` IPC handler to dynamically resize the focus window when the task picker opens/closes
- `switchFocusTask` and `resizeFocusWindow` preload bridge APIs

### Changed

- Focus Mode confirm dialog generalized to handle both exit and complete actions (save tracked time before completing a task)
- Focus Mode tooltip hidden while the task picker is open

## [1.26.1] - 2026-02-13

### Changed

- Quick Add task panel now shows suspended projects alongside active ones, allowing task assignment to any non-archived project
- Removed standalone "Quick task (no project)" option from Quick Add task panel — tasks must now be assigned to a project
- Quick Add project list scrollable with 240px max height to prevent overflow with many projects
- Quick Add content area uses `overflow-hidden` instead of vertical scroll to prevent double scrollbars
- README updated to reflect current features: Quick Add, task/project deletion, monthly schedules, auto-suspend, revised shortcuts and project structure

## [1.26.0] - 2026-02-13

### Added

- Quick Add window: global overlay (`Cmd+Shift+N`) for rapidly adding tasks, projects, and repeating tasks without opening the main window
- Three modes in Quick Add: Task (standalone or to a project), Project (with color, description, first task), and Repeating (with full schedule picker)
- Keyboard-driven workflow: `Tab` to switch modes, `Cmd+1-9` to select project, arrow keys to navigate project list, `Enter` to submit, `Esc` to dismiss
- `quick-add-window` module managing a frameless, always-on-top, transparent BrowserWindow with hash route `#quick-add`
- `close-quick-add-window` IPC handler and preload bridge for programmatic window dismissal
- `QuickAddWindow` renderer component with `TaskPanel`, `ProjectPanel`, and `RepeatPanel` sub-components
- Pin to Today and In Progress toggles when adding tasks via Quick Add

### Changed

- Creating a project when active limit is reached now auto-suspends the new project instead of blocking creation with an error
- Removed client-side limit guard from Dashboard "Add Project" button and ProjectEditor validation
- Main store `save-project` handler sets `suspendedAt` on new projects exceeding the active limit instead of silently discarding

## [1.25.0] - 2026-02-13

### Added

- Delete button on individual tasks (both active and completed) in `ProjectDetailView`
- Delete project action in `ProjectDetailView` header (visible only when project has zero tasks, with confirmation dialog)
- `onDelete` callback on `ProjectDetailView` to navigate back to Today view after project deletion

## [1.24.0] - 2026-02-13

### Removed

- Dead component files from pre-sidebar UI: `CompactBar`, `DashboardToolbar`, `ProjectTile`, `QuickNotes`, `RepeatingTasksTab`, `TabBar`, `TaskList` (replaced by sidebar layout, `ProjectDetailView`, `QuickNotesPanel`, `RepeatView`, and `QuickTasksView`)
- Unused `useTimer` hook (per-project timer replaced by check-in-based time tracking since v1.4.0)
- `StatsView` component and stats window (`open-stats-window` IPC handler) — replaced by inline `InlineStatsView` in sidebar layout
- Compact mode: `enterCompactMode`/`exitCompactMode` IPC handlers, `setCompactMode` Zustand action, and `isCompactMode` main process state
- Separate new-project window: `open-new-project-window`/`close-new-project-window` IPC handlers — project creation now uses inline `ProjectEditor` modal
- `updateProjectTimer` IPC handler (dead since v1.4.0 timer removal)
- `pickFolder` and `pickObsidianNote` IPC handlers (replaced by project links system in v1.20.0)
- Compact mode guard from `enter-clean-view` handler and shortcut select-project handler

## [1.23.0] - 2026-02-13

### Added

- Monthly repeat schedules: day-of-month (`monthlyDay`), Nth weekday (`monthlyNthWeekday`), and every-N-months (`everyNMonths`) schedule types
- Date range support for repeating tasks: optional `startDate` and `endDate` fields to limit when a task is proposed
- `DateRangePicker` component in `RepeatingTasksTab` for inline date range editing
- Collapsible "Set date range" section in `RepeatView` modal
- Hover tooltip on quick task titles showing full text when truncated

### Changed

- Schedule picker in `RepeatView` redesigned into four main categories (Daily, Weekly, Interval, Monthly) with sub-modes for monthly and interval types
- Schedule picker in `RepeatingTasksTab` extended with Monthly, Nth weekday, and Every-N-months tabs
- `isScheduleDueToday` logic in `useTaskList` now handles monthly schedule types and respects `startDate`/`endDate` bounds
- `RepeatSchedule` type extended with `monthlyDay`, `monthlyNthWeekday`, and `everyNMonths` variants (both main and renderer)
- `RepeatingTask` type extended with optional `startDate` and `endDate` fields (both main and renderer)
- Validation in `isValidRepeatSchedule` (main store) covers new monthly schedule types
- README rewritten to reflect current app architecture: sidebar navigation, Today view, configurable project limit, project colors and links, activity log, and updated project structure

## [1.22.0] - 2026-02-13

### Changed

- Today view "Up Next" section now separates regular tasks from repeating tasks with a visual divider
- "Up Next" section label hidden when no Focus or In Progress tasks are present above it
- Removed unused `activeProjectsLimit` destructuring and dead `targetIndex` variable in Sidebar drag-and-drop handler

## [1.21.0] - 2026-02-13

### Added

- Activity operation log: JSONL-based persistent log tracking task creates/completes/deletes, project lifecycle events, and focus check-ins
- `OperationLogView` component displaying activity history in a dedicated window with date grouping and human-readable labels
- `open-operation-log-window` IPC handler with dedicated Electron BrowserWindow (hash route `#operation-log`)
- `get-operations` IPC handler to query operation log entries with optional `since` filter
- "Activity log" link in `InlineStatsView` and `StatsView` for quick access to the operation log window
- `OperationType` and `OperationLogEntry` types in both main and renderer type definitions
- Operations file (`operations.jsonl`) included in daily backup rotation

## [1.20.0] - 2026-02-12

### Added

- Sidebar navigation replacing tab-based UI: fixed sidebar with project color dots, collapsible suspended/archived sections, and drag-and-drop reorder between active/suspended states
- New `Sidebar` component with drag-and-drop support for reordering active projects and moving projects between active/suspended/archived states
- Today view (`TodayView`) as the default landing page, grouping tasks into Focus, In Progress, Up Next, and Done sections
- Full-screen `ProjectDetailView` for managing individual project tasks, links, and metadata
- Project color system: 8 color options (red, orange, amber, green, blue, purple, pink, teal) with auto-assignment for new projects
- `ProjectColor` and `ProjectLink` types in both main and renderer type definitions
- Project quick links replacing launcher path fields: flexible label+URL pairs with support for vscode://, iterm://, obsidian://, mailto:, http(s):// protocols
- Color picker and links editor in `ProjectEditor` modal with add/remove link rows
- `open-external` IPC handler with protocol allowlist validation (http, https, mailto, obsidian, vscode, iterm)
- Work Stats table in `InlineStatsView`: per-project focus time breakdown with selectable time ranges (7d, 14d, month, prev month, 6m, 12m) and intensity-colored cells
- `InlineStatsView` component for viewing focus time stats within the main panel
- `RepeatView` component wrapping repeating tasks management in the sidebar layout
- `QuickNotesPanel` slide-in panel replacing the previous modal-style quick notes
- `activeProjectsLimit` config option (1-20) replacing the hardcoded 5-project limit
- Renderer-side project normalization utilities (`src/renderer/utils/projects.ts`): color assignment, link normalization, launcher-to-link migration
- Project color CSS variables (`--pc-red` through `--pc-teal`) for both dark and light themes
- Sidebar theming CSS variables (`--bg-sidebar`, `--bg-sidebar-hover`, `--bg-sidebar-active`)
- Archive button in the Edit Project modal for quick project archiving
- Keyboard shortcuts reference section (collapsible) in Settings modal
- iCloud sync and data location info displayed in Settings
- Drag-and-drop archiving: drag projects from active or suspended sections to the Archived label/zone
- Drag-and-drop restore from archived: drag archived projects to active or suspended zones
- `n` keyboard shortcut in `ProjectDetailView` to focus the add-task input

### Changed

- Dashboard layout migrated from tabbed interface to sidebar + main panel architecture
- `ProjectEditor` redesigned as a centered modal with color picker and links management, replacing inline path-based launcher fields
- Settings modal redesigned with cleaner row-based layout, removing editable shortcut fields in favor of a read-only reference
- `Project.launchers` field made optional; links system provides backward-compatible migration from launchers to links via `launchersToLinks`/`mergeLaunchersFromLinks`
- Project save pipeline normalizes links and colors on both main and renderer sides
- macOS traffic light buttons permanently hidden (sidebar replaces window chrome)
- Compact mode auto-disabled on load (removed compact mode UI entirely)
- Active project limit now configurable via `activeProjectsLimit` instead of hardcoded to 5
- All project state updates in Zustand store now normalize projects through `assignMissingProjectColors` and `normalizeProject`
- Sidebar drag-and-drop now supports all transitions between active, suspended, and archived states (previously only active/suspended)
- This Week stats grid columns now adapt to actual project count instead of fixed 5-column layout

### Removed

- `TabBar` and `DashboardToolbar` components (replaced by Sidebar)
- `CompactBar` component and compact mode functionality
- Editable keyboard shortcut fields in Settings (shortcuts are now display-only)
- Launcher path fields with native folder pickers in ProjectEditor (replaced by flexible links)
- Activity heatmap placeholder in InlineStatsView (replaced by Work Stats table)

## [1.19.0] - 2026-02-12

### Added

- "In progress" status for tasks: toggle via button on quick tasks and pinned tasks
- IPC handlers: `toggle-quick-task-in-progress`, `toggle-task-in-progress`
- Amber border highlight on in-progress task cards in default view
- Amber dot indicator and `▸` bullet marker for in-progress tasks in clean view
- `inProgress` field on `Task` and `QuickTask` types (both main and renderer)
- Audible notification sound (macOS system `Tink.aiff`) on focus check-in popup
- `clean` npm script to remove stale `.js` artifacts and `.tsbuildinfo` cache files

### Changed

- Completing a task automatically clears its in-progress state
- `MergedTask` type extended with `inProgress` field for unified task list
- Build script now runs `clean` before `typecheck` and `electron-vite build` to prevent stale `.js` file resolution
- TypeScript configs (`tsconfig.node.json`, `tsconfig.web.json`) set `noEmit: true` so `tsc --build` only type-checks without emitting `.js` files

### Removed

- Deleted `src/preload/index.d.ts` (stale TypeScript build artifact)

## [1.18.0] - 2026-02-12

### Added

- `completedAt` timestamp on project tasks, persisted in data file for durable completed-today tracking

### Changed

- Completed pinned tasks now derived from project data (`completedAt` matching today) instead of ephemeral in-memory state
- Removed `CompletedPinnedTask` type and `completedPinned` Zustand state — no longer needed
- Action shortcuts (project switching, quick notes, toggle focus) changed from global to local (window-scoped) using `before-input-event`, keeping only toggle-app as a true global shortcut
- Shortcuts module split into `registerGlobalShortcut` and `registerLocalShortcuts` with accelerator parsing
- Remove button on completed pinned tasks now unpins the task (`toggleTaskToDoNext`) instead of removing from ephemeral list

### Fixed

- Completed pinned tasks no longer lost on app restart or window reload

## [1.17.0] - 2026-02-12

### Added

- Repeating tasks system: define tasks with recurring schedules (daily, specific weekdays, every N days, N days after completion)
- `RepeatingTasksTab` component with CRUD, inline editing, schedule picker, and drag-and-drop reorder
- "Repeat" tab in TabBar (always visible) for managing repeating task definitions
- Repeating task proposals in QuickTasksView: due tasks appear as suggestions below active tasks, with accept/dismiss actions
- Dismissed proposals reset daily; accepted proposals create quick tasks linked via `repeatingTaskId`
- `afterCompletion` schedule updates `lastCompletedAt` when the linked quick task is completed
- `useTaskList` hook extracting merged task list logic (active, repeating, completed, proposals, overflow) from QuickTasksView
- `CompletedPinnedTask` type and `completedPinned` state in Zustand store (replaces local component state)
- Clean view font picker in Settings: choose between Caveat, Patrick Hand, Kalam, and Architects Daughter
- Bundled Patrick Hand, Kalam, and Architects Daughter font files with `@font-face` declarations
- IPC handlers: `save-repeating-task`, `remove-repeating-task`, `reorder-repeating-tasks`, `accept-repeating-proposal`, `dismiss-repeating-proposal`
- Repeating task marker (`↻`) shown on linked tasks in both clean view and normal view
- Remove button on completed tasks in clean view (dismisses repeating proposal on removal)
- Usage statistics on repeating tasks: track accepted, dismissed, and completed counts with inline display in RepeatingTasksTab

### Changed

- Clean view window height calculation accounts for repeating tasks, proposals, and section separators
- Clean view font configurable via `AppConfig.cleanViewFont` (default: Caveat)
- QuickTasksView refactored: task list logic extracted to `useTaskList` hook, completed pinned state lifted to Zustand
- Settings dialog scrollable with `max-h-[90vh]` and `overflow-auto`
- Proposal and repeating active tasks rendered in a separate section with visual separators in clean view

## [1.16.0] - 2026-02-12

### Added

- Content Security Policy (CSP) meta tag on renderer HTML
- Obsidian URI command whitelist: only `open` and `vault` commands are allowed
- Structural IPC input validation for `save-project`, `save-config`, and `save-quick-task` handlers
- `will-navigate` event prevention on main window to block unwanted navigation
- Focus lock: prevent opening duplicate focus windows when one is already active
- Batch `reorder-projects` and `reorder-pinned-tasks` IPC handlers replacing per-item saves
- `typecheck` npm script; `build` now runs `tsc --build` before `electron-vite build`
- Extracted `TabBar`, `DashboardToolbar`, and `CleanViewHeader` components from Dashboard
- Shared `constants.ts` module for `STANDALONE_PROJECT_ID` sentinel value
- Project suspend/unsuspend feature: temporarily pause projects without archiving them
- Suspended tab in Dashboard showing suspended projects with restore option
- `suspendProject` and `unsuspendProject` IPC handlers, preload bridge, and Zustand actions
- `suspendedAt` field on Project type (both main and renderer)
- Suspend button on project tiles and restore button on suspended project tiles
- Double-click to copy task title in Focus Mode
- Hover tooltip in Focus Mode bar showing full task title after 500ms delay
- Focus indicator (blue pulsing dot) on currently focused task in QuickTasksView clean view
- Focus badge on active task in TaskList replacing the Focus button

### Changed

- Dashboard refactored: toolbar, tab bar, and clean view header extracted into dedicated components
- Project and pinned task reorder operations use dedicated batch IPC instead of sequential per-item saves
- Settings component syncs local state with config changes via `useEffect`
- Replaced `any` type casts with `unknown` + `Record<string, unknown>` in main process and preload
- Removed `visibleOnAllWorkspaces` from focus and check-in windows
- `tsconfig.node.json` includes `src/renderer/types/index.ts` for preload type resolution
- Focus Mode window height increased to accommodate tooltip area
- CheckInPopup now scrollable when content overflows
- Focus button in TaskList hidden by default, shown on row hover
- Focus Mode confirm-exit dialog uses fixed 38px height instead of full screen
- README updated with suspend feature, dev mode isolation, and revised project structure

### Fixed

- New project creation now includes `suspendedAt: null` field
- Active project count now excludes both archived and suspended projects
- Unarchive also clears `suspendedAt` to ensure restored projects are fully active
- Error message for max-project limit updated to mention suspend as an option
- Non-null assertion for Obsidian picker URI result in ProjectEditor

## [1.14.0] - 2026-02-12

### Changed

- Focus mode now opens in a dedicated window using hash-based routing (`#focus`) instead of rendering inline in the main window
- Focus window loads data from the Zustand store independently, allowing main window and focus window to coexist
- Global toggle-app shortcut no longer blocks when focus window is open, so the main window can be toggled freely during focus sessions
- TaskList component refactored to `forwardRef` with `TaskListHandle` interface exposing `focusAddInput()`

### Added

- `n` keyboard shortcut on the Projects tab to focus the add-task input when a project tile is expanded

## [1.13.0] - 2026-02-12

### Added

- Dev mode isolation: separate data directory (`~/.config/top5-dev/`) when running in development, preventing dev sessions from modifying production data or syncing to iCloud
- Visual DEV indicator badge in Dashboard and Focus Mode widget when running in development mode
- Window title shows `[DEV] Top5` in development mode for easy identification
- `get-is-dev` IPC handler and `getIsDev` preload API for renderer-side dev mode detection

## [1.12.1] - 2026-02-11

### Added

- Confirmation dialog when deleting a project to prevent accidental deletion
- Enter key handler in ProjectEditor to save changes without clicking the save button

## [1.12.0] - 2026-02-11

### Added

- Launcher buttons (VS Code, iTerm, Obsidian, browser) in focus mode widget for quick access to project tools
- `n` keyboard shortcut to add a quick task from the dashboard (when no input is focused)
- "+" toggle button for task input replaces always-visible input field for a cleaner default view
- Visual separator in all-tasks view dimming tasks below the configured limit

### Changed

- Tasks tab now always shows all tasks (removed separate "All Tasks" tab and overflow indicator)
- Dashboard tabs header moved outside scroll area so it stays fixed while scrolling
- Task add input is hidden by default; toggled via "+" button or `n` shortcut
- README rewritten in English with updated feature descriptions, project structure, and stack details

### Fixed

- Inline task editing intermittent revert bug: switched to ref-based state tracking with fire-and-forget save pattern and single Enter→blur→saveEdit path (affects both QuickTasksView and TaskList)

## [1.11.0] - 2026-02-11

### Added

- Bullet journal style clean view: dotted notebook background, Caveat handwriting font, date and live clock header
- Warm notebook color palette for light theme (sepia tones replacing cool grays)
- Focus exit confirmation dialog: prompts to save unsaved minutes when exiting focus mode with tracked time
- `minutes` field on `FocusCheckIn` for exact elapsed-time tracking (replaces fixed 15/7/0 estimates)
- `get-focus-unsaved-ms` IPC handler returning milliseconds since last check-in
- Time display on clean view tasks showing accumulated focus minutes
- Clean view window size restored on app startup when mode was previously active
- Caveat variable font bundled in `src/renderer/assets/fonts/`

### Changed

- Clean view layout: bullet markers (`•`, `→`, `×`) replace checkbox controls, larger 22px handwriting-style text
- Clean view empty state text changed to Polish ("Brak zadań")
- Light theme CSS variables updated to warm notebook palette (sepia base, olive accents)
- `checkInMinutes()` now accepts full `FocusCheckIn` object and uses `minutes` field when available
- Clean view window dimensions adjusted (340px wide, better height calculation per task row)
- `enter-clean-view` preserves saved bounds on startup restore to avoid overwriting

### Removed

- `pause-focus-mode` IPC handler and pause button from focus mode widget (replaced by save-and-exit flow)

## [1.10.0] - 2026-02-11

### Added

- Clean View mode: minimal, distraction-free window for Quick Tasks toggled via dashboard toolbar button
- `enter-clean-view` and `exit-clean-view` IPC handlers that resize and reposition the window to a narrow panel
- `set-traffic-lights-visible` IPC handler to show/hide macOS traffic lights on window hover
- `cleanView` config option persisted in AppData (both main and renderer types)
- Clean view renders a streamlined task list with hover-reveal controls (focus, complete, uncomplete) and inline editing
- Draggable titlebar with hover-visible exit button in clean view

### Changed

- Dashboard conditionally renders clean view layout when `cleanView` config is active
- QuickTasksView accepts new `cleanView` prop for compact rendering without add-task input or spacing

## [1.9.0] - 2026-02-11

### Added

- Quick Tasks system: standalone task list on the main dashboard with configurable slot limit (default 5)
- New `QuickTasksView` component with add, complete, uncomplete, remove, drag-and-drop reorder, and inline edit (double-click)
- Pin project tasks to Quick Tasks via "To Do Next" toggle (📌 button in TaskList)
- Merged view combining standalone quick tasks and pinned project tasks, sorted by unified order
- "All Tasks" tab shown when task count exceeds the configured limit (overflow indicator)
- Dashboard tab navigation: Tasks, All Tasks, Projects, Archive (replaces previous active/archive toggle)
- Focus mode support for standalone quick tasks (`__standalone__` project sentinel)
- Quick Tasks section in CompactBar showing active tasks with focus-on-click
- Quick Tasks time tracking in StatsView (virtual "Quick Tasks" row in heatmap)
- `calcQuickTaskTime` utility for standalone task time calculation
- Configurable quick tasks limit in Settings (1–20)
- Inline editing for project tasks in TaskList (double-click to edit)
- Pinned task count badge on ProjectTile
- IPC handlers: `save-quick-task`, `remove-quick-task`, `complete-quick-task`, `uncomplete-quick-task`, `reorder-quick-tasks`, `toggle-task-to-do-next`
- `QuickTask` type and `quickTasks` field in AppData (both main and renderer)
- `quickTasksLimit` config option persisted in YAML

### Changed

- Dashboard layout restructured from single project grid to tabbed interface (Tasks as default tab)
- Settings panel title changed from "Keyboard Shortcuts" to "Settings" with new Quick Tasks limit section
- "Add Project" button now only visible on the Projects tab
- CheckInPopup resolves standalone quick tasks when focusProjectId is `__standalone__`
- FocusMode widget shows "Quick Task" label for standalone tasks instead of project name
- Extracted `notifyAllWindows` helper in store to DRY up window broadcast calls
- Shortcut action `select-project` now switches to Projects tab before expanding

## [1.8.0] - 2026-02-11

### Added

- Dedicated "New Project" window: creating a project now opens a separate BrowserWindow with the ProjectEditor in create mode
- IPC handlers `open-new-project-window` and `close-new-project-window` with preload bridge
- Auto-assign order for new projects based on current active project count
- Broadcast `reload-data` to all windows when a project is saved

### Changed

- "Add Project" button opens a new window instead of inline-creating an empty project tile
- ProjectEditor supports both create and edit modes (props made optional)
- Removed `addProject` action from `useProjects` store; project creation now handled entirely in the new window
- ProjectTile no longer auto-enters edit mode for unnamed projects
- Path input "Browse" buttons now use folder icon instead of text label
- macOS `activate` event shows existing main window instead of only creating a new one when none exist

## [1.7.0] - 2026-02-11

### Added

- IPC payload validation for focus check-ins (`toFocusCheckIn` guard in store)
- URL allowlist for `openExternal` calls (only `http:`, `https:`, `mailto:` protocols)
- Browser launcher URL normalization with protocol validation
- Input validation helpers (`isNonEmptyString`, `normalizeLocalPath`, `normalizeBrowserUrl`) in launcher handlers
- Error handling in `useProjects` `loadData` to prevent silent failures
- Shared launcher utility module (`src/renderer/utils/launchers.ts`) for DRY launcher logic
- Coding guide (`docs/CODING_GUIDE.md`) and project instructions (`CLAUDE.MD`)

### Changed

- Launcher handlers use `spawn` with argument arrays instead of `exec` with string interpolation (security hardening)
- iTerm launcher uses AppleScript arguments via `osascript` flags instead of shell-escaped string embedding
- Preload bridge typed with explicit interfaces instead of `any` (`Project`, `AppConfig`, `FocusCheckIn`, `IpcRendererEvent`)
- Non-isolated window fallback uses typed window assignment instead of `@ts-ignore` comments
- React hooks in `App.tsx` moved to top-level to fix conditional hooks violation
- Check-in JSONL loader now skips malformed lines gracefully instead of failing on first parse error
- Compact mode height calculation uses typed project access instead of `any` cast

### Fixed

- Conditional React hooks call in `App.tsx` for auxiliary windows (check-in, stats) now compliant with Rules of Hooks

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
