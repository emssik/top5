import type { ProjectLaunchers } from '../types'

type LauncherType = keyof ProjectLaunchers

export const launcherMeta: Record<LauncherType, { label: string; icon: string }> = {
  vscode: { label: 'VS Code', icon: '</>' },
  iterm: { label: 'Terminal', icon: '>_' },
  obsidian: { label: 'Obsidian', icon: '📓' },
  browser: { label: 'Browser', icon: '🌐' }
}

const launcherTypes: LauncherType[] = ['vscode', 'iterm', 'obsidian', 'browser']

export function getActiveLaunchers(launchers?: ProjectLaunchers): Array<[LauncherType, string]> {
  if (!launchers) return []
  const active: Array<[LauncherType, string]> = []

  for (const type of launcherTypes) {
    const value = launchers[type]
    if (value) active.push([type, value])
  }

  return active
}

export function launchByType(type: LauncherType, value: string): void {
  switch (type) {
    case 'vscode':
      window.api.launchVscode(value)
      break
    case 'iterm':
      window.api.launchIterm(value)
      break
    case 'obsidian':
      window.api.launchObsidian(value)
      break
    case 'browser':
      window.api.launchBrowser(value)
      break
  }
}
