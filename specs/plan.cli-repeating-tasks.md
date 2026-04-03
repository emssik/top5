# Plan: CLI Repeating Tasks Support

> Add repeating task management to the top5 CLI. The API already has full CRUD + accept/dismiss endpoints for repeating tasks (`/api/v1/repeating-tasks`). The CLI currently has zero commands for them. This plan adds a `top5 rt` command group (mirroring the `qt` pattern) to list, create, edit, delete, accept, and dismiss repeating tasks.

## Context & Motivation

The user manages repeating tasks (e.g. "Morning standup", "Weekly review") through the Electron UI's RepeatView. The HTTP API already exposes all repeating task operations. However, the CLI -- used by Claude Code and terminal workflows -- has no way to interact with repeating tasks. This creates a gap: the CLI can manage projects, tasks, quick tasks, focus, and today view, but cannot list or manage repeating tasks.

Adding CLI support enables:
- Viewing today's pending repeating proposals and accepting/dismissing them from the terminal
- CRUD on repeating task definitions without opening the Electron UI
- Automation workflows (e.g. Claude Code accepting today's repeating proposals)

## Scope

### In scope
- `top5 rt` -- list all repeating tasks (definitions)
- `top5 rt add <title>` -- create a repeating task with schedule options
- `top5 rt edit <ref>` -- update title/schedule of existing repeating task
- `top5 rt rm <ref>` -- delete a repeating task
- `top5 rt accept <ref>` -- accept a repeating proposal (creates quick task)
- `top5 rt dismiss <ref>` -- dismiss a repeating proposal for today
- `top5 rt proposals` -- list today's pending repeating proposals (due + not yet accepted/dismissed)
- Update SKILL.md with repeating task commands
- Resolve helper for repeating tasks (by ID or index)

### Out of scope
- Reorder command (`PUT /reorder`) -- low-value for CLI, order is managed in UI
- Date range (startDate/endDate) editing from CLI -- complexity vs. usage tradeoff; can be added later
- Link/projectId editing from CLI -- can be added later if needed
- Tests (no test infrastructure for CLI exists; API tests already cover the endpoints)

### Constraints
- Follow existing CLI patterns exactly (commander subcommands, `printResult`/`formatTable`, `createClient`, error handling with `die`)
- API responses are wrapped in `{ ok: true, data: ... }` -- the `ApiClient` already unwraps this
- Repeating tasks have no "task number" or "code" -- they use UUID IDs. The CLI will refer to them by position (order) in the list or by ID.

## Key Decisions

### Decision 1: Command group name `rt`
- **Choice:** `top5 rt` (parallel to `top5 qt` for quick tasks)
- **Why:** Consistent with existing naming convention. Short, memorable. `repeating` would be too long.
- **Alternatives considered:** `repeat`, `rep` -- less obvious. `rt` mirrors `qt`.
- **Trade-offs:** Two-letter abbreviation is less discoverable but consistent with the codebase.

### Decision 2: Reference repeating tasks by ordinal position (1-based) or ID
- **Choice:** `top5 rt accept 1` refers to the 1st repeating task (by order), or a raw UUID can be passed
- **Why:** Repeating tasks don't have task numbers or codes. Using ordinal position (shown in the list output) is the most natural CLI reference. The list command shows a `#` column with 1-based position.
- **Alternatives considered:** Adding a numbering system like QT-N -- would require changes to data model and API, overkill for this.
- **Trade-offs:** Position can change if tasks are reordered in UI. But for CLI usage (list then act) this is fine.

### Decision 3: Schedule specification via CLI flags
- **Choice:** Use flags to specify schedule: `--daily`, `--weekdays`, `--weekly <days>`, `--interval <N>`, `--after-done <N>`, `--monthly-day <N>`, `--monthly-last-day`
- **Why:** Flags are the natural CLI idiom. Each schedule type maps to one flag. Mutual exclusivity is enforced in code.
- **Alternatives considered:** A single `--schedule` flag with a mini-DSL (e.g. `--schedule "weekdays:1,3,5"`) -- harder to use and document. Interactive prompts -- not suitable for automation.
- **Trade-offs:** Many flags, but most are simple. Advanced schedule types (monthlyNthWeekday, everyNMonths) are omitted for v1 -- they can be created in the UI and managed via edit.

### Decision 4: `proposals` subcommand for today's due proposals
- **Choice:** Add `top5 rt proposals` that uses the shared `getRepeatingTaskProposals` logic via a new API endpoint or by fetching data and computing client-side.
- **Why:** The most common CLI use case is "what repeating tasks are due today and need my attention?" followed by accept/dismiss.
- **Reasoning for API approach:** The API already has `/api/v1/repeating-tasks` and `/api/v1/quick-tasks`. The CLI can fetch both and compute proposals using the same logic as the shared `schedule.ts`. However, to keep the CLI thin, a new API endpoint `GET /api/v1/repeating-tasks/proposals` is cleaner.
- **Alternatives considered:** Client-side computation -- would require importing shared schedule logic into CLI, coupling CLI to internal logic.
- **Trade-offs:** One new API endpoint, but it keeps CLI thin and consistent.

### Decision 5: Omit advanced schedule types from `rt add`
- **Choice:** Support `daily`, `weekdays`, `weekly <days>`, `interval <N>`, `after-done <N>`, `monthly-day <N>`, `monthly-last-day` in CLI creation. Omit `monthlyNthWeekday` and `everyNMonths`.
- **Why:** These advanced types are rarely used and hard to express in flags. Users who need them can create via UI.
- **Trade-offs:** 6 of 8 schedule types available from CLI. The other 2 can be edited once created.

## Implementation Steps

### Step 1: Add `GET /api/v1/repeating-tasks/proposals` API endpoint
- **What:** New route that returns today's pending repeating task proposals
- **How:** Add a handler in `src/main/api/routes/repeating-tasks.ts` that calls `getRepeatingTaskProposals` from `src/shared/schedule.ts` with data from `getData()`. Return the filtered list of `RepeatingTask` objects that are due today and not yet accepted/dismissed.
- **Why this approach:** Keeps CLI thin -- no need to pull in schedule computation logic. Reuses existing tested logic from `shared/schedule.ts`.
- **Confidence: 9/10** -- The `getRepeatingTaskProposals` function already exists and is well-tested. Just need to wire it to a route.
- **Acceptance criteria:**
  - [ ] `GET /api/v1/repeating-tasks/proposals` returns `{ ok: true, data: RepeatingTask[] }`
  - [ ] Only returns tasks that are due today, not dismissed, and not already accepted (have an active/completed-today quick task)
  - [ ] Returns empty array when no proposals are pending
- **Notes:** Must import `getRepeatingTaskProposals` from `../../shared/schedule`. The function needs `repeatingTasks`, `quickTasks`, `dismissedRepeating` -- all available from `getData()`.

### Step 2: Create `cli/src/commands/repeating-tasks.ts` with list and proposals commands
- **What:** New command file with `rt` group, list subcommand (default action), and `proposals` subcommand
- **How:** Follow the `quick-tasks.ts` pattern exactly. `top5 rt` lists all repeating task definitions with columns: `#` (1-based order), `TITLE`, `SCHEDULE` (human-readable), `PROJECT` (code if linked). `top5 rt proposals` lists today's pending proposals (same columns, filtered to due-today).
- **Why this approach:** Mirrors existing CLI patterns for consistency and maintainability.
- **Confidence: 9/10** -- Direct copy of existing pattern with different data shape.
- **Acceptance criteria:**
  - [ ] `top5 rt` lists all repeating tasks sorted by order
  - [ ] Output shows #, TITLE, SCHEDULE (formatted), PROJECT columns
  - [ ] `top5 rt --json` outputs raw JSON array
  - [ ] `top5 rt proposals` lists only today's pending proposals
  - [ ] `top5 rt proposals --json` outputs raw JSON
  - [ ] Empty list shows "(none)"
- **Notes:** The `formatSchedule` function from `RepeatView.tsx` needs to be extracted/replicated in the CLI. It's pure string logic, ~20 lines. Replicate rather than share (CLI is a separate package).

### Step 3: Add `rt add <title>` subcommand with schedule flags
- **What:** Create a new repeating task via `POST /api/v1/repeating-tasks`
- **How:** Flags: `--daily` (default), `--weekdays`, `--weekly <days>` (comma-separated: `1,3,5` or `mon,wed,fri`), `--interval <N>`, `--after-done <N>`, `--monthly-day <N>`, `--monthly-last-day`. Build the `RepeatSchedule` object from flags, construct the full `RepeatingTask` payload, POST to API.
- **Why this approach:** Flags are idiomatic for CLIs. Each schedule type is one flag, easy to document and use.
- **Confidence: 9/10** -- Straightforward flag parsing + API call. The schedule object structure is well-defined in `src/shared/types.ts`.
- **Acceptance criteria:**
  - [ ] `top5 rt add "Standup" --daily` creates a daily repeating task
  - [ ] `top5 rt add "Review" --weekdays` creates a Mon-Fri task
  - [ ] `top5 rt add "Gym" --weekly 1,3,5` creates a Mon/Wed/Fri task
  - [ ] `top5 rt add "Check" --interval 3` creates an every-3-days task
  - [ ] `top5 rt add "Review" --after-done 7` creates an after-completion-7-days task
  - [ ] `top5 rt add "Rent" --monthly-day 1` creates a 1st-of-month task
  - [ ] `top5 rt add "EOM" --monthly-last-day` creates a last-day-of-month task
  - [ ] Default (no schedule flag) is `--daily`
  - [ ] Multiple schedule flags produces an error
  - [ ] Output confirms creation with title and schedule description
- **Notes:** Parse weekday names (mon-sun) to day numbers (0-6 where 0=Sun). The API validates the payload.

### Step 4: Add `rt edit <ref>` subcommand
- **What:** Update an existing repeating task's title and/or schedule
- **How:** `top5 rt edit <ref> [--title <new-title>] [--daily] [--weekdays] [--weekly <days>] ...` -- uses `PUT /api/v1/repeating-tasks/:id`. Fetches current task first, merges changes.
- **Why this approach:** Partial update pattern -- only change what's specified by flags.
- **Confidence: 9/10** -- Same pattern as schedule flags from step 3, plus GET-modify-PUT.
- **Acceptance criteria:**
  - [ ] `top5 rt edit 1 --title "New title"` changes only the title
  - [ ] `top5 rt edit 1 --interval 5` changes only the schedule
  - [ ] `top5 rt edit 1 --title "X" --weekly 1,3` changes both
  - [ ] No flags produces a helpful error message
  - [ ] Invalid ref (out of range or bad ID) produces "not found" error
- **Notes:** Ref is 1-based position from list, or raw UUID.

### Step 5: Add `rt rm <ref>`, `rt accept <ref>`, `rt dismiss <ref>` subcommands
- **What:** Delete a repeating task, accept a proposal (creates quick task), dismiss for today
- **How:** Simple API calls: `DELETE /api/v1/repeating-tasks/:id`, `POST /api/v1/repeating-tasks/:id/accept`, `POST /api/v1/repeating-tasks/:id/dismiss`. Resolve ref to ID first.
- **Why this approach:** Direct mapping to existing API endpoints.
- **Confidence: 10/10** -- Trivial wiring of resolved ID to API endpoint.
- **Acceptance criteria:**
  - [ ] `top5 rt rm 1` deletes the 1st repeating task, confirms deletion
  - [ ] `top5 rt accept 1` accepts proposal, shows created quick task title
  - [ ] `top5 rt dismiss 1` dismisses for today, confirms
  - [ ] Invalid ref returns error
  - [ ] `rm`/`accept`/`dismiss` work with UUID as well as position
- **Notes:** Accept returns `{ quickTasks, repeatingTasks }` -- show the newly created quick task title.

### Step 6: Add resolve helper for repeating tasks
- **What:** Add `resolveRepeatingTask` to `cli/src/lib/resolve.ts`
- **How:** Accepts a string ref (1-based number or UUID). Fetches `GET /api/v1/repeating-tasks`, sorts by order, then resolves by position (1-based) or ID match.
- **Why this approach:** Consistent with `resolveProject`/`resolveQuickTask` pattern.
- **Confidence: 10/10** -- Simple lookup logic.
- **Acceptance criteria:**
  - [ ] `resolveRepeatingTask(client, "1")` returns the first repeating task (by order)
  - [ ] `resolveRepeatingTask(client, "abc-123")` returns the task with that ID
  - [ ] Throws "Repeating task not found" for invalid refs
- **Notes:** Position-based resolution: if ref is a pure number, treat as 1-based index into order-sorted list.

### Step 7: Register in main.ts and update SKILL.md
- **What:** Wire `rt` command group into `cli/src/main.ts`, update `cli/top5-cli/SKILL.md` with repeating task commands
- **How:** Add `import { register as registerRepeatingTasks }` and call it. Add documentation section to SKILL.md following existing format.
- **Why this approach:** Standard registration pattern.
- **Confidence: 10/10** -- Copy-paste pattern.
- **Acceptance criteria:**
  - [ ] `top5 rt` works after registration
  - [ ] `top5 --help` shows the `rt` command
  - [ ] SKILL.md documents all `rt` subcommands with examples
  - [ ] SKILL.md triggers section updated to include repeating task keywords

## Dependencies & Order

```
Step 1 (API endpoint) → no deps
Step 6 (resolve helper) → no deps
  ├── Step 2 (list + proposals) → blocked by Step 1 (uses proposals endpoint) + Step 6
  ├── Step 3 (add) → no deps beyond Step 6
  ├── Step 4 (edit) → blocked by Step 3 (reuses schedule parsing) + Step 6
  └── Step 5 (rm/accept/dismiss) → blocked by Step 6
Step 7 (register + docs) → blocked by all above
```

Critical path: Step 1 → Step 6 → Step 2 → Step 7

## Team Design

> Zadanie jest proste -- 2 pliki tworzysz (1 API endpoint + 1 CLI command file), 2 edytujesz (resolve.ts, main.ts, SKILL.md). Zespol agentow to overkill. Zrealizuj w jednej sesji.

## Risks & Mitigations

| Risk | Probability | Mitigation |
|------|-------------|------------|
| `getRepeatingTaskProposals` import fails in API route (Vite bundling) | Low | It's in `shared/` which is already imported by other API routes. Same pattern as `getVisibleTasks` in `today.ts`. |
| Schedule flag parsing edge cases (weekday names, validation) | Low | Keep parsing simple: comma-separated numbers or short names. API validates the final payload. |
| Position-based refs break if user reorders in UI between list and action | Medium | Acceptable trade-off. Users can always use UUID. Document this caveat. |

## Definition of Done

The task is complete when ALL of the following are true:

- [ ] `top5 rt` lists all repeating task definitions
- [ ] `top5 rt proposals` shows today's pending proposals
- [ ] `top5 rt add "Title" --daily` (and other schedule flags) creates repeating tasks
- [ ] `top5 rt edit <ref>` updates title and/or schedule
- [ ] `top5 rt rm <ref>` deletes a repeating task
- [ ] `top5 rt accept <ref>` accepts a proposal (creates quick task)
- [ ] `top5 rt dismiss <ref>` dismisses a proposal for today
- [ ] All commands support `--json` output
- [ ] SKILL.md updated with all new commands
- [ ] `npm run build` passes (both Electron app + CLI)
- [ ] No regressions in existing CLI commands

## Verification

1. **Manual smoke test:**
   - Start top5 app with API enabled
   - Run `top5 rt` -- should show existing repeating tasks or "(none)"
   - Run `top5 rt add "Test task" --daily` -- should create
   - Run `top5 rt` again -- should show the new task
   - Run `top5 rt proposals` -- should show it if due today
   - Run `top5 rt accept 1` -- should create a quick task
   - Run `top5 qt` -- should show the accepted task
   - Run `top5 rt edit 1 --title "Updated"` -- should update
   - Run `top5 rt rm 1` -- should delete
   - Verify all commands work with `--json`

2. **Build verification:**
   - `cd cli && npm run build` (or whatever the CLI build is)
   - `npm run build` from project root
