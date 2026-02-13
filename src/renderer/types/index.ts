export interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: string
  completedAt?: string | null
  isToDoNext?: boolean
  toDoNextOrder?: number
  inProgress?: boolean
}

export type RepeatSchedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'interval'; days: number }
  | { type: 'afterCompletion'; days: number }
  | { type: 'monthlyDay'; day: number }
  | { type: 'monthlyNthWeekday'; week: number; weekday: number }
  | { type: 'everyNMonths'; months: number; day: number }

export interface RepeatingTask {
  id: string
  title: string
  schedule: RepeatSchedule
  createdAt: string
  lastCompletedAt: string | null
  order: number
  acceptedCount: number
  dismissedCount: number
  completedCount: number
  startDate?: string | null
  endDate?: string | null
}

export interface QuickTask {
  id: string
  title: string
  completed: boolean
  createdAt: string
  completedAt: string | null
  order: number
  repeatingTaskId?: string | null
  inProgress?: boolean
}

export interface ProjectLaunchers {
  vscode: string | null
  iterm: string | null
  obsidian: string | null
  browser: string | null
}

export type ProjectColor =
  | 'red'
  | 'orange'
  | 'amber'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'teal'

export interface ProjectLink {
  label: string
  url: string
}

export interface Project {
  id: string
  name: string
  description: string
  order: number // 0-4
  deadline: string | null // ISO date
  totalTimeMs: number
  timerStartedAt: string | null // ISO timestamp, null = paused
  launchers?: ProjectLaunchers
  links?: ProjectLink[]
  color?: ProjectColor
  tasks: Task[]
  archivedAt: string | null // ISO date = archived, null = active
  suspendedAt: string | null // ISO date = suspended, null = not suspended
}

export interface AppConfig {
  globalShortcut: string
  actionShortcuts: Record<string, string>
  focusTaskId: string | null
  focusProjectId: string | null
  compactMode: boolean
  cleanView: boolean
  theme: 'light' | 'dark'
  quickTasksLimit: number
  activeProjectsLimit: number
  cleanViewFont: string
}

export interface FocusCheckIn {
  id: string
  projectId: string
  taskId: string
  timestamp: string
  response: 'yes' | 'no' | 'a_little'
  minutes?: number
}

export type OperationType =
  | 'task_created' | 'task_completed' | 'task_uncompleted' | 'task_deleted'
  | 'quick_task_created' | 'quick_task_completed' | 'quick_task_uncompleted' | 'quick_task_deleted'
  | 'project_created' | 'project_updated' | 'project_archived' | 'project_unarchived'
  | 'project_suspended' | 'project_unsuspended' | 'project_deleted'
  | 'focus_started'

export interface OperationLogEntry {
  id: string
  timestamp: string
  type: OperationType
  projectId?: string
  projectName?: string
  taskTitle?: string
  details?: string
}

export interface AppData {
  projects: Project[]
  quickTasks: QuickTask[]
  quickNotes: string
  config: AppConfig
  repeatingTasks: RepeatingTask[]
  dismissedRepeating: string[]
  dismissedRepeatingDate: string
}

interface ShortcutActionPayload {
  action: string
  index?: number
}

declare global {
  interface Window {
    api: {
      getIsDev: () => Promise<boolean>
      getAppData: () => Promise<AppData>
      saveProject: (project: Project) => Promise<Project[]>
      deleteProject: (id: string) => Promise<Project[]>
      archiveProject: (id: string) => Promise<Project[]>
      unarchiveProject: (id: string) => Promise<{ projects: Project[] } | { error: string }>
      suspendProject: (id: string) => Promise<Project[]>
      unsuspendProject: (id: string) => Promise<{ projects: Project[] } | { error: string }>
      saveQuickNotes: (notes: string) => Promise<void>
      saveConfig: (config: AppConfig) => Promise<void>
      launchVscode: (path: string) => Promise<void>
      launchIterm: (path: string) => Promise<void>
      launchObsidian: (vault: string) => Promise<void>
      launchBrowser: (url: string) => Promise<void>
      openExternal: (url: string) => Promise<void>
      enterFocusMode: () => Promise<void>
      exitFocusMode: () => Promise<void>
      getFocusUnsavedMs: () => Promise<number>
      saveFocusCheckIn: (checkIn: FocusCheckIn) => Promise<void>
      getFocusCheckIns: (taskId?: string) => Promise<FocusCheckIn[]>
      dismissCheckIn: () => Promise<void>
      openOperationLogWindow: () => Promise<void>
      enterCleanView: () => Promise<void>
      exitCleanView: () => Promise<void>
      setTrafficLightsVisible: (visible: boolean) => Promise<void>
      saveQuickTask: (task: QuickTask) => Promise<QuickTask[]>
      removeQuickTask: (id: string) => Promise<QuickTask[]>
      completeQuickTask: (id: string) => Promise<QuickTask[]>
      uncompleteQuickTask: (id: string) => Promise<QuickTask[]>
      reorderQuickTasks: (orderedIds: string[]) => Promise<QuickTask[]>
      toggleQuickTaskInProgress: (id: string) => Promise<QuickTask[]>
      reorderProjects: (orderedIds: string[]) => Promise<Project[]>
      reorderPinnedTasks: (updates: { projectId: string; taskId: string; order: number }[]) => Promise<void>
      toggleTaskInProgress: (projectId: string, taskId: string) => Promise<Project[]>
      toggleTaskToDoNext: (projectId: string, taskId: string) => Promise<Project[]>
      saveRepeatingTask: (task: RepeatingTask) => Promise<RepeatingTask[]>
      removeRepeatingTask: (id: string) => Promise<RepeatingTask[]>
      reorderRepeatingTasks: (orderedIds: string[]) => Promise<RepeatingTask[]>
      acceptRepeatingProposal: (repeatingTaskId: string) => Promise<QuickTask[]>
      dismissRepeatingProposal: (repeatingTaskId: string) => Promise<void>
      getOperations: (since?: string) => Promise<OperationLogEntry[]>
      switchFocusTask: (projectId: string, taskId: string) => Promise<void>
      resizeFocusWindow: (width: number, height: number) => Promise<void>
      closeQuickAddWindow: () => Promise<void>
      onReloadData: (callback: () => void) => () => void
      onShortcutAction: (callback: (data: ShortcutActionPayload) => void) => () => void
      onCheckInCountdown: (callback: (remainingMs: number) => void) => () => void
    }
  }
}
