import type { Project, ProjectColor, ProjectLink, ProjectLaunchers } from '../types'

export const PROJECT_COLORS: ProjectColor[] = ['red', 'orange', 'amber', 'green', 'blue', 'purple', 'pink', 'teal']

const COLOR_CSS_VAR: Record<ProjectColor, string> = {
  red: 'var(--pc-red)',
  orange: 'var(--pc-orange)',
  amber: 'var(--pc-amber)',
  green: 'var(--pc-green)',
  blue: 'var(--pc-blue)',
  purple: 'var(--pc-purple)',
  pink: 'var(--pc-pink)',
  teal: 'var(--pc-teal)'
}

const LINK_LABELS: Record<keyof ProjectLaunchers, string> = {
  vscode: 'VS Code',
  iterm: 'Terminal',
  obsidian: 'Obsidian',
  browser: 'Browser'
}

function isProjectColor(value: unknown): value is ProjectColor {
  return typeof value === 'string' && PROJECT_COLORS.includes(value as ProjectColor)
}

export function projectColorValue(color?: string | null): string {
  if (color && isProjectColor(color)) {
    return COLOR_CSS_VAR[color]
  }
  return COLOR_CSS_VAR.blue
}

export function normalizeLaunchers(launchers?: ProjectLaunchers): ProjectLaunchers {
  return {
    vscode: launchers?.vscode ?? null,
    iterm: launchers?.iterm ?? null,
    obsidian: launchers?.obsidian ?? null,
    browser: launchers?.browser ?? null
  }
}

export function linksFromLaunchers(launchers?: ProjectLaunchers): ProjectLink[] {
  const normalized = normalizeLaunchers(launchers)
  return (Object.entries(normalized) as Array<[keyof ProjectLaunchers, string | null]>)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => ({ label: LINK_LABELS[key], url: value!.trim() }))
}

export function normalizeProjectLinks(project: Project): ProjectLink[] {
  const rawLinks = Array.isArray(project.links) ? project.links : []
  const links = rawLinks
    .filter((link): link is ProjectLink => !!link && typeof link.label === 'string' && typeof link.url === 'string')
    .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
    .filter((link) => link.label.length > 0 && link.url.length > 0)

  if (links.length > 0) return links
  return linksFromLaunchers(project.launchers)
}

function mergeLaunchersFromLinks(launchers: ProjectLaunchers, links: ProjectLink[]): ProjectLaunchers {
  const next = { ...launchers }

  for (const link of links) {
    const label = link.label.toLowerCase()
    const url = link.url.trim()
    if (!url) continue

    if (!next.vscode && (label.includes('code') || url.startsWith('vscode://'))) {
      next.vscode = url
      continue
    }

    if (!next.iterm && (label.includes('term') || url.startsWith('iterm://'))) {
      next.iterm = url
      continue
    }

    if (!next.obsidian && (label.includes('obsidian') || url.startsWith('obsidian://'))) {
      next.obsidian = url
      continue
    }

    if (!next.browser && (url.startsWith('http://') || url.startsWith('https://') || label.includes('browser'))) {
      next.browser = url
    }
  }

  return next
}

export function normalizeProject(project: Project): Project {
  const links = normalizeProjectLinks(project)
  const launchers = mergeLaunchersFromLinks(normalizeLaunchers(project.launchers), links)
  return {
    ...project,
    launchers,
    links,
    color: isProjectColor(project.color) ? project.color : undefined
  }
}

export function assignMissingProjectColors(projects: Project[]): Project[] {
  const normalized = projects.map(normalizeProject)
  const used = new Set(normalized.map((project) => project.color).filter((color): color is ProjectColor => !!color && isProjectColor(color)))
  const available = PROJECT_COLORS.filter((color) => !used.has(color))

  return normalized.map((project) => {
    if (project.color && isProjectColor(project.color)) return project
    const fallback = PROJECT_COLORS[Math.max(0, project.order) % PROJECT_COLORS.length]
    const color = available.shift() ?? fallback
    used.add(color)
    return { ...project, color }
  })
}

export function firstAvailableProjectColor(projects: Project[]): ProjectColor {
  const used = new Set(projects.map((project) => project.color).filter((color): color is ProjectColor => !!color && isProjectColor(color)))
  return PROJECT_COLORS.find((color) => !used.has(color)) ?? PROJECT_COLORS[0]
}

export function openProjectLink(link: ProjectLink, projectName?: string): void {
  const label = link.label.trim().toLowerCase()
  const value = link.url.trim()
  if (!value) return

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value)

  if (value.startsWith('obsidian://')) {
    window.api.launchObsidian(value)
    return
  }

  if (value.startsWith('mailto:')) {
    window.api.openExternal(value)
    return
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    window.api.launchBrowser(value)
    return
  }

  if (hasScheme) {
    window.api.openExternal(value)
    return
  }

  if (label.includes('code')) {
    window.api.launchVscode(value)
    return
  }

  if (label.includes('term')) {
    window.api.launchIterm(value, projectName)
    return
  }

  if (label.includes('obsidian')) {
    window.api.launchObsidian(value)
    return
  }

  window.api.launchBrowser(value)
}
