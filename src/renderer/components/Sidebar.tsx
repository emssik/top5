import { useState } from 'react'
import type { Project } from '../types'
import { projectColorValue } from '../utils/projects'

interface Props {
  activeView: string
  activeProjects: Project[]
  suspendedProjects: Project[]
  archivedProjects: Project[]
  suspendedOpen: boolean
  archivedOpen: boolean
  theme: 'light' | 'dark'
  onSelectView: (view: string) => void
  onToggleCleanView: () => void
  onToggleNotes: () => void
  onToggleSettings: () => void
  onToggleTheme: () => void
  onAddProject: () => void
  onToggleSuspended: () => void
  onToggleArchived: () => void
  onRestoreArchived: (projectId: string) => void
  onReorderActiveProjects: (orderedIds: string[]) => void | Promise<void>
  onUnsuspendProject: (projectId: string, targetIndex?: number) => void | Promise<void>
  onSuspendProject: (projectId: string) => void | Promise<void>
}

function SidebarItem({
  active,
  icon,
  label,
  onClick,
  dotColor,
  faded,
  className
}: {
  active?: boolean
  icon?: string
  label: string
  onClick?: () => void
  dotColor?: string
  faded?: boolean
  className?: string
}) {
  return (
    <div
      className={`sidebar-item ${active ? 'active' : ''} ${className ?? ''}`}
      onClick={onClick}
      style={faded ? { opacity: 0.5 } : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {dotColor ? (
        <span className="sidebar-dot" style={{ background: dotColor }} />
      ) : (
        <span className="sidebar-icon">{icon}</span>
      )}
      <span>{label}</span>
    </div>
  )
}

export default function Sidebar({
  activeView,
  activeProjects,
  suspendedProjects,
  archivedProjects,
  suspendedOpen,
  archivedOpen,
  theme,
  onSelectView,
  onToggleCleanView,
  onToggleNotes,
  onToggleSettings,
  onToggleTheme,
  onAddProject,
  onToggleSuspended,
  onToggleArchived,
  onRestoreArchived,
  onReorderActiveProjects,
  onUnsuspendProject,
  onSuspendProject
}: Props) {
  const themeIcon = theme === 'light' ? '🌙' : '☀'
  const themeLabel = theme === 'light' ? 'Dark mode' : 'Light mode'
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragSource, setDragSource] = useState<'active' | 'suspended' | null>(null)
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null)
  const [dragOverActiveZone, setDragOverActiveZone] = useState(false)
  const [dragOverSuspendedZone, setDragOverSuspendedZone] = useState(false)

  const clearDragState = () => {
    setDraggedId(null)
    setDragSource(null)
    setDragOverProjectId(null)
    setDragOverActiveZone(false)
    setDragOverSuspendedZone(false)
  }

  const moveInList = (ids: string[], id: string, targetId: string) => {
    const from = ids.indexOf(id)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1 || from === to) return ids
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, id)
    return next
  }

  const handleDragStart = (projectId: string, source: 'active' | 'suspended') => {
    setDraggedId(projectId)
    setDragSource(source)
  }

  const handleSuspendDragOver = (event: React.DragEvent) => {
    if (dragSource !== 'active') return
    event.preventDefault()
    setDragOverSuspendedZone(true)
  }

  const handleSuspendDrop = () => {
    if (!draggedId || dragSource !== 'active') return
    onSuspendProject(draggedId)
    clearDragState()
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sun">☀</span> TOP 5
      </div>

      <div className="sidebar-section">
        <SidebarItem active={activeView === 'today'} icon="▶" label="Today" onClick={() => onSelectView('today')} />
        <SidebarItem icon="👁" label="Clean view" onClick={onToggleCleanView} />
        <SidebarItem icon="📝" label="Quick notes" onClick={onToggleNotes} />
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-label">Projects</div>
        <div
          className={dragOverActiveZone ? 'sidebar-drop-zone active' : 'sidebar-drop-zone'}
          onDragOver={(event) => {
            if (dragSource !== 'suspended') return
            event.preventDefault()
            setDragOverActiveZone(true)
          }}
          onDragLeave={() => setDragOverActiveZone(false)}
          onDrop={() => {
            if (!draggedId || dragSource !== 'suspended') return
            onUnsuspendProject(draggedId, activeProjects.length)
            clearDragState()
          }}
        >
          {activeProjects.map((project) => (
            <div
              key={project.id}
              draggable
              onDragStart={() => handleDragStart(project.id, 'active')}
              onDragEnd={clearDragState}
              onDragOver={(event) => {
                if (!draggedId) return
                if (dragSource !== 'active' && dragSource !== 'suspended') return
                event.preventDefault()
                setDragOverProjectId(project.id)
                setDragOverActiveZone(false)
              }}
              onDragLeave={() => {
                if (dragOverProjectId === project.id) {
                  setDragOverProjectId(null)
                }
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (!draggedId || draggedId === project.id) return
                if (dragSource === 'active') {
                  const ordered = moveInList(activeProjects.map((item) => item.id), draggedId, project.id)
                  onReorderActiveProjects(ordered)
                } else if (dragSource === 'suspended') {
                  const targetIndex = activeProjects.findIndex((item) => item.id === project.id)
                  onUnsuspendProject(draggedId, targetIndex)
                }
                clearDragState()
              }}
            >
              <SidebarItem
                active={activeView === `project-${project.id}`}
                dotColor={projectColorValue(project.color)}
                label={project.name || 'Untitled Project'}
                onClick={() => onSelectView(`project-${project.id}`)}
                className={dragOverProjectId === project.id ? 'drag-over' : undefined}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <div
          className={dragOverSuspendedZone ? 'sidebar-label drag-target' : 'sidebar-label'}
          style={{ cursor: 'pointer' }}
          onClick={onToggleSuspended}
          onDragOver={handleSuspendDragOver}
          onDrop={(event) => {
            event.preventDefault()
            handleSuspendDrop()
          }}
        >
          Suspended <span style={{ fontSize: 9, marginLeft: 2 }}>{suspendedOpen ? '▾' : '▸'}</span>
        </div>
        <div
          className={dragOverSuspendedZone ? 'sidebar-drop-zone active' : 'sidebar-drop-zone'}
          onDragOver={handleSuspendDragOver}
          onDragLeave={() => setDragOverSuspendedZone(false)}
          onDrop={(event) => {
            event.preventDefault()
            handleSuspendDrop()
          }}
        >
          {suspendedOpen && suspendedProjects.map((project) => (
            <div
              key={project.id}
              draggable
              onDragStart={() => handleDragStart(project.id, 'suspended')}
              onDragEnd={clearDragState}
              onDragOver={handleSuspendDragOver}
              onDrop={(event) => {
                event.preventDefault()
                handleSuspendDrop()
              }}
            >
              <SidebarItem
                active={activeView === `project-${project.id}`}
                icon="⏸"
                label={project.name || 'Untitled Project'}
                faded
                onClick={() => onSelectView(`project-${project.id}`)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label" style={{ cursor: 'pointer' }} onClick={onToggleArchived}>
          Archived <span style={{ fontSize: 9, marginLeft: 2 }}>{archivedOpen ? '▾' : '▸'}</span>
        </div>
        {archivedOpen && archivedProjects.map((project) => (
          <SidebarItem
            key={project.id}
            icon="📦"
            label={project.name || 'Untitled Project'}
            faded
            onClick={() => {
              if (confirm(`Restore archived project "${project.name || 'Untitled Project'}"?`)) {
                onRestoreArchived(project.id)
              }
            }}
          />
        ))}
      </div>

      <div className="sidebar-section">
        <SidebarItem icon="+" label="Add project" onClick={onAddProject} />
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-divider" />
        <div className="sidebar-section">
          <SidebarItem active={activeView === 'repeat'} icon="↻" label="Repeat" onClick={() => onSelectView('repeat')} />
          <SidebarItem active={activeView === 'stats'} icon="📊" label="Stats" onClick={() => onSelectView('stats')} />
          <SidebarItem icon="⚙" label="Settings" onClick={onToggleSettings} />
          <div className="sidebar-divider" />
          <SidebarItem icon={themeIcon} label={themeLabel} onClick={onToggleTheme} />
        </div>
      </div>
    </aside>
  )
}
