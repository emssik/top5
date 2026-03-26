---
name: top5-cli
description: >
  Manage projects and tasks in the top5 task manager via the `top5` CLI tool.
  Use when the user asks to: list projects, list tasks in a project, add tasks,
  mark tasks as done/undone, manage quick tasks, create task notes, start/stop focus mode,
  or send a focus heartbeat/ping.
  Triggers: "top5", "projects list", "add task", "mark done", "quick tasks",
  "task note", "show my tasks", "what projects do I have", "focus", "start focus", "stop focus",
  "focus ping", "heartbeat", "today", "today tasks", "what's on today", "dzisiejsze taski".
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

### Add a task

```bash
top5 add PRJ "Task title"
top5 add PRJ "Task title" --note    # also create Obsidian note
top5 add PRJ "Task title" --json
```

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
top5 qt add "Research" --note
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

| Format  | Example | Description              |
|---------|---------|--------------------------|
| `PRJ-N` | `PRJ-3` | Task #3 in project PRJ   |
| `QT-N`  | `QT-5`  | Quick task #5            |
| UUID    | `abc-…` | Raw ID (fallback)        |

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
top5 add PRJ "New task"
top5 done PRJ-5
```

**Focus on a task:**
```bash
top5 focus PRJ-3
top5 focus             # check status
top5 focus ping        # heartbeat — suppress check-in popup
top5 focus stop        # done
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
