import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiClient } from '../src/lib/api-client'
import { okResponse, errorResponse } from './helpers'

/**
 * Tests for `top5 add` JSON output — verifies that notePath and pinned
 * fields are included when --note / --pin succeed.
 *
 * Replicates the core result-building logic from tasks.ts (lines 113-149)
 * using the same ApiClient calls the command uses.
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

const project = {
  id: 'p1',
  code: 'PRJ',
  name: 'Project',
  tasks: [] as Array<{ id: string; taskNumber?: number; title: string; completed: boolean }>,
}

const savedTask = {
  id: 'task-new',
  title: 'Test task',
  taskNumber: 5,
  completed: false,
  createdAt: '2026-04-01T00:00:00.000Z',
}

const noteResult = { noteRef: 'top5.storage/Project/PRJ-5 Test task', filePath: '/vault/top5.storage/Project/PRJ-5 Test task.md' }

/**
 * Replicate the result-building logic from tasks.ts add command.
 * Takes the same flags the command accepts.
 */
async function buildAddResult(opts: { pin?: boolean; note?: boolean }) {
  // Simulate PUT project → server returns project with savedTask
  const putResult = [{ ...project, tasks: [savedTask] }]
  const savedProject = putResult.find((p) => p.id === project.id)
  const task = savedProject?.tasks.find((t) => t.id === savedTask.id)

  let pinned = false
  if (opts.pin && task) {
    try {
      await client.post(`/api/v1/projects/${project.id}/tasks/${task.id}/toggle-to-do-next`)
      pinned = true
    } catch {
      // pin failed — pinned stays false
    }
  }

  let notePath: string | undefined
  if (opts.note && task) {
    try {
      const result = await client.post<{ noteRef: string; filePath: string }>(
        `/api/v1/projects/${project.id}/tasks/${task.id}/note`
      )
      notePath = result.filePath
    } catch {
      // note failed — notePath stays undefined
    }
  }

  return {
    ...(task ?? savedTask),
    ...(notePath ? { notePath } : {}),
    ...(pinned ? { pinned } : {}),
  }
}

describe('top5 add --json result data', () => {
  it('includes notePath when --note succeeds', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/note')) return okResponse(noteResult)
      return errorResponse(404, 'not found')
    })

    const result = await buildAddResult({ note: true })

    expect(result.notePath).toBe(noteResult.filePath)
    expect(result).not.toHaveProperty('pinned')
  })

  it('includes pinned when --pin succeeds', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/toggle-to-do-next')) return okResponse([])
      return errorResponse(404, 'not found')
    })

    const result = await buildAddResult({ pin: true })

    expect(result.pinned).toBe(true)
    expect(result).not.toHaveProperty('notePath')
  })

  it('includes both notePath and pinned when both succeed', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/toggle-to-do-next')) return okResponse([])
      if (url.includes('/note')) return okResponse(noteResult)
      return errorResponse(404, 'not found')
    })

    const result = await buildAddResult({ note: true, pin: true })

    expect(result.notePath).toBe(noteResult.filePath)
    expect(result.pinned).toBe(true)
  })

  it('omits notePath when --note fails', async () => {
    mockFetch.mockImplementation(async () => {
      return errorResponse(400, 'no_obsidian_path')
    })

    const result = await buildAddResult({ note: true })

    expect(result).not.toHaveProperty('notePath')
  })

  it('omits pinned when --pin fails', async () => {
    mockFetch.mockImplementation(async () => {
      return errorResponse(500, 'server error')
    })

    const result = await buildAddResult({ pin: true })

    expect(result).not.toHaveProperty('pinned')
  })

  it('has no extra fields without --note or --pin', async () => {
    const result = await buildAddResult({})

    expect(result).not.toHaveProperty('notePath')
    expect(result).not.toHaveProperty('pinned')
    expect(result.id).toBe(savedTask.id)
    expect(result.title).toBe(savedTask.title)
    expect(result.taskNumber).toBe(savedTask.taskNumber)
  })

  it('includes pinned but omits notePath when --pin succeeds but --note fails', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/toggle-to-do-next')) return okResponse([])
      if (url.includes('/note')) return errorResponse(400, 'no_obsidian_path')
      return errorResponse(404, 'not found')
    })

    const result = await buildAddResult({ note: true, pin: true })

    expect(result.pinned).toBe(true)
    expect(result).not.toHaveProperty('notePath')
  })
})
