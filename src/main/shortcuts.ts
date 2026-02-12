import type { BrowserWindow, GlobalShortcut } from 'electron'
import { getAppData } from './store'

interface ParsedAccelerator {
  meta: boolean
  ctrl: boolean
  shift: boolean
  alt: boolean
  key: string
}

function parseAccelerator(accel: string): ParsedAccelerator | null {
  const parts = accel.split('+')
  const result: ParsedAccelerator = { meta: false, ctrl: false, shift: false, alt: false, key: '' }
  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower === 'commandorcontrol' || lower === 'cmdorctrl') {
      if (process.platform === 'darwin') result.meta = true
      else result.ctrl = true
    } else if (lower === 'shift') {
      result.shift = true
    } else if (lower === 'alt' || lower === 'option') {
      result.alt = true
    } else {
      result.key = lower
    }
  }
  return result.key ? result : null
}

function matchesInput(input: Electron.Input, parsed: ParsedAccelerator): boolean {
  return (
    input.type === 'keyDown' &&
    input.control === parsed.ctrl &&
    input.meta === parsed.meta &&
    input.shift === parsed.shift &&
    input.alt === parsed.alt &&
    input.key.toLowerCase() === parsed.key
  )
}

export function registerGlobalShortcut(
  globalShortcutModule: GlobalShortcut,
  getMainWindow: () => BrowserWindow | null
): void {
  const { config } = getAppData()
  const shortcuts = config?.actionShortcuts || {}

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
}

export function registerLocalShortcuts(
  win: BrowserWindow,
  getIsCompactMode: () => boolean,
  exitCompactMode: () => void
): void {
  const { config } = getAppData()
  const shortcuts = config?.actionShortcuts || {}

  type LocalBinding = { parsed: ParsedAccelerator; handler: () => void }
  const bindings: LocalBinding[] = []

  for (let i = 1; i <= 5; i++) {
    const accel = shortcuts[`project-${i}`]
    if (!accel) continue
    const parsed = parseAccelerator(accel)
    if (!parsed) continue
    bindings.push({
      parsed,
      handler: () => {
        if (getIsCompactMode()) exitCompactMode()
        win.webContents.send('shortcut-action', { action: 'select-project', index: i - 1 })
      }
    })
  }

  const quickNotesAccel = shortcuts['quick-notes']
  if (quickNotesAccel) {
    const parsed = parseAccelerator(quickNotesAccel)
    if (parsed) {
      bindings.push({
        parsed,
        handler: () => win.webContents.send('shortcut-action', { action: 'toggle-quick-notes' })
      })
    }
  }

  const focusAccel = shortcuts['toggle-focus']
  if (focusAccel) {
    const parsed = parseAccelerator(focusAccel)
    if (parsed) {
      bindings.push({
        parsed,
        handler: () => win.webContents.send('shortcut-action', { action: 'toggle-focus' })
      })
    }
  }

  win.webContents.on('before-input-event', (event, input) => {
    for (const { parsed, handler } of bindings) {
      if (matchesInput(input, parsed)) {
        event.preventDefault()
        handler()
        return
      }
    }
  })
}
