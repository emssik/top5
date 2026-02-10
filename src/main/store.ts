import { dialog, app } from 'electron'
import type { IpcMain } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, basename, relative, join } from 'path'
import { homedir } from 'os'
import yaml from 'js-yaml'

interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: string
}

interface Project {
  id: string
  name: string
  description: string
  order: number
  deadline: string | null
  totalTimeMs: number
  timerStartedAt: string | null
  launchers: {
    vscode: string | null
    iterm: string | null
    obsidian: string | null
    browser: string | null
  }
  tasks: Task[]
  archivedAt: string | null
}

interface AppConfig {
  globalShortcut: string
  actionShortcuts: Record<string, string>
  focusTaskId: string | null
  focusProjectId: string | null
  compactMode: boolean
}

interface FocusCheckIn {
  id: string
  projectId: string
  taskId: string
  timestamp: string
  response: 'yes' | 'no' | 'a_little'
}

interface AppData {
  projects: Project[]
  quickNotes: string
  config: AppConfig
  focusCheckIns: FocusCheckIn[]
}

const defaultData: AppData = {
  projects: [],
  quickNotes: '',
  focusCheckIns: [],
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
    compactMode: false
  }
}

const CONFIG_DIR = join(homedir(), '.config', 'top5')
const DATA_FILE = join(CONFIG_DIR, 'data.yaml')

function loadData(): AppData {
  if (!existsSync(DATA_FILE)) {
    migrateFromElectronStore()
    if (!existsSync(DATA_FILE)) {
      saveData(defaultData)
      return { ...defaultData }
    }
  }
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8')
    const parsed = yaml.load(raw) as Partial<AppData> | null
    return {
      projects: parsed?.projects ?? defaultData.projects,
      quickNotes: parsed?.quickNotes ?? defaultData.quickNotes,
      focusCheckIns: parsed?.focusCheckIns ?? [],
      config: { ...defaultData.config, ...parsed?.config }
    }
  } catch {
    return { ...defaultData }
  }
}

function saveData(data: AppData): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(DATA_FILE, yaml.dump(data, { lineWidth: 120, noRefs: true }), 'utf-8')
}

function migrateFromElectronStore(): void {
  try {
    const electronStoreFile = join(app.getPath('userData'), 'config.json')
    if (!existsSync(electronStoreFile)) return
    const raw = readFileSync(electronStoreFile, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppData>
    const data: AppData = {
      projects: parsed.projects ?? defaultData.projects,
      quickNotes: parsed.quickNotes ?? defaultData.quickNotes,
      focusCheckIns: (parsed as any).focusCheckIns ?? [],
      config: { ...defaultData.config, ...parsed.config }
    }
    saveData(data)
  } catch {
    // Migration failed — start fresh
  }
}

// In-memory cache
let cachedData: AppData | null = null

function getData(): AppData {
  if (!cachedData) cachedData = loadData()
  return cachedData
}

function setData(key: keyof AppData, value: AppData[keyof AppData]): void {
  const data = getData()
  ;(data as any)[key] = value
  cachedData = data
  saveData(data)
}

export function getAppData(): AppData {
  return getData()
}

export function setAppDataKey(key: keyof AppData, value: AppData[keyof AppData]): void {
  setData(key, value)
}

export function registerStoreHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('get-app-data', () => {
    return getData()
  })

  ipcMain.handle('save-project', (_event, project: Project) => {
    const data = getData()
    const projects = [...data.projects]
    const index = projects.findIndex((p) => p.id === project.id)
    if (index >= 0) {
      projects[index] = project
    } else {
      projects.push(project)
    }
    setData('projects', projects)
    return projects
  })

  ipcMain.handle('delete-project', (_event, projectId: string) => {
    const data = getData()
    const projects = data.projects.filter((p) => p.id !== projectId)
    setData('projects', projects)
    return projects
  })

  ipcMain.handle('save-quick-notes', (_event, notes: string) => {
    setData('quickNotes', notes)
  })

  ipcMain.handle('save-config', (_event, config: AppConfig) => {
    setData('config', config)
  })

  ipcMain.handle(
    'update-project-timer',
    (_event, projectId: string, totalTimeMs: number, timerStartedAt: string | null) => {
      const data = getData()
      const projects = [...data.projects]
      const project = projects.find((p) => p.id === projectId)
      if (project) {
        project.totalTimeMs = totalTimeMs
        project.timerStartedAt = timerStartedAt
        setData('projects', projects)
      }
      return projects
    }
  )

  ipcMain.handle('archive-project', (_event, projectId: string) => {
    const data = getData()
    const projects = [...data.projects]
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      // Stop timer if running
      if (project.timerStartedAt) {
        const elapsed = Date.now() - new Date(project.timerStartedAt).getTime()
        project.totalTimeMs += elapsed
        project.timerStartedAt = null
      }
      project.archivedAt = new Date().toISOString()
      setData('projects', projects)
    }
    return projects
  })

  ipcMain.handle('unarchive-project', (_event, projectId: string) => {
    const data = getData()
    const projects = [...data.projects]
    const activeProjects = projects.filter((p) => !p.archivedAt)
    if (activeProjects.length >= 5) {
      return { error: 'Cannot restore: 5 active projects already. Archive one first.' }
    }
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      project.archivedAt = null
      // Assign next available order
      const usedOrders = activeProjects.map((p) => p.order)
      let nextOrder = 0
      while (usedOrders.includes(nextOrder)) nextOrder++
      project.order = nextOrder
      setData('projects', projects)
    }
    return { projects }
  })

  ipcMain.handle('pick-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle('save-focus-checkin', (_event, checkIn: FocusCheckIn) => {
    const data = getData()
    const checkIns = [...data.focusCheckIns, checkIn]
    setData('focusCheckIns', checkIns)
    return checkIns
  })

  ipcMain.handle('get-focus-checkins', (_event, taskId?: string) => {
    const data = getData()
    if (taskId) {
      return data.focusCheckIns.filter((c) => c.taskId === taskId)
    }
    return data.focusCheckIns
  })

  ipcMain.handle('pick-obsidian-note', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled) return null

    const filePath = result.filePaths[0]

    // Walk up to find .obsidian folder (vault root)
    let dir = dirname(filePath)
    let vaultRoot: string | null = null
    while (dir !== dirname(dir)) {
      if (existsSync(join(dir, '.obsidian'))) {
        vaultRoot = dir
        break
      }
      dir = dirname(dir)
    }

    if (!vaultRoot) {
      return { path: filePath, uri: null }
    }

    const vaultName = basename(vaultRoot)
    const relativePath = relative(vaultRoot, filePath).replace(/\.md$/, '')

    const uri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relativePath)}`
    return { path: filePath, uri }
  })
}
