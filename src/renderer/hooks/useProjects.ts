import { create } from 'zustand'
import type { Project, AppData, AppConfig } from '../types'
import { nanoid } from 'nanoid'

interface ProjectsState {
  projects: Project[]
  quickNotes: string
  config: AppConfig
  loaded: boolean

  loadData: () => Promise<void>
  addProject: () => Promise<void>
  saveProject: (project: Project) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  archiveProject: (id: string) => Promise<void>
  unarchiveProject: (id: string) => Promise<string | null>
  saveQuickNotes: (notes: string) => Promise<void>
  saveConfig: (config: AppConfig) => Promise<void>
  reorderProjects: (orderedIds: string[]) => Promise<void>
  toggleTimer: (projectId: string) => Promise<void>
  setFocus: (projectId: string | null, taskId: string | null) => Promise<void>
  setCompactMode: (enabled: boolean) => Promise<void>
}

export const useProjects = create<ProjectsState>((set, get) => ({
  projects: [],
  quickNotes: '',
  config: {
    globalShortcut: 'CommandOrControl+Shift+Space',
    actionShortcuts: {},
    focusTaskId: null,
    focusProjectId: null,
    compactMode: false
  },
  loaded: false,

  loadData: async () => {
    const data: AppData = await window.api.getAppData()
    set({
      projects: data.projects,
      quickNotes: data.quickNotes,
      config: data.config,
      loaded: true
    })
  },

  addProject: async () => {
    const { projects } = get()
    const activeProjects = projects.filter((p) => !p.archivedAt)
    if (activeProjects.length >= 5) return

    const newProject: Project = {
      id: nanoid(),
      name: '',
      description: '',
      order: activeProjects.length,
      deadline: null,
      totalTimeMs: 0,
      timerStartedAt: null,
      launchers: { vscode: null, iterm: null, obsidian: null, browser: null },
      tasks: [],
      archivedAt: null
    }

    const updated = await window.api.saveProject(newProject)
    set({ projects: updated })
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

  toggleTimer: async (projectId: string) => {
    const { projects } = get()
    const project = projects.find((p) => p.id === projectId)
    if (!project) return

    let newTotalTimeMs = project.totalTimeMs
    let newTimerStartedAt: string | null

    if (project.timerStartedAt) {
      // Stop: accumulate elapsed time
      const elapsed = Date.now() - new Date(project.timerStartedAt).getTime()
      newTotalTimeMs = project.totalTimeMs + elapsed
      newTimerStartedAt = null
    } else {
      // Start
      newTimerStartedAt = new Date().toISOString()
    }

    const updated = await window.api.updateProjectTimer(projectId, newTotalTimeMs, newTimerStartedAt)
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
  }
}))
