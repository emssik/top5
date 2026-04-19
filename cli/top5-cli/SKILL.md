---
name: top5-cli
description: >
  Manage projects and tasks in the top5 task manager via the `top5` CLI tool.
  Use when the user asks to: list projects, list tasks in a project, show task details,
  add tasks, delete tasks, mark tasks as done/undone, manage quick tasks, set due dates,
  create task notes, start/stop focus mode, send a focus heartbeat/ping, or manage repeating tasks.
  Triggers: "top5", "projects list", "add task", "delete task", "remove task", "mark done",
  "quick tasks", "task note", "show my tasks", "show task", "task details",
  "what projects do I have", "focus", "start focus", "stop focus", "focus ping", "heartbeat",
  "today", "today tasks", "what's on today", "dzisiejsze taski",
  "due date", "set deadline", "termin", "ustaw datę", "pin", "pin to today", "przypnij",
  "beyond", "beyond the limit", "overflow", "push to overflow", "poza limit", "zepchnij",
  "repeating", "repeating tasks", "recurring", "cykliczne", "powtarzalne",
  "usuń task", "skasuj task", "usuń zadanie".
---

# top5-cli

CLI for managing projects and tasks in the top5 app. Communicates via HTTP API — requires top5 Electron app running with API enabled.

## Prerequisites

- `top5` command available globally (installed via `npm link` in `cli/` dir)
- top5 app running with HTTP API enabled (Settings > HTTP API)
- API key configured: `top5 config set apiKey <key>`

## JSON mode

All commands support `--json` for machine-readable output. Use `--json` when parsing results programmatically.

## IMPORTANT: Project codes are NOT guessable

Project codes (e.g., `TOP`, `MKT`, `CLI`) are user-defined and **cannot be inferred from project names**. A project named "Top5" might have code "TOP", "T5", "T", or anything else.

**Rules:**
1. **NEVER guess a project code.** Always look it up first.
2. If you already have a project UUID (e.g., from `top5 focus --json`), use the UUID directly — it works everywhere a code does.
3. If you don't have the UUID, run `top5 projects` first to get the correct code, then use it.
4. If the user mentions a project by name, find its code from `top5 projects` output before running any task commands.

## Commands

### List projects

```bash
top5 projects              # active projects only
top5 projects --all        # include archived/suspended
top5 projects --archived   # only archived
top5 projects --suspended  # only suspended
top5 projects --json
```

Output columns: CODE, NAME, TASKS (active count), PINNED (up-next count), STATUS.

### List tasks in a project

```bash
top5 tasks PRJ             # active tasks in project PRJ
top5 tasks PRJ --all       # include completed
top5 tasks PRJ --json
```

`<project>` accepts: project CODE (case-insensitive) or UUID.

Task statuses: `[done]`, `in-progress`, `up-next`, or empty (backlog).

### Show task details

```bash
top5 show PRJ-3            # show details of a single task
top5 show PRJ-3 --json     # JSON output (includes projectId, projectCode)
```

Returns: task code, title, project name, status, due date. JSON mode adds `projectId` and `projectCode`.

### Add a task

```bash
top5 add PRJ "Task title"
top5 add PRJ "Task title" --due tomorrow
top5 add PRJ "Task title" --due 2026-04-15
top5 add PRJ "Task title" --pin     # pin to today (mark as up-next)
top5 add PRJ "Task title" --note    # also create Obsidian note
top5 add PRJ "Task title" --json
```

`--due` accepts: `YYYY-MM-DD`, `today`, `tomorrow`, `+Nd` (e.g. `+3d`), day name (`monday`–`sunday`, or `mon`–`sun`).

**JSON output with `--note` and/or `--pin`:** includes extra fields:

```bash
top5 add PRJ "Report" --note --pin --json
# { ..., "notePath": "/vault/top5.storage/Project/PRJ-5 Report.md", "pinned": true }
```

`notePath` — full path to the Obsidian note file (only when `--note` used). Useful for writing content directly to the note after creation.

### Set / clear due date

```bash
top5 due PRJ-3                 # show current due date
top5 due PRJ-3 tomorrow        # set due date
top5 due PRJ-3 +5d             # 5 days from today
top5 due PRJ-3 friday          # next Friday
top5 due PRJ-3 2026-04-15      # specific date
top5 due PRJ-3 clear           # remove due date
```

### Pin / unpin task (pin to today)

```bash
top5 pin PRJ-3             # toggle pin — if unpinned, pins to today; if pinned, unpins
```

Pinned tasks appear in the "today" view as "up-next". Toggle behavior: running `pin` again unpins the task.

### Move task to / from "beyond the limit"

```bash
top5 beyond PRJ-3          # toggle: push to overflow (if visible) or bring back (if already beyond)
top5 beyond QT-5           # same for quick tasks
top5 beyond PRJ-3 --json
```

Sets the `beyondLimit` flag on a task. When `true`, the task is forced into the Today "overflow" (beyond-the-limit) zone even if the limit isn't exceeded. When `false`, the task returns to normal Today ordering. Toggles — running again flips the flag.

Matches drag-and-drop semantics: when pushing a task beyond the limit, any currently natural-overflow tasks are also frozen as `beyondLimit`, so nothing slides up to fill the vacated slot.

Works for both project tasks (`PRJ-N`) and quick tasks (`QT-N`). Accepts UUIDs.

### Delete a task

```bash
top5 rm PRJ-3
top5 rm PRJ-3 --json
```

Permanently deletes the task from the project. `<task-code>` accepts: `PRJ-N` format or UUID.

### Mark task done / undone

```bash
top5 done PRJ-3
top5 undone PRJ-3
```

`<task-code>` accepts: `PRJ-N` format or UUID.

### Quick tasks (no project)

```bash
top5 qt                    # list active quick tasks
top5 qt --all              # include completed
top5 qt add "Buy coffee"
top5 qt add "Buy coffee" --due friday
top5 qt add "Research" --note
top5 qt rm QT-5             # delete quick task
top5 qt due QT-5 tomorrow  # set due date
top5 qt due QT-5           # show due date
top5 qt due QT-5 clear     # remove due date
top5 qt done QT-5
top5 qt undone QT-5
```

Quick task codes use `QT-N` format.

### Task notes (Obsidian)

```bash
top5 note PRJ-3            # create/open note for project task
top5 note QT-5             # create/open note for quick task
```

Returns file path to the `.md` note in the Obsidian vault.

### Today's tasks

```bash
top5 today                 # visible tasks from the "today" tab
top5 today --json
```

Shows exactly what the user sees in the Today tab: repeating tasks, scheduled (due ≤ today), and regular tasks within the limit (default 5). **Excludes:** overflow (beyond limit), completed, unapproved proposals.

Output columns: #, TITLE, PROJECT, STATUS.

### Focus mode

```bash
top5 focus                 # show current focus status
top5 focus PRJ-3           # start focus on project task PRJ-3
top5 focus QT-5            # start focus on quick task QT-5
top5 focus stop            # stop current focus session
top5 focus ping            # heartbeat — confirm still working, reset 15-min check-in timer
top5 focus --json
```

Starts/stops the focus window in the Electron app. Without arguments, shows current status (task name, elapsed time).

**`ping`** — sends a heartbeat to confirm the user is still working. Saves accumulated time as a check-in and resets the 15-minute check-in timer (so the popup doesn't appear). Useful for automation — e.g., Claude Code can call `top5 focus ping` periodically to suppress check-in prompts.

### Repeating tasks

```bash
top5 rt                    # list all repeating task definitions
top5 rt proposals          # show today's pending proposals
top5 rt add "Standup" --daily           # every day (default)
top5 rt add "Review" --weekdays         # Mon-Fri
top5 rt add "Gym" --weekly 1,3,5        # specific weekdays (0=Sun..6=Sat or mon-sun)
top5 rt add "Check" --interval 3        # every 3 days
top5 rt add "Review" --after-done 7     # 7 days after completion
top5 rt add "Rent" --monthly-day 1      # 1st of month
top5 rt add "EOM" --monthly-last-day    # last day of month
top5 rt edit 1 --title "New title"      # change title
top5 rt edit 1 --interval 5            # change schedule
top5 rt rm 1                           # delete
top5 rt accept 1                       # accept proposal → creates quick task
top5 rt dismiss 1                      # dismiss proposal for today
```

`<ref>` accepts: 1-based position from `top5 rt` list, or raw UUID.
`accept` and `dismiss` resolve from proposals list (not full list).

### Health check

```bash
top5 health
top5 health --json
```

### Configuration

```bash
top5 config                # show current config
top5 config set apiKey <key>
top5 config set port 15055
top5 config set host 127.0.0.1
```

Config file: `~/.config/top5/cli.json`. Env vars (`TOP5_API_KEY`, `TOP5_API_PORT`, `TOP5_API_HOST`) override file.

## Task code format

| Format  | Example | Description                        | Used by              |
|---------|---------|------------------------------------|-----------------------|
| `PRJ-N` | `PRJ-3` | Task #3 in project PRJ             | tasks, done, due, pin, rm |
| `QT-N`  | `QT-5`  | Quick task #5                      | qt done, qt due, qt rm, note |
| `N`     | `1`     | 1-based position from list         | rt, rt accept/dismiss |
| UUID    | `abc-…` | Raw ID (fallback)                  | everywhere            |

## Common workflows

**What's on today:**
```bash
top5 today
```

**Overview of all work:**
```bash
top5 projects
top5 tasks PRJ
```

**Add and complete a task:**
```bash
top5 add PRJ "New task" --due friday
top5 add PRJ "New task" --pin       # add and pin to today
top5 done PRJ-5
```

**Pin a task to today:**
```bash
top5 pin PRJ-3             # pin (appears in today view)
top5 pin PRJ-3             # unpin (toggle)
```

**Push a task beyond the Today limit:**
```bash
top5 beyond PRJ-3          # send to overflow zone
top5 beyond PRJ-3          # bring back (toggle)
top5 beyond QT-5           # works for quick tasks too
```

**Manage due dates:**
```bash
top5 due PRJ-3 tomorrow     # set
top5 due PRJ-3              # check
top5 due PRJ-3 clear        # remove
```

**Focus on a task:**
```bash
top5 focus PRJ-3
top5 focus             # check status
top5 focus ping        # heartbeat — suppress check-in popup
top5 focus stop        # done
```

**Manage repeating tasks:**
```bash
top5 rt                     # list definitions
top5 rt proposals           # what's due today?
top5 rt accept 1            # accept → becomes quick task
top5 rt dismiss 2           # skip for today
top5 rt add "Daily standup" --weekdays
top5 rt rm 3                # delete definition
```

## Error handling

| Situation            | Message                                |
|----------------------|----------------------------------------|
| API not running      | `Cannot connect to top5 at …`          |
| Bad API key          | `HTTP 401: Unauthorized`               |
| Project not found    | `Project not found: XYZ`               |
| Task not found       | `Task PRJ-99 not found in project PRJ` |
| Timeout (>5s)        | `Request timed out`                    |
| Already in focus     | `already_in_focus` (409)               |
| Not in focus (stop)  | `not_in_focus` (409)                   |
