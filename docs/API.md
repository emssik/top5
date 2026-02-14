# Top5 HTTP API

Local REST API for integrating with Top5 app — automations, scripts, AI agents.

## Overview

| | |
|---|---|
| **Framework** | Fastify |
| **Base URL** | `http://127.0.0.1:15055/api/v1` |
| **Port** | Default `15055`, override: `TOP5_API_PORT` env |
| **Bind** | `127.0.0.1` only (localhost) |
| **CORS** | Enabled (`*`) |
| **Auth** | Bearer token |

## Authentication

All endpoints (except `/health`) require a Bearer token:

```
Authorization: Bearer <apiKey>
```

The API key is configured in **Settings → HTTP API** inside the app.

Unauthenticated requests return `401 Unauthorized`.

## Response format

**Success:**
```json
{ "ok": true, "data": <payload> }
```

**Error:**
```json
{ "ok": false, "error": "Human-readable error message" }
```

HTTP status codes: `200` OK, `201` Created, `400` Bad Request, `404` Not Found, `409` Conflict.

---

## Endpoints

### Health

#### `GET /health`

No auth required. Returns API status and app version.

```json
{ "ok": true, "data": { "status": "ok", "version": "1.2.3" } }
```

---

### Projects

#### `GET /projects`

Returns all projects.

**Response:** `{ ok, data: Project[] }`

#### `GET /projects/:id`

Returns a single project.

**Errors:** `404` if not found.

#### `POST /projects`

Creates a new project.

**Body:** Project object (requires `name`, `tasks` array).

**Response:** `201` — `{ ok, data: Project[] }` (all projects).

Auto-assigns color, order. Auto-suspends if active project limit is reached.

#### `PUT /projects/:id`

Updates a project (including its tasks).

**Body:** Full project object.

**Errors:** `404` not found, `409` active limit conflict, `400` validation.

Detects task-level changes (created, completed, deleted) and logs them.

#### `DELETE /projects/:id`

Deletes a project.

**Errors:** `404` if not found.

#### `POST /projects/:id/archive`

Archives a project. Stops timer if running.

#### `POST /projects/:id/unarchive`

Unarchives a project. Clears both `archivedAt` and `suspendedAt`.

**Errors:** `409` if active limit reached.

#### `POST /projects/:id/suspend`

Suspends a project (removes from active list without archiving).

#### `POST /projects/:id/unsuspend`

Unsuspends a project.

**Errors:** `409` if active limit reached.

#### `PUT /projects/reorder`

Reorders active projects.

**Body:** `string[]` — ordered array of project IDs.

```json
["proj-id-1", "proj-id-3", "proj-id-2"]
```

#### `POST /projects/:pid/tasks/:tid/toggle-in-progress`

Toggles `inProgress` flag on a task. No-op if task is completed.

**Errors:** `404` if project or task not found.

#### `POST /projects/:pid/tasks/:tid/toggle-to-do-next`

Toggles `isToDoNext` (pinned) flag on a task.

**Errors:** `404` if project or task not found.

#### `PUT /projects/pinned-tasks/reorder`

Reorders pinned ("To Do Next") tasks.

**Body:** `Array<{ projectId: string, taskId: string, order: number }>`

---

### Quick Tasks

#### `GET /quick-tasks`

Returns all quick tasks.

**Response:** `{ ok, data: QuickTask[] }`

#### `POST /quick-tasks`

Creates a quick task.

**Body:** QuickTask object (requires `title`).

**Response:** `201` — `{ ok, data: QuickTask[] }`

#### `PUT /quick-tasks/:id`

Updates a quick task.

**Errors:** `404` if not found.

#### `DELETE /quick-tasks/:id`

Deletes a quick task.

**Errors:** `404` if not found.

#### `POST /quick-tasks/:id/complete`

Marks a quick task as completed. Tracks time, updates linked repeating task stats.

#### `POST /quick-tasks/:id/uncomplete`

Marks a completed quick task as incomplete.

#### `POST /quick-tasks/:id/toggle-in-progress`

Toggles `inProgress` flag. No-op if task is completed.

#### `PUT /quick-tasks/reorder`

Reorders quick tasks.

**Body:** `string[]` — ordered array of task IDs.

---

### Repeating Tasks

#### `GET /repeating-tasks`

Returns all repeating tasks.

**Response:** `{ ok, data: RepeatingTask[] }`

#### `POST /repeating-tasks`

Creates a repeating task.

**Body:** RepeatingTask object (requires `title`, `schedule`).

**Response:** `201` — `{ ok, data: RepeatingTask[] }`

#### `PUT /repeating-tasks/:id`

Updates a repeating task.

**Errors:** `404` if not found.

#### `DELETE /repeating-tasks/:id`

Deletes a repeating task.

**Errors:** `404` if not found.

#### `PUT /repeating-tasks/reorder`

Reorders repeating tasks.

**Body:** `string[]` — ordered array of task IDs.

#### `POST /repeating-tasks/:id/accept`

Accepts a repeating task proposal — creates a new Quick Task from it.

**Response:** `{ ok, data: { quickTasks: QuickTask[], repeatingTasks: RepeatingTask[] } }`

#### `POST /repeating-tasks/:id/dismiss`

Dismisses a repeating task proposal for today.

**Response:** `{ ok, data: { dismissed: true } }`

---

## Data types

### Project

```typescript
{
  id: string
  name: string
  description: string
  order: number
  deadline: string | null        // ISO date
  totalTimeMs: number
  timerStartedAt: string | null  // ISO datetime
  color?: string
  tasks: Task[]
  archivedAt: string | null
  suspendedAt: string | null
}
```

### Task (project task)

```typescript
{
  id: string
  title: string
  completed: boolean
  createdAt: string
  completedAt?: string | null
  isToDoNext?: boolean
  toDoNextOrder?: number
  inProgress?: boolean
}
```

### QuickTask

```typescript
{
  id: string
  title: string
  completed: boolean
  createdAt: string
  completedAt: string | null
  order: number
  repeatingTaskId?: string | null
  inProgress?: boolean
}
```

### RepeatingTask

```typescript
{
  id: string
  title: string
  schedule: RepeatSchedule
  createdAt: string
  lastCompletedAt: string | null
  order: number
  acceptedCount: number
  dismissedCount: number
  completedCount: number
  startDate?: string | null
  endDate?: string | null
}
```

### RepeatSchedule

```typescript
| { type: 'daily' }
| { type: 'weekdays', days: number[] }          // 0=Sun, 6=Sat
| { type: 'interval', days: number }
| { type: 'afterCompletion', days: number }
| { type: 'monthlyDay', day: number }
| { type: 'monthlyNthWeekday', week: number, weekday: number }
| { type: 'everyNMonths', months: number, day: number }
```

---

## Examples

### Create a project

```bash
curl -X POST http://127.0.0.1:15055/api/v1/projects \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Project",
    "description": "",
    "tasks": [{ "id": "t1", "title": "First task", "completed": false, "createdAt": "2025-01-01T00:00:00Z" }],
    "order": 0,
    "deadline": null,
    "totalTimeMs": 0,
    "timerStartedAt": null,
    "archivedAt": null,
    "suspendedAt": null
  }'
```

### Complete a quick task

```bash
curl -X POST http://127.0.0.1:15055/api/v1/quick-tasks/TASK_ID/complete \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Accept a repeating task

```bash
curl -X POST http://127.0.0.1:15055/api/v1/repeating-tasks/TASK_ID/accept \
  -H "Authorization: Bearer YOUR_API_KEY"
```
