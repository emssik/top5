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
  EnergyCheckIn,
  EnergyRating,
  EnergyTrackerConfig,
  LockedTaskRef,
  WinsLockState,
  WinEntry,
  StreakStats,
  Habit,
  HabitSchedule,
  HabitLogEntry,
  HabitTodayEntry
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
      launchIterm: (path: string, tabName?: string) => Promise<void>
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
      setBeyondLimit: (input: { quickTaskIds?: string[]; pinnedTasks?: { projectId: string; taskId: string }[]; beyondLimit: boolean }) => Promise<void>
      toggleTaskInProgress: (projectId: string, taskId: string) => Promise<import('../../shared/types').Project[]>
      moveTaskToProject: (fromProjectId: string, toProjectId: string, taskId: string) => Promise<import('../../shared/types').Project[]>
      toggleTaskToDoNext: (projectId: string, taskId: string) => Promise<import('../../shared/types').Project[]>
      updateTaskDueDate: (projectId: string, taskId: string, dueDate: string | null) => Promise<import('../../shared/types').Project[]>
      updateQuickTaskDueDate: (id: string, dueDate: string | null) => Promise<import('../../shared/types').QuickTask[]>
      saveRepeatingTask: (task: import('../../shared/types').RepeatingTask) => Promise<import('../../shared/types').RepeatingTask[]>
      removeRepeatingTask: (id: string) => Promise<import('../../shared/types').RepeatingTask[]>
      reorderRepeatingTasks: (orderedIds: string[]) => Promise<import('../../shared/types').RepeatingTask[]>
      acceptRepeatingProposal: (repeatingTaskId: string, forDate?: string) => Promise<import('../../shared/types').QuickTask[]>
      dismissRepeatingProposal: (repeatingTaskId: string, forDate?: string) => Promise<void>
      getOperations: (since?: string) => Promise<import('../../shared/types').OperationLogEntry[]>
      switchFocusTask: (projectId: string, taskId: string) => Promise<void>
      resizeFocusWindow: (width: number, height: number) => Promise<void>
      showFocusContextMenu: (items: { id: string; label: string; type?: 'separator' }[], clickX: number, clickY: number) => Promise<void>
      getFocusMenuItems: () => Promise<{ id: string; label: string; type?: 'separator' }[]>
      focusMenuClick: (actionId: string) => Promise<void>
      onFocusMenuAction: (callback: (actionId: string) => void) => () => void
      showProjectInMain: (projectId: string) => Promise<void>
      onNavigateToProject: (callback: (projectId: string) => void) => () => void
      closeQuickAddWindow: () => Promise<void>
      resizeQuickAddWindow: (height: number) => Promise<void>
      setZoomFactor: (factor: number) => void
      getApiConfig: () => Promise<import('../../shared/types').ApiConfig>
      saveApiConfig: (config: Partial<import('../../shared/types').ApiConfig>) => Promise<import('../../shared/types').ApiConfig>
      winsLock: (tasks: import('../../shared/types').LockedTaskRef[]) => Promise<import('../../shared/types').WinsLockState>
      winsUnlock: () => Promise<import('../../shared/types').WinsLockState>
      winsGetLockState: () => Promise<import('../../shared/types').WinsLockState | null>
      winsGetHistory: () => Promise<import('../../shared/types').WinEntry[]>
      winsGetStreaks: () => Promise<import('../../shared/types').StreakStats>
      selectDirectory: () => Promise<string | null>
      openTaskNote: (taskId: string, taskTitle: string, projectName?: string, taskBadge?: string, noteRef?: string) => Promise<{ ok?: boolean; error?: string }>
      appendNoteDoneEntry: (noteRef: string, description: string, focusMinutes: number) => Promise<{ ok?: boolean; error?: string }>
      sendTaskToMyCC: (projectId: string, taskId: string, comment?: string) => Promise<{ taskCode: string; projectCode: string; projectName: string; title: string; noteRef?: string } | null>
      pasteImageToTask: (projectId: string, taskId: string) => Promise<{ filename: string } | { error: string }>
      removeTaskImage: (projectId: string, taskId: string, filename: string) => Promise<import('../../shared/types').Project[]>
      openTaskImage: (filename: string) => Promise<void>
      saveHabit: (h: import('../../shared/types').Habit) => Promise<import('../../shared/types').Habit[]>
      removeHabit: (id: string) => Promise<import('../../shared/types').Habit[]>
      reorderHabits: (ids: string[]) => Promise<import('../../shared/types').Habit[]>
      habitTick: (id: string, mode: 'done' | 'freeze' | 'skip' | 'undo') => Promise<import('../../shared/types').Habit[]>
      habitRetroTick: (id: string, dk: string, action: 'done' | 'freeze' | 'skip' | 'clear') => Promise<import('../../shared/types').Habit[]>
      habitLogMinutes: (id: string, minutes: number) => Promise<import('../../shared/types').Habit[]>
      habitsToday: () => Promise<import('../../shared/types').HabitTodayEntry[]>
      journalGenerateDaily: (dateStr?: string) => Promise<{ path: string; notePath: string } | null>
      journalGenerateWeekly: (weekKey?: string) => Promise<{ path: string; notePath: string } | null>
      journalGenerateMonthly: (monthKey?: string) => Promise<{ path: string; notePath: string } | null>
      journalOpen: (notePath: string) => Promise<void>
      nudgeSnooze: (minutes: number) => Promise<void>
      nudgeDismiss: () => Promise<void>
      nudgeGetTasks: () => Promise<{ projectId: string; taskId: string; title: string; projectName?: string; projectCode?: string }[]>
      nudgeStartFocus: (projectId: string, taskId: string) => Promise<void>
      nudgeOpenQuickAdd: () => Promise<void>
      getEnergyTrackerConfig: () => Promise<import('../../shared/types').EnergyTrackerConfig>
      saveEnergyTrackerConfig: (config: import('../../shared/types').EnergyTrackerConfig) => Promise<import('../../shared/types').EnergyTrackerConfig>
      energyPauseUntil: (isoTimestamp: string) => Promise<import('../../shared/types').EnergyTrackerConfig>
      energyResume: () => Promise<import('../../shared/types').EnergyTrackerConfig>
      energySkip: () => Promise<void>
      energySubmit: (payload: { energy: 1 | 2 | 3; mood: 1 | 2 | 3; hungry: boolean; note?: string }) => Promise<{ ok: true } | { error: string }>
      onReloadData: (callback: () => void) => () => void
      onShortcutAction: (callback: (data: ShortcutActionPayload) => void) => () => void
      onCheckInCountdown: (callback: (remainingMs: number) => void) => () => void
      onCheckInRespond: (callback: (response: 'yes' | 'a_little' | 'no') => void) => () => void
    }
  }
}
