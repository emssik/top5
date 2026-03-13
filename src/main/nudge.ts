import { BrowserWindow, powerMonitor, screen } from 'electron'
import { join } from 'path'
import { execFile } from 'child_process'
import { is } from '@electron-toolkit/utils'
import type { IpcMain } from 'electron'
import { getFocusWindow, enterFocusMode } from './focus-window'
import { createQuickAddWindow } from './quick-add-window'
import { getData, getAppData, setAppDataKey } from './store'
import type { Project, Task } from '../shared/types'

const POLL_INTERVAL_MS = 5_000 // DEBUG: 5s (prod: 30_000)
const IDLE_THRESHOLD_S = 120 // 2min — below this = user is active
const NUDGE_THRESHOLD_MS = 15 * 1000 // DEBUG: 15s (prod: 15 * 60 * 1000)

let pollInterval: ReturnType<typeof setInterval> | null = null
let cumulativeActiveMs = 0
let nudgeThresholdMs = NUDGE_THRESHOLD_MS
let nudgeWindow: BrowserWindow | null = null
let lastDate = todayKey()

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function hasUncompletedTasks(): boolean {
  const data = getData()
  const activeQuick = (data.quickTasks ?? []).filter((t) => !t.completed && !t.beyondLimit)
  if (activeQuick.length > 0) return true

  const pinnedCount = (data.projects ?? [])
    .filter((p: Project) => !p.archivedAt)
    .reduce(
      (n: number, p: Project) =>
        n + p.tasks.filter((t: Task) => t.isToDoNext && !t.completed && !t.beyondLimit).length,
      0
    )
  return pinnedCount > 0
}

function playNudgeSound(): void {
  execFile('afplay', ['/System/Library/Sounds/Funk.aiff'])
}

function showNudgeWindow(): void {
  if (nudgeWindow && !nudgeWindow.isDestroyed()) return

  playNudgeSound()

  const display = screen.getPrimaryDisplay()
  const { width: workWidth, height: workHeight, x: workX, y: workY } = display.workArea

  const popupWidth = 400
  const popupHeight = 360
  const x = workX + Math.round((workWidth - popupWidth) / 2)
  const y = workY + Math.round((workHeight - popupHeight) / 2)

  nudgeWindow = new BrowserWindow({
    width: popupWidth,
    height: popupHeight,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    roundedCorners: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  nudgeWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  nudgeWindow.setAlwaysOnTop(true, 'screen-saver')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    nudgeWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#nudge')
  } else {
    nudgeWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'nudge' })
  }

  nudgeWindow.on('closed', () => {
    nudgeWindow = null
  })
}

function closeNudgeWindow(): void {
  if (nudgeWindow && !nudgeWindow.isDestroyed()) {
    nudgeWindow.close()
    nudgeWindow = null
  }
}

function tick(): void {
  // Day change → full reset
  const today = todayKey()
  if (today !== lastDate) {
    lastDate = today
    cumulativeActiveMs = 0
    nudgeThresholdMs = NUDGE_THRESHOLD_MS
    return
  }

  // Focus mode active → reset, user is working
  if (getFocusWindow()) {
    cumulativeActiveMs = 0
    nudgeThresholdMs = NUDGE_THRESHOLD_MS
    return
  }

  // No uncompleted tasks → nothing to nudge about
  if (!hasUncompletedTasks()) {
    cumulativeActiveMs = 0
    nudgeThresholdMs = NUDGE_THRESHOLD_MS
    return
  }

  // Nudge already showing → don't accumulate
  if (nudgeWindow && !nudgeWindow.isDestroyed()) return

  // Check if user is active
  const idleSeconds = powerMonitor.getSystemIdleTime()
  if (idleSeconds < IDLE_THRESHOLD_S) {
    cumulativeActiveMs += POLL_INTERVAL_MS
  }

  // Threshold reached → show nudge
  if (cumulativeActiveMs >= nudgeThresholdMs) {
    showNudgeWindow()
  }
}

export function startNudgeMonitor(): void {
  if (pollInterval) return
  lastDate = todayKey()
  cumulativeActiveMs = 0
  nudgeThresholdMs = NUDGE_THRESHOLD_MS
  pollInterval = setInterval(tick, POLL_INTERVAL_MS)
}

export function stopNudgeMonitor(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  closeNudgeWindow()
}

export interface NudgeTask {
  projectId: string // '__standalone__' for quick tasks
  taskId: string
  title: string
  projectName?: string
  projectCode?: string
}

function getUncompletedTaskList(): NudgeTask[] {
  const data = getData()
  const tasks: NudgeTask[] = []

  // Quick tasks (standalone) — only top5, not beyond limit
  for (const qt of (data.quickTasks ?? []).filter((t) => !t.completed && !t.beyondLimit)) {
    const proj = qt.projectId ? (data.projects ?? []).find((p) => p.id === qt.projectId) : null
    tasks.push({
      projectId: '__standalone__',
      taskId: qt.id,
      title: qt.title,
      projectName: proj?.name,
      projectCode: proj?.code
    })
  }

  // Pinned project tasks
  for (const p of (data.projects ?? []).filter((p: Project) => !p.archivedAt)) {
    for (const t of p.tasks.filter((t: Task) => t.isToDoNext && !t.completed && !t.beyondLimit)) {
      tasks.push({
        projectId: p.id,
        taskId: t.id,
        title: t.title,
        projectName: p.name,
        projectCode: p.code
      })
    }
  }

  return tasks.slice(0, 7) // max 7 tasks in popup
}

export function registerNudgeHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('nudge-snooze', (_event, minutes: number) => {
    closeNudgeWindow()
    // Move threshold forward by N minutes of active time
    nudgeThresholdMs = cumulativeActiveMs + minutes * 60_000
  })

  ipcMain.handle('nudge-dismiss', () => {
    closeNudgeWindow()
    // User acknowledged — reset counter fully
    cumulativeActiveMs = 0
    nudgeThresholdMs = NUDGE_THRESHOLD_MS
  })

  ipcMain.handle('nudge-get-tasks', () => {
    return getUncompletedTaskList()
  })

  ipcMain.handle('nudge-start-focus', (_event, projectId: string, taskId: string) => {
    closeNudgeWindow()
    cumulativeActiveMs = 0
    nudgeThresholdMs = NUDGE_THRESHOLD_MS
    const appData = getAppData()
    setAppDataKey('config', { ...appData.config, focusProjectId: projectId, focusTaskId: taskId })
    return enterFocusMode()
  })

  ipcMain.handle('nudge-open-quick-add', () => {
    closeNudgeWindow()
    cumulativeActiveMs = 0
    nudgeThresholdMs = NUDGE_THRESHOLD_MS
    createQuickAddWindow()
  })
}
