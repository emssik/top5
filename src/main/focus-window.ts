import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { execFile } from 'child_process'
import { is } from '@electron-toolkit/utils'
import type { IpcMain } from 'electron'
import { getAppData, setAppDataKey } from './store'

let focusWindow: BrowserWindow | null = null
let checkInWindow: BrowserWindow | null = null
let statsWindow: BrowserWindow | null = null
let newProjectWindow: BrowserWindow | null = null
let checkInTimeout: ReturnType<typeof setTimeout> | null = null
let countdownInterval: ReturnType<typeof setInterval> | null = null
let checkInDeadline: number = 0
let lastCheckInAt: number = 0

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
    checkInWindow = null
  })
}

function closeCheckInPopup(): void {
  if (checkInWindow && !checkInWindow.isDestroyed()) {
    checkInWindow.close()
    checkInWindow = null
  }
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

    const focusWidth = 420
    const focusHeight = 110

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

    startCheckInTimer()
  })

  ipcMain.handle('exit-focus-mode', () => {
    const mainWin = getMainWindow()

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

  ipcMain.handle('open-new-project-window', () => {
    if (newProjectWindow && !newProjectWindow.isDestroyed()) {
      newProjectWindow.focus()
      return
    }

    newProjectWindow = new BrowserWindow({
      width: 500,
      height: 500,
      resizable: true,
      title: 'New Project',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      newProjectWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#new-project')
    } else {
      newProjectWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'new-project' })
    }

    newProjectWindow.on('closed', () => {
      newProjectWindow = null
      const mainWin = getMainWindow()
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('reload-data')
      }
    })
  })

  ipcMain.handle('close-new-project-window', () => {
    if (newProjectWindow && !newProjectWindow.isDestroyed()) {
      newProjectWindow.close()
      newProjectWindow = null
    }
  })

  ipcMain.handle('open-stats-window', () => {
    if (statsWindow && !statsWindow.isDestroyed()) {
      statsWindow.close()
      statsWindow = null
      return
    }

    statsWindow = new BrowserWindow({
      width: 600,
      height: 500,
      resizable: true,
      title: 'Work Stats',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      statsWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#stats')
    } else {
      statsWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'stats' })
    }

    statsWindow.on('closed', () => {
      statsWindow = null
    })
  })
}
