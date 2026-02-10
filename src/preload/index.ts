import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getAppData: () => ipcRenderer.invoke('get-app-data'),
  saveProject: (project: any) => ipcRenderer.invoke('save-project', project),
  deleteProject: (id: string) => ipcRenderer.invoke('delete-project', id),
  saveQuickNotes: (notes: string) => ipcRenderer.invoke('save-quick-notes', notes),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  updateProjectTimer: (projectId: string, totalTimeMs: number, timerStartedAt: string | null) =>
    ipcRenderer.invoke('update-project-timer', projectId, totalTimeMs, timerStartedAt),
  launchVscode: (path: string) => ipcRenderer.invoke('launch-vscode', path),
  launchIterm: (path: string) => ipcRenderer.invoke('launch-iterm', path),
  launchObsidian: (vault: string) => ipcRenderer.invoke('launch-obsidian', vault),
  launchBrowser: (url: string) => ipcRenderer.invoke('launch-browser', url),
  enterFocusMode: () => ipcRenderer.invoke('enter-focus-mode'),
  exitFocusMode: () => ipcRenderer.invoke('exit-focus-mode'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  pickObsidianNote: () => ipcRenderer.invoke('pick-obsidian-note'),
  onReloadData: (callback: () => void) => {
    ipcRenderer.on('reload-data', callback)
    return () => ipcRenderer.removeListener('reload-data', callback)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
