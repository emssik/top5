import { contextBridge, ipcRenderer, webFrame } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppConfig, FocusCheckIn, OperationLogEntry, Project, QuickTask, RepeatingTask, ApiConfig, LockedTaskRef, WinsLockState, WinEntry, StreakStats } from '../shared/types'

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
  launchVscode: (path: string) => ipcRenderer.invoke('launch-vscode', path),
  launchIterm: (path: string, tabName?: string) => ipcRenderer.invoke('launch-iterm', path, tabName),
  launchObsidian: (vault: string) => ipcRenderer.invoke('launch-obsidian', vault),
  launchBrowser: (url: string) => ipcRenderer.invoke('launch-browser', url),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  enterFocusMode: () => ipcRenderer.invoke('enter-focus-mode'),
  exitFocusMode: () => ipcRenderer.invoke('exit-focus-mode'),
  getFocusUnsavedMs: () => ipcRenderer.invoke('get-focus-unsaved-ms'),
  saveFocusCheckIn: (checkIn: FocusCheckIn) => ipcRenderer.invoke('save-focus-checkin', checkIn),
  getFocusCheckIns: (taskId?: string) => ipcRenderer.invoke('get-focus-checkins', taskId),
  dismissCheckIn: () => ipcRenderer.invoke('dismiss-checkin'),
  openOperationLogWindow: (filter?: string) => ipcRenderer.invoke('open-operation-log-window', filter),
  enterCleanView: () => ipcRenderer.invoke('enter-clean-view'),
  exitCleanView: () => ipcRenderer.invoke('exit-clean-view'),
  setTrafficLightsVisible: (visible: boolean) => ipcRenderer.invoke('set-traffic-lights-visible', visible),
  saveQuickTask: (task: QuickTask) => ipcRenderer.invoke('save-quick-task', task),
  removeQuickTask: (id: string) => ipcRenderer.invoke('remove-quick-task', id),
  completeQuickTask: (id: string) => ipcRenderer.invoke('complete-quick-task', id),
  uncompleteQuickTask: (id: string) => ipcRenderer.invoke('uncomplete-quick-task', id),
  reorderQuickTasks: (orderedIds: string[]) => ipcRenderer.invoke('reorder-quick-tasks', orderedIds),
  toggleQuickTaskInProgress: (id: string) => ipcRenderer.invoke('toggle-quick-task-in-progress', id),
  reorderProjects: (orderedIds: string[]) => ipcRenderer.invoke('reorder-projects', orderedIds),
  reorderPinnedTasks: (updates: { projectId: string; taskId: string; order: number }[]) => ipcRenderer.invoke('reorder-pinned-tasks', updates),
  setBeyondLimit: (input: { quickTaskIds?: string[]; pinnedTasks?: { projectId: string; taskId: string }[]; beyondLimit: boolean }) => ipcRenderer.invoke('set-beyond-limit', input),
  toggleTaskInProgress: (projectId: string, taskId: string) => ipcRenderer.invoke('toggle-task-in-progress', projectId, taskId),
  moveTaskToProject: (fromProjectId: string, toProjectId: string, taskId: string) => ipcRenderer.invoke('move-task-to-project', fromProjectId, toProjectId, taskId),
  toggleTaskToDoNext: (projectId: string, taskId: string) => ipcRenderer.invoke('toggle-task-to-do-next', projectId, taskId),
  updateTaskDueDate: (projectId: string, taskId: string, dueDate: string | null) => ipcRenderer.invoke('update-task-due-date', projectId, taskId, dueDate),
  updateQuickTaskDueDate: (id: string, dueDate: string | null) => ipcRenderer.invoke('update-quick-task-due-date', id, dueDate),
  saveRepeatingTask: (task: RepeatingTask) => ipcRenderer.invoke('save-repeating-task', task),
  removeRepeatingTask: (id: string) => ipcRenderer.invoke('remove-repeating-task', id),
  reorderRepeatingTasks: (orderedIds: string[]) => ipcRenderer.invoke('reorder-repeating-tasks', orderedIds),
  acceptRepeatingProposal: (repeatingTaskId: string, forDate?: string) => ipcRenderer.invoke('accept-repeating-proposal', repeatingTaskId, forDate),
  dismissRepeatingProposal: (repeatingTaskId: string, forDate?: string) => ipcRenderer.invoke('dismiss-repeating-proposal', repeatingTaskId, forDate),
  getOperations: (since?: string): Promise<OperationLogEntry[]> => ipcRenderer.invoke('get-operations', since),
  switchFocusTask: (projectId: string, taskId: string) => ipcRenderer.invoke('switch-focus-task', projectId, taskId),
  resizeFocusWindow: (width: number, height: number) => ipcRenderer.invoke('resize-focus-window', width, height),
  showFocusContextMenu: (items: { id: string; label: string; type?: 'separator' }[], clickX: number, clickY: number) => ipcRenderer.invoke('show-focus-context-menu', items, clickX, clickY),
  getFocusMenuItems: (): Promise<{ id: string; label: string; type?: 'separator' }[]> => ipcRenderer.invoke('get-focus-menu-items'),
  focusMenuClick: (actionId: string) => ipcRenderer.invoke('focus-menu-click', actionId),
  onFocusMenuAction: (callback: (actionId: string) => void) => {
    const handler = (_event: IpcRendererEvent, actionId: string) => callback(actionId)
    ipcRenderer.on('focus-menu-action', handler)
    return () => ipcRenderer.removeListener('focus-menu-action', handler)
  },
  showProjectInMain: (projectId: string) => ipcRenderer.invoke('show-project-in-main', projectId),
  onNavigateToProject: (callback: (projectId: string) => void) => {
    const handler = (_event: IpcRendererEvent, projectId: string) => callback(projectId)
    ipcRenderer.on('navigate-to-project', handler)
    return () => ipcRenderer.removeListener('navigate-to-project', handler)
  },
  closeQuickAddWindow: () => ipcRenderer.invoke('close-quick-add-window'),
  resizeQuickAddWindow: (height: number) => ipcRenderer.invoke('resize-quick-add-window', height),
  setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor),
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  getApiConfig: (): Promise<ApiConfig> => ipcRenderer.invoke('get-api-config'),
  saveApiConfig: (config: Partial<ApiConfig>): Promise<ApiConfig> => ipcRenderer.invoke('save-api-config', config),
  winsLock: (tasks: LockedTaskRef[]): Promise<WinsLockState> => ipcRenderer.invoke('wins-lock', tasks),
  winsUnlock: (): Promise<WinsLockState> => ipcRenderer.invoke('wins-unlock'),
  winsGetLockState: (): Promise<WinsLockState | null> => ipcRenderer.invoke('wins-get-lock-state'),
  winsGetHistory: (): Promise<WinEntry[]> => ipcRenderer.invoke('wins-get-history'),
  winsGetStreaks: (): Promise<StreakStats> => ipcRenderer.invoke('wins-get-streaks'),
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('select-directory'),
  openTaskNote: (taskId: string, taskTitle: string, projectName?: string, taskBadge?: string, noteRef?: string) => ipcRenderer.invoke('open-task-note', taskId, taskTitle, projectName, taskBadge, noteRef),
  appendNoteDoneEntry: (noteRef: string, description: string, focusMinutes: number) => ipcRenderer.invoke('append-note-done-entry', noteRef, description, focusMinutes),
  sendTaskToMyCC: (projectId: string, taskId: string, comment?: string) => ipcRenderer.invoke('send-task-to-mycc', projectId, taskId, comment),
  journalGenerateDaily: (dateStr?: string) => ipcRenderer.invoke('journal-generate-daily', dateStr),
  journalGenerateWeekly: (weekKey?: string) => ipcRenderer.invoke('journal-generate-weekly', weekKey),
  journalGenerateMonthly: (monthKey?: string) => ipcRenderer.invoke('journal-generate-monthly', monthKey),
  journalOpen: (notePath: string) => ipcRenderer.invoke('journal-open', notePath),
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
  },
  nudgeSnooze: (minutes: number) => ipcRenderer.invoke('nudge-snooze', minutes),
  nudgeDismiss: () => ipcRenderer.invoke('nudge-dismiss'),
  nudgeGetTasks: () => ipcRenderer.invoke('nudge-get-tasks'),
  nudgeStartFocus: (projectId: string, taskId: string) => ipcRenderer.invoke('nudge-start-focus', projectId, taskId),
  nudgeOpenQuickAdd: () => ipcRenderer.invoke('nudge-open-quick-add'),
  onCheckInRespond: (callback: (response: 'yes' | 'a_little' | 'no') => void) => {
    const handler = (_event: IpcRendererEvent, response: 'yes' | 'a_little' | 'no') => callback(response)
    ipcRenderer.on('checkin-respond', handler)
    return () => ipcRenderer.removeListener('checkin-respond', handler)
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
