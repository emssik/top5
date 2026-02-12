import { dialog, app, BrowserWindow } from 'electron'
import type { IpcMain } from 'electron'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  symlinkSync,
  lstatSync,
  renameSync,
  readdirSync,
  unlinkSync,
  copyFileSync
} from 'fs'
import { createHash } from 'crypto'
import { platform } from 'os'
import { dirname, basename, relative, join } from 'path'
import { homedir } from 'os'
import yaml from 'js-yaml'

interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: string
  isToDoNext?: boolean
  toDoNextOrder?: number
}

type RepeatSchedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'interval'; days: number }
  | { type: 'afterCompletion'; days: number }

interface RepeatingTask {
  id: string
  title: string
  schedule: RepeatSchedule
  createdAt: string
  lastCompletedAt: string | null
  order: number
  acceptedCount: number
  dismissedCount: number
  completedCount: number
}

interface QuickTask {
  id: string
  title: string
  completed: boolean
  createdAt: string
  completedAt: string | null
  order: number
  repeatingTaskId?: string | null
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
  suspendedAt: string | null
}

interface AppConfig {
  globalShortcut: string
  actionShortcuts: Record<string, string>
  focusTaskId: string | null
  focusProjectId: string | null
  compactMode: boolean
  cleanView: boolean
  theme: 'light' | 'dark'
  quickTasksLimit: number
  cleanViewFont: string
}

interface FocusCheckIn {
  id: string
  projectId: string
  taskId: string
  timestamp: string
  response: 'yes' | 'no' | 'a_little'
  minutes?: number
}

interface AppData {
  projects: Project[]
  quickTasks: QuickTask[]
  quickNotes: string
  config: AppConfig
  repeatingTasks: RepeatingTask[]
  dismissedRepeating: string[]
  dismissedRepeatingDate: string
}

const defaultData: AppData = {
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
    cleanViewFont: 'Caveat'
  }
}

export const IS_DEV = process.env.NODE_ENV === 'development' || process.env.TOP5_DEV === '1'
const ICLOUD_DIR = join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'top5')
const SYMLINK_PATH = join(homedir(), '.config', IS_DEV ? 'top5-dev' : 'top5')

function ensureDataDir(): string {
  // Dev mode: always use local directory, no iCloud sync
  if (IS_DEV) {
    mkdirSync(SYMLINK_PATH, { recursive: true })
    return SYMLINK_PATH
  }

  if (platform() === 'darwin') {
    // Create real dir in iCloud
    mkdirSync(ICLOUD_DIR, { recursive: true })

    // Migrate: if ~/.config/top5 is a real directory (not symlink), move contents to iCloud
    if (existsSync(SYMLINK_PATH) && !lstatSync(SYMLINK_PATH).isSymbolicLink()) {
      const files = ['data.yaml', 'checkins.jsonl']
      for (const f of files) {
        const src = join(SYMLINK_PATH, f)
        const dst = join(ICLOUD_DIR, f)
        if (existsSync(src) && !existsSync(dst)) {
          renameSync(src, dst)
        }
      }
      // Remove old dir (should be empty now) and create symlink
      const { rmSync } = require('fs')
      rmSync(SYMLINK_PATH, { recursive: true })
    }

    // Create symlink if missing
    if (!existsSync(SYMLINK_PATH)) {
      mkdirSync(dirname(SYMLINK_PATH), { recursive: true })
      symlinkSync(ICLOUD_DIR, SYMLINK_PATH)
    }

    return ICLOUD_DIR
  }

  // Non-mac fallback
  mkdirSync(SYMLINK_PATH, { recursive: true })
  return SYMLINK_PATH
}

const CONFIG_DIR = ensureDataDir()
const DATA_FILE = join(CONFIG_DIR, 'data.yaml')
const CHECKINS_FILE = join(CONFIG_DIR, 'checkins.jsonl')

// --- Daily backup ---

const BACKUP_DIR = join(CONFIG_DIR, 'backups')
const MAX_BACKUPS = 7
const VALID_CHECK_IN_RESPONSES = new Set<FocusCheckIn['response']>(['yes', 'no', 'a_little'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toFocusCheckIn(value: unknown): FocusCheckIn | null {
  if (!isRecord(value)) return null

  const { id, projectId, taskId, timestamp, response } = value
  if (
    typeof id !== 'string' ||
    typeof projectId !== 'string' ||
    typeof taskId !== 'string' ||
    typeof timestamp !== 'string' ||
    typeof response !== 'string' ||
    !VALID_CHECK_IN_RESPONSES.has(response as FocusCheckIn['response'])
  ) {
    return null
  }

  const result: FocusCheckIn = { id, projectId, taskId, timestamp, response: response as FocusCheckIn['response'] }
  const { minutes } = value
  if (typeof minutes === 'number' && minutes >= 0) result.minutes = minutes
  return result
}

function isValidTask(value: unknown): value is Task {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.title === 'string' && typeof value.completed === 'boolean'
}

function isValidProject(value: unknown): value is Project {
  if (!isRecord(value)) return false
  const { id, name, order, tasks, launchers } = value
  if (typeof id !== 'string' || typeof name !== 'string' || typeof order !== 'number') return false
  if (!Array.isArray(tasks) || !tasks.every(isValidTask)) return false
  if (!isRecord(launchers)) return false
  return true
}

function isValidAppConfig(value: unknown): value is AppConfig {
  if (!isRecord(value)) return false
  const { globalShortcut, actionShortcuts, theme, quickTasksLimit } = value
  if (typeof globalShortcut !== 'string') return false
  if (!isRecord(actionShortcuts)) return false
  if (theme !== 'light' && theme !== 'dark') return false
  if (typeof quickTasksLimit !== 'number' || quickTasksLimit < 1 || quickTasksLimit > 20) return false
  return true
}

function isValidQuickTask(value: unknown): value is QuickTask {
  if (!isRecord(value)) return false
  const { id, title, completed, order } = value
  return typeof id === 'string' && typeof title === 'string' && typeof completed === 'boolean' && typeof order === 'number'
}

function isValidRepeatSchedule(value: unknown): value is RepeatSchedule {
  if (!isRecord(value)) return false
  const { type } = value
  if (type === 'daily') return true
  if (type === 'weekdays') return Array.isArray(value.days) && value.days.every((d: unknown) => typeof d === 'number')
  if (type === 'interval' || type === 'afterCompletion') return typeof value.days === 'number' && value.days > 0
  return false
}

function isValidRepeatingTask(value: unknown): value is RepeatingTask {
  if (!isRecord(value)) return false
  const { id, title, schedule, order } = value
  return typeof id === 'string' && typeof title === 'string' && typeof order === 'number' && isValidRepeatSchedule(schedule)
}

function dailyBackup(): void {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const backupPrefix = `backup-${today}`

  mkdirSync(BACKUP_DIR, { recursive: true })

  // Already backed up today?
  const existing = readdirSync(BACKUP_DIR)
  if (existing.some((f) => f.startsWith(backupPrefix))) return

  // Collect files to backup and check if anything changed since last backup
  const filesToBackup = [DATA_FILE, CHECKINS_FILE].filter((f) => existsSync(f))
  if (filesToBackup.length === 0) return

  // Hash current content
  const currentHash = filesToBackup
    .map((f) => createHash('md5').update(readFileSync(f)).digest('hex'))
    .join(':')

  // Compare with most recent backup hash
  const hashFile = join(BACKUP_DIR, '.last-hash')
  if (existsSync(hashFile) && readFileSync(hashFile, 'utf-8').trim() === currentHash) return

  // Create backups
  for (const f of filesToBackup) {
    const name = basename(f)
    copyFileSync(f, join(BACKUP_DIR, `${backupPrefix}-${name}`))
  }
  writeFileSync(hashFile, currentHash, 'utf-8')

  // Prune old backups — keep last MAX_BACKUPS days
  const allBackups = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('backup-'))
  const days = [...new Set(allBackups.map((f) => f.slice(7, 17)))].sort().reverse()
  const daysToRemove = days.slice(MAX_BACKUPS)
  for (const day of daysToRemove) {
    for (const f of allBackups.filter((b) => b.slice(7, 17) === day)) {
      unlinkSync(join(BACKUP_DIR, f))
    }
  }
}

// --- JSONL check-ins ---

function appendCheckIn(checkIn: FocusCheckIn): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  appendFileSync(CHECKINS_FILE, JSON.stringify(checkIn) + '\n', 'utf-8')
}

function loadCheckIns(): FocusCheckIn[] {
  if (!existsSync(CHECKINS_FILE)) return []
  try {
    const raw = readFileSync(CHECKINS_FILE, 'utf-8')
    const parsed: FocusCheckIn[] = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        const checkIn = toFocusCheckIn(JSON.parse(line))
        if (checkIn) parsed.push(checkIn)
      } catch {
        // Ignore malformed lines and continue loading valid entries.
      }
    }
    return parsed
  } catch {
    return []
  }
}

function migrateCheckInsToJsonl(): void {
  if (existsSync(CHECKINS_FILE)) return
  // Migrate existing check-ins from YAML if present
  if (!existsSync(DATA_FILE)) return
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8')
    const parsed = yaml.load(raw) as any
    const checkIns: FocusCheckIn[] = parsed?.focusCheckIns ?? []
    if (checkIns.length > 0) {
      mkdirSync(CONFIG_DIR, { recursive: true })
      const lines = checkIns.map((c) => JSON.stringify(c)).join('\n') + '\n'
      writeFileSync(CHECKINS_FILE, lines, 'utf-8')
    }
    // Remove focusCheckIns from YAML
    if (parsed?.focusCheckIns) {
      delete parsed.focusCheckIns
      writeFileSync(DATA_FILE, yaml.dump(parsed, { lineWidth: 120, noRefs: true }), 'utf-8')
    }
  } catch {
    // Migration failed — not critical
  }
}

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
    const today = new Date().toISOString().slice(0, 10)
    const dismissedRepeatingDate = parsed?.dismissedRepeatingDate ?? ''
    return {
      projects: parsed?.projects ?? defaultData.projects,
      quickTasks: parsed?.quickTasks ?? [],
      quickNotes: parsed?.quickNotes ?? defaultData.quickNotes,
      repeatingTasks: parsed?.repeatingTasks ?? [],
      dismissedRepeating: dismissedRepeatingDate === today ? (parsed?.dismissedRepeating ?? []) : [],
      dismissedRepeatingDate: dismissedRepeatingDate === today ? today : '',
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
      quickTasks: parsed.quickTasks ?? [],
      quickNotes: parsed.quickNotes ?? defaultData.quickNotes,
      repeatingTasks: [],
      dismissedRepeating: [],
      dismissedRepeatingDate: '',
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

function notifyAllWindows(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('reload-data')
    }
  }
}

export function registerStoreHandlers(ipcMain: IpcMain): void {
  migrateCheckInsToJsonl()
  dailyBackup()

  ipcMain.handle('get-is-dev', () => {
    return IS_DEV
  })

  ipcMain.handle('get-app-data', () => {
    return getData()
  })

  ipcMain.handle('save-project', (_event, project: unknown) => {
    if (!isValidProject(project)) return getData().projects
    const data = getData()
    const projects = [...data.projects]
    const index = projects.findIndex((p) => p.id === project.id)
    if (index >= 0) {
      projects[index] = project
    } else {
      // Assign order for new projects based on current active count
      const activeCount = projects.filter((p) => !p.archivedAt && !p.suspendedAt).length
      project.order = activeCount
      projects.push(project)
    }
    setData('projects', projects)
    notifyAllWindows()
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

  ipcMain.handle('save-config', (_event, config: unknown) => {
    if (!isValidAppConfig(config)) return
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
    const activeProjects = projects.filter((p) => !p.archivedAt && !p.suspendedAt)
    if (activeProjects.length >= 5) {
      return { error: 'Cannot restore: 5 active projects already. Archive or suspend one first.' }
    }
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      project.archivedAt = null
      project.suspendedAt = null
      // Assign next available order
      const usedOrders = activeProjects.map((p) => p.order)
      let nextOrder = 0
      while (usedOrders.includes(nextOrder)) nextOrder++
      project.order = nextOrder
      setData('projects', projects)
    }
    return { projects }
  })

  ipcMain.handle('suspend-project', (_event, projectId: string) => {
    const data = getData()
    const projects = [...data.projects]
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      project.suspendedAt = new Date().toISOString()
      setData('projects', projects)
    }
    return projects
  })

  ipcMain.handle('unsuspend-project', (_event, projectId: string) => {
    const data = getData()
    const projects = [...data.projects]
    const activeProjects = projects.filter((p) => !p.archivedAt && !p.suspendedAt)
    if (activeProjects.length >= 5) {
      return { error: 'Cannot restore: 5 active projects already. Archive or suspend one first.' }
    }
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      project.suspendedAt = null
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

  ipcMain.handle('save-focus-checkin', (_event, checkIn: unknown) => {
    const normalized = toFocusCheckIn(checkIn)
    if (!normalized) return loadCheckIns()
    appendCheckIn(normalized)
    return loadCheckIns()
  })

  ipcMain.handle('get-focus-checkins', (_event, taskId?: string) => {
    const checkIns = loadCheckIns()
    if (taskId) {
      return checkIns.filter((c) => c.taskId === taskId)
    }
    return checkIns
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

  // --- Quick Tasks ---

  ipcMain.handle('save-quick-task', (_event, task: unknown) => {
    if (!isValidQuickTask(task)) return
    const data = getData()
    const quickTasks = [...data.quickTasks]
    const qt = task
    const index = quickTasks.findIndex((t) => t.id === qt.id)
    if (index >= 0) {
      quickTasks[index] = qt
    } else {
      qt.order = quickTasks.filter((t) => !t.completed).length
      quickTasks.push(qt)
    }
    setData('quickTasks', quickTasks)
    notifyAllWindows()
    return quickTasks
  })

  ipcMain.handle('remove-quick-task', (_event, id: string) => {
    if (typeof id !== 'string') return
    const data = getData()
    const quickTasks = data.quickTasks.filter((t) => t.id !== id)
    setData('quickTasks', quickTasks)
    notifyAllWindows()
    return quickTasks
  })

  ipcMain.handle('complete-quick-task', (_event, id: string) => {
    if (typeof id !== 'string') return
    const data = getData()
    const quickTasks = [...data.quickTasks]
    const task = quickTasks.find((t) => t.id === id)
    if (task) {
      task.completed = true
      task.completedAt = new Date().toISOString()
      setData('quickTasks', quickTasks)
      // Update repeating task stats and lastCompletedAt
      if (task.repeatingTaskId) {
        const repeatingTasks = [...data.repeatingTasks]
        const rt = repeatingTasks.find((r) => r.id === task.repeatingTaskId)
        if (rt) {
          rt.completedCount = (rt.completedCount || 0) + 1
          if (rt.schedule.type === 'afterCompletion') {
            rt.lastCompletedAt = task.completedAt
          }
          setData('repeatingTasks', repeatingTasks)
        }
      }
      notifyAllWindows()
    }
    return quickTasks
  })

  ipcMain.handle('uncomplete-quick-task', (_event, id: string) => {
    if (typeof id !== 'string') return
    const data = getData()
    const quickTasks = [...data.quickTasks]
    const task = quickTasks.find((t) => t.id === id)
    if (task) {
      task.completed = false
      task.completedAt = null
      task.order = quickTasks.filter((t) => !t.completed).length
      setData('quickTasks', quickTasks)
      notifyAllWindows()
    }
    return quickTasks
  })

  ipcMain.handle('reorder-quick-tasks', (_event, orderedIds: string[]) => {
    if (!Array.isArray(orderedIds)) return
    const data = getData()
    const quickTasks = [...data.quickTasks]
    for (let i = 0; i < orderedIds.length; i++) {
      const task = quickTasks.find((t) => t.id === orderedIds[i])
      if (task) task.order = i
    }
    setData('quickTasks', quickTasks)
    return quickTasks
  })

  ipcMain.handle('reorder-projects', (_event, orderedIds: string[]) => {
    if (!Array.isArray(orderedIds)) return
    const data = getData()
    const projects = [...data.projects]
    for (let i = 0; i < orderedIds.length; i++) {
      const project = projects.find((p) => p.id === orderedIds[i])
      if (project) project.order = i
    }
    setData('projects', projects)
    notifyAllWindows()
    return projects
  })

  ipcMain.handle('reorder-pinned-tasks', (_event, updates: { projectId: string; taskId: string; order: number }[]) => {
    if (!Array.isArray(updates)) return
    const data = getData()
    const projects = [...data.projects]
    for (const { projectId, taskId, order } of updates) {
      const project = projects.find((p) => p.id === projectId)
      if (!project) continue
      const task = project.tasks.find((t) => t.id === taskId)
      if (task) task.toDoNextOrder = order
    }
    setData('projects', projects)
    notifyAllWindows()
    return projects
  })

  // --- Repeating Tasks ---

  ipcMain.handle('save-repeating-task', (_event, task: unknown) => {
    if (!isValidRepeatingTask(task)) return
    const data = getData()
    const repeatingTasks = [...data.repeatingTasks]
    const index = repeatingTasks.findIndex((t) => t.id === task.id)
    if (index >= 0) {
      repeatingTasks[index] = task
    } else {
      task.order = repeatingTasks.length
      repeatingTasks.push(task)
    }
    setData('repeatingTasks', repeatingTasks)
    notifyAllWindows()
    return repeatingTasks
  })

  ipcMain.handle('remove-repeating-task', (_event, id: string) => {
    if (typeof id !== 'string') return
    const data = getData()
    const repeatingTasks = data.repeatingTasks.filter((t) => t.id !== id)
    setData('repeatingTasks', repeatingTasks)
    notifyAllWindows()
    return repeatingTasks
  })

  ipcMain.handle('reorder-repeating-tasks', (_event, orderedIds: string[]) => {
    if (!Array.isArray(orderedIds)) return
    const data = getData()
    const repeatingTasks = [...data.repeatingTasks]
    for (let i = 0; i < orderedIds.length; i++) {
      const task = repeatingTasks.find((t) => t.id === orderedIds[i])
      if (task) task.order = i
    }
    setData('repeatingTasks', repeatingTasks)
    return repeatingTasks
  })

  ipcMain.handle('accept-repeating-proposal', (_event, repeatingTaskId: string) => {
    if (typeof repeatingTaskId !== 'string') return
    const data = getData()
    const repeatingTasks = [...data.repeatingTasks]
    const rt = repeatingTasks.find((t) => t.id === repeatingTaskId)
    if (!rt) return data.quickTasks
    const quickTasks = [...data.quickTasks]
    const newTask: QuickTask = {
      id: require('crypto').randomUUID().slice(0, 21),
      title: rt.title,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      order: quickTasks.filter((t) => !t.completed).length,
      repeatingTaskId
    }
    quickTasks.push(newTask)
    setData('quickTasks', quickTasks)
    rt.acceptedCount = (rt.acceptedCount || 0) + 1
    setData('repeatingTasks', repeatingTasks)
    notifyAllWindows()
    return quickTasks
  })

  ipcMain.handle('dismiss-repeating-proposal', (_event, repeatingTaskId: string) => {
    if (typeof repeatingTaskId !== 'string') return
    const data = getData()
    const today = new Date().toISOString().slice(0, 10)
    const dismissed = data.dismissedRepeatingDate === today ? [...data.dismissedRepeating] : []
    if (!dismissed.includes(repeatingTaskId)) dismissed.push(repeatingTaskId)
    setData('dismissedRepeating', dismissed)
    setData('dismissedRepeatingDate', today)
    const repeatingTasks = [...data.repeatingTasks]
    const rt = repeatingTasks.find((t) => t.id === repeatingTaskId)
    if (rt) {
      rt.dismissedCount = (rt.dismissedCount || 0) + 1
      setData('repeatingTasks', repeatingTasks)
    }
    notifyAllWindows()
  })

  ipcMain.handle('toggle-task-to-do-next', (_event, projectId: string, taskId: string) => {
    if (typeof projectId !== 'string' || typeof taskId !== 'string') return
    const data = getData()
    const projects = [...data.projects]
    const project = projects.find((p) => p.id === projectId)
    if (!project) return projects
    const task = project.tasks.find((t) => t.id === taskId)
    if (task) {
      task.isToDoNext = !task.isToDoNext
      setData('projects', projects)
      notifyAllWindows()
    }
    return projects
  })
}
