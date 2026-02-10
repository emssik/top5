import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { IpcMain } from 'electron'
import { getStore } from './store'

let focusWindow: BrowserWindow | null = null

export function getFocusWindow(): BrowserWindow | null {
  return focusWindow
}

export function registerFocusHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('enter-focus-mode', () => {
    const mainWin = getMainWindow()
    if (!mainWin) return

    // Hide main window
    mainWin.hide()

    // Get current display
    const cursorPoint = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursorPoint)
    const { x: workX, y: workY, width: workWidth } = display.workArea

    const focusWidth = 420
    const focusHeight = 38

    // Create frameless focus window
    focusWindow = new BrowserWindow({
      width: focusWidth,
      height: focusHeight,
      x: workX + workWidth - focusWidth - 16,
      y: workY + 12,
      frame: false,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      visibleOnAllWorkspaces: true,
      hasShadow: true,
      roundedCorners: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    // Keep on all Spaces
    focusWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    focusWindow.setAlwaysOnTop(true, 'screen-saver')

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      focusWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      focusWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    focusWindow.on('closed', () => {
      focusWindow = null
    })
  })

  ipcMain.handle('exit-focus-mode', () => {
    const mainWin = getMainWindow()

    // Clear focus state in store before showing main window
    const store = getStore()
    const config = store.get('config')
    store.set('config', { ...config, focusProjectId: null, focusTaskId: null })

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
}
