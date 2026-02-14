import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import yaml from 'js-yaml'

let testDir: string
let _server: FastifyInstance | null = null

const TEST_API_KEY = 'top5_test-key-12345'

export function getTestDir(): string {
  return testDir
}

export function getTestApiKey(): string {
  return TEST_API_KEY
}

export async function getTestServer(): Promise<FastifyInstance> {
  if (_server) return _server
  // Dynamic import AFTER env is set
  const { createTestServer } = await import('../../src/main/api/server')
  _server = createTestServer()
  await _server.ready()
  return _server
}

export function setupTestEnv(): void {
  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), 'top5-test-'))
    process.env.TOP5_DATA_DIR = testDir
    // Write initial data.yaml with apiConfig
    const initialData = {
      projects: [],
      quickTasks: [],
      quickNotes: '',
      repeatingTasks: [],
      dismissedRepeating: [],
      dismissedRepeatingDate: '',
      config: {
        globalShortcut: 'CommandOrControl+Shift+Space',
        actionShortcuts: {
          'toggle-app': 'CommandOrControl+Shift+Space',
          'project-1': 'CommandOrControl+1',
          'project-2': 'CommandOrControl+2',
          'project-3': 'CommandOrControl+3',
          'project-4': 'CommandOrControl+4',
          'project-5': 'CommandOrControl+5',
          'toggle-focus': 'CommandOrControl+Shift+F',
          'quick-notes': 'CommandOrControl+Shift+N'
        },
        focusTaskId: null,
        focusProjectId: null,
        compactMode: false,
        cleanView: false,
        theme: 'dark',
        quickTasksLimit: 5,
        activeProjectsLimit: 5,
        cleanViewFont: 'Caveat'
      },
      apiConfig: {
        enabled: true,
        apiKey: TEST_API_KEY,
        port: 15055
      }
    }
    writeFileSync(join(testDir, 'data.yaml'), yaml.dump(initialData, { lineWidth: 120, noRefs: true }), 'utf-8')
  })

  beforeEach(async () => {
    // Reset data to clean state
    const initialData = {
      projects: [],
      quickTasks: [],
      quickNotes: '',
      repeatingTasks: [],
      dismissedRepeating: [],
      dismissedRepeatingDate: '',
      config: {
        globalShortcut: 'CommandOrControl+Shift+Space',
        actionShortcuts: {
          'toggle-app': 'CommandOrControl+Shift+Space',
          'project-1': 'CommandOrControl+1',
          'project-2': 'CommandOrControl+2',
          'project-3': 'CommandOrControl+3',
          'project-4': 'CommandOrControl+4',
          'project-5': 'CommandOrControl+5',
          'toggle-focus': 'CommandOrControl+Shift+F',
          'quick-notes': 'CommandOrControl+Shift+N'
        },
        focusTaskId: null,
        focusProjectId: null,
        compactMode: false,
        cleanView: false,
        theme: 'dark',
        quickTasksLimit: 5,
        activeProjectsLimit: 5,
        cleanViewFont: 'Caveat'
      },
      apiConfig: {
        enabled: true,
        apiKey: TEST_API_KEY,
        port: 15055
      }
    }
    writeFileSync(join(testDir, 'data.yaml'), yaml.dump(initialData, { lineWidth: 120, noRefs: true }), 'utf-8')

    // Force reload of cached data by clearing the module cache
    // This is needed because store.ts caches data in memory
    const store = await import('../../src/main/store')
    // Reset in-memory cache by setting data through the public API
    const data = store.getAppData()
    // The cache will be stale, but the file is fresh — we need to invalidate
    // We'll do this by calling getData which re-reads on cache miss
    // Actually, we need a way to reset the cache. Let's use setData to force it.
    store.setData('projects', [])
    store.setData('quickTasks', [])
    store.setData('repeatingTasks', [])
    store.setData('dismissedRepeating', [])
    store.setData('dismissedRepeatingDate', '')

    // Reset server instance for fresh routes
    if (_server) {
      await _server.close()
      _server = null
    }
  })

  afterAll(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true })
    }
    delete process.env.TOP5_DATA_DIR
  })
}
