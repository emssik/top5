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
})
