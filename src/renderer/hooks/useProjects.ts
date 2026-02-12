import { create } from 'zustand'
import type { Project, QuickTask, AppData, AppConfig, FocusCheckIn } from '../types'

interface ProjectsState {
  projects: Project[]
  quickTasks: QuickTask[]
  quickNotes: string
  config: AppConfig
  focusCheckIns: FocusCheckIn[]
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
  setCompactMode: (enabled: boolean) => Promise<void>
  saveQuickTask: (task: QuickTask) => Promise<void>
  removeQuickTask: (id: string) => Promise<void>
  completeQuickTask: (id: string) => Promise<void>
  uncompleteQuickTask: (id: string) => Promise<void>
  reorderQuickTasks: (orderedIds: string[]) => Promise<void>
  toggleTaskToDoNext: (projectId: string, taskId: string) => Promise<void>
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
    quickTasksLimit: 5
  },
  focusCheckIns: [],
  loaded: false,

  loadData: async () => {
    try {
      const [data, checkIns] = await Promise.all([
        window.api.getAppData(),
        window.api.getFocusCheckIns()
      ])
      set({
        projects: data.projects,
        quickTasks: data.quickTasks ?? [],
        quickNotes: data.quickNotes,
        config: data.config,
        focusCheckIns: checkIns,
        loaded: true
      })
    } catch (error) {
      console.error('Failed to load app data', error)
      set({ loaded: true })
    }
  },

  saveProject: async (project: Project) => {
    const updated = await window.api.saveProject(project)
    set({ projects: updated })
  },

  deleteProject: async (id: string) => {
    const updated = await window.api.deleteProject(id)
    set({ projects: updated })
  },

  archiveProject: async (id: string) => {
    const updated = await window.api.archiveProject(id)
    set({ projects: updated })
  },

  unarchiveProject: async (id: string) => {
    const result = await window.api.unarchiveProject(id)
    if ('error' in result) {
      return result.error
    }
    set({ projects: result.projects })
    return null
  },

  suspendProject: async (id: string) => {
    const updated = await window.api.suspendProject(id)
    set({ projects: updated })
  },

  unsuspendProject: async (id: string) => {
    const result = await window.api.unsuspendProject(id)
    if ('error' in result) {
      return result.error
    }
    set({ projects: result.projects })
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
    const { projects } = get()
    let updated = projects
    for (let i = 0; i < orderedIds.length; i++) {
      const project = projects.find((p) => p.id === orderedIds[i])
      if (project && project.order !== i) {
        updated = await window.api.saveProject({ ...project, order: i })
      }
    }
    set({ projects: updated })
  },

  setFocus: async (projectId: string | null, taskId: string | null) => {
    const { config } = get()
    const newConfig = { ...config, focusProjectId: projectId, focusTaskId: taskId }
    await window.api.saveConfig(newConfig)
    set({ config: newConfig })

    if (projectId && taskId) {
      await window.api.enterFocusMode()
    } else {
      await window.api.exitFocusMode()
    }
  },

  setCompactMode: async (enabled: boolean) => {
    const { config } = get()
    const newConfig = { ...config, compactMode: enabled }
    await window.api.saveConfig(newConfig)
    set({ config: newConfig })

    if (enabled) {
      await window.api.enterCompactMode()
    } else {
      await window.api.exitCompactMode()
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

  toggleTaskToDoNext: async (projectId: string, taskId: string) => {
    const updated = await window.api.toggleTaskToDoNext(projectId, taskId)
    set({ projects: updated })
  }
}))
