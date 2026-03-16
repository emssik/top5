import { BrowserWindow, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { execFile } from 'child_process'
import { is } from '@electron-toolkit/utils'
import type { IpcMain } from 'electron'
import { randomUUID } from 'crypto'
import { appendCheckIn, appendOperation, getAppData, loadCheckIns, setAppDataKey } from './store'
import { STANDALONE_PROJECT_ID } from '../shared/constants'

let focusWindow: BrowserWindow | null = null
let focusMenuWindow: BrowserWindow | null = null
let checkInWindow: BrowserWindow | null = null
let operationLogWindow: BrowserWindow | null = null
let checkInTimeout: ReturnType<typeof setTimeout> | null = null
let countdownInterval: ReturnType<typeof setInterval> | null = null
let checkInDeadline: number = 0
let lastCheckInAt: number = 0
let focusStartedAt: number = 0
let focusTaskInfo: { projectId?: string; projectName?: string; taskTitle?: string } = {}

const CHECK_IN_INTERVAL_MS = 15 * 60 * 1000

export function getFocusWindow(): BrowserWindow | null {
  return focusWindow
}

function startCheckInTimer(): void {
  clearCheckInTimer()
  lastCheckInAt = Date.now()
  checkInDeadline = Date.now() + CHECK_IN_INTERVAL_MS

  // Send countdown updates to focus window every second
  countdownInterval = setInterval(() => {
    if (focusWindow && !focusWindow.isDestroyed()) {
      const remaining = Math.max(0, checkInDeadline - Date.now())
      focusWindow.webContents.send('checkin-countdown', remaining)
    }
  }, 1000)

  checkInTimeout = setTimeout(() => {
    clearCountdownInterval()
    if (focusWindow && !focusWindow.isDestroyed()) {
      focusWindow.webContents.send('checkin-countdown', 0)
    }
    showCheckInPopup()
  }, CHECK_IN_INTERVAL_MS)
}

function clearCountdownInterval(): void {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

function clearCheckInTimer(): void {
  if (checkInTimeout) {
    clearTimeout(checkInTimeout)
    checkInTimeout = null
  }
  clearCountdownInterval()
}

function playCheckInSound(): void {
  // Play macOS system notification sound
  execFile('afplay', ['/System/Library/Sounds/Tink.aiff'])
}

const CHECKIN_SHORTCUT_KEYS = ['1', '2', '3'] as const
const CHECKIN_RESPONSES: Record<string, 'yes' | 'a_little' | 'no'> = {
  '1': 'yes',
  '2': 'a_little',
  '3': 'no'
}

function registerCheckInShortcuts(): void {
  for (const key of CHECKIN_SHORTCUT_KEYS) {
    globalShortcut.register(key, () => {
      if (!checkInWindow || checkInWindow.isDestroyed()) return
      checkInWindow.webContents.send('checkin-respond', CHECKIN_RESPONSES[key])
    })
  }
}

function unregisterCheckInShortcuts(): void {
  for (const key of CHECKIN_SHORTCUT_KEYS) {
    globalShortcut.unregister(key)
  }
}

function showCheckInPopup(): void {
  if (checkInWindow && !checkInWindow.isDestroyed()) return
  if (!focusWindow || focusWindow.isDestroyed()) return

  playCheckInSound()

  const focusBounds = focusWindow.getBounds()
  const display = screen.getDisplayNearestPoint({ x: focusBounds.x, y: focusBounds.y })

  const popupWidth = 340
  const popupHeight = 200

  // Position below the focus bar, right-aligned with it
  const x = Math.min(
    focusBounds.x + focusBounds.width - popupWidth,
    display.workArea.x + display.workArea.width - popupWidth
  )
  const y = focusBounds.y + focusBounds.height + 8

  checkInWindow = new BrowserWindow({
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

  checkInWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  checkInWindow.setAlwaysOnTop(true, 'screen-saver')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    checkInWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#checkin')
  } else {
    checkInWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'checkin' })
  }

  checkInWindow.on('closed', () => {
    unregisterCheckInShortcuts()
    checkInWindow = null
  })

  registerCheckInShortcuts()
}

function closeCheckInPopup(): void {
  unregisterCheckInShortcuts()
  if (checkInWindow && !checkInWindow.isDestroyed()) {
    checkInWindow.close()
    checkInWindow = null
  }
}

function resolveFocusTask(): { projectId?: string; projectName?: string; taskTitle?: string } {
  const { config, projects, quickTasks } = getAppData()
  const pid = config.focusProjectId
  const tid = config.focusTaskId
  if (!pid || !tid) return {}

  if (pid === STANDALONE_PROJECT_ID) {
    const qt = (quickTasks ?? []).find((t) => t.id === tid)
    if (qt?.projectId) {
      const project = projects.find((p) => p.id === qt.projectId)
      return { projectId: qt.projectId, projectName: project?.name, taskTitle: qt?.title }
    }
    return { taskTitle: qt?.title }
  }

  const project = projects.find((p) => p.id === pid)
  const task = project?.tasks.find((t) => t.id === tid)
  return { projectId: pid, projectName: project?.name, taskTitle: task?.title }
}

/**
 * Auto-stop focus when the focused task is completed from outside the focus window.
 * Saves any unsaved time (since last check-in) as a check-in without prompting.
 */
export function stopFocusForCompletedTask(taskId: string): void {
  const { config } = getAppData()
  if (!config.focusTaskId || config.focusTaskId !== taskId) return
  if (!focusWindow || focusWindow.isDestroyed()) return

  // Save unsaved time as check-in (no prompt)
  if (lastCheckInAt > 0 && config.focusProjectId) {
    const unsavedMin = Math.floor((Date.now() - lastCheckInAt) / 60000)
    if (unsavedMin >= 1) {
      appendCheckIn({
        id: randomUUID().slice(0, 21),
        projectId: config.focusProjectId,
        taskId,
        timestamp: new Date().toISOString(),
        response: 'yes',
        minutes: unsavedMin
      })
    }
  }

  exitFocusMode()
}

let _getMainWindow: (() => BrowserWindow | null) | null = null

export function enterFocusMode(): { error: string } | undefined {
  if (focusWindow && !focusWindow.isDestroyed()) return { error: 'already_in_focus' }

  const mainWin = _getMainWindow?.() ?? null
  if (!mainWin) return { error: 'no_main_window' }

  // Hide main window
  mainWin.hide()

  // Always open on primary display
  const display = screen.getPrimaryDisplay()
  const { x: workX, y: workY, width: workWidth } = display.workArea

  const focusWidth = 520
  const focusHeight = 58

  // Create frameless focus window
  focusWindow = new BrowserWindow({
    width: focusWidth,
    height: focusHeight,
    x: workX + workWidth - focusWidth - 16,
    y: workY + 12,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    roundedCorners: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Keep on all Spaces but allow moving between monitors
  focusWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  focusWindow.setAlwaysOnTop(true, 'floating')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    focusWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#focus')
  } else {
    focusWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'focus' })
  }

  focusWindow.on('closed', () => {
    focusWindow = null
  })

  focusStartedAt = Date.now()
  focusTaskInfo = resolveFocusTask()
  appendOperation({ type: 'focus_started', ...focusTaskInfo })

  startCheckInTimer()
  return undefined
}

export function exitFocusMode(): { error: string } | undefined {
  if (!focusWindow || focusWindow.isDestroyed()) return { error: 'not_in_focus' }

  const mainWin = _getMainWindow?.() ?? null

  // Log focus end with reported (check-in) time
  const reportedMinutes = focusStartedAt
    ? loadCheckIns()
        .filter((c) => new Date(c.timestamp).getTime() >= focusStartedAt)
        .reduce((sum, c) => sum + (c.minutes ?? (c.response === 'yes' ? 15 : c.response === 'a_little' ? 7 : 0)), 0)
    : 0
  appendOperation({ type: 'focus_ended', ...focusTaskInfo, details: `${reportedMinutes}min` })
  focusStartedAt = 0
  focusTaskInfo = {}

  // Clear focus state in store before showing main window
  const { config } = getAppData()
  setAppDataKey('config', { ...config, focusProjectId: null, focusTaskId: null })

  clearCheckInTimer()
  closeCheckInPopup()

  if (focusMenuWindow && !focusMenuWindow.isDestroyed()) {
    focusMenuWindow.close()
    focusMenuWindow = null
  }

  if (focusWindow && !focusWindow.isDestroyed()) {
    focusWindow.close()
    focusWindow = null
  }

  if (mainWin) {
    // Tell main window to reload data
    mainWin.webContents.send('reload-data')
    mainWin.show()
    mainWin.focus()
  }
  return undefined
}

export function getFocusStatus(): {
  active: boolean
  projectId?: string
  taskId?: string
  projectName?: string
  taskTitle?: string
  startedAt?: number
  elapsedMs?: number
} {
  const { config } = getAppData()
  const active = !!(focusWindow && !focusWindow.isDestroyed())
  if (!active) return { active: false }
  return {
    active: true,
    projectId: config.focusProjectId ?? undefined,
    taskId: config.focusTaskId ?? undefined,
    projectName: focusTaskInfo.projectName,
    taskTitle: focusTaskInfo.taskTitle,
    startedAt: focusStartedAt || undefined,
    elapsedMs: focusStartedAt ? Date.now() - focusStartedAt : undefined,
  }
}

export function registerFocusHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  _getMainWindow = getMainWindow

  ipcMain.handle('enter-focus-mode', () => enterFocusMode())

  ipcMain.handle('exit-focus-mode', () => exitFocusMode())

  ipcMain.handle('get-focus-unsaved-ms', () => {
    if (!lastCheckInAt) return 0
    return Date.now() - lastCheckInAt
  })

  ipcMain.handle('dismiss-checkin', () => {
    closeCheckInPopup()
    // Start next timer only after user responds
    if (focusWindow && !focusWindow.isDestroyed()) {
      startCheckInTimer()
    }
  })

  ipcMain.handle('switch-focus-task', (_event, projectId: string, taskId: string) => {
    if (!focusWindow || focusWindow.isDestroyed()) return

    const { config } = getAppData()
    setAppDataKey('config', { ...config, focusProjectId: projectId, focusTaskId: taskId })
    focusTaskInfo = resolveFocusTask()

    // Reset check-in timer for the new task
    startCheckInTimer()

    // Notify all windows (focus + main) to reload data
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('reload-data')
      }
    }
  })

  ipcMain.handle('resize-focus-window', (_event, width: number, height: number) => {
    if (!focusWindow || focusWindow.isDestroyed()) return
    focusWindow.setMinimumSize(width, height)
    focusWindow.setSize(width, height)
  })

  let pendingMenuItems: { id: string; label: string; type?: 'separator' }[] = []

  ipcMain.handle('show-focus-context-menu', (_event, items: { id: string; label: string; type?: 'separator' }[], clickX: number, clickY: number) => {
    if (!focusWindow || focusWindow.isDestroyed()) return

    // Toggle — close if already open
    if (focusMenuWindow && !focusMenuWindow.isDestroyed()) {
      focusMenuWindow.close()
      focusMenuWindow = null
      return
    }

    pendingMenuItems = items

    const focusBounds = focusWindow.getBounds()
    const display = screen.getDisplayNearestPoint({ x: focusBounds.x, y: focusBounds.y })
    const workArea = display.workArea

    const popupWidth = 200
    const itemCount = items.filter((i) => i.type !== 'separator').length
    const sepCount = items.filter((i) => i.type === 'separator').length
    const popupHeight = itemCount * 30 + sepCount * 9 + 12

    // Position at click coords (translated to screen), clamped to screen edges
    const rawX = focusBounds.x + clickX
    const rawY = focusBounds.y + clickY
    const x = Math.min(rawX, workArea.x + workArea.width - popupWidth)
    const y = Math.min(rawY, workArea.y + workArea.height - popupHeight)

    focusMenuWindow = new BrowserWindow({
      width: popupWidth,
      height: popupHeight,
      x,
      y,
      frame: false,
      transparent: false,
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

    focusMenuWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    focusMenuWindow.setAlwaysOnTop(true, 'screen-saver')

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      focusMenuWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#focus-menu')
    } else {
      focusMenuWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'focus-menu' })
    }

    focusMenuWindow.on('blur', () => {
      if (focusMenuWindow && !focusMenuWindow.isDestroyed()) {
        focusMenuWindow.close()
      }
      focusMenuWindow = null
    })

    focusMenuWindow.on('closed', () => {
      focusMenuWindow = null
    })
  })

  ipcMain.handle('get-focus-menu-items', () => {
    return pendingMenuItems
  })

  ipcMain.handle('focus-menu-click', (_event, actionId: string) => {
    if (focusMenuWindow && !focusMenuWindow.isDestroyed()) {
      focusMenuWindow.close()
      focusMenuWindow = null
    }
    if (focusWindow && !focusWindow.isDestroyed()) {
      focusWindow.webContents.send('focus-menu-action', actionId)
    }
  })

  ipcMain.handle('show-project-in-main', (_event, projectId: string) => {
    const mainWin = getMainWindow()
    if (!mainWin) return
    mainWin.webContents.send('navigate-to-project', projectId)
    mainWin.show()
    mainWin.focus()
  })

  ipcMain.handle('open-operation-log-window', (_event, filter?: string) => {
    if (operationLogWindow && !operationLogWindow.isDestroyed()) {
      operationLogWindow.close()
      operationLogWindow = null
    }

    const hash = filter
      ? `operation-log?filter=${encodeURIComponent(filter)}`
      : 'operation-log'

    operationLogWindow = new BrowserWindow({
      width: 520,
      height: 600,
      resizable: true,
      title: 'Activity Log',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      operationLogWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + hash)
    } else {
      operationLogWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash })
    }

    operationLogWindow.on('closed', () => {
      operationLogWindow = null
    })
  })
}
