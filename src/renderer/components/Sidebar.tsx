import { useState } from 'react'
import type { Project } from '../types'
import { projectColorValue } from '../utils/projects'

type DragSource = 'active' | 'suspended' | 'archived'

interface Props {
  activeView: string
  activeProjects: Project[]
  suspendedProjects: Project[]
  archivedProjects: Project[]
  suspendedOpen: boolean
  archivedOpen: boolean
  activeProjectsLimit: number
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
  onRestoreArchivedToSuspended: (projectId: string) => void | Promise<void>
  onReorderActiveProjects: (orderedIds: string[]) => void | Promise<void>
  onUnsuspendProject: (projectId: string, targetIndex?: number) => void | Promise<void>
  onSuspendProject: (projectId: string) => void | Promise<void>
  onArchiveProject: (projectId: string) => void | Promise<void>
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
  activeProjectsLimit,
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
  onRestoreArchivedToSuspended,
  onReorderActiveProjects,
  onUnsuspendProject,
  onSuspendProject,
  onArchiveProject
}: Props) {
  const themeIcon = theme === 'light' ? '🌙' : '☀'
  const themeLabel = theme === 'light' ? 'Dark mode' : 'Light mode'
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragSource, setDragSource] = useState<DragSource | null>(null)
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null)
  const [dragOverActiveZone, setDragOverActiveZone] = useState(false)
  const [dragOverSuspendedZone, setDragOverSuspendedZone] = useState(false)
  const [dragOverArchivedZone, setDragOverArchivedZone] = useState(false)

  const clearDragState = () => {
    setDraggedId(null)
    setDragSource(null)
    setDragOverProjectId(null)
    setDragOverActiveZone(false)
    setDragOverSuspendedZone(false)
    setDragOverArchivedZone(false)
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

  const handleDragStart = (projectId: string, source: DragSource) => {
    setDraggedId(projectId)
    setDragSource(source)
  }

  // --- Active zone: accepts from suspended & archived ---
  const canDropToActive = dragSource === 'suspended' || dragSource === 'archived'

  const handleActiveDragOver = (event: React.DragEvent) => {
    if (!canDropToActive) return
    event.preventDefault()
    setDragOverActiveZone(true)
  }

  const handleActiveDrop = () => {
    if (!draggedId || !canDropToActive) return
    if (dragSource === 'suspended') {
      onUnsuspendProject(draggedId, activeProjects.length)
    } else if (dragSource === 'archived') {
      onRestoreArchived(draggedId)
    }
    clearDragState()
  }

  // --- Suspended zone: accepts from active & archived ---
  const canDropToSuspended = dragSource === 'active' || dragSource === 'archived'

  const handleSuspendDragOver = (event: React.DragEvent) => {
    if (!canDropToSuspended) return
    event.preventDefault()
    setDragOverSuspendedZone(true)
  }

  const handleSuspendDrop = () => {
    if (!draggedId || !canDropToSuspended) return
    if (dragSource === 'active') {
      onSuspendProject(draggedId)
    } else if (dragSource === 'archived') {
      onRestoreArchivedToSuspended(draggedId)
    }
    clearDragState()
  }

  // --- Archived zone: accepts from active & suspended ---
  const canDropToArchived = dragSource === 'active' || dragSource === 'suspended'

  const handleArchivedDragOver = (event: React.DragEvent) => {
    if (!canDropToArchived) return
    event.preventDefault()
    setDragOverArchivedZone(true)
  }

  const handleArchivedDrop = () => {
    if (!draggedId || !canDropToArchived) return
    onArchiveProject(draggedId)
    clearDragState()
  }

  // --- Active item drop: accepts reorder from active, insert from suspended & archived ---
  const handleActiveItemDragOver = (event: React.DragEvent, projectId: string) => {
    if (!draggedId) return
    if (dragSource !== 'active' && dragSource !== 'suspended' && dragSource !== 'archived') return
    event.preventDefault()
    setDragOverProjectId(projectId)
    setDragOverActiveZone(false)
  }

  const handleActiveItemDrop = (event: React.DragEvent, projectId: string) => {
    event.preventDefault()
    if (!draggedId || draggedId === projectId) return
    if (dragSource === 'active') {
      const ordered = moveInList(activeProjects.map((item) => item.id), draggedId, projectId)
      onReorderActiveProjects(ordered)
    } else if (dragSource === 'suspended') {
      const targetIndex = activeProjects.findIndex((item) => item.id === projectId)
      onUnsuspendProject(draggedId, targetIndex)
    } else if (dragSource === 'archived') {
      const targetIndex = activeProjects.findIndex((item) => item.id === projectId)
      // Restore archived then reorder — onRestoreArchived handles limit check
      onRestoreArchived(draggedId)
      // Position will be at end; reordering after async restore is handled by Dashboard
    }
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
          onDragOver={handleActiveDragOver}
          onDragLeave={() => setDragOverActiveZone(false)}
          onDrop={() => handleActiveDrop()}
        >
          {activeProjects.map((project) => (
            <div
              key={project.id}
              draggable
              onDragStart={() => handleDragStart(project.id, 'active')}
              onDragEnd={clearDragState}
              onDragOver={(event) => handleActiveItemDragOver(event, project.id)}
              onDragLeave={() => {
                if (dragOverProjectId === project.id) {
                  setDragOverProjectId(null)
                }
              }}
              onDrop={(event) => handleActiveItemDrop(event, project.id)}
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
        <div
          className={dragOverArchivedZone ? 'sidebar-label drag-target' : 'sidebar-label'}
          style={{ cursor: 'pointer' }}
          onClick={onToggleArchived}
          onDragOver={handleArchivedDragOver}
          onDrop={(event) => {
            event.preventDefault()
            handleArchivedDrop()
          }}
        >
          Archived <span style={{ fontSize: 9, marginLeft: 2 }}>{archivedOpen ? '▾' : '▸'}</span>
        </div>
        <div
          className={dragOverArchivedZone ? 'sidebar-drop-zone active' : 'sidebar-drop-zone'}
          onDragOver={handleArchivedDragOver}
          onDragLeave={() => setDragOverArchivedZone(false)}
          onDrop={(event) => {
            event.preventDefault()
            handleArchivedDrop()
          }}
        >
          {archivedOpen && archivedProjects.map((project) => (
            <div
              key={project.id}
              draggable
              onDragStart={() => handleDragStart(project.id, 'archived')}
              onDragEnd={clearDragState}
              onDragOver={handleArchivedDragOver}
              onDrop={(event) => {
                event.preventDefault()
                handleArchivedDrop()
              }}
            >
              <SidebarItem
                icon="📦"
                label={project.name || 'Untitled Project'}
                faded
                onClick={() => {
                  if (confirm(`Restore archived project "${project.name || 'Untitled Project'}"?`)) {
                    onRestoreArchived(project.id)
                  }
                }}
              />
            </div>
          ))}
        </div>
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
