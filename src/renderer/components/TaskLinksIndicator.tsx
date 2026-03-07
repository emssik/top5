import type { ProjectLink } from '../types'
import { openProjectLink } from '../utils/projects'

interface Props {
  links: ProjectLink[]
  projectName?: string
}

function formatLinkTooltip(links: ProjectLink[]): string {
  return links.map((l) => `${l.label}: ${l.url}`).join('\n')
}

export default function TaskLinksIndicator({ links, projectName }: Props) {
  if (links.length === 0) return null

  return (
    <span
      className="task-links-indicator"
      title={formatLinkTooltip(links)}
      onClick={(e) => { e.stopPropagation(); for (const l of links) openProjectLink(l, projectName) }}
    >
      🔗
    </span>
  )
}
