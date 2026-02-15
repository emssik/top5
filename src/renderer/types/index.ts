export type {
  Task,
  RepeatSchedule,
  RepeatingTask,
  QuickTask,
  ProjectColor,
  ProjectLaunchers,
  ProjectLink,
  Project,
  AppConfig,
  FocusCheckIn,
  OperationType,
  OperationLogEntry,
  AppData,
  ApiConfig,
  ApiConfigPublic,
  LockedTaskRef,
  WinsLockState,
  WinEntry,
  StreakStats
} from '../../shared/types'

interface ShortcutActionPayload {
  action: string
  index?: number
}

declare global {
  interface Window {
    api: {
      getIsDev: () => Promise<boolean>
      getAppData: () => Promise<import('../../shared/types').AppData>
      saveProject: (project: import('../../shared/types').Project) => Promise<import('../../shared/types').Project[]>
      deleteProject: (id: string) => Promise<import('../../shared/types').Project[]>
      archiveProject: (id: string) => Promise<import('../../shared/types').Project[]>
      unarchiveProject: (id: string) => Promise<{ projects: import('../../shared/types').Project[] } | { error: string }>
      suspendProject: (id: string) => Promise<import('../../shared/types').Project[]>
      unsuspendProject: (id: string) => Promise<{ projects: import('../../shared/types').Project[] } | { error: string }>
      saveQuickNotes: (notes: string) => Promise<void>
      saveConfig: (config: import('../../shared/types').AppConfig) => Promise<void>
      launchVscode: (path: string) => Promise<void>
      launchIterm: (path: string) => Promise<void>
      launchObsidian: (vault: string) => Promise<void>
      launchBrowser: (url: string) => Promise<void>
      openExternal: (url: string) => Promise<void>
      openDevTools: () => Promise<void>
      enterFocusMode: () => Promise<void>
      exitFocusMode: () => Promise<void>
      getFocusUnsavedMs: () => Promise<number>
      saveFocusCheckIn: (checkIn: import('../../shared/types').FocusCheckIn) => Promise<import('../../shared/types').FocusCheckIn[]>
      getFocusCheckIns: (taskId?: string) => Promise<import('../../shared/types').FocusCheckIn[]>
      dismissCheckIn: () => Promise<void>
      openOperationLogWindow: (filter?: string) => Promise<void>
      enterCleanView: () => Promise<void>
      exitCleanView: () => Promise<void>
      setTrafficLightsVisible: (visible: boolean) => Promise<void>
      saveQuickTask: (task: import('../../shared/types').QuickTask) => Promise<import('../../shared/types').QuickTask[]>
      removeQuickTask: (id: string) => Promise<import('../../shared/types').QuickTask[]>
      completeQuickTask: (id: string) => Promise<import('../../shared/types').QuickTask[]>
      uncompleteQuickTask: (id: string) => Promise<import('../../shared/types').QuickTask[]>
      reorderQuickTasks: (orderedIds: string[]) => Promise<import('../../shared/types').QuickTask[]>
      toggleQuickTaskInProgress: (id: string) => Promise<import('../../shared/types').QuickTask[]>
      reorderProjects: (orderedIds: string[]) => Promise<import('../../shared/types').Project[]>
      reorderPinnedTasks: (updates: { projectId: string; taskId: string; order: number }[]) => Promise<void>
      toggleTaskInProgress: (projectId: string, taskId: string) => Promise<import('../../shared/types').Project[]>
      moveTaskToProject: (fromProjectId: string, toProjectId: string, taskId: string) => Promise<import('../../shared/types').Project[]>
      toggleTaskToDoNext: (projectId: string, taskId: string) => Promise<import('../../shared/types').Project[]>
      saveRepeatingTask: (task: import('../../shared/types').RepeatingTask) => Promise<import('../../shared/types').RepeatingTask[]>
      removeRepeatingTask: (id: string) => Promise<import('../../shared/types').RepeatingTask[]>
      reorderRepeatingTasks: (orderedIds: string[]) => Promise<import('../../shared/types').RepeatingTask[]>
      acceptRepeatingProposal: (repeatingTaskId: string) => Promise<import('../../shared/types').QuickTask[]>
      dismissRepeatingProposal: (repeatingTaskId: string) => Promise<void>
      getOperations: (since?: string) => Promise<import('../../shared/types').OperationLogEntry[]>
      switchFocusTask: (projectId: string, taskId: string) => Promise<void>
      resizeFocusWindow: (width: number, height: number) => Promise<void>
      closeQuickAddWindow: () => Promise<void>
      getApiConfig: () => Promise<import('../../shared/types').ApiConfig>
      saveApiConfig: (config: Partial<import('../../shared/types').ApiConfig>) => Promise<import('../../shared/types').ApiConfig>
      winsLock: (tasks: import('../../shared/types').LockedTaskRef[]) => Promise<import('../../shared/types').WinsLockState>
      winsUnlock: () => Promise<import('../../shared/types').WinsLockState>
      winsGetLockState: () => Promise<import('../../shared/types').WinsLockState | null>
      winsGetHistory: () => Promise<import('../../shared/types').WinEntry[]>
      winsGetStreaks: () => Promise<import('../../shared/types').StreakStats>
      selectDirectory: () => Promise<string | null>
      openTaskNote: (taskId: string, taskTitle: string, projectName?: string, taskBadge?: string) => Promise<{ ok?: boolean; error?: string }>
      onReloadData: (callback: () => void) => () => void
      onShortcutAction: (callback: (data: ShortcutActionPayload) => void) => () => void
      onCheckInCountdown: (callback: (remainingMs: number) => void) => () => void
      onCheckInRespond: (callback: (response: 'yes' | 'a_little' | 'no') => void) => () => void
    }
  }
}
