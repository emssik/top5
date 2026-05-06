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

  it('toggle-important', async () => {
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
      url: `/api/v1/projects/${project.id}/tasks/task-1/toggle-important`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    let p = res.json().data.find((p: any) => p.id === project.id)
    expect(p.tasks[0].important).toBe(true)

    // toggle off
    res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/tasks/task-1/toggle-important`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    p = res.json().data.find((p: any) => p.id === project.id)
    expect(p.tasks[0].important).toBe(false)

    // 404 for unknown task
    res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/tasks/task-missing/toggle-important`,
      headers: auth
    })
    expect(res.statusCode).toBe(404)
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

  describe('PUT /projects/:pid/tasks/:tid/cycle-role', () => {
    it('sets cycle role on a task', async () => {
      const server = await getTestServer()
      const project = makeProject({
        tasks: [{ id: 'task-1', title: 'Task 1', completed: false, createdAt: new Date().toISOString() }]
      })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/tasks/task-1/cycle-role`,
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { cycleRole: 'must' }
      })
      expect(res.statusCode).toBe(200)
      const task = res.json().data.find((p: any) => p.id === project.id).tasks[0]
      expect(task.cycleRole).toBe('must')
    })

    it('clears cycle role with null', async () => {
      const server = await getTestServer()
      const project = makeProject({
        tasks: [{ id: 'task-1', title: 'Task 1', completed: false, cycleRole: 'should', createdAt: new Date().toISOString() }]
      })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/tasks/task-1/cycle-role`,
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { cycleRole: null }
      })
      expect(res.statusCode).toBe(200)
      const task = res.json().data.find((p: any) => p.id === project.id).tasks[0]
      expect(task.cycleRole).toBeUndefined()
    })

    it('rejects invalid role with 400', async () => {
      const server = await getTestServer()
      const project = makeProject({
        tasks: [{ id: 'task-1', title: 'Task 1', completed: false, createdAt: new Date().toISOString() }]
      })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/tasks/task-1/cycle-role`,
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { cycleRole: 'bogus' }
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for unknown task', async () => {
      const server = await getTestServer()
      const project = makeProject({ tasks: [] })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/tasks/nonexistent/cycle-role`,
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { cycleRole: 'must' }
      })
      expect(res.statusCode).toBe(404)
    })

    it('persists cycle role across full project update', async () => {
      const server = await getTestServer()
      const project = makeProject({
        tasks: [{ id: 'task-1', title: 'Task 1', completed: false, createdAt: new Date().toISOString() }]
      })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/tasks/task-1/cycle-role`,
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { cycleRole: 'could' }
      })

      const res = await server.inject({ method: 'GET', url: `/api/v1/projects/${project.id}`, headers: auth })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.tasks[0].cycleRole).toBe('could')
    })
  })

  describe('POST /cycle/reset', () => {
    it('clears cycleRole on all tasks across projects', async () => {
      const server = await getTestServer()
      const p1 = makeProject({
        name: 'P1',
        tasks: [
          { id: 't1', title: 'T1', completed: false, cycleRole: 'must', createdAt: new Date().toISOString() },
          { id: 't2', title: 'T2', completed: true, cycleRole: 'should', createdAt: new Date().toISOString() }
        ]
      })
      const p2 = makeProject({
        name: 'P2',
        tasks: [
          { id: 't3', title: 'T3', completed: false, cycleRole: 'could', createdAt: new Date().toISOString() },
          { id: 't4', title: 'T4', completed: false, createdAt: new Date().toISOString() }
        ]
      })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: p1 })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: p2 })

      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/cycle/reset',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: {}
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.cleared).toBe(3)

      const verify = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: auth })
      const projects = verify.json().data
      for (const p of projects) {
        for (const t of p.tasks) {
          expect(t.cycleRole).toBeUndefined()
        }
      }
    })

    it('clears only the specified layer', async () => {
      const server = await getTestServer()
      const project = makeProject({
        tasks: [
          { id: 't1', title: 'T1', completed: false, cycleRole: 'must', createdAt: new Date().toISOString() },
          { id: 't2', title: 'T2', completed: false, cycleRole: 'should', createdAt: new Date().toISOString() },
          { id: 't3', title: 'T3', completed: false, cycleRole: 'could', createdAt: new Date().toISOString() }
        ]
      })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/cycle/reset',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { layer: 'should' }
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.cleared).toBe(1)

      const verify = await server.inject({ method: 'GET', url: `/api/v1/projects/${project.id}`, headers: auth })
      const tasks = verify.json().data.tasks
      expect(tasks.find((t: any) => t.id === 't1').cycleRole).toBe('must')
      expect(tasks.find((t: any) => t.id === 't2').cycleRole).toBeUndefined()
      expect(tasks.find((t: any) => t.id === 't3').cycleRole).toBe('could')
    })

    it('returns cleared=0 when no tasks have cycleRole', async () => {
      const server = await getTestServer()
      const project = makeProject({
        tasks: [{ id: 't1', title: 'T1', completed: false, createdAt: new Date().toISOString() }]
      })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/cycle/reset',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: {}
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.cleared).toBe(0)
    })

    it('rejects invalid layer with 400', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/cycle/reset',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { layer: 'bogus' }
      })
      expect(res.statusCode).toBe(400)
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

  describe('DELETE /projects/:pid/tasks/:tid', () => {
    it('deletes a task from a project', async () => {
      const server = await getTestServer()
      const project = makeProject({
        tasks: [
          { id: 'task-1', title: 'Keep', completed: false, createdAt: new Date().toISOString() },
          { id: 'task-2', title: 'Remove', completed: false, createdAt: new Date().toISOString() }
        ]
      })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}/tasks/task-2`,
        headers: auth
      })
      expect(res.statusCode).toBe(200)
      const tasks = res.json().data.find((p: any) => p.id === project.id).tasks
      expect(tasks).toHaveLength(1)
      expect(tasks[0].id).toBe('task-1')
    })

    it('returns 404 for unknown project', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/v1/projects/nonexistent/tasks/task-1',
        headers: auth
      })
      expect(res.statusCode).toBe(404)
    })

    it('returns 404 for unknown task', async () => {
      const server = await getTestServer()
      const project = makeProject({ tasks: [] })
      await server.inject({ method: 'POST', url: '/api/v1/projects', headers: { ...auth, 'content-type': 'application/json' }, payload: project })

      const res = await server.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}/tasks/nonexistent`,
        headers: auth
      })
      expect(res.statusCode).toBe(404)
    })
  })
})
