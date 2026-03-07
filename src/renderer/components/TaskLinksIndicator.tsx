import type { ProjectLink } from '../types'
import { openProjectLink } from '../utils/projects'

interface Props {
  links: ProjectLink[]
  projectName?: string
}

const SCHEME_ICONS: Record<string, string> = {
  'vscode://': 'vscode',
  'obsidian://': 'obsidian',
  'iterm://': 'terminal',
}

const DOMAIN_ICONS: Record<string, string> = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
  'figma.com': 'figma',
  'linear.app': 'linear',
  'notion.so': 'notion',
  'slack.com': 'slack',
  'jira.atlassian.net': 'jira',
  'trello.com': 'trello',
  'stackoverflow.com': 'stackoverflow',
  'youtube.com': 'youtube',
  'docs.google.com': 'google-docs',
  'drive.google.com': 'google-drive',
  'sheets.google.com': 'google-sheets',
}

const LABEL_HINTS: Record<string, string> = {
  code: 'vscode',
  vscode: 'vscode',
  'vs code': 'vscode',
  terminal: 'terminal',
  iterm: 'terminal',
  obsidian: 'obsidian',
  github: 'github',
  figma: 'figma',
  linear: 'linear',
  notion: 'notion',
  slack: 'slack',
  jira: 'jira',
}

// Small inline SVG icons for known apps (16x16 viewBox)
const SVG_ICONS: Record<string, JSX.Element> = {
  vscode: (
    <svg viewBox="0 0 100 100" width="12" height="12">
      <path d="M71.6 99.1l24.7-11.9c2.3-1.1 3.7-3.4 3.7-5.9V18.7c0-2.5-1.4-4.8-3.7-5.9L71.6.9c-2.9-1.4-6.3-.8-8.6 1.4L28.2 34.7 11.7 22.1c-1.9-1.5-4.6-1.3-6.3.3L.8 27.1c-1.9 1.9-1.9 5 0 6.9L15.4 50 .8 66c-1.9 1.9-1.9 5 0 6.9l4.6 4.7c1.7 1.7 4.4 1.8 6.3.3L28.2 65.3 63 97.7c2.3 2.3 5.7 2.9 8.6 1.4zM71.4 27.2L43.6 50l27.8 22.8V27.2z" fill="currentColor"/>
    </svg>
  ),
  obsidian: (
    <svg viewBox="0 0 100 100" width="12" height="12">
      <path d="M68.1 3.8C62 8.5 55.3 17.4 52.6 29.2c-1.4 6-1.7 12.1-1 18 .7 5.8 2.6 11.5 5.5 16.6 4.3 7.6 5.8 16.4 4.2 24.9l-1.4 7.2 7-2c8.1-2.4 15.1-7.4 19.8-14.3 4.8-6.9 7-15.2 6.4-23.5-.4-5.2-1.9-10.3-4.4-14.9-2.5-4.5-5.9-8.5-10-11.6-3.8-2.9-6.4-7.2-7.3-12-.8-4.8.2-9.7 2.7-13.8zM31.9 3.8c6.1 4.7 12.8 13.6 15.5 25.4 1.4 6 1.7 12.1 1 18-.7 5.8-2.6 11.5-5.5 16.6-4.3 7.6-5.8 16.4-4.2 24.9l1.4 7.2-7-2c-8.1-2.4-15.1-7.4-19.8-14.3C8.5 72.7 6.3 64.4 6.9 56c.4-5.2 1.9-10.3 4.4-14.9 2.5-4.5 5.9-8.5 10-11.6 3.8-2.9 6.4-7.2 7.3-12 .8-4.8-.2-9.7-2.7-13.7z" fill="currentColor"/>
    </svg>
  ),
  terminal: (
    <svg viewBox="0 0 16 16" width="12" height="12">
      <path d="M2.5 3.5l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.5 12.5h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  github: (
    <svg viewBox="0 0 16 16" width="12" height="12">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" fill="currentColor"/>
    </svg>
  ),
  gitlab: (
    <svg viewBox="0 0 16 16" width="12" height="12">
      <path d="M8 14.5L10.9 5H5.1L8 14.5z" fill="currentColor" opacity="0.8"/>
      <path d="M8 14.5L5.1 5H1.4L8 14.5z" fill="currentColor" opacity="0.6"/>
      <path d="M1.4 5L.5 7.8c-.1.2 0 .5.2.6L8 14.5 1.4 5z" fill="currentColor" opacity="0.4"/>
      <path d="M1.4 5h3.7L3.6.5c-.1-.2-.3-.2-.4 0L1.4 5z" fill="currentColor"/>
      <path d="M8 14.5L10.9 5h3.7L8 14.5z" fill="currentColor" opacity="0.6"/>
      <path d="M14.6 5l.9 2.8c.1.2 0 .5-.2.6L8 14.5 14.6 5z" fill="currentColor" opacity="0.4"/>
      <path d="M14.6 5h-3.7L12.4.5c.1-.2.3-.2.4 0L14.6 5z" fill="currentColor"/>
    </svg>
  ),
}

function getDomain(url: string): string | null {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function resolveIconType(link: ProjectLink): string | null {
  const url = link.url.trim()
  const label = link.label.trim().toLowerCase()

  // Check label hints first
  for (const [hint, icon] of Object.entries(LABEL_HINTS)) {
    if (label.includes(hint)) return icon
  }

  // Check URL scheme
  for (const [scheme, icon] of Object.entries(SCHEME_ICONS)) {
    if (url.startsWith(scheme)) return icon
  }

  // Check domain
  const domain = getDomain(url)
  if (domain) {
    for (const [d, icon] of Object.entries(DOMAIN_ICONS)) {
      if (domain === d || domain.endsWith('.' + d)) return icon
    }
  }

  return null
}

function LinkIcon({ link }: { link: ProjectLink }) {
  const iconType = resolveIconType(link)

  // Known SVG icon
  if (iconType && SVG_ICONS[iconType]) {
    return <span className="task-link-icon">{SVG_ICONS[iconType]}</span>
  }

  // HTTP(S) URL — use favicon
  const domain = getDomain(link.url.trim())
  if (domain) {
    return (
      <span className="task-link-icon">
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
          width="12"
          height="12"
          alt=""
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      </span>
    )
  }

  return null
}

export default function TaskLinksIndicator({ links, projectName }: Props) {
  if (links.length === 0) return null

  // Deduplicate icon types to avoid showing e.g. two GitHub icons
  const seen = new Set<string>()
  const iconsToShow: ProjectLink[] = []
  for (const link of links) {
    const key = resolveIconType(link) ?? getDomain(link.url.trim()) ?? link.url
    if (!seen.has(key)) {
      seen.add(key)
      iconsToShow.push(link)
    }
  }

  return (
    <span
      className="task-links-indicator"
      title={links.map((l) => `${l.label}: ${l.url}`).join('\n')}
      onClick={(e) => { e.stopPropagation(); for (const l of links) openProjectLink(l, projectName) }}
    >
      {iconsToShow.map((link, i) => (
        <LinkIcon key={i} link={link} />
      ))}
    </span>
  )
}
