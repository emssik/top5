import { exec } from 'child_process'
import { shell } from 'electron'
import type { IpcMain } from 'electron'

export function registerLauncherHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('launch-vscode', (_event, path: string) => {
    exec(`code "${path}"`)
  })

  ipcMain.handle('launch-iterm', (_event, path: string) => {
    const script = `
      tell application "iTerm"
        activate
        tell current window
          create tab with default profile
          tell current session
            write text "cd ${path.replace(/"/g, '\\"')}"
          end tell
        end tell
      end tell
    `
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`)
  })

  ipcMain.handle('launch-obsidian', (_event, uri: string) => {
    if (uri.startsWith('obsidian://')) {
      shell.openExternal(uri)
    } else {
      // Fallback: treat as vault name
      shell.openExternal(`obsidian://open?vault=${encodeURIComponent(uri)}`)
    }
  })

  ipcMain.handle('launch-browser', (_event, url: string) => {
    shell.openExternal(url)
  })
}
