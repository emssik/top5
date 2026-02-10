import { app, BrowserWindow, shell, ipcMain, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { is, optimizer, electronApp } from '@electron-toolkit/utils'
import { registerStoreHandlers } from './store'
import { registerLauncherHandlers } from './launchers'
import { registerFocusHandlers, getFocusWindow } from './focus-window'
import { registerShortcuts } from './shortcuts'

let mainWindow: BrowserWindow | null = null

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
  registerShortcuts(globalShortcut, () => mainWindow, screen)

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
