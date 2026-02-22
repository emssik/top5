import { BrowserWindow, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { execFile } from 'child_process'
import { is } from '@electron-toolkit/utils'
import type { IpcMain } from 'electron'
import { appendOperation, getAppData, loadCheckIns, setAppDataKey } from './store'

let focusWindow: BrowserWindow | null = null
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

  if (pid === '__standalone__') {
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

export function registerFocusHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('enter-focus-mode', () => {
    if (focusWindow && !focusWindow.isDestroyed()) return

    const mainWin = getMainWindow()
    if (!mainWin) return

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
  })

  ipcMain.handle('exit-focus-mode', () => {
    const mainWin = getMainWindow()

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
  })

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
