import Store from 'electron-store'
import { dialog } from 'electron'
import type { IpcMain } from 'electron'
import { existsSync } from 'fs'
import { dirname, basename, relative, join } from 'path'

interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: string
}

interface Project {
  id: string
  name: string
  description: string
  order: number
  deadline: string | null
  totalTimeMs: number
  timerStartedAt: string | null
  launchers: {
    vscode: string | null
    iterm: string | null
    obsidian: string | null
    browser: string | null
  }
  tasks: Task[]
}

interface AppConfig {
  globalShortcut: string
  actionShortcuts: Record<string, string>
  focusTaskId: string | null
  focusProjectId: string | null
}

interface AppData {
  projects: Project[]
  quickNotes: string
  config: AppConfig
}

const defaultData: AppData = {
  projects: [],
  quickNotes: '',
  config: {
    globalShortcut: 'CommandOrControl+Shift+Space',
    actionShortcuts: {
      'toggle-app': 'CommandOrControl+Shift+Space',
      'project-1': 'CommandOrControl+1',
      'project-2': 'CommandOrControl+2',
      'project-3': 'CommandOrControl+3',
      'project-4': 'CommandOrControl+4',
      'project-5': 'CommandOrControl+5',
      'toggle-focus': 'CommandOrControl+Shift+F',
      'quick-notes': 'CommandOrControl+Shift+N'
    },
    focusTaskId: null,
    focusProjectId: null
  }
}

const store = new Store<AppData>({ defaults: defaultData })

export function getStore(): Store<AppData> {
  return store
}

export function registerStoreHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('get-app-data', () => {
    return store.store
  })

  ipcMain.handle('save-project', (_event, project: Project) => {
    const projects = store.get('projects', [])
    const index = projects.findIndex((p) => p.id === project.id)
    if (index >= 0) {
      projects[index] = project
    } else {
      projects.push(project)
    }
    store.set('projects', projects)
    return projects
  })

  ipcMain.handle('delete-project', (_event, projectId: string) => {
    const projects = store.get('projects', []).filter((p) => p.id !== projectId)
    store.set('projects', projects)
    return projects
  })

  ipcMain.handle('save-quick-notes', (_event, notes: string) => {
    store.set('quickNotes', notes)
  })

  ipcMain.handle('save-config', (_event, config: AppConfig) => {
    store.set('config', config)
  })

  ipcMain.handle('update-project-timer', (_event, projectId: string, totalTimeMs: number, timerStartedAt: string | null) => {
    const projects = store.get('projects', [])
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      project.totalTimeMs = totalTimeMs
      project.timerStartedAt = timerStartedAt
      store.set('projects', projects)
    }
    return projects
  })

  ipcMain.handle('pick-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle('pick-obsidian-note', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled) return null

    const filePath = result.filePaths[0]

    // Walk up to find .obsidian folder (vault root)
    let dir = dirname(filePath)
    let vaultRoot: string | null = null
    while (dir !== dirname(dir)) {
      if (existsSync(join(dir, '.obsidian'))) {
        vaultRoot = dir
        break
      }
      dir = dirname(dir)
    }

    if (!vaultRoot) {
      // No vault found - return just the path
      return { path: filePath, uri: null }
    }

    const vaultName = basename(vaultRoot)
    const relativePath = relative(vaultRoot, filePath).replace(/\.md$/, '')

    const uri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relativePath)}`
    return { path: filePath, uri }
  })
}
