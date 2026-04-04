# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.83.0] - 2026-04-04

### Added

- Completed tasks remain visible in TodayView, ProjectDetailView, and QuickTasksView for 1 hour after completion with a "Restore" button, making it easy to undo accidental completions
- `task_sent_to_mycc` operation type logged to the operation log each time a task is sent to MyCC, with cyan color indicator

## [1.82.0] - 2026-04-04

### Added

- Task image attachments in ProjectDetailView — paste an image from clipboard via the task overflow menu or by selecting a task and pressing Cmd+V; thumbnails shown inline with hover-to-remove button
- Click any thumbnail to open the image in the system default viewer
- Images included as file paths when sending a task to MyCC (listed under "Załączone obrazki")
- `top5-img://` custom Electron protocol for secure, sandboxed image serving from the app data directory
- `images` field on the `Task` type to store attachment filenames

## [1.81.1] - 2026-04-04

### Changed

- `MyccCommentPopover` extracted into a shared component used by both TodayView and ProjectDetailView; send logic now uses async/await with proper error handling

### Fixed

- `noteRef` prefix stripping in MyCC service now uses a `startsWith` guard to avoid corrupting paths that do not contain the `top5.storage/` prefix

## [1.81.0] - 2026-04-03

### Added

- Optional comment popover when sending a task to MyCC — Enter to send, Esc to cancel; comment is prepended to the task title as operator context
- CLI `top5 send --comment <text>` flag to attach a comment when sending a task to MyCC from the terminal

## [1.80.1] - 2026-04-03

### Fixed

- `noteRef` in MyCC inbox payload now contains the full absolute path to the Obsidian note file, ensuring MyCC can locate the note correctly

## [1.80.0] - 2026-04-03

### Added

- API `GET /projects/:pid/tasks/:tid` endpoint returns a single task enriched with `projectId` and `projectCode`
- CLI `top5 show <task-code>` command displays task details (title, project, status, due date); `--json` includes `projectId` and `projectCode`
- CLI `top5 send <task-code>` command sends a task to the MyCC inbox (writes a JSON file to `~/.mycc/inbox/`)
- "Send to MyCC" action in task overflow menus in TodayView and ProjectDetailView
- `MyccInboxItem` type now includes `projectId` and `taskId` fields in the inbox payload
- API `POST /projects/:pid/tasks/:tid/send-to-mycc` endpoint triggers MyCC inbox delivery from HTTP clients
- IPC `send-task-to-mycc` handler and `window.api.sendTaskToMyCC` preload bridge

### Changed

- Completed tasks in ProjectDetailView are now sorted by `completedAt` descending (most recently completed first)
- PUT `/projects/:id` now detects when the active focus task is completed and stops focus mode automatically

## [1.79.0] - 2026-04-01

### Added

- CLI `top5 add --json` output now includes `notePath` (full Obsidian note path) when `--note` is used, and `pinned: true` when `--pin` is used — enables scripted workflows that need to write note content immediately after task creation

## [1.78.1] - 2026-03-31

### Fixed

- Off-by-one in weekday validation — `isValidRepeatSchedule` now correctly rejects day value 7 (valid range is 0-6)
- CLI `top5 rt add` now validates `--interval`, `--after-done`, and `--monthly-day` inputs; bad values exit with a clear error instead of silently producing `NaN`

### Changed

- `formatSchedule` and display constants (`DAY_LABELS`, `ORDINAL`, `WEEKDAY_NAMES`) extracted to `src/shared/schedule.ts` — renderer and CLI both import from the single shared source, eliminating duplicated logic
- CLI repeating-tasks types (`RepeatSchedule`, `RepeatingTask`) consolidated into `cli/src/lib/schedule.ts`; `repeating-tasks.ts` command no longer duplicates them inline

## [1.78.0] - 2026-03-31

### Added

- CLI `top5 rt` command group for managing repeating tasks: list, add, edit, delete, and `proposals` (today's pending proposals)
- CLI `top5 pin <task-code>` command to toggle pin-to-today (up-next) on a project task
- `--pin` flag on `top5 task add` to immediately pin the new task to today
- API `GET /api/v1/repeating-tasks/proposals` endpoint returning today's pending repeating task proposals
- `monthlyLastDay` repeat schedule type — task repeats on the last day of every month; supported in UI (Quick Add, RepeatView) and schedule engine
- `resolveRepeatingTask` helper in CLI resolve module — look up repeating tasks by 1-based position or UUID

### Fixed

- `monthlyLastDay` schedule variant now passes validation in `isValidRepeatSchedule` (was silently rejected)

## [1.77.0] - 2026-03-30

### Added

- CLI `top5 due <task-code> [date]` command to set or clear due dates on project tasks
- CLI `top5 qt due <ref> [date]` command to set or clear due dates on quick tasks
- `--due` option on `top5 task add` and `top5 qt add` — accepts YYYY-MM-DD, today, tomorrow, +Nd, or weekday names
- DUE column in `top5 task list` and `top5 qt list` output
- API `PUT /api/v1/quick-tasks/:id/due-date` endpoint for setting or clearing a quick task's due date

## [1.76.0] - 2026-03-30

### Added

- Quick-add window: project picker now uses a compact 3-column grid with keyboard shortcuts ⌘A–Z for projects beyond the first 9
- Quick-add window: inline mini-calendar replaces the native date picker when selecting a due date
- Quick-add window: window height auto-adjusts to content via ResizeObserver — no more fixed-height blank space
- Base font size setting (10–18 px) in Settings with a live-preview slider; applies via zoom factor across the app
- Window position and size are now persisted to `window-state.json` and restored on next launch
- Main window is clamped to the display work area on every show to prevent off-screen placement

## [1.75.0] - 2026-03-26

### Added

- Focus heartbeat (`top5 focus ping`) — confirms the user is still working, saves accumulated check-in time, and resets the 15-minute check-in timer to suppress the popup; available via CLI and `POST /api/v1/focus/heartbeat`

## [1.74.2] - 2026-03-23

### Changed

- Electron upgraded to v41

### Fixed

- Focus mode timer now resets when switching to a different task via the task picker (elapsed time no longer carries over to the new task)

## [1.74.1] - 2026-03-22

### Changed

- Light theme palette updated to Catppuccin Latte — cooler, higher-contrast colors replace the previous warm Solarized-style scheme

## [1.74.0] - 2026-03-19

### Added

- Split & Continue now appends a "Zrobione" (Done) entry to the task's Obsidian note, recording the date and focused time for the completed portion

### Fixed

- Split & Continue continuation task now correctly lands in overflow instead of top 5 (`beyondLimit: true`)

## [1.73.0] - 2026-03-18

### Added

- Focus mode auto-stops when the focused task is completed from outside the focus window (e.g. TodayView), saving any unsaved time as a check-in without prompting
- Task overflow menu (⋯) on each task card in TodayView, consolidating Focus, In Progress, Set due date, Edit links, Open note, Split & Continue, and Remove/Unpin actions
- Inline due-date picker in overflow menu with quick-add buttons (+1d, +2d, +3d, +1w) and a date input
- Inline link editor (TaskLinksPopover) accessible from the overflow menu for pinned project tasks

### Changed

- `getVisibleTasks` (shared) now respects wins-lock state: when the day is locked, only locked tasks are shown within the limit and all others move to overflow; nudge and main process pass `winsLock` accordingly

### Fixed

- Restored production timing for focus nudge: polling interval 30s and nudge threshold 15 minutes (were left at debug values 5s/15s)

## [1.69.0] - 2026-03-13

### Added

- Focus nudge popup: after 15 minutes of active computer use without starting focus mode, a centered popup reminds the user to pick a task
- Nudge popup lists up to 7 uncompleted top-5 tasks (quick tasks + pinned project tasks, excluding beyond-limit); clicking any task immediately enters focus mode on it
- Quick-add button in nudge popup to add a new task without dismissing context
- Snooze options (5, 10, 15, 30, 60 min of active time) to delay the next nudge
- Nudge resets automatically when focus mode is active, all tasks are completed, or the day changes

## [1.68.1] - 2026-03-10

### Fixed

- Repeating task link button in FocusMode is now clickable — was swallowed by the Electron drag region

## [1.68.0] - 2026-03-07

### Changed

- `TaskLinksIndicator` now shows app-specific SVG icons (VS Code, Obsidian, Terminal, GitHub, GitLab) and favicons for HTTP URLs via Google's favicon service, replacing the generic link emoji
- Duplicate icon types are deduplicated — multiple links to the same app show a single icon

## [1.67.0] - 2026-03-07

### Added

- Per-task links: tasks can now have their own links (VS Code, iTerm, Obsidian, Browser, Custom) stored on the task model
- `TaskLinksIndicator` component — inline link icon shown next to task titles across TodayView, QuickTasksView, and ProjectDetailView; clicking opens all task links at once
- `TaskLinksPopover` component — editor popover in ProjectDetailView to add, edit, and remove task links via the task overflow menu
- Task links appear in TodayView context menu for one-click access per link
- Task links appear in FocusMode context menu, listed above project links with a separator

### Changed

- `normalizeLinks()` extracted as a standalone helper from `normalizeProjectLinks()`, enabling link normalization for both project and task links
- `MergedTask` interface extended with optional `links` field, populated by `useTaskList` for pinned and focus tasks

## [1.66.0] - 2026-02-28

### Added

- `createClient()` factory helper (`cli/src/lib/client.ts`) — eliminates repeated `resolveConfig + new ApiClient` boilerplate across all CLI commands
- `warn()` function in CLI output module for non-fatal warnings (e.g. note creation failures)
- Port validation in CLI config: rejects invalid port values (NaN, out of 1-65535 range) with a clear error message
- `top5 note` command now supports raw IDs (not just task codes): tries quick task first, falls back to project task
- Task code regex now accepts alphanumeric project codes (e.g. `A1-3`, `P2X-12`)
- CLI tests for raw-ID note resolution branching logic (`cli/tests/notes.test.ts`)
- CLI tests for alphanumeric project codes in `parseTaskCode`
- API tests for focus endpoints (`tests/api/focus.test.ts`) — 11 tests covering validation, error rollback, and status
- Electron test mocks for `globalShortcut`, `screen`, `app.hide` and `@electron-toolkit/utils`

### Changed

- All CLI commands refactored to use `createClient(globalOpts)` instead of inline config + client construction
- Note creation errors in `top5 add --note` and `top5 qt add --note` now emit a warning instead of being silently swallowed

### Fixed

- Focus API (`POST /focus`) rolls back `focusProjectId`/`focusTaskId` in config when `enterFocusMode()` fails, preventing stale focus config leak
- Focus API defers `notifyAllWindows()` until after successful `enterFocusMode()`, avoiding premature UI updates on failure

## [1.65.0] - 2026-02-28

### Added

- API route `POST /projects/:pid/tasks/:tid/note` — create/ensure an Obsidian note for a project task, persists `noteRef` on the task
- API route `POST /quick-tasks/:id/note` — create/ensure an Obsidian note for a quick task
- API routes for focus mode: `GET /focus` (status), `POST /focus` (start), `DELETE /focus` (stop)
- `top5 note <task-ref>` CLI command — create or open an Obsidian note for any task (project or quick task)
- `top5 focus [task-ref|stop]` CLI command — start, stop, or check focus mode from the terminal
- `-n, --note` flag on `top5 add` and `top5 qt add` — create an Obsidian note together with the new task
- `task-notes` service (`src/main/service/task-notes.ts`) — extracted note creation logic from IPC handler into a reusable service layer
- `getQuickTask()` helper in quick-tasks service for single-task lookups
- API tests for notes endpoints (`tests/api/notes.test.ts`)
- CLI README with full command reference (`cli/README.md`)

### Changed

- `focus-window.ts` refactored: `enterFocusMode()`, `exitFocusMode()`, `getFocusStatus()` extracted as standalone exported functions, enabling API access to focus mode
- `open-task-note` IPC handler in `store.ts` now delegates to `task-notes` service instead of inline logic

### Fixed

- Task overflow menu in ProjectDetailView auto-repositions upward when it would extend below the viewport

## [1.64.0] - 2026-02-28

### Added

- `cli/` — new standalone CLI package (`top5-cli` v0.1.0) for interacting with the top5 HTTP API from the terminal
  - `top5 health` — check if the API is running
  - `top5 projects` — list active projects, with `--all`, `--archived`, `--suspended` filters
  - `top5 tasks <project>` — list tasks in a project (by code or ID), with `--all` to include completed
  - `top5 add <project> <title>` — add a task to a project
  - `top5 done <task-code>` / `top5 undone <task-code>` — complete or reopen a project task (e.g. `PRJ-3`)
  - `top5 qt` — list quick tasks, with `--all` flag
  - `top5 qt add <title>` / `top5 qt done <ref>` / `top5 qt undone <ref>` — manage quick tasks
  - `top5 config` / `top5 config set <key> <value>` — read/write CLI config (`~/.config/top5/cli.json`)
  - `--json` flag on every command for pipe-friendly JSON output
  - `--api-key` and `--port` global flags as per-invocation overrides
  - Config resolution priority: CLI flags > `TOP5_API_KEY`/`TOP5_API_PORT` env vars > config file > defaults
  - Task lookup by human-readable code (`PRJ-3`, `QT-5`) or raw UUID
  - 5s request timeout with clear "is the app running?" error messages
  - Unit tests with vitest: api-client, config, output formatting, task resolution
- `docs/CLI_PLAN.md` — implementation plan for the CLI package
- `docs/CLI_REVIEW.md` — code review notes for the CLI implementation

## [1.63.0] - 2026-02-27

### Added

- API route `PUT /projects/:pid/tasks/:tid/due-date` to set or clear a task's due date
- API route `POST /projects/:pid/tasks/:tid/move` to move a task between projects
- API route `PUT /projects/pinned-tasks/beyond-limit` to set beyondLimit flags on pinned tasks
- 12 new API tests covering due-date, move, and beyond-limit endpoints

### Changed

- README updated with recent features: due dates, sweep & promote, split & continue, clickable URLs, project links menu, task IDs, and new shared modules/components

## [1.62.1] - 2026-02-27

### Fixed

- Prevent unwanted scrollbars and background flash on the main window by setting `overflow: hidden`, `height: 100%`, and theme background on `html`/`body`

## [1.62.0] - 2026-02-27

### Changed

- Focus mode context menu extracted to a separate popup window (`FocusMenuPopup`) instead of rendering inline inside the focus window — fixes clipping and focus issues
- Context menu items built dynamically from project links, Obsidian, and actions, sent via IPC to the popup
- New IPC endpoints: `show-focus-context-menu`, `get-focus-menu-items`, `focus-menu-click`, `focus-menu-action` for popup ↔ focus window communication
- Popup window positioned at click coordinates, clamped to screen edges, auto-closes on blur

### Removed

- Inline context menu rendering and resize logic from FocusMode component (`ctxMenu` state, `ctxRef`, manual DOM event listeners)

## [1.61.0] - 2026-02-26

### Added

- Manual time entry in focus mode: click the time badge to open an inline input for adding arbitrary minutes to the current task
- "Dodaj czas" option in focus mode context menu for quick access to manual time entry

## [1.60.0] - 2026-02-26

### Added

- `beyondLimit` flag on tasks: persistent marker that keeps tasks in the overflow section across reloads
- Multi-select in overflow: checkboxes on promotable tasks allow selecting multiple items at once
- Promote button in overflow header: moves selected tasks back to the top section (respects hard limit)
- `setBeyondLimit` IPC endpoint for batch-updating beyondLimit on quick tasks and pinned tasks
- Limit indicator as separate D&D drop zone: bidirectional — drops from overflow promote to top, drops from top demote to overflow

### Changed

- D&D rewrite: `visualOrderTasks` useMemo reflects actual JSX render order (focus → scheduled → in-progress → up-next → overflow), fixing visual/data order mismatch
- D&D cross-section drops now persist `beyondLimit` flag instead of adjusting a transient `limitAdjust` counter
- Sweep-to-overflow now sets `beyondLimit=true` on swept tasks instead of using ephemeral limit adjustment
- Extracted `reorderAndPersist` helper — DRY reorder+persist logic shared by sweep, D&D, and promote
- Overflow section collapse clears multi-select state

### Removed

- `limitAdjust` state and `limit` from useTaskList — replaced by persistent `beyondLimit` flag on each task

## [1.59.0] - 2026-02-25

### Added

- Sweep to overflow button: clears all non-locked, non-repeating tasks to the overflow section with a single click

### Changed

- Task limit minimum lowered from 1 to 0, allowing all tasks to be swept to overflow

## [1.58.0] - 2026-02-22

### Added

- Linkify component: URLs in task titles are now clickable links across all views (TodayView, QuickTasksView, ProjectDetailView, FocusMode, RepeatView)

### Changed

- API server uses lazy dynamic import for faster app startup

## [1.57.0] - 2026-02-22

### Added

- Project association for repeating tasks: new project picker in RepeatView modal, `projectId` propagated to quick tasks when accepting proposals
- Dev mode separate identity: dev builds use a separate `userData` directory so dev and prod can run side by side

### Fixed

- Focus window now correctly resolves project name for quick tasks that have a `projectId`
- CheckInPopup assigns correct `projectId` for standalone quick tasks linked to a project
- `calcQuickTaskTime` no longer incorrectly filters by `STANDALONE_PROJECT_ID`, fixing focus time tracking for project-linked quick tasks

## [1.56.0] - 2026-02-22

### Added

- Obsidian journal integration: auto-generated daily, weekly, and monthly notes in Obsidian vault with completed tasks, focus time, and 5 Wins results
- Daily notes preserve user-written Refleksja and Notatki sections on re-generation; Zrobione section always refreshed from current data
- Weekly notes with day-by-day breakdown table, focus per project, and W/L stats
- Monthly notes with focus per project and links to weekly summaries
- Auto-trigger: `resolveDay()` generates daily note; Monday auto-generates previous week; 1st of month auto-generates previous month
- Journal button and `j` keyboard shortcut in TodayView 30-day strip to generate and open daily note in Obsidian
- Deep links: `top5://project/<id>` protocol opens projects from Obsidian notes or terminal
- Single instance lock: second app launch forwards deep link URL to the running instance instead of opening a duplicate
- Project dictionary (`.top5-dictionary.md`) for autocomplete via Obsidian Various Complements plugin, auto-refreshed on data changes and startup
- Documentation: `docs/journal.md` covering journal structure, deep links, dictionary setup, and architecture

## [1.55.3] - 2026-02-22

### Fixed

- Win entry date in `resolveDay` now uses `dateKey(new Date())` instead of slicing from ISO string, ensuring local timezone consistency with the rest of the codebase

## [1.55.2] - 2026-02-22

### Fixed

- TodayView outer container now has `minHeight: 100%` so context menu works on the full viewport area
- "Due Tomorrow" section moved below task limit indicator for better visual hierarchy
- "Add task" button is now always visible regardless of lock state, allowing task creation at any time

## [1.55.1] - 2026-02-22

### Fixed

- Date formatting across the entire codebase now uses local timezone instead of UTC — `dateKey()` helper exported from `shared/schedule.ts` replaces all inline `toISOString().slice(0, 10)` calls, preventing wrong-date bugs near midnight in non-UTC timezones

## [1.55.0] - 2026-02-22

### Changed

- Task actions in ProjectDetailView replaced with overflow menu (`⋯` button): pin, focus, due date, note, someday, and delete actions consolidated into a single dropdown
- Pinned task indicator changed from inline pin emoji to a colored corner triangle on the task card
- Task action buttons (`.task-actions`) use `display: none/flex` toggle instead of opacity transition for cleaner show/hide behavior

### Removed

- Inline pin icon and pin-action button styles (replaced by corner triangle and overflow menu)

## [1.54.0] - 2026-02-21

### Added

- Due date picker in Quick Add window: "Schedule" button with quick-set options (Tomorrow, +2d, +3d, +1w) and calendar input for setting due dates on new tasks
- Due date passed through to both project tasks and standalone quick tasks created via Quick Add

## [1.53.0] - 2026-02-21

### Added

- Split & Continue button (`⋯`) on non-repeating tasks in QuickTasksView: completes the current task and creates a continuation with incremented `(✂N)` title prefix
- `handleSplit` function supporting both pinned project tasks and standalone quick tasks, preserving `noteRef` for Obsidian note continuity
- `continuationTitle` helper in QuickTasksView for generating sequential split titles

## [1.52.0] - 2026-02-21

### Added

- Due date field (`dueDate`) on project tasks and quick tasks with set/change/remove support
- Due date picker popover in ProjectDetailView and TodayView with quick-set buttons (+1d, +2d, +3d, +1w), calendar input, and remove option
- Due date badge on tasks showing formatted date with overdue highlighting (red) for past-due items
- "Scheduled" tasks section in TodayView: tasks due today or overdue are always visible and don't count against the active task limit
- Due date proposals in TodayView: "Due" and "Due Tomorrow" sections suggest unpinned tasks approaching their deadline with accept (pin) and reschedule actions
- `getDueDateProposals` function in shared schedule engine for date-based task proposal filtering
- `updateTaskDueDate` and `updateQuickTaskDueDate` service functions, IPC handlers, and preload bridge APIs
- Unit tests for `getDueDateProposals` covering matching, exclusion of completed/pinned/someday/archived tasks, and null dates

### Changed

- Moving a task to someday now clears its due date
- Lockable tasks for Wins now include scheduled (due today) tasks alongside regular within-limit tasks
- Focus task slot calculation excludes scheduled tasks from limit consumption
- `MergedTask` type extended with `dueDate` field
- `TaskListData` extended with `scheduledTasks`, `dueDateProposals`, and `dueDateTomorrowProposals`

## [1.51.0] - 2026-02-21

### Added

- Tomorrow proposals section in TodayView showing next-day repeating tasks for early accept/dismiss
- Wins rules modal (?) button in lock bar explaining the 5 Wins game mechanics
- Optional `link` field on repeating tasks with URL/path support in RepeatView editor
- Repeating task link button in focus bar for quick access to associated resources
- Confirmation dialog before locking when tomorrow has unapproved recurring tasks

### Changed

- Migrated `dismissedRepeating` from flat `string[]` + `dismissedRepeatingDate` to `Record<string, string[]>` keyed by date, with automatic migration of old format
- Accept/dismiss repeating proposal APIs now accept optional `forDate` parameter for date-specific operations
- Wins deadline threshold changed from 12:00 to 20:00 for next-day extension
- Win/loss celebration banners now only trigger for entries resolved within the last 5 seconds (ignores manual unlock)

## [1.50.1] - 2026-02-20

### Changed

- Extracted shared `src/shared/constants.ts` module for `PROJECT_COLORS`, `LINK_LABELS`, and clean view layout constants, removing duplicates from `store.ts` and `renderer/utils/projects.ts`
- Extracted `src/main/api/utils.ts` with `isServiceError` and `errorToHttpStatus` helpers, replacing duplicated `isError`/`errorToStatus` functions across API route files
- Replaced `any` casts with proper `QuickTask`, `Project`, and `Task` types in clean view sizing logic (`main/index.ts`)
- Simplified test setup comments in `tests/api/setup.ts`

## [1.50.0] - 2026-02-20

### Changed

- Focus bar timer now shows wall-clock elapsed time since focus window opened as the main display, with confirmed (check-in recorded) time shown in parentheses
- Focus bar timer uses reactive `focusCheckIns` from Zustand store instead of a one-time async load, updating confirmed time as check-ins are recorded
- Removed prior session time accumulation from focus bar — timer resets each time the focus window opens

### Fixed

- Focus check-in save handler now broadcasts `notifyAllWindows()` so the focus window receives updated check-in data in real time

## [1.49.2] - 2026-02-19

### Fixed

- Focus bar, context menu, and task picker now use `bg-clean-view` instead of `bg-card` so they match the clean view background color in both dark and light themes
- Cmd+H hide-app now uses an explicit `click` handler in the app menu instead of `role: 'hide'` to ensure reliable hiding on all macOS versions
- iTerm tab name restored to use `printf` escape sequence alongside AppleScript `set name` for robust tab title setting

### Added

- `--bg-clean-view` CSS variable (`#2a2520` dark / `#fdf6e3` light) and `--color-clean-view` Tailwind token for a warm, distinct clean view background

## [1.49.1] - 2026-02-19

### Fixed

- Win entry `date` field now uses the lock date (`lockedAt.slice(0,10)`) instead of the resolution date, correctly attributing cross-midnight sessions to the day tasks were locked

## [1.49.0] - 2026-02-18

### Added

- `ProjectLinksMenu` component: right-click context menu listing active projects with their quick links; clicking a link launches it, clicking the project code navigates to the project in the main window
- Right-click on TodayView outer area opens `ProjectLinksMenu` at cursor position (only when at least one project has links)
- Right-click on clean view outer area opens `ProjectLinksMenu` centered in the window (`fullWidth` prop)

### Fixed

- Cmd+H now reliably hides the app via explicit `before-input-event` handler in `createWindow()` as a belt-and-suspenders fallback to the menu role
- Right-click on task cards and focus card now stops event propagation so it does not bubble up to the outer div and accidentally open the links menu
- iTerm tab name set via AppleScript `set name to tabName` directly, removing the broken `printf` escape sequence that was corrupting the tab title

### Changed

- Clean view enters `always-on-top` mode when activated and restores normal window level on exit

## [1.48.3] - 2026-02-18

### Added

- Clean view header now shows today's total focus time next to the clock (e.g. `14:32 (1h 10min)`), refreshed every 60 seconds

## [1.48.2] - 2026-02-18

### Fixed

- Split continuation prefix `(✂N)` stripped from task title in Focus Mode bar for cleaner display

## [1.48.1] - 2026-02-18

### Fixed

- Clean view no longer toggles macOS traffic lights on mouse enter/leave, preventing flickering
- Split continuation prefix `(✂N)` stripped from task titles in clean view for cleaner display

## [1.48.0] - 2026-02-17

### Fixed

- Win entry date now uses resolution date instead of lock date, fixing incorrect date attribution for cross-midnight sessions
- Win/loss celebration banner checks the most recent history entry instead of searching by today's date

### Changed

- Wins hierarchy redesigned: day, week, month, and year win conditions with formal grace rules (max 2 grace weeks per month, 1 lost month per year)
- Week streak requires minimum 5 played days and uses month-level grace accounting
- Week with 2+ losses is immediately marked as lost without waiting for end of week
- Month win condition simplified to "all weeks won" (grace handled at week level)
- Streak documentation in `docs/wins.md` updated with full hierarchy and revised streak definitions

### Added

- Year win condition and yearly streak tracking

## [1.47.0] - 2026-02-17

### Added

- iTerm tab naming: tabs opened via project links are automatically named after the project for easier identification

## [1.46.0] - 2026-02-17

### Added

- `noteRef` field on `Task` and `QuickTask` types for persistent Obsidian note references across task splits
- `computeNotePath` helper in `src/shared/taskId.ts` for client-side note path computation
- Split task ("Split & Continue") now preserves the original task's Obsidian note reference on the continuation task

### Changed

- Split task continuation title format changed from `continue (N) title` to `(✂N) title`
- `open-task-note` IPC handler accepts optional `noteRef` parameter and uses stored note path when available
- All views (TodayView, FocusMode, QuickTasksView, ProjectDetailView) pass `noteRef` through to `openTaskNote` calls
- `MergedTask` type in `useTaskList` hook extended with `noteRef` field

## [1.45.1] - 2026-02-17

### Fixed

- VSCode launcher uses `open -a` instead of `code` CLI for more reliable opening on macOS

## [1.45.0] - 2026-02-16

### Added

- Redesigned focus mode bar: compact single-line layout (520x58) with project color dot, project code label, session timer, and inline action buttons
- Session time tracker in focus bar — counts elapsed time and adds prior check-in minutes for the focused task
- Right-click context menu on focus bar with project links, Obsidian note shortcut, open project, complete, and exit actions
- "Show project in main" IPC handler — clicking project code in focus bar opens the project in the main window
- `onNavigateToProject` IPC bridge for main window to receive navigation requests from focus window
- macOS application menu with standard Cmd+H, Cmd+Q, Edit (undo/redo/copy/paste), and Window roles

### Changed

- Focus bar dimensions reduced from 420x110 to 520x58 for a more compact, always-on-top experience
- Replaced hover tooltip and check-in countdown with persistent session timer and context menu
- Task picker popup height reduced from 350 to 320; removed project name column from picker rows
- Confirm save dialog uses slightly larger font and button sizing for better readability

### Removed

- Hover tooltip showing full task title (replaced by context menu and double-click to copy)
- Check-in countdown timer display (replaced by cumulative session timer)
- Launcher buttons inline in focus bar (moved to context menu as project links)

### Fixed

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal
- Settings icon in sidebar now renders as proper emoji (⚙️) instead of plain text glyph

## [1.44.0] - 2026-02-16

### Added

- Remove button (✕) on every task row including overflow section for quick task removal
- "Clear" button on Done section header to remove all completed tasks at once

### Changed

- Focus button is hidden for overflow tasks but remove button remains accessible

## [1.43.1] - 2026-02-15

### Fixed

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal

- Keyboard shortcuts (split, focus, remove, etc.) could double-fire because `hoveredTaskRef` was not cleared after action — `consume()` helper now clears both context menu and hover ref

## [1.43.0] - 2026-02-15

### Added

- Right-click context menu on tasks in TodayView with actions: Focus, In Progress, Stop Focus, Open Note, Split & Continue, Remove/Unpin
- Keyboard shortcuts for task actions triggered on hovered or context-menu-targeted task (F=focus, P=in-progress, S=stop focus, N=open note, C=split, Backspace/Delete=remove)
- Hover tracking on task rows and focus card for keyboard shortcut targeting

### Changed

- Replaced inline task action buttons (progress toggle, note, split, remove) with context menu — cleaner task row UI
- Removed stop-focus button from focus card in favor of context menu and S keyboard shortcut


## [1.42.0] - 2026-02-15

### Added

- Split task action ("complete & continue"): scissor button on non-repeating tasks in TodayView completes the current task and creates a continuation with incremented title (e.g. "continue (1) Task title")
- `continuationTitle` helper for generating sequential continuation titles

### Fixed

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal

- Stale closure in `ProjectDetailView.updateTasks`: now reads fresh project state from Zustand store instead of using potentially stale `project` prop
- Stale closure in `TodayView.completeTask` and `uncompleteTask`: use `useProjects.getState()` instead of `projects` from closure
- Today view active task slot calculation no longer subtracts completed tasks from the limit, preventing premature overflow of active tasks
- Long unbreakable task titles now wrap correctly with `overflow-wrap: anywhere` on task title elements

## [1.41.1] - 2026-02-15

### Fixed

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal

- Quick Add window no longer closes on Cmd+Enter when submission fails (empty title); `handleSubmit` now returns success/failure boolean
- `RepeatUpdateModal` properly awaits async `saveRepeatingTask` before closing
- `obsidianVaultName` config field now validated in `isValidAppConfig`
- Settings directory picker no longer auto-populates vault name from selected path (vault name is set explicitly)

## [1.41.0] - 2026-02-15

### Added

- `obsidianVaultName` config option for explicitly setting the Obsidian vault name used in `obsidian://` URIs (previously derived from storage path)
- Native directory picker dialog (`select-directory` IPC handler) for browsing vault path in Settings
- Browse button (folder icon) on Obsidian vault path input in Settings UI

### Changed

- Obsidian Settings section split into separate vault name and vault path fields (previously single path input)
- Vault name auto-populated from selected directory when using the browse button
- Obsidian note `open-task-note` handler uses explicit `obsidianVaultName` config with fallback to directory basename via `path.resolve()`
- Settings modal overlay now handles Escape key via `onKeyDown` for keyboard dismissal

## [1.40.0] - 2026-02-15

### Added

- Obsidian task notes integration: configure vault path in Settings, open/create per-task markdown notes from TodayView, QuickTasksView, and ProjectDetailView via `obsidian://` URI
- `open-task-note` IPC handler creating notes in `top5.storage/<ProjectName>/` subfolders within the Obsidian vault
- Task ID badge prefix in Obsidian note filenames (e.g. `TOP5-3 Task title.md`) with 40-char title truncation
- `obsidianStoragePath` config option in AppConfig and Settings UI
- Someday tasks: `someday` flag on project tasks with dedicated collapsible section in ProjectDetailView
- Drag-and-drop support for moving tasks to/from the Someday section
- Repeating task title sync prompt: when renaming a task spawned from a repeating template, a modal asks whether to update the template title too
- `RepeatUpdateModal` shared component extracted from duplicated modal code in TodayView and QuickTasksView
- Done list pagination in ProjectDetailView (10 tasks per page with prev/next controls)

### Changed

- Quick Add window stays open after adding an item: Enter adds and clears the input, Cmd+Enter adds and closes the window
- Quick Add shows inline toast confirmation instead of closing on success
- Quick Add footer shortcut hints updated to reflect new Cmd+Enter behavior
- Quick Add Cmd+Enter close now waits for submit to complete before closing the window
- Wins day streak calculation now skips weekends (Sat/Sun) and tolerates missing workday entries without breaking the streak
- Obsidian note path sanitization improved: collapses `..` sequences to prevent path traversal
- Settings label "Obsidian notes path" renamed to "Obsidian Vault"
- TodayView uses destructured `config` from store instead of inline `getState()` call

### Fixed

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal

- Drag-and-drop reorder in ProjectDetailView no longer disrupts someday tasks

## [1.39.0] - 2026-02-15

### Added

- Move task between projects via drag-and-drop: drag a task from ProjectDetailView or TodayView onto any project in the Sidebar to reassign it
- `moveTaskToProject` service function with task number reassignment, pin/progress state reset, and operation logging
- `move-task-to-project` IPC handler, preload bridge, and Zustand store action
- `task_moved` operation type logged in activity log with source project details
- Sidebar drop targets on both active and suspended project items for task moves
- `application/top5-task` drag data transfer format carrying projectId and taskId

### Changed

- ProjectDetailView drag-start now sets `application/top5-task` data transfer alongside internal reorder drag
- TodayView drag-start sets `application/top5-task` data for pinned tasks, enabling cross-project moves from Today
- Sidebar active and suspended item drag-over handlers detect task drags and show drop feedback independently of project reorder drags

## [1.38.0] - 2026-02-15

### Changed

- Quick Links editor now uses a dropdown with preset link types (VS Code, iTerm, Obsidian, Browser) instead of a free-text label field
- Context-sensitive URL placeholder based on selected link type
- "Custom..." option in dropdown reveals a free-text label input for non-preset link types
- Default new link label changed from empty to "VS Code"

## [1.37.0] - 2026-02-14

### Added

- Today's total focus time displayed next to "Today" label in sidebar (e.g. "Today (1h 25min)")

## [1.36.0] - 2026-02-14

### Added

- Cross-section drag-and-drop: drag tasks between "above limit" and "overflow" sections in Today view
- Zone-based drop targets on the limit indicator and overflow header for intuitive cross-section moves
- `drag-over-zone` CSS highlight style for drop target feedback (blue border glow)
- `limitAdjust` mechanism in `useTaskList` hook: visual split adjusts on cross-section drag without changing the persisted config limit

### Changed

- `useTaskList` hook now accepts `limitAdjust` option and returns `configLimit` alongside the effective `limit`
- Limit indicator bar always rendered (previously conditionally shown based on overflow presence)
- Limit indicator and overflow header act as drag-and-drop zones with visual feedback

## [1.35.0] - 2026-02-14

### Added

- **5 Wins** gamification system: lock today's tasks, earn wins by completing them before deadline
- Wins lock/unlock mechanism with automatic deadline calculation (end of day or next day based on lock time)
- Win/loss tracking persisted in `wins.jsonl` with full history
- Streak stats engine (`src/shared/wins.ts`): day, week, and month streaks with win/loss counters
- Wins service layer (`src/main/service/wins.ts`) with lock, unlock, deadline check, and history
- IPC handlers: `wins-lock`, `wins-unlock`, `wins-get-lock-state`, `wins-get-history`, `wins-get-streaks`
- Preload bridge and type declarations for all wins IPC methods
- Lock bar UI in TodayView and QuickTasksView showing progress, countdown, and unlock button
- 30-day win/loss dot strip visualization in TodayView
- Victory celebration overlay (trophy animation) on completing all locked tasks
- Loss banner overlay when deadline expires with incomplete tasks
- Wins calendar (monthly grid) and streak summary in InlineStatsView (Stats panel)
- Post-win encouragement state showing streak continuation prompt
- `wins.jsonl` included in daily backup rotation
- Wins operation logging: day won/lost, week streak won/lost, month streak won/lost events recorded in operation log
- `wins` category filter in Operation Log view for filtering wins-related events
- Six new `OperationType` values: `wins_day_won`, `wins_day_lost`, `wins_week_won`, `wins_week_lost`, `wins_month_won`, `wins_month_lost`

### Changed

- `useTaskList` hook: extracted shared logic from TodayView, added `excludeFocus` option, returns focus/inProgress/upNext splits and lock state
- TodayView refactored to use `useTaskList` hook instead of inline task merging logic
- `AppData` type extended with `winsLock` field (`WinsLockState`)
- Zustand store (`useProjects`) extended with `winsLock` state and `lockWinsTasks`/`unlockWinsTasks`/`loadWinsLock` actions
- Periodic deadline check runs every 60 seconds in main process
- Task completion handlers (`save-project`, `complete-quick-task`) now trigger win condition check
- InlineStatsView weekly project cards and Work Stats table headers now show project codes instead of full names
- InlineStatsView Work Stats table highlights today's row with accent background
- InlineStatsView today label in daily view uses dot marker (`●`) instead of text
- Wins calendar grid uses fixed 24px cell size instead of fluid aspect-ratio layout

## [1.34.0] - 2026-02-14

### Added

- Task ID system: every task gets a sequential number displayed as `CODE-N` (project tasks) or `QT-N` (quick tasks)
- Project codes: unique 2-6 character alphanumeric identifiers per project (e.g. `TOP5`, `API`)
- `TaskIdBadge` component for consistent task ID display across all views
- `ProjectCodeMigration` modal: prompts user to assign codes to existing projects on first load
- Task ID formatting utilities in `src/shared/taskId.ts` (`formatTaskId`, `formatQuickTaskId`)
- Auto-migration of existing tasks to assign sequential task numbers on data load
- Project code uniqueness validation in service layer and editor UI
- Task codes logged in operation log entries (`taskCode` field)

### Changed

- `Project` type: added `code` and `nextTaskNumber` fields
- `Task` and `QuickTask` types: added `taskNumber` field
- `AppData` type: added `nextQuickTaskNumber` for global quick task numbering
- `OperationLogEntry` type: added `taskCode` field
- Operation log display now shows task codes (e.g. `[TOP5-3] "task title"`)
- Project editor includes a Code field with inline validation
- FocusMode, TodayView, QuickTasksView, ProjectDetailView, and Dashboard updated to display task IDs
- `useTaskList` hook propagates `projectCode` and `taskNumber` through merged task data

## [1.33.0] - 2026-02-14

### Added

- DevTools button in Settings for opening Chrome DevTools in detached mode
- `open-dev-tools` IPC handler and `openDevTools` preload bridge API

### Changed

- Build script (`build.sh`): kills running Top5 instance before install, copies app to `/Applications/`, uses `-c.mac.identity=null` to skip code signing

### Fixed

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal

- Stale focus state on startup: `focusProjectId` and `focusTaskId` are now cleared when the app launches, preventing ghost focus indicators from previous sessions

## [1.32.0] - 2026-02-14

### Changed

- Electron upgraded from v28 to v40
- electron-vite upgraded from v2 to v5
- electron-builder upgraded from v24 to v26
- `@electron-toolkit/utils` upgraded from v3 to v4
- `@electron-toolkit/tsconfig` upgraded from v1 to v2
- `@electron-toolkit/preload` upgraded from v3.0.0 to v3.0.2
- Build script (`build.sh`) reworked: default quick build (unpacked `.app`, no signing) for daily use; `--release` flag for full DMG with signing
- Removed `@ts-expect-error` workaround in `electron.vite.config.ts` (no longer needed with updated toolchain)
- README updated with HTTP API feature, Fastify in stack section, API docs link, and `api/`/`service/` directory tree

## [1.31.0] - 2026-02-14

### Added

- HTTP API server powered by Fastify, bound to `127.0.0.1` only, with Bearer token authentication
- API routes for projects (CRUD, archive/unarchive, suspend/unsuspend, tasks), quick tasks (CRUD, complete/uncomplete, reorder), and repeating tasks (CRUD, reorder)
- Health endpoint (`GET /api/v1/health`) exempt from authentication
- API configuration stored in `data.yaml` under `apiConfig` (enabled, apiKey, port) with default port `15055`
- `TOP5_API_PORT` environment variable override for API server port
- Service layer (`src/main/service/`) extracting business logic from IPC handlers: `projects.ts`, `quick-tasks.ts`, `repeating-tasks.ts`
- Unified type definitions in `src/shared/types.ts` as single source of truth for main, renderer, and API
- `ApiConfig` and `ApiConfigPublic` types for full and sanitized API configuration
- `get-api-config` and `save-api-config` IPC handlers with preload bridge for renderer access
- HTTP API section in Settings UI: toggle enable/disable, view port, show/copy/regenerate API key
- API test suite (`tests/api/`) with 34 vitest tests covering auth, health, projects, quick tasks, and repeating tasks
- `npm run test:api` script using vitest with Electron mock
- `vitest.config.ts` with Electron module alias for test isolation
- API reference documentation (`docs/API.md`) covering all endpoints, data types, and usage examples

### Changed

- Renderer types (`src/renderer/types/index.ts`) now re-export from `src/shared/types.ts` instead of defining types locally
- Main store (`src/main/store.ts`) imports types from `src/shared/types.ts` and delegates to service layer, reducing file size significantly
- Preload bridge imports types from `src/shared/types.ts` instead of renderer types

## [1.30.0] - 2026-02-14

### Added

- Shared `src/shared/schedule.ts` module: single source of truth for repeat schedule logic (`isScheduleDueOnDate`, `getRepeatingTaskProposals`, `normalizeWeekdays`, `normalizeRepeatSchedule`, `sortWeekdays`)
- Shared `src/shared/quick-add.ts` module: `buildQuickAddSchedule` extracted from QuickAddWindow for reuse and testability
- Unit tests for schedule logic (`tests/schedule.test.ts`) covering weekday normalization, monthly schedules, proposal filtering, and legacy Sunday mapping
- `npm run test` script using Node.js built-in test runner with TypeScript compilation to `.tmp-tests/`
- `tsconfig.tests.json` for test compilation configuration
- Accelerator validation (`isValidAccelerator`) and action shortcut validation (`isValidActionShortcuts`) in main store for IPC input hardening
- `normalizeAppConfig` function for defensive config normalization on load, migration, and save
- `normalizeRepeatingTask` function applying schedule normalization on load and save
- Check-in caching layer (`cachedCheckIns`, `taskMinutesById`) with incremental updates on append, avoiding repeated full file reads
- `mailto:` protocol added to `ALLOWED_BROWSER_PROTOCOLS` in launchers module

### Changed

- `TodayView`, `useTaskList`, and `main/index.ts` (clean view sizing) all use shared `getRepeatingTaskProposals` instead of duplicated inline filtering logic
- `QuickAddWindow` uses shared `buildQuickAddSchedule` and `sortWeekdays` instead of inline schedule construction
- Weekday picker in QuickAddWindow uses `WEEKDAY_VALUES` array mapping UI positions to JS weekday numbers (Mon=1...Sun=0), fixing incorrect day mapping
- `isValidRepeatSchedule` now validates weekday range (0-7), requires non-empty days array, and checks `Number.isFinite`
- `isValidAppConfig` expanded to validate all config fields including `focusTaskId`, `focusProjectId`, `compactMode`, `cleanView`, and `cleanViewFont`
- `save-config` IPC handler applies `normalizeAppConfig` before persisting, ensuring invalid payloads are sanitized
- `loadData` uses `normalizeAppConfig` and filters/normalizes repeating tasks on load
- Data migration (`ensureDataDir`) includes `operations.jsonl` in iCloud file migration list
- Data migration only removes legacy directory when all known files are successfully migrated and directory is empty
- `set-traffic-lights-visible` IPC handler now respects the `visible` argument instead of always hiding
- `saveFocusCheckIn` return type in renderer types corrected from `Promise<void>` to `Promise<FocusCheckIn[]>`
- `openProjectLink` handles `mailto:` via `openExternal` instead of routing through `launchBrowser` (which only accepts http/https)
- TypeScript configs (`tsconfig.node.json`, `tsconfig.web.json`) updated to include `src/shared/**/*`
- `CLAUDE.MD` updated with Electron sandbox safety note

### Fixed

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal

- Weekdays schedule in Quick Add: "weekdays" mode now correctly saves Mon-Fri (was saving only `[1]`)
- Weekly schedule picker correctly maps UI button positions to JS weekday values (Sun=0, Mon=1...Sat=6)
- Legacy Sunday value `7` normalized to `0` when loading repeating task schedules
- Data migration no longer silently deletes `operations.jsonl` when migrating to iCloud
- Data migration uses copy fallback when rename fails (cross-device) and preserves legacy directory on partial migration

## [1.29.0] - 2026-02-14

### Added

- Inline editing in Today view: double-click any task (regular or focused) to edit its title in place
- `.inline-edit-input` CSS class for seamless inline editing appearance (transparent background, inherited font)

### Changed

- Operation Log descriptions now capitalize "Project" for consistency (e.g. "Created Project X" instead of "Created project X")
- Operation Log search filter now matches against the full rendered description instead of raw field values, improving search accuracy

### Fixed

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal

- Focus check-in interval restored to production value (15 minutes) from debug value (30 seconds)

## [1.28.0] - 2026-02-14

### Added

- Focus session tracking: `focus_started` and `focus_ended` operations now log task/project context and total reported focus time
- Keyboard shortcuts for check-in responses: press `1` (Yes), `2` (A little), `3` (No) to respond without clicking — shortcuts shown as hints on buttons
- `onCheckInRespond` preload API for global shortcut-driven check-in responses via IPC
- Category filter buttons (All / Tasks / Projects / Focus) in Operation Log view
- URL-based filter parameter for Operation Log window — open pre-filtered via `openOperationLogWindow(filter)`
- "Activity" link in Project Detail View header to open the operation log filtered by project name
- Focus time (`Xmin`) shown in task completion log entries (both quick tasks and project tasks)
- `taskTimeMinutes` helper in main store to calculate accumulated focus time per task from check-in data
- `loadCheckIns` and `appendOperation` exported from main store for use in focus-window module

### Changed

- Focus Mode task picker now uses `useTaskList` hook for consistent task list with clean view (same ordering and filtering)
- Clean view hides repeating section header when no repeating tasks are active
- Clean view no longer shows repeating task proposals (accept/dismiss UI)
- Clean view completed section separator only shown when there are actual repeating active tasks (not just proposals)
- Pinned tasks in Project Detail View now appear above unpinned tasks, sorted by pin order
- Newly pinned tasks are assigned the next order position so they appear at the end of the pinned group
- Pin icon in Project Detail View is now always clickable — click to unpin an already-pinned task (previously pinned tasks showed a static icon)
- Operation Log time column simplified to show only `HH:MM` time (removed relative "ago" format)
- Operation Log no longer fetches project data or renders project color dots — streamlined to text-only entries
- Check-in popup uses refs instead of state for projectId/taskId to avoid stale closures in IPC callback
- Operation Log window re-creates on each open (closes previous instance) to support changing filter parameters

### Removed

- `focus_checkin` operation type from activity log — focus check-ins are no longer logged as separate operations
- Project color dots from Operation Log entries

## [1.27.1] - 2026-02-13

### Fixed

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal

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

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal

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

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal

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

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal

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

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal

- Conditional React hooks call in `App.tsx` for auxiliary windows (check-in, stats) now compliant with Rules of Hooks

## [1.6.1] - 2026-02-11

### Fixed

- Hide remove button on completed (locked) tasks in TodayView to prevent accidental removal

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
