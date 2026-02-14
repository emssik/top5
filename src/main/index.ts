import { app, BrowserWindow, shell, ipcMain, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { is, optimizer, electronApp } from '@electron-toolkit/utils'
import { registerStoreHandlers, getAppData, setAppDataKey, IS_DEV } from './store'
import { registerLauncherHandlers } from './launchers'
import { registerFocusHandlers } from './focus-window'
import { registerGlobalShortcut, registerLocalShortcuts } from './shortcuts'
import { registerQuickAddHandlers } from './quick-add-window'
import { getRepeatingTaskProposals } from '../shared/schedule'
import { startApiServer } from './api/server'

let mainWindow: BrowserWindow | null = null
let savedBounds: Electron.Rectangle | null = null

function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:'
  } catch {
    return false
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 600,
    minHeight: 400,
    show: false,
    title: IS_DEV ? '[DEV] Top5' : 'Top5',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (process.platform === 'darwin') {
      mainWindow!.setWindowButtonVisibility(false)
    }
    mainWindow!.show()
  })

  // Hide instead of destroy on close (macOS pattern)
  mainWindow.on('close', (e) => {
    if (!(app as unknown as Record<string, unknown>).isQuitting) {
      e.preventDefault()
      mainWindow!.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalUrl(details.url)) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.top5.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerStoreHandlers(ipcMain)

  // Clear stale focus state from previous session (no focus window exists at startup)
  const startupData = getAppData()
  if (startupData.config.focusProjectId || startupData.config.focusTaskId) {
    setAppDataKey('config', { ...startupData.config, focusProjectId: null, focusTaskId: null })
  }

  registerLauncherHandlers(ipcMain)
  registerFocusHandlers(ipcMain, () => mainWindow)
  registerQuickAddHandlers(ipcMain)
  registerGlobalShortcut(globalShortcut, () => mainWindow)
  createWindow()
  registerLocalShortcuts(mainWindow!)

  // Start HTTP API server (if enabled in config)
  startApiServer().catch((err) => console.error('[API] Start failed:', err))

  ipcMain.handle('enter-clean-view', () => {
    if (!mainWindow) return
    // Only save bounds if not already in clean view (avoid overwriting on startup restore)
    if (!savedBounds) {
      savedBounds = mainWindow.getBounds()
    }
    const bounds = mainWindow.getBounds()
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
    const workArea = display.workArea
    const data = getAppData()
    const limit = data.config.quickTasksLimit ?? 5
    const width = 340
    // Count visible rows to match renderer logic
    const today = new Date().toISOString().slice(0, 10)
    const qts: any[] = data.quickTasks ?? []
    const completedToday = qts.filter((t) => t.completed && t.completedAt?.startsWith(today))
    const regularCompleted = completedToday.filter((t) => !t.repeatingTaskId)
    const activeQuick = qts.filter((t) => !t.completed)
    const pinnedCount = (data.projects ?? [])
      .filter((p: any) => !p.archivedAt)
      .reduce((n: number, p: any) => n + p.tasks.filter((t: any) => t.isToDoNext && !t.completed).length, 0)
    const regularActiveCount = activeQuick.filter((t) => !t.repeatingTaskId).length + pinnedCount
    const repeatingActiveCount = activeQuick.filter((t) => t.repeatingTaskId).length
    const activeSlots = Math.max(0, limit - regularCompleted.length)
    const visibleRegularCount = Math.min(regularActiveCount, activeSlots)
    const proposalCount = getRepeatingTaskProposals({
      repeatingTasks: data.repeatingTasks ?? [],
      quickTasks: qts,
      dismissedRepeating: data.dismissedRepeating ?? [],
      dismissedRepeatingDate: data.dismissedRepeatingDate ?? ''
    }).length
    const totalRows = visibleRegularCount + repeatingActiveCount + proposalCount + completedToday.length
    // Separators: only when preceding section has content
    const hasRepeating = repeatingActiveCount + proposalCount > 0
    const hasCompleted = completedToday.length > 0
    const separators = (hasRepeating && visibleRegularCount > 0 ? 1 : 0) + (hasCompleted && (visibleRegularCount > 0 || hasRepeating) ? 1 : 0)
    // Header ≈ 130, each row ≈ 34px, each separator ≈ 20px, bottom padding 12px
    const height = Math.min(Math.max(totalRows * 34 + separators * 20 + 142, 240), workArea.height)
    mainWindow.setMinimumSize(width, 100)
    mainWindow.setBounds({
      x: bounds.x + Math.round((bounds.width - width) / 2),
      y: bounds.y,
      width,
      height
    })
    mainWindow.setResizable(true)
    if (process.platform === 'darwin') {
      mainWindow.setWindowButtonVisibility(false)
    }
  })

  ipcMain.handle('exit-clean-view', () => {
    if (!mainWindow) return
    mainWindow.setMinimumSize(600, 400)
    if (savedBounds) {
      mainWindow.setBounds(savedBounds)
      savedBounds = null
    }
    if (process.platform === 'darwin') {
      mainWindow.setWindowButtonVisibility(false)
    }
  })

  ipcMain.handle('open-dev-tools', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.webContents.openDevTools({ mode: 'detach' })
  })

  ipcMain.handle('set-traffic-lights-visible', (_event, visible: unknown) => {
    if (!mainWindow || process.platform !== 'darwin') return
    mainWindow.setWindowButtonVisibility(Boolean(visible))
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (mainWindow) {
      mainWindow.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  ;(app as unknown as Record<string, unknown>).isQuitting = true
})
