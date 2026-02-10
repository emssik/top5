import type { BrowserWindow, GlobalShortcut, Screen } from 'electron'
import { getStore } from './store'
import { getFocusWindow } from './focus-window'

export function registerShortcuts(
  globalShortcutModule: GlobalShortcut,
  getMainWindow: () => BrowserWindow | null,
  _screen: Screen
): void {
  const store = getStore()
  const config = store.get('config')

  const shortcut = config?.globalShortcut || 'CommandOrControl+Shift+Space'

  globalShortcutModule.register(shortcut, () => {
    // If focus window is open, ignore toggle (use Exit button in focus mode)
    const focusWin = getFocusWindow()
    if (focusWin && !focusWin.isDestroyed()) return

    const win = getMainWindow()
    if (!win) return

    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })
}
