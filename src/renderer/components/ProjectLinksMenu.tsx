import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Project } from '../../shared/types'
import { normalizeProjectLinks, openProjectLink, projectColorValue } from '../utils/projects'

interface Props {
  projects: Project[]
  x: number
  y: number
  onClose: () => void
  fullWidth?: boolean
}

function projectCode(p: Project): string {
  return p.code || p.name.slice(0, 4)
}

export default function ProjectLinksMenu({ projects, x, y, onClose, fullWidth }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  const active = projects.filter((p) => !p.archivedAt && !p.suspendedAt)
  const withLinks = active
    .map((p) => ({ project: p, links: normalizeProjectLinks(p) }))
    .filter(({ links }) => links.length > 0)
  const withoutLinks = active.filter((p) => normalizeProjectLinks(p).length === 0)

  useLayoutEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const vh = window.innerHeight
    const vw = window.innerWidth

    if (fullWidth) {
      const left = Math.round((vw - rect.width) / 2)
      let top = y
      if (rect.bottom > vh) top = vh - rect.height - 4
      if (top < 0) top = 4
      setPos({ left, top })
    } else {
      let left = x
      let top = y
      if (rect.right > vw) left = vw - rect.width - 4
      if (rect.bottom > vh) top = vh - rect.height - 4
      if (left < 0) left = 4
      if (top < 0) top = 4
      setPos({ left, top })
    }
  }, [x, y, fullWidth])

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  if (withLinks.length === 0 && withoutLinks.length === 0) return null

  return (
    <div
      ref={ref}
      className="context-menu links-menu"
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation() }}
    >
      {withLinks.map(({ project, links }) => (
        <div key={project.id} className="links-menu-row">
          <button
            className="links-menu-code"
            style={{ color: projectColorValue(project.color) || undefined }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => { window.api.showProjectInMain(project.id); onClose() }}
            title={`Open ${project.name}`}
          >
            {projectCode(project)}
          </button>
          <span className="links-menu-links">
            {links.map((link, i) => (
              <span key={i} className="links-menu-link-wrap">
                {i > 0 && <span className="links-menu-divider">|</span>}
                <span
                  className="links-menu-link"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => { openProjectLink(link, project.name); onClose() }}
                >
                  {link.label}
                </span>
              </span>
            ))}
          </span>
        </div>
      ))}

      {withoutLinks.length > 0 && (
        <>
          <div className="context-menu-separator" />
          <div className="links-menu-row">
            {withoutLinks.map((project) => (
              <button
                key={project.id}
                className="links-menu-code"
                style={{ color: projectColorValue(project.color) || undefined }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => { window.api.showProjectInMain(project.id); onClose() }}
                title={project.name}
              >
                {projectCode(project)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
