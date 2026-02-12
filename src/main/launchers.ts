import { spawn } from 'child_process'
import { shell } from 'electron'
import type { IpcMain } from 'electron'

const ALLOWED_BROWSER_PROTOCOLS = new Set(['http:', 'https:'])
const ALLOWED_OBSIDIAN_COMMANDS = new Set(['open', 'vault'])

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function runDetached(command: string, args: string[]): void {
  const child = spawn(command, args, { detached: true, stdio: 'ignore' })
  child.unref()
}

function normalizeLocalPath(value: unknown): string | null {
  if (!isNonEmptyString(value)) return null
  return value.trim()
}

function normalizeBrowserUrl(value: unknown): string | null {
  if (!isNonEmptyString(value)) return null
  const raw = value.trim()

  const parse = (input: string): URL | null => {
    try {
      return new URL(input)
    } catch {
      return null
    }
  }

  const direct = parse(raw)
  const parsed = direct ?? (raw.includes('://') ? null : parse(`https://${raw}`))
  if (!parsed || !ALLOWED_BROWSER_PROTOCOLS.has(parsed.protocol)) return null
  return parsed.toString()
}

const ITERM_SCRIPT_LINES = [
  'on run argv',
  'set targetPath to item 1 of argv',
  'tell application "iTerm"',
  'activate',
  'if (count of windows) = 0 then',
  'create window with default profile',
  'end if',
  'tell current window',
  'create tab with default profile',
  'tell current session',
  'write text ("cd " & quoted form of targetPath)',
  'end tell',
  'end tell',
  'end tell',
  'end run'
]

export function registerLauncherHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('launch-vscode', (_event, path: unknown) => {
    const normalizedPath = normalizeLocalPath(path)
    if (!normalizedPath) return
    runDetached('code', [normalizedPath])
  })

  ipcMain.handle('launch-iterm', (_event, path: unknown) => {
    const normalizedPath = normalizeLocalPath(path)
    if (!normalizedPath) return
    const args = [...ITERM_SCRIPT_LINES.flatMap((line) => ['-e', line]), normalizedPath]
    runDetached('osascript', args)
  })

  ipcMain.handle('launch-obsidian', (_event, uri: unknown) => {
    if (!isNonEmptyString(uri)) return
    const trimmed = uri.trim()

    if (trimmed.startsWith('obsidian://')) {
      // Only allow whitelisted commands (open, vault)
      try {
        const parsed = new URL(trimmed)
        const command = parsed.pathname.replace(/^\/+/, '') || parsed.hostname
        if (!ALLOWED_OBSIDIAN_COMMANDS.has(command)) return
      } catch {
        return
      }
      shell.openExternal(trimmed)
    } else {
      shell.openExternal(`obsidian://open?vault=${encodeURIComponent(trimmed)}`)
    }
  })

  ipcMain.handle('launch-browser', (_event, url: unknown) => {
    const normalizedUrl = normalizeBrowserUrl(url)
    if (!normalizedUrl) return
    shell.openExternal(normalizedUrl)
  })
}
