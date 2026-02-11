export interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: string
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
}

export interface AppConfig {
  globalShortcut: string
  actionShortcuts: Record<string, string>
  focusTaskId: string | null
  focusProjectId: string | null
  compactMode: boolean
  theme: 'light' | 'dark'
}

export interface FocusCheckIn {
  id: string
  projectId: string
  taskId: string
  timestamp: string
  response: 'yes' | 'no' | 'a_little'
}

export interface AppData {
  projects: Project[]
  quickNotes: string
  config: AppConfig
}
