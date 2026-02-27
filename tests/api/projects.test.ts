import { describe, it, expect } from 'vitest'
import { setupTestEnv, getTestServer, getTestApiKey } from './setup'

setupTestEnv()

const auth = { authorization: `Bearer ${getTestApiKey()}` }

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-' + Math.random().toString(36).slice(2, 8),
    name: 'Test Project',
    description: '',
    order: 0,
    deadline: null,
    totalTimeMs: 0,
    timerStartedAt: null,
    tasks: [],
    archivedAt: null,
    suspendedAt: null,
    ...overrides
  }
}

describe('Projects API', () => {
  it('GET /projects — empty list', async () => {
    const server = await getTestServer()
    const res = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: auth })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([])
  })

  it('POST /projects — create, returns 201', async () => {
    const server = await getTestServer()
    const project = makeProject()
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: project
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().ok).toBe(true)
    expect(res.json().data.length).toBe(1)
    expect(res.json().data[0].id).toBe(project.id)
  })

  it('POST /projects — auto-suspend at limit', async () => {
    const server = await getTestServer()
    // Create 5 projects (limit)
    for (let i = 0; i < 5; i++) {
      await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: makeProject({ name: `Project ${i}` })
      })
    }
    // 6th project should be auto-suspended
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: makeProject({ name: 'Project 6' })
    })
    expect(res.statusCode).toBe(201)
    const projects = res.json().data
    const last = projects.find((p: any) => p.name === 'Project 6')
    expect(last.suspendedAt).not.toBeNull()
  })

  it('GET /projects/:id — existing', async () => {
    const server = await getTestServer()
    const project = makeProject()
    await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: project
    })
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.id).toBe(project.id)
  })

  it('GET /projects/:id — not found', async () => {
    const server = await getTestServer()
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/projects/nonexistent',
      headers: auth
    })
    expect(res.statusCode).toBe(404)
  })

  it('PUT /projects/:id — update', async () => {
    const server = await getTestServer()
    const project = makeProject()
    await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: project
    })
    const res = await server.inject({
      method: 'PUT',
      url: `/api/v1/projects/${project.id}`,
      headers: { ...auth, 'content-type': 'application/json' },
      payload: { ...project, name: 'Updated' }
    })
    expect(res.statusCode).toBe(200)
    const updated = res.json().data.find((p: any) => p.id === project.id)
    expect(updated.name).toBe('Updated')
  })

  it('PUT /projects/:id — not found', async () => {
    const server = await getTestServer()
    const res = await server.inject({
      method: 'PUT',
      url: '/api/v1/projects/nonexistent',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: makeProject({ id: 'nonexistent' })
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /projects/:id', async () => {
    const server = await getTestServer()
    const project = makeProject()
    await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: project
    })
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([])
  })

  it('DELETE /projects/:id — not found', async () => {
    const server = await getTestServer()
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/v1/projects/nonexistent',
      headers: auth
    })
    expect(res.statusCode).toBe(404)
  })

  it('archive/unarchive/suspend/unsuspend lifecycle', async () => {
    const server = await getTestServer()
    const project = makeProject()
    await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: project
    })

    // Archive
    let res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/archive`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.find((p: any) => p.id === project.id).archivedAt).not.toBeNull()

    // Unarchive
    res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/unarchive`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)

    // Suspend
    res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/suspend`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.find((p: any) => p.id === project.id).suspendedAt).not.toBeNull()

    // Unsuspend
    res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/unsuspend`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
  })

  it('PUT /projects/reorder', async () => {
    const server = await getTestServer()
    const p1 = makeProject({ name: 'P1' })
    const p2 = makeProject({ name: 'P2' })
    await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: p1 })
    await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: p2 })

    const res = await server.inject({
      method: 'PUT',
      url: '/api/v1/projects/reorder',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: [p2.id, p1.id]
    })
    expect(res.statusCode).toBe(200)
    const projects = res.json().data
    expect(projects.find((p: any) => p.id === p2.id).order).toBe(0)
    expect(projects.find((p: any) => p.id === p1.id).order).toBe(1)
  })

  it('toggle-in-progress / toggle-to-do-next', async () => {
    const server = await getTestServer()
    const project = makeProject({
      tasks: [{ id: 'task-1', title: 'Task 1', completed: false, createdAt: new Date().toISOString() }]
    })
    await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: project
    })

    let res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/tasks/task-1/toggle-in-progress`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    let p = res.json().data.find((p: any) => p.id === project.id)
    expect(p.tasks[0].inProgress).toBe(true)

    res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/tasks/task-1/toggle-to-do-next`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    p = res.json().data.find((p: any) => p.id === project.id)
    expect(p.tasks[0].isToDoNext).toBe(true)
  })

  describe('PUT /projects/:pid/tasks/:tid/due-date', () => {
    it('sets due date on a task', async () => {
      const server = await getTestServer()
      const project = makeProject({
        tasks: [{ id: 'task-1', title: 'Task 1', completed: false, createdAt: new Date().toISOString() }]
      })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/tasks/task-1/due-date`,
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { dueDate: '2026-03-15' }
      })
      expect(res.statusCode).toBe(200)
      const task = res.json().data.find((p: any) => p.id === project.id).tasks[0]
      expect(task.dueDate).toBe('2026-03-15')
    })

    it('clears due date with null', async () => {
      const server = await getTestServer()
      const project = makeProject({
        tasks: [{ id: 'task-1', title: 'Task 1', completed: false, dueDate: '2026-03-15', createdAt: new Date().toISOString() }]
      })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/tasks/task-1/due-date`,
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { dueDate: null }
      })
      expect(res.statusCode).toBe(200)
      const task = res.json().data.find((p: any) => p.id === project.id).tasks[0]
      expect(task.dueDate).toBeNull()
    })

    it('returns 404 for unknown project', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/v1/projects/nonexistent/tasks/task-1/due-date',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { dueDate: '2026-03-15' }
      })
      expect(res.statusCode).toBe(404)
    })

    it('returns 404 for unknown task', async () => {
      const server = await getTestServer()
      const project = makeProject({ tasks: [] })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/tasks/nonexistent/due-date`,
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { dueDate: '2026-03-15' }
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('POST /projects/:pid/tasks/:tid/move', () => {
    it('moves task to another project', async () => {
      const server = await getTestServer()
      const p1 = makeProject({
        name: 'Source',
        tasks: [{ id: 'task-1', title: 'Movable', completed: false, createdAt: new Date().toISOString() }]
      })
      const p2 = makeProject({ name: 'Target', tasks: [] })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: p1 })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: p2 })

      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${p1.id}/tasks/task-1/move`,
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { toProjectId: p2.id }
      })
      expect(res.statusCode).toBe(200)
      const projects = res.json().data
      expect(projects.find((p: any) => p.id === p1.id).tasks).toHaveLength(0)
      expect(projects.find((p: any) => p.id === p2.id).tasks).toHaveLength(1)
      expect(projects.find((p: any) => p.id === p2.id).tasks[0].title).toBe('Movable')
    })

    it('returns 400 without toProjectId', async () => {
      const server = await getTestServer()
      const project = makeProject({
        tasks: [{ id: 'task-1', title: 'Task', completed: false, createdAt: new Date().toISOString() }]
      })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tasks/task-1/move`,
        headers: { ...auth, 'content-type': 'application/json' },
        payload: {}
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 400 when moving to same project', async () => {
      const server = await getTestServer()
      const project = makeProject({
        tasks: [{ id: 'task-1', title: 'Task', completed: false, createdAt: new Date().toISOString() }]
      })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tasks/task-1/move`,
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { toProjectId: project.id }
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for unknown source project', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/projects/nonexistent/tasks/task-1/move',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { toProjectId: 'other' }
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('PUT /projects/pinned-tasks/beyond-limit', () => {
    it('sets beyondLimit flag on tasks', async () => {
      const server = await getTestServer()
      const project = makeProject({
        tasks: [
          { id: 'task-1', title: 'T1', completed: false, isToDoNext: true, createdAt: new Date().toISOString() },
          { id: 'task-2', title: 'T2', completed: false, isToDoNext: true, createdAt: new Date().toISOString() }
        ]
      })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'PUT',
        url: '/api/v1/projects/pinned-tasks/beyond-limit',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: [
          { projectId: project.id, taskId: 'task-1', beyondLimit: true },
          { projectId: project.id, taskId: 'task-2', beyondLimit: false }
        ]
      })
      expect(res.statusCode).toBe(200)
      const tasks = res.json().data.find((p: any) => p.id === project.id).tasks
      expect(tasks.find((t: any) => t.id === 'task-1').beyondLimit).toBe(true)
      expect(tasks.find((t: any) => t.id === 'task-2').beyondLimit).toBeUndefined()
    })

    it('returns 400 for invalid payload', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/v1/projects/pinned-tasks/beyond-limit',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: 'not-an-array'
      })
      expect(res.statusCode).toBe(400)
    })
  })
})
