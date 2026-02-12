import type { BrowserWindow, GlobalShortcut, Screen } from 'electron'
import { getAppData } from './store'

function showAndFocus(win: BrowserWindow): void {
  if (!win.isVisible()) {
    win.show()
  }
  win.focus()
}

export function registerShortcuts(
  globalShortcutModule: GlobalShortcut,
  getMainWindow: () => BrowserWindow | null,
  _screen: Screen,
  getIsCompactMode: () => boolean = () => false,
  exitCompactMode: () => void = () => {}
): void {
  const { config } = getAppData()
  const shortcuts = config?.actionShortcuts || {}

  // Toggle app visibility
  const toggleShortcut = shortcuts['toggle-app'] || config?.globalShortcut || 'CommandOrControl+Shift+Space'
  globalShortcutModule.register(toggleShortcut, () => {
    const win = getMainWindow()
    if (!win) return

    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })

  // Project shortcuts (Cmd+1 through Cmd+5)
  for (let i = 1; i <= 5; i++) {
    const key = `project-${i}`
    const shortcut = shortcuts[key]
    if (shortcut) {
      globalShortcutModule.register(shortcut, () => {
        const win = getMainWindow()
        if (!win) return
        showAndFocus(win)
        if (getIsCompactMode()) {
          exitCompactMode()
        }
        win.webContents.send('shortcut-action', { action: 'select-project', index: i - 1 })
      })
    }
  }

  // Quick notes
  const quickNotesShortcut = shortcuts['quick-notes']
  if (quickNotesShortcut) {
    globalShortcutModule.register(quickNotesShortcut, () => {
      const win = getMainWindow()
      if (!win) return
      showAndFocus(win)
      win.webContents.send('shortcut-action', { action: 'toggle-quick-notes' })
    })
  }

  // Toggle focus
  const focusShortcut = shortcuts['toggle-focus']
  if (focusShortcut) {
    globalShortcutModule.register(focusShortcut, () => {
      const win = getMainWindow()
      if (!win) return
      showAndFocus(win)
      win.webContents.send('shortcut-action', { action: 'toggle-focus' })
    })
  }
}
