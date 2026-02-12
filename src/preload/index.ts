import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppConfig, FocusCheckIn, OperationLogEntry, Project, QuickTask, RepeatingTask } from '../renderer/types'

interface ShortcutActionPayload {
  action: string
  index?: number
}

export const api = {
  getIsDev: () => ipcRenderer.invoke('get-is-dev'),
  getAppData: () => ipcRenderer.invoke('get-app-data'),
  saveProject: (project: Project) => ipcRenderer.invoke('save-project', project),
  deleteProject: (id: string) => ipcRenderer.invoke('delete-project', id),
  archiveProject: (id: string) => ipcRenderer.invoke('archive-project', id),
  unarchiveProject: (id: string) => ipcRenderer.invoke('unarchive-project', id),
  suspendProject: (id: string) => ipcRenderer.invoke('suspend-project', id),
  unsuspendProject: (id: string) => ipcRenderer.invoke('unsuspend-project', id),
  saveQuickNotes: (notes: string) => ipcRenderer.invoke('save-quick-notes', notes),
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('save-config', config),
  updateProjectTimer: (projectId: string, totalTimeMs: number, timerStartedAt: string | null) =>
    ipcRenderer.invoke('update-project-timer', projectId, totalTimeMs, timerStartedAt),
  launchVscode: (path: string) => ipcRenderer.invoke('launch-vscode', path),
  launchIterm: (path: string) => ipcRenderer.invoke('launch-iterm', path),
  launchObsidian: (vault: string) => ipcRenderer.invoke('launch-obsidian', vault),
  launchBrowser: (url: string) => ipcRenderer.invoke('launch-browser', url),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  enterFocusMode: () => ipcRenderer.invoke('enter-focus-mode'),
  exitFocusMode: () => ipcRenderer.invoke('exit-focus-mode'),
  getFocusUnsavedMs: () => ipcRenderer.invoke('get-focus-unsaved-ms'),
  saveFocusCheckIn: (checkIn: FocusCheckIn) => ipcRenderer.invoke('save-focus-checkin', checkIn),
  getFocusCheckIns: (taskId?: string) => ipcRenderer.invoke('get-focus-checkins', taskId),
  dismissCheckIn: () => ipcRenderer.invoke('dismiss-checkin'),
  openStatsWindow: () => ipcRenderer.invoke('open-stats-window'),
  openOperationLogWindow: () => ipcRenderer.invoke('open-operation-log-window'),
  openNewProjectWindow: () => ipcRenderer.invoke('open-new-project-window'),
  closeNewProjectWindow: () => ipcRenderer.invoke('close-new-project-window'),
  enterCompactMode: () => ipcRenderer.invoke('enter-compact-mode'),
  exitCompactMode: () => ipcRenderer.invoke('exit-compact-mode'),
  enterCleanView: () => ipcRenderer.invoke('enter-clean-view'),
  exitCleanView: () => ipcRenderer.invoke('exit-clean-view'),
  setTrafficLightsVisible: (visible: boolean) => ipcRenderer.invoke('set-traffic-lights-visible', visible),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  pickObsidianNote: () => ipcRenderer.invoke('pick-obsidian-note'),
  saveQuickTask: (task: QuickTask) => ipcRenderer.invoke('save-quick-task', task),
  removeQuickTask: (id: string) => ipcRenderer.invoke('remove-quick-task', id),
  completeQuickTask: (id: string) => ipcRenderer.invoke('complete-quick-task', id),
  uncompleteQuickTask: (id: string) => ipcRenderer.invoke('uncomplete-quick-task', id),
  reorderQuickTasks: (orderedIds: string[]) => ipcRenderer.invoke('reorder-quick-tasks', orderedIds),
  toggleQuickTaskInProgress: (id: string) => ipcRenderer.invoke('toggle-quick-task-in-progress', id),
  reorderProjects: (orderedIds: string[]) => ipcRenderer.invoke('reorder-projects', orderedIds),
  reorderPinnedTasks: (updates: { projectId: string; taskId: string; order: number }[]) => ipcRenderer.invoke('reorder-pinned-tasks', updates),
  toggleTaskInProgress: (projectId: string, taskId: string) => ipcRenderer.invoke('toggle-task-in-progress', projectId, taskId),
  toggleTaskToDoNext: (projectId: string, taskId: string) => ipcRenderer.invoke('toggle-task-to-do-next', projectId, taskId),
  saveRepeatingTask: (task: RepeatingTask) => ipcRenderer.invoke('save-repeating-task', task),
  removeRepeatingTask: (id: string) => ipcRenderer.invoke('remove-repeating-task', id),
  reorderRepeatingTasks: (orderedIds: string[]) => ipcRenderer.invoke('reorder-repeating-tasks', orderedIds),
  acceptRepeatingProposal: (repeatingTaskId: string) => ipcRenderer.invoke('accept-repeating-proposal', repeatingTaskId),
  dismissRepeatingProposal: (repeatingTaskId: string) => ipcRenderer.invoke('dismiss-repeating-proposal', repeatingTaskId),
  getOperations: (since?: string): Promise<OperationLogEntry[]> => ipcRenderer.invoke('get-operations', since),
  onReloadData: (callback: () => void) => {
    ipcRenderer.on('reload-data', callback)
    return () => ipcRenderer.removeListener('reload-data', callback)
  },
  onShortcutAction: (callback: (data: ShortcutActionPayload) => void) => {
    const handler = (_event: IpcRendererEvent, data: ShortcutActionPayload) => callback(data)
    ipcRenderer.on('shortcut-action', handler)
    return () => ipcRenderer.removeListener('shortcut-action', handler)
  },
  onCheckInCountdown: (callback: (remainingMs: number) => void) => {
    const handler = (_event: IpcRendererEvent, remainingMs: number) => callback(remainingMs)
    ipcRenderer.on('checkin-countdown', handler)
    return () => ipcRenderer.removeListener('checkin-countdown', handler)
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
  const windowWithApi = window as unknown as Window & { electron: typeof electronAPI; api: typeof api }
  windowWithApi.electron = electronAPI
  windowWithApi.api = api
}
