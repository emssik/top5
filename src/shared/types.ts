export interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: string
  completedAt?: string | null
  isToDoNext?: boolean
  toDoNextOrder?: number
  inProgress?: boolean
  taskNumber?: number
  someday?: boolean
  noteRef?: string
  dueDate?: string | null
  beyondLimit?: boolean
  links?: ProjectLink[]
  images?: string[]
}

export type RepeatSchedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'interval'; days: number }
  | { type: 'afterCompletion'; days: number }
  | { type: 'monthlyDay'; day: number }
  | { type: 'monthlyNthWeekday'; week: number; weekday: number }
  | { type: 'everyNMonths'; months: number; day: number }
  | { type: 'monthlyLastDay' }

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
  link?: string | null
  projectId?: string | null
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
  taskNumber?: number
  noteRef?: string
  dueDate?: string | null
  projectId?: string | null
  beyondLimit?: boolean
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

export interface ProjectLaunchers {
  vscode: string | null
  iterm: string | null
  obsidian: string | null
  browser: string | null
}

export interface ProjectLink {
  label: string
  url: string
}

export interface Project {
  id: string
  name: string
  description: string
  order: number
  deadline: string | null
  totalTimeMs: number
  timerStartedAt: string | null
  launchers?: ProjectLaunchers
  links?: ProjectLink[]
  color?: ProjectColor
  tasks: Task[]
  archivedAt: string | null
  suspendedAt: string | null
  code?: string
  nextTaskNumber?: number
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
  obsidianStoragePath?: string
  obsidianVaultName?: string
  baseFontSize?: number
}

export interface FocusCheckIn {
  id: string
  projectId: string
  taskId: string
  timestamp: string
  response: 'yes' | 'no' | 'a_little'
  minutes?: number
}

export type HabitSchedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] } // 0=Sun..6=Sat (JS Date convention)
  | { type: 'nPerWeek'; count: number }
  | { type: 'interval'; every: number }
  | { type: 'dailyMinutes'; minutes: number }
  | { type: 'weeklyMinutes'; minutes: number }

export interface HabitLogEntry {
  done?: boolean
  minutes?: number
  freeze?: boolean
  skip?: boolean
}

export interface Habit {
  id: string
  name: string
  projectId?: string | null
  icon: string
  note: string
  createdAt: string // 'YYYY-MM-DD'
  freezeAvailable: number
  order: number
  schedule: HabitSchedule
  log: Record<string, HabitLogEntry> // 'YYYY-MM-DD' -> entry
  archivedAt?: string | null
}

export interface HabitTodayEntry {
  id: string
  name: string
  icon: string
  projectId: string | null
  schedule: HabitSchedule
  isScheduled: boolean
  status: 'done' | 'freeze' | 'skip' | 'pending'
  streak: number
  streakUnit: 'dni' | 'tyg'
  minutesToday?: number
  minutesGoal?: number
}

export type OperationType =
  | 'task_created' | 'task_completed' | 'task_uncompleted' | 'task_deleted'
  | 'quick_task_created' | 'quick_task_completed' | 'quick_task_uncompleted' | 'quick_task_deleted'
  | 'project_created' | 'project_updated' | 'project_archived' | 'project_unarchived'
  | 'project_suspended' | 'project_unsuspended' | 'project_deleted'
  | 'task_moved' | 'task_sent_to_mycc'
  | 'focus_started' | 'focus_ended'
  | 'wins_day_won' | 'wins_day_lost'
  | 'wins_week_won' | 'wins_week_lost'
  | 'wins_month_won' | 'wins_month_lost'
  | 'habit_ticked' | 'habit_freeze' | 'habit_skip'

export interface OperationLogEntry {
  id: string
  timestamp: string
  type: OperationType
  projectId?: string
  projectName?: string
  taskTitle?: string
  taskCode?: string
  details?: string
}

export interface ApiConfig {
  enabled: boolean
  apiKey: string
  port: number
}

export interface ApiConfigPublic {
  enabled: boolean
  port: number
}

export type EnergyRating = 1 | 2 | 3

export interface EnergyCheckIn {
  id: string
  timestamp: string
  energy: EnergyRating
  mood: EnergyRating
  hungry: boolean
  note?: string
}

export interface EnergyTrackerConfig {
  enabled: boolean
  intervalMinMin: number
  intervalMaxMin: number
  pausedUntil: string | null
  lastFirstActivityDate: string | null
}

export interface LockedTaskRef {
  kind: 'quick' | 'pinned'
  quickTaskId?: string
  projectId?: string
  taskId?: string
}

export interface WinsLockState {
  locked: boolean
  lockedAt: string | null
  deadline: string | null
  lockedTasks: LockedTaskRef[]
}

export interface WinEntry {
  id: string
  date: string
  lockedAt: string
  resolvedAt: string
  result: 'win' | 'loss'
  taskCount: number
  completedCount: number
}

export interface StreakStats {
  currentDayStreak: number
  currentWeekStreak: number
  currentMonthStreak: number
  totalWins: number
  totalLosses: number
  thisWeekWins: number
  thisWeekLosses: number
  thisMonthWins: number
  thisMonthLosses: number
}

export interface AppData {
  projects: Project[]
  quickTasks: QuickTask[]
  quickNotes: string
  config: AppConfig
  repeatingTasks: RepeatingTask[]
  dismissedRepeating: Record<string, string[]>
  apiConfig?: ApiConfigPublic
  energyTracker?: EnergyTrackerConfig
  nextQuickTaskNumber?: number
  winsLock?: WinsLockState
  habits?: Habit[]
}
