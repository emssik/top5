import { describe, it, expect } from 'vitest'
import { setupTestEnv, getTestServer, getTestApiKey } from './setup'

setupTestEnv()

const auth = { authorization: `Bearer ${getTestApiKey()}` }

function makeQuickTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'qt-' + Math.random().toString(36).slice(2, 8),
    title: 'Quick',
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: 0,
    ...overrides
  }
}

async function seedQuickTasks(server: Awaited<ReturnType<typeof getTestServer>>, tasks: ReturnType<typeof makeQuickTask>[]) {
  for (const t of tasks) {
    await server.inject({
      method: 'POST',
      url: '/api/v1/quick-tasks',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: t
    })
  }
}

describe('POST /today/beyond-limit', () => {
  it('marks only target when there is no natural overflow', async () => {
    const server = await getTestServer()
    const t1 = makeQuickTask({ title: 'T1', order: 0 })
    const t2 = makeQuickTask({ title: 'T2', order: 1 })
    await seedQuickTasks(server, [t1, t2])

    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/today/beyond-limit',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: { quickTaskIds: [t1.id], beyondLimit: true }
    })
    expect(res.statusCode).toBe(200)

    const all = await server.inject({ method: 'GET', url: '/api/v1/quick-tasks', headers: auth })
    const tasks = all.json().data
    expect(tasks.find((t: any) => t.id === t1.id).beyondLimit).toBe(true)
    expect(tasks.find((t: any) => t.id === t2.id).beyondLimit).toBeUndefined()
  })

  it('freezes natural overflow when pushing a task beyond the limit', async () => {
    const server = await getTestServer()
    // Limit is 5 in test setup. Create 7 quick tasks → 5 in limit, 2 natural overflow.
    const tasks = Array.from({ length: 7 }, (_, i) =>
      makeQuickTask({ title: `T${i + 1}`, order: i })
    )
    await seedQuickTasks(server, tasks)

    // Push T1 (in-limit) beyond — natural overflow (T6, T7) should also freeze.
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/today/beyond-limit',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: { quickTaskIds: [tasks[0].id], beyondLimit: true }
    })
    expect(res.statusCode).toBe(200)

    const all = await server.inject({ method: 'GET', url: '/api/v1/quick-tasks', headers: auth })
    const saved = all.json().data
    expect(saved.find((t: any) => t.id === tasks[0].id).beyondLimit).toBe(true) // target
    expect(saved.find((t: any) => t.id === tasks[5].id).beyondLimit).toBe(true) // was natural
    expect(saved.find((t: any) => t.id === tasks[6].id).beyondLimit).toBe(true) // was natural
    // In-limit tasks (T2..T5) must not be affected
    expect(saved.find((t: any) => t.id === tasks[1].id).beyondLimit).toBeUndefined()
    expect(saved.find((t: any) => t.id === tasks[2].id).beyondLimit).toBeUndefined()
  })

  it('does not auto-touch other tasks when pulling a task back (beyondLimit=false)', async () => {
    const server = await getTestServer()
    const tasks = Array.from({ length: 7 }, (_, i) =>
      makeQuickTask({ title: `T${i + 1}`, order: i, beyondLimit: i === 0 || i >= 5 ? true : undefined })
    )
    await seedQuickTasks(server, tasks)

    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/today/beyond-limit',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: { quickTaskIds: [tasks[0].id], beyondLimit: false }
    })
    expect(res.statusCode).toBe(200)

    const all = await server.inject({ method: 'GET', url: '/api/v1/quick-tasks', headers: auth })
    const saved = all.json().data
    expect(saved.find((t: any) => t.id === tasks[0].id).beyondLimit).toBeUndefined()
    // Previously-forced tasks stay forced
    expect(saved.find((t: any) => t.id === tasks[5].id).beyondLimit).toBe(true)
    expect(saved.find((t: any) => t.id === tasks[6].id).beyondLimit).toBe(true)
  })

  it('returns 400 when beyondLimit is missing', async () => {
    const server = await getTestServer()
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/today/beyond-limit',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: { quickTaskIds: ['x'] }
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when no targets provided', async () => {
    const server = await getTestServer()
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/today/beyond-limit',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: { beyondLimit: true }
    })
    expect(res.statusCode).toBe(400)
  })
})
