import { describe, it, expect } from 'vitest'
import { setupTestEnv, getTestServer, getTestApiKey } from './setup'

setupTestEnv()

const auth = { authorization: `Bearer ${getTestApiKey()}` }

function makeQuickTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'qt-' + Math.random().toString(36).slice(2, 8),
    title: 'Test Quick Task',
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: 0,
    ...overrides
  }
}

describe('Quick Tasks API', () => {
  it('GET /quick-tasks — empty list', async () => {
    const server = await getTestServer()
    const res = await server.inject({ method: 'GET', url: '/api/v1/quick-tasks', headers: auth })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([])
  })

  it('POST /quick-tasks — create', async () => {
    const server = await getTestServer()
    const task = makeQuickTask()
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/quick-tasks',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: task
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.length).toBe(1)
  })

  it('POST /quick-tasks — invalid data', async () => {
    const server = await getTestServer()
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/quick-tasks',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: { title: 'Missing fields' }
    })
    expect(res.statusCode).toBe(400)
  })

  it('PUT /quick-tasks/:id — update', async () => {
    const server = await getTestServer()
    const task = makeQuickTask()
    await server.inject({
      method: 'POST',
      url: '/api/v1/quick-tasks',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: task
    })
    const res = await server.inject({
      method: 'PUT',
      url: `/api/v1/quick-tasks/${task.id}`,
      headers: { ...auth, 'content-type': 'application/json' },
      payload: { ...task, title: 'Updated Title' }
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.find((t: any) => t.id === task.id).title).toBe('Updated Title')
  })

  it('DELETE /quick-tasks/:id', async () => {
    const server = await getTestServer()
    const task = makeQuickTask()
    await server.inject({
      method: 'POST',
      url: '/api/v1/quick-tasks',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: task
    })
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/v1/quick-tasks/${task.id}`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([])
  })

  it('complete / uncomplete cycle', async () => {
    const server = await getTestServer()
    const task = makeQuickTask()
    await server.inject({
      method: 'POST',
      url: '/api/v1/quick-tasks',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: task
    })

    let res = await server.inject({
      method: 'POST',
      url: `/api/v1/quick-tasks/${task.id}/complete`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.find((t: any) => t.id === task.id).completed).toBe(true)

    res = await server.inject({
      method: 'POST',
      url: `/api/v1/quick-tasks/${task.id}/uncomplete`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.find((t: any) => t.id === task.id).completed).toBe(false)
  })

  it('toggle-in-progress', async () => {
    const server = await getTestServer()
    const task = makeQuickTask()
    await server.inject({
      method: 'POST',
      url: '/api/v1/quick-tasks',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: task
    })
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/quick-tasks/${task.id}/toggle-in-progress`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.find((t: any) => t.id === task.id).inProgress).toBe(true)
  })

  it('PUT /quick-tasks/reorder', async () => {
    const server = await getTestServer()
    const t1 = makeQuickTask({ title: 'T1' })
    const t2 = makeQuickTask({ title: 'T2' })
    await server.inject({ method: 'POST', url: '/api/v1/quick-tasks', headers: { ...auth, 'content-type': 'application/json' }, payload: t1 })
    await server.inject({ method: 'POST', url: '/api/v1/quick-tasks', headers: { ...auth, 'content-type': 'application/json' }, payload: t2 })

    const res = await server.inject({
      method: 'PUT',
      url: '/api/v1/quick-tasks/reorder',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: [t2.id, t1.id]
    })
    expect(res.statusCode).toBe(200)
    const tasks = res.json().data
    expect(tasks.find((t: any) => t.id === t2.id).order).toBe(0)
    expect(tasks.find((t: any) => t.id === t1.id).order).toBe(1)
  })

  it('PUT /quick-tasks/beyond-limit — set flag on tasks', async () => {
    const server = await getTestServer()
    const t1 = makeQuickTask({ title: 'T1' })
    const t2 = makeQuickTask({ title: 'T2' })
    await server.inject({ method: 'POST', url: '/api/v1/quick-tasks', headers: { ...auth, 'content-type': 'application/json' }, payload: t1 })
    await server.inject({ method: 'POST', url: '/api/v1/quick-tasks', headers: { ...auth, 'content-type': 'application/json' }, payload: t2 })

    const res = await server.inject({
      method: 'PUT',
      url: '/api/v1/quick-tasks/beyond-limit',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: { ids: [t1.id, t2.id], beyondLimit: true }
    })
    expect(res.statusCode).toBe(200)
    const tasks = res.json().data
    expect(tasks.find((t: any) => t.id === t1.id).beyondLimit).toBe(true)
    expect(tasks.find((t: any) => t.id === t2.id).beyondLimit).toBe(true)
  })

  it('PUT /quick-tasks/beyond-limit — clears flag when false', async () => {
    const server = await getTestServer()
    const t1 = makeQuickTask({ title: 'T1', beyondLimit: true })
    await server.inject({ method: 'POST', url: '/api/v1/quick-tasks', headers: { ...auth, 'content-type': 'application/json' }, payload: t1 })

    const res = await server.inject({
      method: 'PUT',
      url: '/api/v1/quick-tasks/beyond-limit',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: { ids: [t1.id], beyondLimit: false }
    })
    expect(res.statusCode).toBe(200)
    const tasks = res.json().data
    expect(tasks.find((t: any) => t.id === t1.id).beyondLimit).toBeUndefined()
  })

  it('PUT /quick-tasks/beyond-limit — 400 for invalid payload', async () => {
    const server = await getTestServer()
    const res = await server.inject({
      method: 'PUT',
      url: '/api/v1/quick-tasks/beyond-limit',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: { ids: ['x'] } // missing beyondLimit
    })
    expect(res.statusCode).toBe(400)
  })

  it('PUT /quick-tasks/:id — not found', async () => {
    const server = await getTestServer()
    const res = await server.inject({
      method: 'PUT',
      url: '/api/v1/quick-tasks/nonexistent',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: makeQuickTask({ id: 'nonexistent' })
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /quick-tasks/:id — not found', async () => {
    const server = await getTestServer()
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/v1/quick-tasks/nonexistent',
      headers: auth
    })
    expect(res.statusCode).toBe(404)
  })
})
