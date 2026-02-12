export interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: string
  isToDoNext?: boolean
  toDoNextOrder?: number
}

export type RepeatSchedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'interval'; days: number }
  | { type: 'afterCompletion'; days: number }

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
}

export interface QuickTask {
  id: string
  title: string
  completed: boolean
  createdAt: string
  completedAt: string | null
  order: number
  repeatingTaskId?: string | null
}

export interface ProjectLaunchers {
  vscode: string | null
  iterm: string | null
  obsidian: string | null
  browser: string | null
}

export interface Project {
  id: string
  name: string
  description: string
  order: number // 0-4
  deadline: string | null // ISO date
  totalTimeMs: number
  timerStartedAt: string | null // ISO timestamp, null = paused
  launchers: ProjectLaunchers
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
      updateProjectTimer: (projectId: string, totalTimeMs: number, timerStartedAt: string | null) => Promise<void>
      launchVscode: (path: string) => Promise<void>
      launchIterm: (path: string) => Promise<void>
      launchObsidian: (vault: string) => Promise<void>
      launchBrowser: (url: string) => Promise<void>
      enterFocusMode: () => Promise<void>
      exitFocusMode: () => Promise<void>
      getFocusUnsavedMs: () => Promise<number>
      saveFocusCheckIn: (checkIn: FocusCheckIn) => Promise<void>
      getFocusCheckIns: (taskId?: string) => Promise<FocusCheckIn[]>
      dismissCheckIn: () => Promise<void>
      openStatsWindow: () => Promise<void>
      openNewProjectWindow: () => Promise<void>
      closeNewProjectWindow: () => Promise<void>
      enterCompactMode: () => Promise<void>
      exitCompactMode: () => Promise<void>
      enterCleanView: () => Promise<void>
      exitCleanView: () => Promise<void>
      setTrafficLightsVisible: (visible: boolean) => Promise<void>
      pickFolder: () => Promise<string | null>
      pickObsidianNote: () => Promise<{ uri?: string; path: string } | null>
      saveQuickTask: (task: QuickTask) => Promise<QuickTask[]>
      removeQuickTask: (id: string) => Promise<QuickTask[]>
      completeQuickTask: (id: string) => Promise<QuickTask[]>
      uncompleteQuickTask: (id: string) => Promise<QuickTask[]>
      reorderQuickTasks: (orderedIds: string[]) => Promise<QuickTask[]>
      reorderProjects: (orderedIds: string[]) => Promise<Project[]>
      reorderPinnedTasks: (updates: { projectId: string; taskId: string; order: number }[]) => Promise<void>
      toggleTaskToDoNext: (projectId: string, taskId: string) => Promise<Project[]>
      saveRepeatingTask: (task: RepeatingTask) => Promise<RepeatingTask[]>
      removeRepeatingTask: (id: string) => Promise<RepeatingTask[]>
      reorderRepeatingTasks: (orderedIds: string[]) => Promise<RepeatingTask[]>
      acceptRepeatingProposal: (repeatingTaskId: string) => Promise<QuickTask[]>
      dismissRepeatingProposal: (repeatingTaskId: string) => Promise<void>
      onReloadData: (callback: () => void) => () => void
      onShortcutAction: (callback: (data: ShortcutActionPayload) => void) => () => void
      onCheckInCountdown: (callback: (remainingMs: number) => void) => () => void
    }
  }
}
