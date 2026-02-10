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
  saveQuickNotes: (notes: string) => Promise<void>
  saveConfig: (config: AppConfig) => Promise<void>
  toggleTimer: (projectId: string) => Promise<void>
  setFocus: (projectId: string | null, taskId: string | null) => Promise<void>
}

export const useProjects = create<ProjectsState>((set, get) => ({
  projects: [],
  quickNotes: '',
  config: {
    globalShortcut: 'CommandOrControl+Shift+Space',
    actionShortcuts: {},
    focusTaskId: null,
    focusProjectId: null
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
    if (projects.length >= 5) return

    const newProject: Project = {
      id: nanoid(),
      name: '',
      description: '',
      order: projects.length,
      deadline: null,
      totalTimeMs: 0,
      timerStartedAt: null,
      launchers: { vscode: null, iterm: null, obsidian: null, browser: null },
      tasks: []
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

  saveQuickNotes: async (notes: string) => {
    await window.api.saveQuickNotes(notes)
    set({ quickNotes: notes })
  },

  saveConfig: async (config: AppConfig) => {
    await window.api.saveConfig(config)
    set({ config })
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
  }
}))
