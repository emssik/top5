import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseTaskCode, resolveProject, resolveProjectTask, resolveQuickTask } from '../src/lib/resolve'
import { ApiClient } from '../src/lib/api-client'
import { okResponse } from './helpers'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const client = new ApiClient('http://127.0.0.1:15055', 'test-key')

describe('parseTaskCode', () => {
  it('parses PRJ-3 into projectCode and taskNumber', () => {
    const result = parseTaskCode('PRJ-3')
    expect(result).toEqual({ projectCode: 'PRJ', taskNumber: 3 })
  })

  it('parses lowercase codes (case-insensitive project code)', () => {
    const result = parseTaskCode('prj-3')
    expect(result).toEqual({ projectCode: 'PRJ', taskNumber: 3 })
  })

  it('parses QT-5', () => {
    const result = parseTaskCode('QT-5')
    expect(result).toEqual({ projectCode: 'QT', taskNumber: 5 })
  })

  it('parses multi-letter codes', () => {
    const result = parseTaskCode('MYAPP-12')
    expect(result).toEqual({ projectCode: 'MYAPP', taskNumber: 12 })
  })

  it('returns null for UUID-like strings', () => {
    expect(parseTaskCode('550e8400-e29b-41d4-a716-446655440000')).toBeNull()
  })

  it('returns null for plain text', () => {
    expect(parseTaskCode('hello')).toBeNull()
  })

  it('returns null for numbers only', () => {
    expect(parseTaskCode('123')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseTaskCode('')).toBeNull()
  })

  it('returns null for code without number', () => {
    expect(parseTaskCode('PRJ-')).toBeNull()
  })

  it('returns null for number without code', () => {
    expect(parseTaskCode('-3')).toBeNull()
  })

  it('handles single letter codes', () => {
    const result = parseTaskCode('A-1')
    expect(result).toEqual({ projectCode: 'A', taskNumber: 1 })
  })
})

describe('resolveProject', () => {
  const projects = [
    { id: 'id-1', code: 'PRJ', name: 'Project', tasks: [] },
    { id: 'id-2', code: 'APP', name: 'App', tasks: [] },
    { id: 'id-3', name: 'No Code', tasks: [] },
  ]

  it('finds project by code (case-insensitive)', async () => {
    mockFetch.mockResolvedValue(okResponse(projects))
    const result = await resolveProject(client, 'prj')
    expect(result.id).toBe('id-1')
    expect(result.name).toBe('Project')
  })

  it('finds project by code (uppercase)', async () => {
    mockFetch.mockResolvedValue(okResponse(projects))
    const result = await resolveProject(client, 'APP')
    expect(result.id).toBe('id-2')
  })

  it('finds project by ID', async () => {
    mockFetch.mockResolvedValue(okResponse(projects))
    const result = await resolveProject(client, 'id-3')
    expect(result.id).toBe('id-3')
    expect(result.name).toBe('No Code')
  })

  it('prefers code match over ID match', async () => {
    // Project with code "ABC" and another project with id "abc"
    const ambiguous = [
      { id: 'x', code: 'ABC', name: 'By Code', tasks: [] },
      { id: 'abc', name: 'By ID', tasks: [] },
    ]
    mockFetch.mockResolvedValue(okResponse(ambiguous))
    const result = await resolveProject(client, 'abc')
    expect(result.name).toBe('By Code') // code match wins
  })

  it('throws when project not found', async () => {
    mockFetch.mockResolvedValue(okResponse(projects))
    await expect(resolveProject(client, 'NOPE')).rejects.toThrow('Project not found: NOPE')
  })
})

describe('resolveProjectTask', () => {
  const projects = [
    {
      id: 'p1',
      code: 'PRJ',
      name: 'Project',
      tasks: [
        { id: 't1', taskNumber: 1, title: 'First', completed: false },
        { id: 't2', taskNumber: 2, title: 'Second', completed: true },
      ],
    },
    {
      id: 'p2',
      code: 'APP',
      name: 'App',
      tasks: [
        { id: 't3', taskNumber: 1, title: 'App Task', completed: false },
      ],
    },
  ]

  it('resolves by task code PRJ-1', async () => {
    mockFetch.mockResolvedValue(okResponse(projects))
    const result = await resolveProjectTask(client, 'PRJ-1')
    expect(result.project.id).toBe('p1')
    expect(result.task.id).toBe('t1')
    expect(result.task.title).toBe('First')
  })

  it('resolves by task code PRJ-2', async () => {
    mockFetch.mockResolvedValue(okResponse(projects))
    const result = await resolveProjectTask(client, 'PRJ-2')
    expect(result.project.id).toBe('p1')
    expect(result.task.id).toBe('t2')
    expect(result.task.title).toBe('Second')
  })

  it('resolves case-insensitively prj-1', async () => {
    mockFetch.mockResolvedValue(okResponse(projects))
    const result = await resolveProjectTask(client, 'prj-1')
    expect(result.task.title).toBe('First')
  })

  it('resolves from different project APP-1', async () => {
    mockFetch.mockResolvedValue(okResponse(projects))
    const result = await resolveProjectTask(client, 'APP-1')
    expect(result.project.id).toBe('p2')
    expect(result.task.title).toBe('App Task')
  })

  it('falls back to raw task ID across projects', async () => {
    mockFetch.mockResolvedValue(okResponse(projects))
    const result = await resolveProjectTask(client, 't3')
    expect(result.project.id).toBe('p2')
    expect(result.task.id).toBe('t3')
  })

  it('throws when task code exists but task number not found', async () => {
    mockFetch.mockResolvedValue(okResponse(projects))
    await expect(resolveProjectTask(client, 'PRJ-99')).rejects.toThrow('Task PRJ-99 not found')
  })

  it('throws when raw ID not found in any project', async () => {
    mockFetch.mockResolvedValue(okResponse(projects))
    await expect(resolveProjectTask(client, 'nonexistent-id')).rejects.toThrow('Task not found: nonexistent-id')
  })
})

describe('resolveQuickTask', () => {
  const quickTasks = [
    { id: 'qt-a', taskNumber: 1, title: 'Buy groceries', completed: false },
    { id: 'qt-b', taskNumber: 2, title: 'Call dentist', completed: true },
    { id: 'qt-c', taskNumber: 3, title: 'Read book', completed: false },
  ]

  it('resolves by QT-1 code', async () => {
    mockFetch.mockResolvedValue(okResponse(quickTasks))
    const result = await resolveQuickTask(client, 'QT-1')
    expect(result.id).toBe('qt-a')
    expect(result.title).toBe('Buy groceries')
  })

  it('resolves by QT-2 code', async () => {
    mockFetch.mockResolvedValue(okResponse(quickTasks))
    const result = await resolveQuickTask(client, 'QT-2')
    expect(result.id).toBe('qt-b')
    expect(result.title).toBe('Call dentist')
  })

  it('is case-insensitive for QT prefix', async () => {
    mockFetch.mockResolvedValue(okResponse(quickTasks))
    const result = await resolveQuickTask(client, 'qt-3')
    expect(result.id).toBe('qt-c')
  })

  it('falls back to raw ID', async () => {
    mockFetch.mockResolvedValue(okResponse(quickTasks))
    const result = await resolveQuickTask(client, 'qt-b')
    expect(result.id).toBe('qt-b')
    expect(result.title).toBe('Call dentist')
  })

  it('throws when QT code not found', async () => {
    mockFetch.mockResolvedValue(okResponse(quickTasks))
    await expect(resolveQuickTask(client, 'QT-99')).rejects.toThrow('Quick task QT-99 not found')
  })

  it('throws when raw ID not found', async () => {
    mockFetch.mockResolvedValue(okResponse(quickTasks))
    await expect(resolveQuickTask(client, 'nonexistent')).rejects.toThrow('Quick task not found: nonexistent')
  })

  it('non-QT task code falls back to ID lookup', async () => {
    mockFetch.mockResolvedValue(okResponse(quickTasks))
    // PRJ-3 is not a QT code, so it should try ID lookup
    await expect(resolveQuickTask(client, 'PRJ-3')).rejects.toThrow('Quick task not found: PRJ-3')
  })
})
