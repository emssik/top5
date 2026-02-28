import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { setupTestEnv, getTestServer, getTestApiKey, getTestDir } from './setup'
import yaml from 'js-yaml'

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
    code: 'TST',
    ...overrides
  }
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-' + Math.random().toString(36).slice(2, 8),
    title: 'Test Task',
    completed: false,
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

function makeQuickTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'qt-' + Math.random().toString(36).slice(2, 8),
    title: 'Quick Test Task',
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: 0,
    ...overrides
  }
}

/** Set obsidianStoragePath in data.yaml config to a temp vault path */
async function setObsidianPath(vaultPath: string): Promise<void> {
  const dataPath = join(getTestDir(), 'data.yaml')
  const raw = readFileSync(dataPath, 'utf-8')
  const data = yaml.load(raw) as any
  data.config.obsidianStoragePath = vaultPath
  writeFileSync(dataPath, yaml.dump(data, { lineWidth: 120, noRefs: true }), 'utf-8')
  // Force re-read of data
  const store = await import('../../src/main/store')
  ;(store as any).reloadData?.()
  // If no reloadData, set config directly
  const currentData = store.getData()
  currentData.config.obsidianStoragePath = vaultPath
}

describe('Notes API', () => {
  let vaultPath: string

  beforeEach(async () => {
    vaultPath = join(getTestDir(), 'vault')
    mkdirSync(vaultPath, { recursive: true })
    await setObsidianPath(vaultPath)
  })

  describe('POST /projects/:pid/tasks/:tid/note', () => {
    it('creates note for a project task', async () => {
      const server = await getTestServer()
      const task = makeTask()
      const project = makeProject({ tasks: [task] })

      await server.inject({
        method: 'POST', url: '/api/v1/projects',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: project
      })

      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tasks/${task.id}/note`,
        headers: auth
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.ok).toBe(true)
      expect(body.data.noteRef).toMatch(/^top5\.storage\//)
      expect(body.data.filePath).toContain('.md')
      expect(existsSync(body.data.filePath)).toBe(true)
    })

    it('is idempotent — second call returns same data', async () => {
      const server = await getTestServer()
      const task = makeTask()
      const project = makeProject({ tasks: [task] })

      await server.inject({
        method: 'POST', url: '/api/v1/projects',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: project
      })

      const res1 = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tasks/${task.id}/note`,
        headers: auth
      })

      const res2 = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tasks/${task.id}/note`,
        headers: auth
      })

      expect(res1.json().data.noteRef).toBe(res2.json().data.noteRef)
      expect(res1.json().data.filePath).toBe(res2.json().data.filePath)
    })

    it('returns 404 for unknown project', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/projects/nonexistent/tasks/whatever/note',
        headers: auth
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().ok).toBe(false)
    })

    it('returns 404 for unknown task in existing project', async () => {
      const server = await getTestServer()
      const project = makeProject()

      await server.inject({
        method: 'POST', url: '/api/v1/projects',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: project
      })

      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tasks/nonexistent/note`,
        headers: auth
      })
      expect(res.statusCode).toBe(404)
    })

    it('returns 400 when obsidianStoragePath not configured', async () => {
      const server = await getTestServer()
      const task = makeTask()
      const project = makeProject({ tasks: [task] })

      await server.inject({
        method: 'POST', url: '/api/v1/projects',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: project
      })

      // Clear obsidian path
      const store = await import('../../src/main/store')
      const data = store.getData()
      data.config.obsidianStoragePath = undefined

      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tasks/${task.id}/note`,
        headers: auth
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('no_obsidian_path')
    })

    it('persists noteRef on the task', async () => {
      const server = await getTestServer()
      const task = makeTask()
      const project = makeProject({ tasks: [task] })

      await server.inject({
        method: 'POST', url: '/api/v1/projects',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: project
      })

      const noteRes = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tasks/${task.id}/note`,
        headers: auth
      })
      const noteRef = noteRes.json().data.noteRef

      // Fetch project and check noteRef is saved
      const getRes = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}`,
        headers: auth
      })
      const savedTask = getRes.json().data.tasks.find((t: any) => t.id === task.id)
      expect(savedTask.noteRef).toBe(noteRef)
    })
  })

  describe('POST /quick-tasks/:id/note', () => {
    it('creates note for a quick task', async () => {
      const server = await getTestServer()
      const qt = makeQuickTask()

      await server.inject({
        method: 'POST', url: '/api/v1/quick-tasks',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: qt
      })

      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/quick-tasks/${qt.id}/note`,
        headers: auth
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.ok).toBe(true)
      expect(body.data.noteRef).toMatch(/^top5\.storage\//)
      expect(body.data.filePath).toContain('.md')
      expect(existsSync(body.data.filePath)).toBe(true)
    })

    it('returns 404 for unknown quick task', async () => {
      const server = await getTestServer()
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/quick-tasks/nonexistent/note',
        headers: auth
      })
      expect(res.statusCode).toBe(404)
    })

    it('persists noteRef on the quick task', async () => {
      const server = await getTestServer()
      const qt = makeQuickTask()

      await server.inject({
        method: 'POST', url: '/api/v1/quick-tasks',
        headers: { ...auth, 'content-type': 'application/json' },
        payload: qt
      })

      const noteRes = await server.inject({
        method: 'POST',
        url: `/api/v1/quick-tasks/${qt.id}/note`,
        headers: auth
      })
      const noteRef = noteRes.json().data.noteRef

      // Fetch quick tasks and check noteRef is saved
      const getRes = await server.inject({
        method: 'GET',
        url: '/api/v1/quick-tasks',
        headers: auth
      })
      const savedQt = getRes.json().data.find((t: any) => t.id === qt.id)
      expect(savedQt.noteRef).toBe(noteRef)
    })
  })
})
