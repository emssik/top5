import { describe, it, expect } from 'vitest'
import { setupTestEnv, getTestServer, getTestApiKey } from './setup'

setupTestEnv()

const auth = { authorization: `Bearer ${getTestApiKey()}` }

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-' + Math.random().toString(36).slice(2, 8),
    name: 'Focus Project',
    description: '',
    order: 0,
    deadline: null,
    totalTimeMs: 0,
    timerStartedAt: null,
    tasks: [],
    archivedAt: null,
    suspendedAt: null,
    code: 'FOC',
    ...overrides
  }
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-' + Math.random().toString(36).slice(2, 8),
    title: 'Focus Task',
    completed: false,
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

function makeQuickTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'qt-' + Math.random().toString(36).slice(2, 8),
    title: 'Quick Focus Task',
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: 0,
    ...overrides
  }
}

describe('Focus API', () => {
  describe('GET /api/v1/focus', () => {
    it('returns inactive status when no focus session', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/focus',
        headers: auth
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.ok).toBe(true)
      expect(body.data.active).toBe(false)
    })
  })

  describe('POST /api/v1/focus', () => {
    it('returns 400 when projectId is missing', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/focus',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { taskId: 'some-task' }
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('projectId and taskId are required')
    })

    it('returns 400 when taskId is missing', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/focus',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { projectId: 'some-project' }
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('projectId and taskId are required')
    })

    it('returns 400 when body is empty', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/focus',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: {}
      })

      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for unknown project', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/focus',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { projectId: 'nonexistent', taskId: 'some-task' }
      })

      expect(res.statusCode).toBe(404)
      expect(res.json().error).toBe('Project not found')
    })

    it('returns 404 for unknown task in existing project', async () => {
      const server = await getTestServer()
      const task = makeTask()
      const project = makeProject({ tasks: [task] })

      await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: project
      })

      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/focus',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { projectId: project.id, taskId: 'nonexistent-task' }
      })

      expect(res.statusCode).toBe(404)
      expect(res.json().error).toBe('Task not found in project')
    })

    it('returns 404 for unknown quick task', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/focus',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { projectId: '__standalone__', taskId: 'nonexistent-qt' }
      })

      expect(res.statusCode).toBe(404)
      expect(res.json().error).toBe('Quick task not found')
    })

    it('validates quick task exists for __standalone__ project', async () => {
      const server = await getTestServer()
      const qt = makeQuickTask()

      await server.inject({
        method: 'POST',
        url: '/api/v1/quick-tasks',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: qt
      })

      // enterFocusMode will fail (no main window in test), but validation passes
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/focus',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { projectId: '__standalone__', taskId: qt.id }
      })

      // 409 = enterFocusMode failed (no_main_window), not 404
      expect(res.statusCode).toBe(409)
      expect(res.json().error).toBe('no_main_window')
    })

    it('validates project task exists before entering focus', async () => {
      const server = await getTestServer()
      const task = makeTask()
      const project = makeProject({ tasks: [task] })

      await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: project
      })

      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/focus',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { projectId: project.id, taskId: task.id }
      })

      // 409 = enterFocusMode failed (no_main_window), not 404
      expect(res.statusCode).toBe(409)
      expect(res.json().error).toBe('no_main_window')
    })

    it('does not leak focusProjectId/focusTaskId into config on failure', async () => {
      const server = await getTestServer()
      const task = makeTask()
      const project = makeProject({ tasks: [task] })

      await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: project
      })

      // This will fail with no_main_window → config should be rolled back
      await server.inject({
        method: 'POST',
        url: '/api/v1/focus',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: { projectId: project.id, taskId: task.id }
      })

      // Verify config was rolled back
      const store = await import('../../src/main/store')
      const { config } = store.getAppData()
      expect(config.focusProjectId).toBeNull()
      expect(config.focusTaskId).toBeNull()
    })
  })

  describe('DELETE /api/v1/focus', () => {
    it('returns 409 when not in focus mode', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/v1/focus',
        headers: auth
      })

      expect(res.statusCode).toBe(409)
      expect(res.json().error).toBe('not_in_focus')
    })
  })
})
