import { app, BrowserWindow, shell, ipcMain, globalShortcut, screen, Menu } from 'electron'
import { join, resolve } from 'path'
import { is, optimizer, electronApp } from '@electron-toolkit/utils'
import { registerStoreHandlers, getAppData, setAppDataKey, IS_DEV } from './store'
import { registerLauncherHandlers } from './launchers'
import { registerFocusHandlers } from './focus-window'
import { registerGlobalShortcut, registerLocalShortcuts } from './shortcuts'
import { registerQuickAddHandlers } from './quick-add-window'
import { registerNudgeHandlers, startNudgeMonitor, stopNudgeMonitor } from './nudge'
import { getRepeatingTaskProposals, dateKey } from '../shared/schedule'
import type { QuickTask } from '../shared/types'
import { getVisibleTasks } from '../shared/task-list'
import { CLEAN_VIEW_ROW_HEIGHT, CLEAN_VIEW_SEPARATOR_HEIGHT, CLEAN_VIEW_HEADER_HEIGHT, CLEAN_VIEW_MIN_HEIGHT, CLEAN_VIEW_WIDTH } from '../shared/constants'

let mainWindow: BrowserWindow | null = null
let savedBounds: Electron.Rectangle | null = null
let pendingDeepLinkUrl: string | null = null

function handleDeepLink(url: string): void {
  // Expected format: top5://project/<id>
  const match = url.match(/^top5:\/\/project\/(.+)$/)
  if (!match) return
  const projectId = decodeURIComponent(match[1])
  if (!mainWindow) {
    pendingDeepLinkUrl = url
    return
  }
  mainWindow.webContents.send('navigate-to-project', projectId)
  mainWindow.show()
  mainWindow.focus()
}

// Dev mode: separate app identity so dev and prod can run side by side
if (IS_DEV) {
  app.setPath('userData', join(app.getPath('userData'), '-dev'))
}

// Single instance lock — second launch forwards deep link to first instance
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    // On Windows/Linux the URL arrives as argv; on macOS it comes via open-url
    const url = argv.find((arg) => arg.startsWith('top5://'))
    if (url) handleDeepLink(url)
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// Register protocol — in dev mode pass the entry script so macOS launches the right app
if (is.dev && process.argv[1]) {
  app.setAsDefaultProtocolClient('top5', process.execPath, [resolve(process.argv[1])])
} else {
  app.setAsDefaultProtocolClient('top5')
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  if (mainWindow && mainWindow.webContents) {
    handleDeepLink(url)
  } else {
    pendingDeepLinkUrl = url
  }
})

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
    if (pendingDeepLinkUrl) {
      handleDeepLink(pendingDeepLinkUrl)
      pendingDeepLinkUrl = null
    }
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

  // macOS application menu — enables Cmd+H, Cmd+Q, etc.
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { label: `Hide ${app.name}`, accelerator: 'Command+H', click: () => { app.hide() } },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      }
    ]))
  }

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
  registerNudgeHandlers(ipcMain)
  registerGlobalShortcut(globalShortcut, () => mainWindow)
  createWindow()
  registerLocalShortcuts(mainWindow!)

  startNudgeMonitor()

  // Start HTTP API server (if enabled in config)
  import('./api/server').then(({ startApiServer }) =>
    startApiServer().catch((err) => console.error('[API] Start failed:', err))
  )

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
    const width = CLEAN_VIEW_WIDTH
    // Count visible rows to match renderer logic (uses shared getVisibleTasks)
    const today = dateKey(new Date())
    const qts: QuickTask[] = data.quickTasks ?? []
    const { repeating, scheduled, withinLimit } = getVisibleTasks({
      quickTasks: qts,
      projects: data.projects ?? [],
      configLimit: limit
    })
    const completedToday = qts.filter((t) => t.completed && t.completedAt?.startsWith(today))
    const proposalCount = getRepeatingTaskProposals({
      repeatingTasks: data.repeatingTasks ?? [],
      quickTasks: qts,
      dismissedRepeating: data.dismissedRepeating ?? {}
    }).length
    const visibleRegularCount = scheduled.length + withinLimit.length
    const repeatingActiveCount = repeating.length
    const totalRows = visibleRegularCount + repeatingActiveCount + proposalCount + completedToday.length
    // Separators: only when preceding section has content
    const hasRepeating = repeatingActiveCount + proposalCount > 0
    const hasCompleted = completedToday.length > 0
    const separators = (hasRepeating && visibleRegularCount > 0 ? 1 : 0) + (hasCompleted && (visibleRegularCount > 0 || hasRepeating) ? 1 : 0)
    // Header ≈ 130, each row ≈ 34px, each separator ≈ 20px, bottom padding 12px
    const height = Math.min(Math.max(totalRows * CLEAN_VIEW_ROW_HEIGHT + separators * CLEAN_VIEW_SEPARATOR_HEIGHT + CLEAN_VIEW_HEADER_HEIGHT, CLEAN_VIEW_MIN_HEIGHT), workArea.height)
    mainWindow.setMinimumSize(width, 100)
    mainWindow.setBounds({
      x: bounds.x + Math.round((bounds.width - width) / 2),
      y: bounds.y,
      width,
      height
    })
    mainWindow.setResizable(true)
    mainWindow.setAlwaysOnTop(true)
    if (process.platform === 'darwin') {
      mainWindow.setWindowButtonVisibility(false)
    }
  })

  ipcMain.handle('exit-clean-view', () => {
    if (!mainWindow) return
    mainWindow.setAlwaysOnTop(false)
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
  stopNudgeMonitor()
})
