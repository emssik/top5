import { describe, it, expect } from 'vitest'
import { setupTestEnv, getTestServer, getTestApiKey } from './setup'

setupTestEnv()

const auth = { authorization: `Bearer ${getTestApiKey()}` }

function makeRepeatingTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rt-' + Math.random().toString(36).slice(2, 8),
    title: 'Test Repeating Task',
    schedule: { type: 'daily' },
    createdAt: new Date().toISOString(),
    lastCompletedAt: null,
    order: 0,
    acceptedCount: 0,
    dismissedCount: 0,
    completedCount: 0,
    ...overrides
  }
}

describe('Repeating Tasks API', () => {
  it('GET /repeating-tasks — empty list', async () => {
    const server = await getTestServer()
    const res = await server.inject({ method: 'GET', url: '/api/v1/repeating-tasks', headers: auth })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([])
  })

  it('POST /repeating-tasks — create', async () => {
    const server = await getTestServer()
    const task = makeRepeatingTask()
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/repeating-tasks',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: task
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.length).toBe(1)
  })

  it('POST /repeating-tasks — invalid data', async () => {
    const server = await getTestServer()
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/repeating-tasks',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: { title: 'Missing schedule' }
    })
    expect(res.statusCode).toBe(400)
  })

  it('PUT /repeating-tasks/:id — update', async () => {
    const server = await getTestServer()
    const task = makeRepeatingTask()
    await server.inject({
      method: 'POST',
      url: '/api/v1/repeating-tasks',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: task
    })
    const res = await server.inject({
      method: 'PUT',
      url: `/api/v1/repeating-tasks/${task.id}`,
      headers: { ...auth, 'content-type': 'application/json' },
      payload: { ...task, title: 'Updated' }
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.find((t: any) => t.id === task.id).title).toBe('Updated')
  })

  it('PUT /repeating-tasks/:id — not found', async () => {
    const server = await getTestServer()
    const res = await server.inject({
      method: 'PUT',
      url: '/api/v1/repeating-tasks/nonexistent',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: makeRepeatingTask({ id: 'nonexistent' })
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /repeating-tasks/:id', async () => {
    const server = await getTestServer()
    const task = makeRepeatingTask()
    await server.inject({
      method: 'POST',
      url: '/api/v1/repeating-tasks',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: task
    })
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/v1/repeating-tasks/${task.id}`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([])
  })

  it('PUT /repeating-tasks/reorder', async () => {
    const server = await getTestServer()
    const t1 = makeRepeatingTask({ title: 'R1' })
    const t2 = makeRepeatingTask({ title: 'R2' })
    await server.inject({ method: 'POST', url: '/api/v1/repeating-tasks', headers: { ...auth, 'content-type': 'application/json' }, payload: t1 })
    await server.inject({ method: 'POST', url: '/api/v1/repeating-tasks', headers: { ...auth, 'content-type': 'application/json' }, payload: t2 })

    const res = await server.inject({
      method: 'PUT',
      url: '/api/v1/repeating-tasks/reorder',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: [t2.id, t1.id]
    })
    expect(res.statusCode).toBe(200)
    const tasks = res.json().data
    expect(tasks.find((t: any) => t.id === t2.id).order).toBe(0)
  })

  it('POST /repeating-tasks/:id/accept — creates quick task', async () => {
    const server = await getTestServer()
    const task = makeRepeatingTask()
    await server.inject({
      method: 'POST',
      url: '/api/v1/repeating-tasks',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: task
    })
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/repeating-tasks/${task.id}/accept`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.quickTasks.length).toBe(1)
    expect(res.json().data.quickTasks[0].repeatingTaskId).toBe(task.id)
  })

  it('POST /repeating-tasks/:id/dismiss', async () => {
    const server = await getTestServer()
    const task = makeRepeatingTask()
    await server.inject({
      method: 'POST',
      url: '/api/v1/repeating-tasks',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: task
    })
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/repeating-tasks/${task.id}/dismiss`,
      headers: auth
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})
