import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiClient } from '../src/lib/api-client'
import { okResponse, errorResponse } from './helpers'

/**
 * Tests for `top5 note <raw-id>` branching logic.
 *
 * The note command uses raw ID path when parseTaskCode returns null.
 * It should try quick task first, then fall back to project task.
 * We can't easily invoke Commander, so we replicate the core branching
 * logic using the same resolve + ApiClient calls the command uses.
 */

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const client = new ApiClient('http://127.0.0.1:15055', 'test-key')

const quickTasks = [
  { id: 'qt-aaa', taskNumber: 1, title: 'Quick One', completed: false },
  { id: 'qt-bbb', taskNumber: 2, title: 'Quick Two', completed: false },
]

const projects = [
  {
    id: 'p1',
    code: 'PRJ',
    name: 'Project',
    tasks: [
      { id: 'task-xxx', taskNumber: 1, title: 'Project Task', completed: false },
    ],
  },
]

const noteResult = { noteRef: 'ref-1', filePath: '/notes/test.md' }

// Replicate the raw-ID branching from notes.ts
async function resolveAndCreateNote(rawId: string) {
  const { resolveQuickTask, resolveProjectTask, parseTaskCode } = await import('../src/lib/resolve')

  const parsed = parseTaskCode(rawId)
  if (parsed) throw new Error('Expected raw ID, got parsed code')

  let quickTask: { id: string } | null = null
  try {
    quickTask = await resolveQuickTask(client, rawId)
  } catch {
    // not a quick task
  }

  if (quickTask) {
    return client.post(`/api/v1/quick-tasks/${quickTask.id}/note`)
  } else {
    const { project, task } = await resolveProjectTask(client, rawId)
    return client.post(`/api/v1/projects/${project.id}/tasks/${task.id}/note`)
  }
}

describe('top5 note <raw-id>', () => {
  it('resolves raw ID as quick task and calls quick-task note endpoint', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/quick-tasks') && !url.includes('/note')) {
        return okResponse(quickTasks)
      }
      if (url.includes('/api/v1/quick-tasks/qt-aaa/note')) {
        return okResponse(noteResult)
      }
      return errorResponse(404, 'not found')
    })

    const result = await resolveAndCreateNote('qt-aaa')
    expect(result).toEqual(noteResult)

    // Verify note endpoint was called for quick task
    const noteCalls = mockFetch.mock.calls.filter(([url]: [string]) =>
      url.includes('/note')
    )
    expect(noteCalls).toHaveLength(1)
    expect(noteCalls[0][0]).toContain('/api/v1/quick-tasks/qt-aaa/note')
  })

  it('falls back to project task when raw ID is not a quick task', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/quick-tasks') && !url.includes('/note')) {
        return okResponse([]) // no quick tasks — ID won't match
      }
      if (url.includes('/api/v1/projects') && !url.includes('/note')) {
        return okResponse(projects)
      }
      if (url.includes('/api/v1/projects/p1/tasks/task-xxx/note')) {
        return okResponse(noteResult)
      }
      return errorResponse(404, 'not found')
    })

    const result = await resolveAndCreateNote('task-xxx')
    expect(result).toEqual(noteResult)

    const noteCalls = mockFetch.mock.calls.filter(([url]: [string]) =>
      url.includes('/note')
    )
    expect(noteCalls).toHaveLength(1)
    expect(noteCalls[0][0]).toContain('/api/v1/projects/p1/tasks/task-xxx/note')
  })

  it('throws when raw ID is not found in quick tasks or project tasks', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/quick-tasks')) return okResponse([])
      if (url.includes('/api/v1/projects')) return okResponse(projects)
      return errorResponse(404, 'not found')
    })

    await expect(resolveAndCreateNote('nonexistent-id')).rejects.toThrow(
      'Task not found: nonexistent-id'
    )
  })

  it('does not mask note-creation errors as "task not found"', async () => {
    // Quick task resolves fine, but POST /note returns an API error
    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/quick-tasks') && opts?.method !== 'POST') {
        return okResponse(quickTasks)
      }
      if (url.includes('/api/v1/quick-tasks/qt-aaa/note')) {
        return errorResponse(400, 'no_obsidian_path')
      }
      return errorResponse(404, 'not found')
    })

    // Should throw the API error, NOT fall through to project task
    await expect(resolveAndCreateNote('qt-aaa')).rejects.toThrow('no_obsidian_path')

    // Verify it never tried the project task endpoint
    const projectCalls = mockFetch.mock.calls.filter(([url]: [string]) =>
      url.includes('/api/v1/projects')
    )
    expect(projectCalls).toHaveLength(0)
  })
})
