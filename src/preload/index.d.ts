import { ElectronAPI } from '@electron-toolkit/preload'

interface Api {
  getAppData: () => Promise<import('../renderer/types').AppData>
  saveProject: (project: import('../renderer/types').Project) => Promise<import('../renderer/types').Project[]>
  deleteProject: (id: string) => Promise<import('../renderer/types').Project[]>
  saveQuickNotes: (notes: string) => Promise<void>
  saveConfig: (config: import('../renderer/types').AppConfig) => Promise<void>
  updateProjectTimer: (projectId: string, totalTimeMs: number, timerStartedAt: string | null) => Promise<import('../renderer/types').Project[]>
  launchVscode: (path: string) => Promise<void>
  launchIterm: (path: string) => Promise<void>
  launchObsidian: (vault: string) => Promise<void>
  launchBrowser: (url: string) => Promise<void>
  enterFocusMode: () => Promise<void>
  exitFocusMode: () => Promise<void>
  pickFolder: () => Promise<string | null>
  pickObsidianNote: () => Promise<{ path: string; uri: string | null } | null>
  onReloadData: (callback: () => void) => () => void
  onShortcutAction: (callback: (data: { action: string; index?: number }) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
