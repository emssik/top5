export interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: string
  isToDoNext?: boolean
  toDoNextOrder?: number
}

export interface QuickTask {
  id: string
  title: string
  completed: boolean
  createdAt: string
  completedAt: string | null
  order: number
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
}
