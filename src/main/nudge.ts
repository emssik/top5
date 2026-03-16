import { BrowserWindow, powerMonitor, screen } from 'electron'
import { join } from 'path'
import { execFile } from 'child_process'
import { is } from '@electron-toolkit/utils'
import type { IpcMain } from 'electron'
import { getFocusWindow, enterFocusMode } from './focus-window'
import { createQuickAddWindow } from './quick-add-window'
import { getData, getAppData, setAppDataKey } from './store'
import { getVisibleTasks } from '../shared/task-list'
import { dateKey } from '../shared/schedule'
import { STANDALONE_PROJECT_ID } from '../shared/constants'

const POLL_INTERVAL_MS = 30_000 // 30s
const IDLE_THRESHOLD_S = 120 // 2min — below this = user is active
const NUDGE_THRESHOLD_MS = 15 * 60 * 1000 // 15min cumulative active time

let pollInterval: ReturnType<typeof setInterval> | null = null
let cumulativeActiveMs = 0
let nudgeThresholdMs = NUDGE_THRESHOLD_MS
let nudgeWindow: BrowserWindow | null = null
let lastDate = dateKey(new Date())

function getVisibleTasksFromStore() {
  const data = getData()
  return getVisibleTasks({
    quickTasks: data.quickTasks ?? [],
    projects: data.projects ?? [],
    configLimit: data.config?.quickTasksLimit ?? 5
  })
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
  const today = dateKey(new Date())
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
  if (getVisibleTasksFromStore().allVisible.length === 0) {
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
  lastDate = dateKey(new Date())
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
  return getVisibleTasksFromStore().allVisible.map((t) => ({
    projectId: t.projectId ?? STANDALONE_PROJECT_ID,
    taskId: t.taskId ?? t.id,
    title: t.title,
    projectName: t.projectName,
    projectCode: t.projectCode
  }))
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
