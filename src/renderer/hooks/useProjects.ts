import { create } from 'zustand'
import type { Project, QuickTask, AppConfig, FocusCheckIn, RepeatingTask, LockedTaskRef, WinsLockState, Habit } from '../types'
import { assignMissingProjectColors, normalizeProject } from '../utils/projects'
import { dateKey } from '../../shared/schedule'

interface ProjectsState {
  projects: Project[]
  quickTasks: QuickTask[]
  quickNotes: string
  config: AppConfig
  focusCheckIns: FocusCheckIn[]
  repeatingTasks: RepeatingTask[]
  dismissedRepeating: Record<string, string[]>
  winsLock: WinsLockState | null
  habits: Habit[]
  loaded: boolean

  loadData: () => Promise<void>
  saveProject: (project: Project) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  archiveProject: (id: string) => Promise<void>
  unarchiveProject: (id: string) => Promise<string | null>
  suspendProject: (id: string) => Promise<void>
  unsuspendProject: (id: string) => Promise<string | null>
  saveQuickNotes: (notes: string) => Promise<void>
  saveConfig: (config: AppConfig) => Promise<void>
  reorderProjects: (orderedIds: string[]) => Promise<void>
  setFocus: (projectId: string | null, taskId: string | null) => Promise<void>
  saveQuickTask: (task: QuickTask) => Promise<void>
  removeQuickTask: (id: string) => Promise<void>
  completeQuickTask: (id: string) => Promise<void>
  uncompleteQuickTask: (id: string) => Promise<void>
  reorderQuickTasks: (orderedIds: string[]) => Promise<void>
  toggleQuickTaskInProgress: (id: string) => Promise<void>
  toggleTaskInProgress: (projectId: string, taskId: string) => Promise<void>
  moveTaskToProject: (fromProjectId: string, toProjectId: string, taskId: string) => Promise<void>
  toggleTaskToDoNext: (projectId: string, taskId: string) => Promise<void>
  saveRepeatingTask: (task: RepeatingTask) => Promise<void>
  removeRepeatingTask: (id: string) => Promise<void>
  reorderRepeatingTasks: (orderedIds: string[]) => Promise<void>
  acceptRepeatingProposal: (repeatingTaskId: string, forDate?: string) => Promise<void>
  dismissRepeatingProposal: (repeatingTaskId: string, forDate?: string) => Promise<void>
  lockWinsTasks: (tasks: LockedTaskRef[]) => Promise<void>
  unlockWinsTasks: () => Promise<void>
  loadWinsLock: () => Promise<void>
  saveHabit: (habit: Habit) => Promise<void>
  removeHabit: (id: string) => Promise<void>
  reorderHabits: (orderedIds: string[]) => Promise<void>
  habitTick: (id: string, mode: 'done' | 'freeze' | 'skip' | 'undo') => Promise<void>
  habitRetroTick: (id: string, dk: string, action: 'done' | 'freeze' | 'skip' | 'clear') => Promise<void>
  habitLogMinutes: (id: string, minutes: number) => Promise<void>
}

export const useProjects = create<ProjectsState>((set, get) => ({
  projects: [],
  quickTasks: [],
  quickNotes: '',
  config: {
    globalShortcut: 'CommandOrControl+Shift+Space',
    actionShortcuts: {},
    focusTaskId: null,
    focusProjectId: null,
    compactMode: false,
    cleanView: false,
    theme: 'dark',
    quickTasksLimit: 5,
    activeProjectsLimit: 5,
    cleanViewFont: 'Caveat'
  },
  focusCheckIns: [],
  repeatingTasks: [],
  dismissedRepeating: {},
  winsLock: null,
  habits: [],
  loaded: false,

  // Normalize project shape (links/color) when data comes from main process.

  loadData: async () => {
    try {
      const [data, checkIns] = await Promise.all([
        window.api.getAppData(),
        window.api.getFocusCheckIns()
      ])
      const normalizedProjects = assignMissingProjectColors((data.projects ?? []).map(normalizeProject))
      set({
        projects: normalizedProjects,
        quickTasks: data.quickTasks ?? [],
        quickNotes: data.quickNotes,
        config: data.config,
        focusCheckIns: checkIns,
        repeatingTasks: data.repeatingTasks ?? [],
        dismissedRepeating: data.dismissedRepeating ?? {},
        winsLock: data.winsLock ?? null,
        habits: data.habits ?? [],
        loaded: true
      })
    } catch (error) {
      console.error('Failed to load app data', error)
      set({ loaded: true })
    }
  },

  saveProject: async (project: Project) => {
    const updated = await window.api.saveProject(normalizeProject(project))
    set({ projects: assignMissingProjectColors((updated ?? []).map(normalizeProject)) })
  },

  deleteProject: async (id: string) => {
    const updated = await window.api.deleteProject(id)
    set({ projects: assignMissingProjectColors((updated ?? []).map(normalizeProject)) })
  },

  archiveProject: async (id: string) => {
    const updated = await window.api.archiveProject(id)
    set({ projects: assignMissingProjectColors((updated ?? []).map(normalizeProject)) })
  },

  unarchiveProject: async (id: string) => {
    const result = await window.api.unarchiveProject(id)
    if ('error' in result) {
      return result.error
    }
    set({ projects: assignMissingProjectColors((result.projects ?? []).map(normalizeProject)) })
    return null
  },

  suspendProject: async (id: string) => {
    const updated = await window.api.suspendProject(id)
    set({ projects: assignMissingProjectColors((updated ?? []).map(normalizeProject)) })
  },

  unsuspendProject: async (id: string) => {
    const result = await window.api.unsuspendProject(id)
    if ('error' in result) {
      return result.error
    }
    set({ projects: assignMissingProjectColors((result.projects ?? []).map(normalizeProject)) })
    return null
  },

  saveQuickNotes: async (notes: string) => {
    await window.api.saveQuickNotes(notes)
    set({ quickNotes: notes })
  },

  saveConfig: async (config: AppConfig) => {
    await window.api.saveConfig(config)
    set({ config })
  },

  reorderProjects: async (orderedIds: string[]) => {
    const updated = await window.api.reorderProjects(orderedIds)
    set({ projects: assignMissingProjectColors((updated ?? []).map(normalizeProject)) })
  },

  setFocus: async (projectId: string | null, taskId: string | null) => {
    const { config } = get()
    // Block starting new focus while one is already active
    if (projectId && taskId && config.focusProjectId && config.focusTaskId) return
    const newConfig = { ...config, focusProjectId: projectId, focusTaskId: taskId }
    await window.api.saveConfig(newConfig)
    set({ config: newConfig })

    if (projectId && taskId) {
      await window.api.enterFocusMode()
    } else {
      await window.api.exitFocusMode()
    }
  },

  saveQuickTask: async (task: QuickTask) => {
    const updated = await window.api.saveQuickTask(task)
    set({ quickTasks: updated })
  },

  removeQuickTask: async (id: string) => {
    const updated = await window.api.removeQuickTask(id)
    set({ quickTasks: updated })
  },

  completeQuickTask: async (id: string) => {
    const updated = await window.api.completeQuickTask(id)
    set({ quickTasks: updated })
  },

  uncompleteQuickTask: async (id: string) => {
    const updated = await window.api.uncompleteQuickTask(id)
    set({ quickTasks: updated })
  },

  reorderQuickTasks: async (orderedIds: string[]) => {
    const updated = await window.api.reorderQuickTasks(orderedIds)
    set({ quickTasks: updated })
  },

  toggleQuickTaskInProgress: async (id: string) => {
    const updated = await window.api.toggleQuickTaskInProgress(id)
    set({ quickTasks: updated })
  },

  toggleTaskInProgress: async (projectId: string, taskId: string) => {
    const updated = await window.api.toggleTaskInProgress(projectId, taskId)
    set({ projects: assignMissingProjectColors((updated ?? []).map(normalizeProject)) })
  },

  moveTaskToProject: async (fromProjectId: string, toProjectId: string, taskId: string) => {
    const updated = await window.api.moveTaskToProject(fromProjectId, toProjectId, taskId)
    set({ projects: assignMissingProjectColors((updated ?? []).map(normalizeProject)) })
  },

  toggleTaskToDoNext: async (projectId: string, taskId: string) => {
    const updated = await window.api.toggleTaskToDoNext(projectId, taskId)
    set({ projects: assignMissingProjectColors((updated ?? []).map(normalizeProject)) })
  },

  saveRepeatingTask: async (task: RepeatingTask) => {
    const updated = await window.api.saveRepeatingTask(task)
    set({ repeatingTasks: updated })
  },

  removeRepeatingTask: async (id: string) => {
    const updated = await window.api.removeRepeatingTask(id)
    set({ repeatingTasks: updated })
  },

  reorderRepeatingTasks: async (orderedIds: string[]) => {
    const updated = await window.api.reorderRepeatingTasks(orderedIds)
    set({ repeatingTasks: updated })
  },

  acceptRepeatingProposal: async (repeatingTaskId: string, forDate?: string) => {
    const updated = await window.api.acceptRepeatingProposal(repeatingTaskId, forDate)
    set({ quickTasks: updated })
  },

  dismissRepeatingProposal: async (repeatingTaskId: string, forDate?: string) => {
    await window.api.dismissRepeatingProposal(repeatingTaskId, forDate)
    const { dismissedRepeating } = get()
    const dk = forDate || dateKey(new Date())
    const existing = dismissedRepeating[dk] ?? []
    set({
      dismissedRepeating: { ...dismissedRepeating, [dk]: [...existing, repeatingTaskId] }
    })
  },

  lockWinsTasks: async (tasks: LockedTaskRef[]) => {
    const lockState = await window.api.winsLock(tasks)
    set({ winsLock: lockState })
  },

  unlockWinsTasks: async () => {
    const lockState = await window.api.winsUnlock()
    set({ winsLock: lockState })
  },

  loadWinsLock: async () => {
    const lockState = await window.api.winsGetLockState()
    set({ winsLock: lockState })
  },

  saveHabit: async (habit: Habit) => {
    const updated = await window.api.saveHabit(habit)
    set({ habits: updated })
  },

  removeHabit: async (id: string) => {
    const updated = await window.api.removeHabit(id)
    set({ habits: updated })
  },

  reorderHabits: async (orderedIds: string[]) => {
    const updated = await window.api.reorderHabits(orderedIds)
    set({ habits: updated })
  },

  habitTick: async (id: string, mode: 'done' | 'freeze' | 'skip' | 'undo') => {
    const updated = await window.api.habitTick(id, mode)
    set({ habits: updated })
  },

  habitRetroTick: async (id: string, dk: string, action: 'done' | 'freeze' | 'skip' | 'clear') => {
    const updated = await window.api.habitRetroTick(id, dk, action)
    set({ habits: updated })
  },

  habitLogMinutes: async (id: string, minutes: number) => {
    const updated = await window.api.habitLogMinutes(id, minutes)
    set({ habits: updated })
  },
}))
