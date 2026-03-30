import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { IpcMain } from 'electron'

let quickAddWindow: BrowserWindow | null = null

export function createQuickAddWindow(): void {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    quickAddWindow.focus()
    return
  }

  const display = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = display.workAreaSize
  const winW = 520
  const winH = 300

  quickAddWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x: Math.round(display.workArea.x + (screenW - winW) / 2),
    y: Math.max(display.workArea.y, Math.round(display.workArea.y + (screenH - winH) / 2 - 80)),
    show: false,
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

  quickAddWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  quickAddWindow.setAlwaysOnTop(true, 'screen-saver')

  quickAddWindow.once('ready-to-show', () => {
    quickAddWindow?.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    quickAddWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#quick-add')
  } else {
    quickAddWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'quick-add' })
  }

  quickAddWindow.on('closed', () => {
    quickAddWindow = null
  })
}

export function toggleQuickAddWindow(): void {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    quickAddWindow.close()
    quickAddWindow = null
  } else {
    createQuickAddWindow()
  }
}

export function registerQuickAddHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('close-quick-add-window', () => {
    if (quickAddWindow && !quickAddWindow.isDestroyed()) {
      quickAddWindow.close()
      quickAddWindow = null
    }
  })

  ipcMain.handle('resize-quick-add-window', (_e, height: number) => {
    if (quickAddWindow && !quickAddWindow.isDestroyed()) {
      const [w] = quickAddWindow.getSize()
      const pos = quickAddWindow.getPosition()
      const display = screen.getPrimaryDisplay()
      const maxY = display.workArea.y + display.workAreaSize.height
      const maxH = Math.min(Math.ceil(height), maxY - pos[1])
      quickAddWindow.setSize(w, maxH)
    }
  })
}
