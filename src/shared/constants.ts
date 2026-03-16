import type { ProjectColor, ProjectLaunchers } from './types'

export const PROJECT_COLORS: ProjectColor[] = ['red', 'orange', 'amber', 'green', 'blue', 'purple', 'pink', 'teal']

export const LINK_LABELS: Record<keyof ProjectLaunchers, string> = {
  vscode: 'VS Code',
  iterm: 'Terminal',
  obsidian: 'Obsidian',
  browser: 'Browser'
}

export const STANDALONE_PROJECT_ID = '__standalone__'

// UI layout constants for clean view
export const CLEAN_VIEW_ROW_HEIGHT = 34
export const CLEAN_VIEW_SEPARATOR_HEIGHT = 20
export const CLEAN_VIEW_HEADER_HEIGHT = 142
export const CLEAN_VIEW_MIN_HEIGHT = 240
export const CLEAN_VIEW_WIDTH = 340
