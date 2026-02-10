import { app, BrowserWindow, shell, ipcMain, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { is, optimizer, electronApp } from '@electron-toolkit/utils'
import { registerStoreHandlers, getAppData } from './store'
import { registerLauncherHandlers } from './launchers'
import { registerFocusHandlers, getFocusWindow } from './focus-window'
import { registerShortcuts } from './shortcuts'

let mainWindow: BrowserWindow | null = null
let savedBounds: Electron.Rectangle | null = null
let isCompactMode = false

function exitCompactMode(): void {
  if (!mainWindow || !isCompactMode) return
  isCompactMode = false
  mainWindow.setAlwaysOnTop(false)
  mainWindow.setResizable(true)
  mainWindow.setMinimumSize(600, 400)
  if (savedBounds) {
    mainWindow.setBounds(savedBounds)
    savedBounds = null
  }
  mainWindow.webContents.send('shortcut-action', { action: 'exit-compact-mode' })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 600,
    minHeight: 400,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // Hide instead of destroy on close (macOS pattern)
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow!.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
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

  createWindow()
  registerStoreHandlers(ipcMain)
  registerLauncherHandlers(ipcMain)
  registerFocusHandlers(ipcMain, () => mainWindow)
  registerShortcuts(globalShortcut, () => mainWindow, screen, () => isCompactMode, exitCompactMode)

  ipcMain.handle('enter-compact-mode', () => {
    if (!mainWindow || isCompactMode) return
    savedBounds = mainWindow.getBounds()
    isCompactMode = true
    const bounds = mainWindow.getBounds()
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
    const workArea = display.workArea
    const barWidth = 260
    // ~56px per project row + 60px for titlebar/expand button
    const data = getAppData()
    const activeCount = (data.projects || []).filter((p: any) => !p.archivedAt).length
    const barHeight = Math.min(Math.max(activeCount * 56 + 60, 150), workArea.height)
    mainWindow.setMinimumSize(barWidth, 100)
    mainWindow.setBounds({
      x: workArea.x + workArea.width - barWidth,
      y: workArea.y,
      width: barWidth,
      height: barHeight
    })
    mainWindow.setResizable(false)
    mainWindow.setAlwaysOnTop(true)
  })

  ipcMain.handle('exit-compact-mode', () => {
    exitCompactMode()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  (app as any).isQuitting = true
})
