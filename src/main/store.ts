import { app, BrowserWindow } from 'electron'
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
  copyFileSync,
  rmSync
} from 'fs'
import { createHash, randomUUID } from 'crypto'
import { platform } from 'os'
import { dirname, basename, join, resolve } from 'path'
import { homedir } from 'os'
import yaml from 'js-yaml'
import { normalizeRepeatSchedule } from '../shared/schedule'
import { PROJECT_COLORS, LINK_LABELS } from '../shared/constants'
import * as projectService from './service/projects'
import * as quickTaskService from './service/quick-tasks'
import * as repeatingTaskService from './service/repeating-tasks'
import * as winsService from './service/wins'
import type {
  Task,
  RepeatSchedule,
  RepeatingTask,
  QuickTask,
  ProjectColor,
  ProjectLink,
  Project,
  AppConfig,
  FocusCheckIn,
  OperationLogEntry,
  AppData,
  ApiConfig,
  ApiConfigPublic,
  LockedTaskRef,
  WinsLockState,
  WinEntry,
  StreakStats
} from '../shared/types'

// Re-export types for convenience
export type { Task, RepeatSchedule, RepeatingTask, QuickTask, ProjectColor, ProjectLink, Project, AppConfig, FocusCheckIn, OperationLogEntry, AppData, ApiConfig, ApiConfigPublic, LockedTaskRef, WinsLockState, WinEntry, StreakStats }

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
    activeProjectsLimit: 5,
    cleanViewFont: 'Caveat'
  }
}

const DEFAULT_API_PORT = 15055

export const IS_DEV = process.env.NODE_ENV === 'development' || process.env.TOP5_DEV === '1'
const ICLOUD_DIR = join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'top5')
const SYMLINK_PATH = join(homedir(), '.config', IS_DEV ? 'top5-dev' : 'top5')

function ensureDataDir(): string {
  // Test/override: explicit data directory
  if (process.env.TOP5_DATA_DIR) {
    mkdirSync(process.env.TOP5_DATA_DIR, { recursive: true })
    return process.env.TOP5_DATA_DIR
  }

  // Dev mode: always use local directory, no iCloud sync
  if (IS_DEV) {
    mkdirSync(SYMLINK_PATH, { recursive: true })
    return SYMLINK_PATH
  }

  if (platform() === 'darwin') {
    // Create real dir in iCloud
    mkdirSync(ICLOUD_DIR, { recursive: true })

    // Migrate: if ~/.config/top5 is a real directory (not symlink), move known files to iCloud.
    if (existsSync(SYMLINK_PATH) && !lstatSync(SYMLINK_PATH).isSymbolicLink()) {
      const files = ['data.yaml', 'checkins.jsonl', 'operations.jsonl']
      let migrationOk = true
      for (const f of files) {
        const src = join(SYMLINK_PATH, f)
        const dst = join(ICLOUD_DIR, f)
        if (!existsSync(src) || existsSync(dst)) continue
        try {
          renameSync(src, dst)
        } catch {
          try {
            copyFileSync(src, dst)
          } catch {
            migrationOk = false
          }
        }
        if (!existsSync(dst)) {
          migrationOk = false
        }
      }

      // Remove legacy directory only when known files are migrated and directory is empty.
      if (migrationOk) {
        try {
          if (readdirSync(SYMLINK_PATH).length === 0) {
            rmSync(SYMLINK_PATH, { recursive: true, force: true })
          }
        } catch {
          // Keep legacy directory on any error to avoid data loss.
        }
      }
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

export function getConfigDir(): string {
  return CONFIG_DIR
}
const DATA_FILE = join(CONFIG_DIR, 'data.yaml')
const CHECKINS_FILE = join(CONFIG_DIR, 'checkins.jsonl')
const OPERATIONS_FILE = join(CONFIG_DIR, 'operations.jsonl')

// --- Daily backup ---

const BACKUP_DIR = join(CONFIG_DIR, 'backups')
const MAX_BACKUPS = 7
const VALID_CHECK_IN_RESPONSES = new Set<FocusCheckIn['response']>(['yes', 'no', 'a_little'])
const ALLOWED_CONFIG_SHORTCUT_ACTIONS = new Set([
  'toggle-app',
  'quick-add',
  'project-1',
  'project-2',
  'project-3',
  'project-4',
  'project-5',
  'toggle-focus',
  'quick-notes'
])
const ACCELERATOR_PART_PATTERN = /^[A-Za-z0-9]+$/

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isServiceError(result: unknown): result is { error: string } {
  return isRecord(result) && typeof result.error === 'string'
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

export function isValidProjectCode(code: string): boolean {
  return /^[A-Z0-9]{2,6}$/.test(code)
}

export function isValidProject(value: unknown): value is Project {
  if (!isRecord(value)) return false
  const { id, name, order, tasks } = value
  if (typeof id !== 'string' || typeof name !== 'string' || typeof order !== 'number') return false
  if (!Array.isArray(tasks) || !tasks.every(isValidTask)) return false
  if (value.links !== undefined) {
    if (!Array.isArray(value.links)) return false
    for (const link of value.links) {
      if (!isRecord(link) || typeof link.label !== 'string' || typeof link.url !== 'string') return false
    }
  }
  if (value.code !== undefined && typeof value.code === 'string' && value.code.length > 0) {
    if (!isValidProjectCode(value.code)) return false
  }
  return true
}

function isProjectColor(value: unknown): value is ProjectColor {
  return typeof value === 'string' && PROJECT_COLORS.includes(value as ProjectColor)
}

function normalizeLaunchers(value: unknown): NonNullable<Project['launchers']> {
  if (!isRecord(value)) {
    return { vscode: null, iterm: null, obsidian: null, browser: null }
  }
  return {
    vscode: typeof value.vscode === 'string' ? value.vscode : null,
    iterm: typeof value.iterm === 'string' ? value.iterm : null,
    obsidian: typeof value.obsidian === 'string' ? value.obsidian : null,
    browser: typeof value.browser === 'string' ? value.browser : null
  }
}

function normalizeLinks(value: unknown): ProjectLink[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((link): link is ProjectLink => isRecord(link) && typeof link.label === 'string' && typeof link.url === 'string')
    .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
    .filter((link) => link.label.length > 0 && link.url.length > 0)
}

function launchersToLinks(launchers: NonNullable<Project['launchers']>): ProjectLink[] {
  return Object.entries(launchers)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([type, value]) => ({
      label: LINK_LABELS[type as keyof typeof LINK_LABELS],
      url: (value as string).trim()
    }))
}

function mergeLaunchersFromLinks(launchers: NonNullable<Project['launchers']>, links: ProjectLink[]): NonNullable<Project['launchers']> {
  const next = { ...launchers }

  for (const link of links) {
    const label = link.label.toLowerCase()
    const url = link.url.trim()
    if (!url) continue

    if (!next.vscode && (label.includes('code') || url.startsWith('vscode://'))) {
      next.vscode = url
      continue
    }

    if (!next.iterm && (label.includes('term') || url.startsWith('iterm://'))) {
      next.iterm = url
      continue
    }

    if (!next.obsidian && (label.includes('obsidian') || url.startsWith('obsidian://'))) {
      next.obsidian = url
      continue
    }

    if (!next.browser && (url.startsWith('http://') || url.startsWith('https://') || label.includes('browser'))) {
      next.browser = url
    }
  }

  return next
}

export function normalizeProject(project: Project): Project {
  const launchers = normalizeLaunchers(project.launchers)
  const links = normalizeLinks(project.links)
  const normalizedLinks = links.length > 0 ? links : launchersToLinks(launchers)
  return {
    ...project,
    launchers: mergeLaunchersFromLinks(launchers, normalizedLinks),
    links: normalizedLinks,
    color: isProjectColor(project.color) ? project.color : undefined
  }
}

export function assignMissingProjectColors(projects: Project[]): Project[] {
  const used = new Set(projects.map((project) => project.color).filter(isProjectColor))
  const available = PROJECT_COLORS.filter((color) => !used.has(color))

  return projects.map((project) => {
    if (isProjectColor(project.color)) return project
    const fallback = PROJECT_COLORS[Math.max(0, project.order) % PROJECT_COLORS.length]
    const nextColor = available.shift() ?? fallback
    used.add(nextColor)
    return { ...project, color: nextColor }
  })
}

export function getActiveProjectsLimit(config: AppConfig): number {
  return Math.max(1, Math.min(20, config.activeProjectsLimit ?? 5))
}

function isValidAccelerator(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 80) return false
  const parts = trimmed.split('+').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 0) return false

  let hasKey = false
  for (const part of parts) {
    const lower = part.toLowerCase()
    const isModifier = lower === 'commandorcontrol' || lower === 'cmdorctrl' || lower === 'shift' || lower === 'alt' || lower === 'option' || lower === 'ctrl' || lower === 'control' || lower === 'cmd' || lower === 'command'
    if (isModifier) continue
    if (hasKey || !ACCELERATOR_PART_PATTERN.test(part)) return false
    hasKey = true
  }
  return hasKey
}

function isValidActionShortcuts(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false
  for (const [key, shortcut] of Object.entries(value)) {
    if (!ALLOWED_CONFIG_SHORTCUT_ACTIONS.has(key)) return false
    if (!isValidAccelerator(shortcut)) return false
  }
  return true
}

function normalizeActionShortcuts(value: unknown): Record<string, string> {
  const next = { ...defaultData.config.actionShortcuts }
  if (!isRecord(value)) return next
  for (const action of ALLOWED_CONFIG_SHORTCUT_ACTIONS) {
    const candidate = value[action]
    if (isValidAccelerator(candidate)) {
      next[action] = candidate.trim()
    }
  }
  return next
}

function normalizeAppConfig(value: unknown): AppConfig {
  if (!isRecord(value)) return { ...defaultData.config }
  return {
    globalShortcut: isValidAccelerator(value.globalShortcut) ? value.globalShortcut.trim() : defaultData.config.globalShortcut,
    actionShortcuts: normalizeActionShortcuts(value.actionShortcuts),
    focusTaskId: typeof value.focusTaskId === 'string' || value.focusTaskId === null ? value.focusTaskId : null,
    focusProjectId: typeof value.focusProjectId === 'string' || value.focusProjectId === null ? value.focusProjectId : null,
    compactMode: typeof value.compactMode === 'boolean' ? value.compactMode : defaultData.config.compactMode,
    cleanView: typeof value.cleanView === 'boolean' ? value.cleanView : defaultData.config.cleanView,
    theme: value.theme === 'light' || value.theme === 'dark' ? value.theme : defaultData.config.theme,
    quickTasksLimit: typeof value.quickTasksLimit === 'number' ? Math.max(1, Math.min(20, value.quickTasksLimit)) : defaultData.config.quickTasksLimit,
    activeProjectsLimit: typeof value.activeProjectsLimit === 'number' ? Math.max(1, Math.min(20, value.activeProjectsLimit)) : defaultData.config.activeProjectsLimit,
    cleanViewFont: typeof value.cleanViewFont === 'string' && value.cleanViewFont.trim().length > 0
      ? value.cleanViewFont.trim().slice(0, 64)
      : defaultData.config.cleanViewFont,
    obsidianStoragePath: typeof value.obsidianStoragePath === 'string' && value.obsidianStoragePath.trim().length > 0
      ? value.obsidianStoragePath.trim()
      : undefined,
    obsidianVaultName: typeof value.obsidianVaultName === 'string' && value.obsidianVaultName.trim().length > 0
      ? value.obsidianVaultName.trim()
      : undefined
  }
}

function isValidAppConfig(value: unknown): value is AppConfig {
  if (!isRecord(value)) return false
  const {
    globalShortcut,
    actionShortcuts,
    theme,
    quickTasksLimit,
    activeProjectsLimit,
    focusTaskId,
    focusProjectId,
    compactMode,
    cleanView,
    cleanViewFont
  } = value
  if (!isValidAccelerator(globalShortcut)) return false
  if (!isValidActionShortcuts(actionShortcuts)) return false
  if (theme !== 'light' && theme !== 'dark') return false
  if (typeof quickTasksLimit !== 'number' || quickTasksLimit < 1 || quickTasksLimit > 20) return false
  if (typeof activeProjectsLimit !== 'number' || activeProjectsLimit < 1 || activeProjectsLimit > 20) return false
  if (!(typeof focusTaskId === 'string' || focusTaskId === null)) return false
  if (!(typeof focusProjectId === 'string' || focusProjectId === null)) return false
  if (typeof compactMode !== 'boolean' || typeof cleanView !== 'boolean') return false
  if (typeof cleanViewFont !== 'string' || cleanViewFont.trim().length === 0 || cleanViewFont.length > 64) return false
  if (value.obsidianStoragePath !== undefined && typeof value.obsidianStoragePath !== 'string') return false
  if (value.obsidianVaultName !== undefined && typeof value.obsidianVaultName !== 'string') return false
  return true
}

export function isValidQuickTask(value: unknown): value is QuickTask {
  if (!isRecord(value)) return false
  const { id, title, completed, order } = value
  return typeof id === 'string' && typeof title === 'string' && typeof completed === 'boolean' && typeof order === 'number'
}

export function isValidRepeatSchedule(value: unknown): value is RepeatSchedule {
  if (!isRecord(value)) return false
  const { type } = value
  if (type === 'daily') return true
  if (type === 'weekdays') {
    return (
      Array.isArray(value.days) &&
      value.days.length > 0 &&
      value.days.every((d: unknown) => typeof d === 'number' && Number.isFinite(d) && d >= 0 && d <= 7)
    )
  }
  if (type === 'interval' || type === 'afterCompletion') return typeof value.days === 'number' && value.days > 0
  if (type === 'monthlyDay') return typeof value.day === 'number' && value.day >= 1 && value.day <= 31
  if (type === 'monthlyNthWeekday') return typeof value.week === 'number' && value.week >= 1 && value.week <= 5 && typeof value.weekday === 'number' && value.weekday >= 0 && value.weekday <= 6
  if (type === 'everyNMonths') return typeof value.months === 'number' && value.months >= 1 && typeof value.day === 'number' && value.day >= 1 && value.day <= 31
  return false
}

export function isValidRepeatingTask(value: unknown): value is RepeatingTask {
  if (!isRecord(value)) return false
  const { id, title, schedule, order } = value
  return typeof id === 'string' && typeof title === 'string' && typeof order === 'number' && isValidRepeatSchedule(schedule)
}

function normalizeRepeatingTask(task: RepeatingTask): RepeatingTask {
  return {
    ...task,
    schedule: normalizeRepeatSchedule(task.schedule)
  }
}

function dailyBackup(): void {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const backupPrefix = `backup-${today}`

  mkdirSync(BACKUP_DIR, { recursive: true })

  // Already backed up today?
  const existing = readdirSync(BACKUP_DIR)
  if (existing.some((f) => f.startsWith(backupPrefix))) return

  // Collect files to backup and check if anything changed since last backup
  const WINS_FILE = join(CONFIG_DIR, 'wins.jsonl')
  const filesToBackup = [DATA_FILE, CHECKINS_FILE, OPERATIONS_FILE, WINS_FILE].filter((f) => existsSync(f))
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

let cachedCheckIns: FocusCheckIn[] | null = null
let taskMinutesById: Map<string, number> | null = null

function checkInMinutes(checkIn: FocusCheckIn): number {
  if (typeof checkIn.minutes === 'number' && checkIn.minutes >= 0) return checkIn.minutes
  if (checkIn.response === 'yes') return 15
  if (checkIn.response === 'a_little') return 7
  return 0
}

function rebuildCheckInCaches(checkIns: FocusCheckIn[]): void {
  cachedCheckIns = checkIns
  const perTask = new Map<string, number>()
  for (const checkIn of checkIns) {
    perTask.set(checkIn.taskId, (perTask.get(checkIn.taskId) ?? 0) + checkInMinutes(checkIn))
  }
  taskMinutesById = perTask
}

function ensureCheckInCaches(): void {
  if (cachedCheckIns && taskMinutesById) return
  if (!existsSync(CHECKINS_FILE)) {
    rebuildCheckInCaches([])
    return
  }

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
    rebuildCheckInCaches(parsed)
  } catch {
    rebuildCheckInCaches([])
  }
}

function appendCheckIn(checkIn: FocusCheckIn): void {
  ensureCheckInCaches()
  mkdirSync(CONFIG_DIR, { recursive: true })
  appendFileSync(CHECKINS_FILE, JSON.stringify(checkIn) + '\n', 'utf-8')
  cachedCheckIns!.push(checkIn)
  taskMinutesById!.set(checkIn.taskId, (taskMinutesById!.get(checkIn.taskId) ?? 0) + checkInMinutes(checkIn))
}

export function loadCheckIns(): FocusCheckIn[] {
  ensureCheckInCaches()
  return [...(cachedCheckIns ?? [])]
}

export function taskTimeMinutes(taskId: string): number {
  ensureCheckInCaches()
  return taskMinutesById?.get(taskId) ?? 0
}

// --- Operation log ---

export function appendOperation(entry: Omit<OperationLogEntry, 'id' | 'timestamp'>): void {
  const full: OperationLogEntry = {
    id: randomUUID().slice(0, 21),
    timestamp: new Date().toISOString(),
    ...entry
  }
  mkdirSync(CONFIG_DIR, { recursive: true })
  appendFileSync(OPERATIONS_FILE, JSON.stringify(full) + '\n', 'utf-8')
}

function loadOperations(since?: string): OperationLogEntry[] {
  if (!existsSync(OPERATIONS_FILE)) return []
  try {
    const raw = readFileSync(OPERATIONS_FILE, 'utf-8')
    const entries: OperationLogEntry[] = []
    const sinceTime = since ? new Date(since).getTime() : 0
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line) as OperationLogEntry
        if (entry.id && entry.timestamp && entry.type) {
          if (!since || new Date(entry.timestamp).getTime() >= sinceTime) {
            entries.push(entry)
          }
        }
      } catch {
        // skip malformed lines
      }
    }
    return entries
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

// --- ApiConfig ---

let cachedApiConfig: ApiConfig | null = null

function loadApiConfig(): ApiConfig {
  if (cachedApiConfig) return cachedApiConfig
  if (!existsSync(DATA_FILE)) {
    cachedApiConfig = { enabled: false, apiKey: '', port: DEFAULT_API_PORT }
    return cachedApiConfig
  }
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8')
    const parsed = yaml.load(raw) as any
    const cfg = parsed?.apiConfig
    if (cfg && isRecord(cfg)) {
      cachedApiConfig = {
        enabled: typeof cfg.enabled === 'boolean' ? cfg.enabled : false,
        apiKey: typeof cfg.apiKey === 'string' ? cfg.apiKey : '',
        port: typeof cfg.port === 'number' ? cfg.port : DEFAULT_API_PORT
      }
    } else {
      cachedApiConfig = { enabled: false, apiKey: '', port: DEFAULT_API_PORT }
    }
  } catch {
    cachedApiConfig = { enabled: false, apiKey: '', port: DEFAULT_API_PORT }
  }
  return cachedApiConfig
}

function saveApiConfigToFile(config: ApiConfig): void {
  cachedApiConfig = config
  // Read full YAML, update apiConfig field, write back
  let parsed: any = {}
  if (existsSync(DATA_FILE)) {
    try {
      parsed = yaml.load(readFileSync(DATA_FILE, 'utf-8')) ?? {}
    } catch {
      parsed = {}
    }
  }
  parsed.apiConfig = config
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(DATA_FILE, yaml.dump(parsed, { lineWidth: 120, noRefs: true }), 'utf-8')
}

export function getApiConfig(): ApiConfig {
  return loadApiConfig()
}

export function saveApiConfig(config: ApiConfig): void {
  saveApiConfigToFile(config)
}

function getApiConfigPublic(): ApiConfigPublic {
  const cfg = loadApiConfig()
  return { enabled: cfg.enabled, port: cfg.port }
}

// --- Task number migration ---

function migrateTaskNumbers(data: AppData): boolean {
  let changed = false

  for (const project of data.projects) {
    const unnumbered = project.tasks
      .filter((t) => t.taskNumber == null)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))

    if (unnumbered.length === 0) continue

    let next = project.nextTaskNumber ?? 1
    for (const task of unnumbered) {
      task.taskNumber = next++
      changed = true
    }
    project.nextTaskNumber = next
  }

  const unnumberedQuick = data.quickTasks
    .filter((t) => t.taskNumber == null)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))

  if (unnumberedQuick.length > 0) {
    let next = data.nextQuickTaskNumber ?? 1
    for (const task of unnumberedQuick) {
      task.taskNumber = next++
      changed = true
    }
    data.nextQuickTaskNumber = next
  }

  return changed
}

// --- Data persistence ---

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
    const projects = assignMissingProjectColors((parsed?.projects ?? defaultData.projects).map(normalizeProject))
    const config = normalizeAppConfig(parsed?.config ?? {})
    const data: AppData = {
      projects,
      quickTasks: parsed?.quickTasks ?? [],
      quickNotes: parsed?.quickNotes ?? defaultData.quickNotes,
      repeatingTasks: (parsed?.repeatingTasks ?? [])
        .filter(isValidRepeatingTask)
        .map(normalizeRepeatingTask),
      dismissedRepeating: dismissedRepeatingDate === today ? (parsed?.dismissedRepeating ?? []) : [],
      dismissedRepeatingDate: dismissedRepeatingDate === today ? today : '',
      config,
      apiConfig: getApiConfigPublic(),
      nextQuickTaskNumber: typeof parsed?.nextQuickTaskNumber === 'number' ? parsed.nextQuickTaskNumber : undefined,
      winsLock: isRecord(parsed?.winsLock) ? parsed.winsLock as WinsLockState : undefined
    }

    if (migrateTaskNumbers(data)) {
      saveData(data)
    }

    return data
  } catch {
    return { ...defaultData }
  }
}

function saveData(data: AppData): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  // Preserve apiConfig in YAML (full version with key) — don't overwrite it from AppData
  const toSave: any = { ...data }
  delete toSave.apiConfig // Don't save the public version; full apiConfig is managed separately
  // Merge with existing apiConfig in file
  if (existsSync(DATA_FILE)) {
    try {
      const existing = yaml.load(readFileSync(DATA_FILE, 'utf-8')) as any
      if (existing?.apiConfig) {
        toSave.apiConfig = existing.apiConfig
      }
    } catch {
      // ignore
    }
  }
  writeFileSync(DATA_FILE, yaml.dump(toSave, { lineWidth: 120, noRefs: true }), 'utf-8')
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
      config: normalizeAppConfig(parsed.config ?? {})
    }
    saveData(data)
  } catch {
    // Migration failed — start fresh
  }
}

// In-memory cache
let cachedData: AppData | null = null

export function getData(): AppData {
  if (!cachedData) cachedData = loadData()
  return cachedData
}

export function setData(key: keyof AppData, value: AppData[keyof AppData]): void {
  const data = getData()
  ;(data as any)[key] = value
  cachedData = data
  saveData(data)
}

export function getAppData(): AppData {
  const data = getData()
  return { ...data, apiConfig: getApiConfigPublic() }
}

export function setAppDataKey(key: keyof AppData, value: AppData[keyof AppData]): void {
  setData(key, value)
}

export function notifyAllWindows(): void {
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
    return getAppData()
  })

  ipcMain.handle('get-operations', (_event, since?: string) => {
    return loadOperations(since)
  })

  // --- API Config ---

  ipcMain.handle('get-api-config', () => {
    return getApiConfig()
  })

  ipcMain.handle('save-api-config', (_event, config: unknown) => {
    if (!isRecord(config)) return
    const current = getApiConfig()
    const next: ApiConfig = {
      enabled: typeof config.enabled === 'boolean' ? config.enabled : current.enabled,
      apiKey: typeof config.apiKey === 'string' ? config.apiKey : current.apiKey,
      port: typeof config.port === 'number' ? config.port : current.port
    }
    // Generate key on first enable if empty
    if (next.enabled && !next.apiKey) {
      next.apiKey = 'top5_' + randomUUID()
    }
    saveApiConfig(next)
    notifyAllWindows()
    // Restart API server to apply config changes (enable/disable/port/key)
    // Dynamic import to avoid circular dependency (server.ts imports from store.ts)
    import('./api/server').then(({ restartApiServer, stopApiServer }) => {
      if (next.enabled) {
        restartApiServer().catch((err: unknown) => console.error('[API] Restart failed:', err))
      } else {
        stopApiServer().catch((err: unknown) => console.error('[API] Stop failed:', err))
      }
    })
    return next
  })

  // --- Projects --- (thin IPC adapters → service/projects.ts)

  ipcMain.handle('save-project', (_event, project: unknown) => {
    // IPC does upsert (backward compat with UI)
    if (!isValidProject(project)) return getData().projects
    const exists = getData().projects.some((p) => p.id === project.id)
    const result = exists
      ? projectService.updateProject(project.id, project)
      : projectService.createProject(project)
    if (isServiceError(result)) return getData().projects
    if (winsService.checkWinCondition()) notifyAllWindows()
    notifyAllWindows()
    return result
  })

  ipcMain.handle('delete-project', (_event, projectId: string) => {
    if (typeof projectId !== 'string') return getData().projects
    const result = projectService.deleteProject(projectId)
    if (isServiceError(result)) return getData().projects
    return result
  })

  ipcMain.handle('save-quick-notes', (_event, notes: string) => {
    setData('quickNotes', notes)
  })

  ipcMain.handle('save-config', (_event, config: unknown) => {
    if (!isValidAppConfig(config)) return
    setData('config', normalizeAppConfig(config))
  })

  ipcMain.handle('archive-project', (_event, projectId: string) => {
    if (typeof projectId !== 'string') return getData().projects
    const result = projectService.archiveProject(projectId)
    if (isServiceError(result)) return getData().projects
    return result
  })

  ipcMain.handle('unarchive-project', (_event, projectId: string) => {
    if (typeof projectId !== 'string') return { projects: getData().projects }
    const result = projectService.unarchiveProject(projectId)
    if (isServiceError(result)) {
      if (result.error === 'active_limit') {
        const limit = getActiveProjectsLimit(getData().config)
        return { error: `Cannot restore: ${limit} active projects already. Archive or suspend one first.` }
      }
      return { projects: getData().projects }
    }
    notifyAllWindows()
    return result
  })

  ipcMain.handle('suspend-project', (_event, projectId: string) => {
    if (typeof projectId !== 'string') return getData().projects
    const result = projectService.suspendProject(projectId)
    if (isServiceError(result)) return getData().projects
    return result
  })

  ipcMain.handle('unsuspend-project', (_event, projectId: string) => {
    if (typeof projectId !== 'string') return { projects: getData().projects }
    const result = projectService.unsuspendProject(projectId)
    if (isServiceError(result)) {
      if (result.error === 'active_limit') {
        const limit = getActiveProjectsLimit(getData().config)
        return { error: `Cannot restore: ${limit} active projects already. Archive or suspend one first.` }
      }
      return { projects: getData().projects }
    }
    notifyAllWindows()
    return result
  })

  ipcMain.handle('save-focus-checkin', (_event, checkIn: unknown) => {
    const normalized = toFocusCheckIn(checkIn)
    if (!normalized) return loadCheckIns()
    appendCheckIn(normalized)
    notifyAllWindows()
    return loadCheckIns()
  })

  ipcMain.handle('get-focus-checkins', (_event, taskId?: string) => {
    const checkIns = loadCheckIns()
    if (taskId) {
      return checkIns.filter((c) => c.taskId === taskId)
    }
    return checkIns
  })

  // --- Quick Tasks --- (thin IPC adapters → service/quick-tasks.ts)

  ipcMain.handle('save-quick-task', (_event, task: unknown) => {
    const result = quickTaskService.saveQuickTask(task)
    if (isServiceError(result)) return getData().quickTasks
    notifyAllWindows()
    return result
  })

  ipcMain.handle('remove-quick-task', (_event, id: string) => {
    if (typeof id !== 'string') return getData().quickTasks
    const result = quickTaskService.removeQuickTask(id)
    if (isServiceError(result)) return getData().quickTasks
    notifyAllWindows()
    return result
  })

  ipcMain.handle('complete-quick-task', (_event, id: string) => {
    if (typeof id !== 'string') return getData().quickTasks
    const result = quickTaskService.completeQuickTask(id)
    if (isServiceError(result)) return getData().quickTasks
    if (winsService.checkWinCondition()) notifyAllWindows()
    notifyAllWindows()
    return result
  })

  ipcMain.handle('uncomplete-quick-task', (_event, id: string) => {
    if (typeof id !== 'string') return getData().quickTasks
    const result = quickTaskService.uncompleteQuickTask(id)
    if (isServiceError(result)) return getData().quickTasks
    notifyAllWindows()
    return result
  })

  ipcMain.handle('reorder-quick-tasks', (_event, orderedIds: string[]) => {
    const result = quickTaskService.reorderQuickTasks(orderedIds)
    if (isServiceError(result)) return getData().quickTasks
    return result
  })

  ipcMain.handle('toggle-quick-task-in-progress', (_event, id: string) => {
    if (typeof id !== 'string') return getData().quickTasks
    const result = quickTaskService.toggleQuickTaskInProgress(id)
    if (isServiceError(result)) return getData().quickTasks
    notifyAllWindows()
    return result
  })

  // --- Projects: reorder & toggle --- (thin IPC adapters → service/projects.ts)

  ipcMain.handle('reorder-projects', (_event, orderedIds: string[]) => {
    const result = projectService.reorderProjects(orderedIds)
    if (isServiceError(result)) return getData().projects
    notifyAllWindows()
    return result
  })

  ipcMain.handle('reorder-pinned-tasks', (_event, updates: unknown) => {
    const result = projectService.reorderPinnedTasks(updates)
    if (isServiceError(result)) return getData().projects
    notifyAllWindows()
    return result
  })

  // --- Repeating Tasks --- (thin IPC adapters → service/repeating-tasks.ts)

  ipcMain.handle('save-repeating-task', (_event, task: unknown) => {
    const result = repeatingTaskService.saveRepeatingTask(task)
    if (isServiceError(result)) return getData().repeatingTasks
    notifyAllWindows()
    return result
  })

  ipcMain.handle('remove-repeating-task', (_event, id: string) => {
    if (typeof id !== 'string') return getData().repeatingTasks
    const result = repeatingTaskService.removeRepeatingTask(id)
    if (isServiceError(result)) return getData().repeatingTasks
    notifyAllWindows()
    return result
  })

  ipcMain.handle('reorder-repeating-tasks', (_event, orderedIds: string[]) => {
    const result = repeatingTaskService.reorderRepeatingTasks(orderedIds)
    if (isServiceError(result)) return getData().repeatingTasks
    return result
  })

  ipcMain.handle('accept-repeating-proposal', (_event, repeatingTaskId: string) => {
    if (typeof repeatingTaskId !== 'string') return getData().quickTasks
    const result = repeatingTaskService.acceptRepeatingProposal(repeatingTaskId)
    if (isServiceError(result)) return getData().quickTasks
    notifyAllWindows()
    return result.quickTasks
  })

  ipcMain.handle('dismiss-repeating-proposal', (_event, repeatingTaskId: string) => {
    if (typeof repeatingTaskId !== 'string') return
    const result = repeatingTaskService.dismissRepeatingProposal(repeatingTaskId)
    if (isServiceError(result)) return
    notifyAllWindows()
  })

  ipcMain.handle('toggle-task-in-progress', (_event, projectId: string, taskId: string) => {
    if (typeof projectId !== 'string' || typeof taskId !== 'string') return getData().projects
    const result = projectService.toggleTaskInProgress(projectId, taskId)
    if (isServiceError(result)) return getData().projects
    notifyAllWindows()
    return result
  })

  ipcMain.handle('move-task-to-project', (_event, fromProjectId: string, toProjectId: string, taskId: string) => {
    if (typeof fromProjectId !== 'string' || typeof toProjectId !== 'string' || typeof taskId !== 'string') return getData().projects
    const result = projectService.moveTaskToProject(fromProjectId, toProjectId, taskId)
    if (isServiceError(result)) return getData().projects
    notifyAllWindows()
    return result
  })

  ipcMain.handle('toggle-task-to-do-next', (_event, projectId: string, taskId: string) => {
    if (typeof projectId !== 'string' || typeof taskId !== 'string') return getData().projects
    const result = projectService.toggleTaskToDoNext(projectId, taskId)
    if (isServiceError(result)) return getData().projects
    notifyAllWindows()
    return result
  })

  // --- Wins ---

  ipcMain.handle('wins-lock', (_event, tasks: unknown) => {
    if (!Array.isArray(tasks)) return getData().winsLock ?? null
    const refs: LockedTaskRef[] = tasks.filter(
      (t): t is LockedTaskRef => isRecord(t) && (t.kind === 'quick' || t.kind === 'pinned')
    )
    return winsService.lockTasks(refs)
  })

  ipcMain.handle('wins-unlock', () => {
    return winsService.unlockTasks()
  })

  ipcMain.handle('wins-get-lock-state', () => {
    return getData().winsLock ?? null
  })

  ipcMain.handle('wins-get-history', () => {
    return winsService.loadWinHistory()
  })

  ipcMain.handle('wins-get-streaks', () => {
    return winsService.getStreaks()
  })

  ipcMain.handle('select-directory', async () => {
    const { dialog, BrowserWindow } = require('electron') as typeof import('electron')
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  // --- Obsidian task notes ---

  ipcMain.handle('open-task-note', (_event, taskId: string, taskTitle: string, projectName?: string, taskBadge?: string, noteRef?: string) => {
    if (typeof taskId !== 'string' || typeof taskTitle !== 'string') return { error: 'invalid' }
    const config = getData().config
    const storagePath = config.obsidianStoragePath
    if (!storagePath) return { error: 'no_path' }
    const vaultName = config.obsidianVaultName || basename(resolve(storagePath))

    const { shell } = require('electron') as typeof import('electron')

    // Sanitize names for filesystem (also collapse '..' to avoid path traversal)
    const sanitize = (s: string) => s.replace(/[/\\:*?"<>|]/g, '-').replace(/\.{2,}/g, '.').trim()

    let notePath: string
    let folderName: string
    let safeName: string

    if (typeof noteRef === 'string' && noteRef.startsWith('top5.storage/')) {
      // Use stored note reference (e.g. from split tasks)
      notePath = noteRef
      const parts = noteRef.replace('top5.storage/', '').split('/')
      folderName = parts[0]
      safeName = parts.slice(1).join('/')
    } else {
      const prefix = taskBadge ? `${sanitize(taskBadge)} ` : ''
      const truncated = taskTitle.length > 40 ? taskTitle.slice(0, 40) + '\u2026' : taskTitle
      safeName = `${prefix}${sanitize(truncated)}`
      folderName = projectName ? sanitize(projectName) : 'QuickTasks'
      notePath = `top5.storage/${folderName}/${safeName}`
    }

    const vaultPath = resolve(storagePath.replace(/\/+$/, ''))

    // Ensure directory exists so Obsidian can write the file
    const noteDir = join(vaultPath, 'top5.storage', folderName)
    mkdirSync(noteDir, { recursive: true })

    const filePath = join(noteDir, `${safeName}.md`)
    const fileExists = existsSync(filePath)

    if (fileExists) {
      // File exists — just open it
      const uri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(notePath)}`
      shell.openExternal(uri)
    } else {
      // File doesn't exist — use obsidian://new to create and open
      const content = projectName
        ? `# ${taskTitle}\n\nProject: ${projectName}\n\n---\n\n`
        : `# ${taskTitle}\n\n---\n\n`
      const uri = `obsidian://new?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(notePath)}&content=${encodeURIComponent(content)}`
      shell.openExternal(uri)
    }

    return { ok: true }
  })

  // Deadline check on start + periodic
  winsService.checkDeadline()
  setInterval(() => {
    if (winsService.checkDeadline()) {
      notifyAllWindows()
    }
  }, 60_000)
}
