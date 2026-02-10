import { useState, useEffect, useCallback, useRef } from 'react'
import { useProjects } from '../hooks/useProjects'
import ProjectTile from './ProjectTile'
import QuickNotes from './QuickNotes'
import Settings from './Settings'

export default function Dashboard() {
  const { projects, addProject, reorderProjects, unarchiveProject, setCompactMode } = useProjects()
  const [showNotes, setShowNotes] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const draggedId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const activeProjects = projects.filter((p) => !p.archivedAt)
  const archivedProjects = projects.filter((p) => p.archivedAt)

  const toggleExpanded = useCallback((projectId: string) => {
    setExpandedProjectId((prev) => (prev === projectId ? null : projectId))
  }, [])

  const handleRestore = async (id: string) => {
    setRestoreError(null)
    const error = await unarchiveProject(id)
    if (error) {
      setRestoreError(error)
      setTimeout(() => setRestoreError(null), 3000)
    }
  }

  // Auto-switch back to active view when archive becomes empty
  useEffect(() => {
    if (showArchived && archivedProjects.length === 0) {
      setShowArchived(false)
    }
  }, [showArchived, archivedProjects.length])

  const handleShortcutAction = useCallback((data: { action: string; index?: number }) => {
    if (data.action === 'select-project' && data.index !== undefined) {
      const sorted = [...activeProjects].sort((a, b) => a.order - b.order)
      if (data.index < sorted.length) {
        const targetId = sorted[data.index].id
        setExpandedProjectId((prev) => (prev === targetId ? null : targetId))
      }
    } else if (data.action === 'toggle-quick-notes') {
      setShowNotes((prev) => !prev)
    }
  }, [activeProjects])

  useEffect(() => {
    const cleanup = window.api.onShortcutAction(handleShortcutAction)
    return cleanup
  }, [handleShortcutAction])

  return (
    <div className="h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Draggable titlebar area */}
      <div className="h-8 flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1">
            {showArchived && (
              <button
                onClick={() => setShowArchived(false)}
                className="px-3 py-1 rounded-lg text-sm font-medium text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Active
              </button>
            )}
            {archivedProjects.length > 0 && (
              <button
                onClick={() => setShowArchived(true)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  showArchived
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Archive ({archivedProjects.length})
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.api.openStatsWindow()}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-sm transition-colors"
              title="Work stats"
            >
              Stats
            </button>
            <button
              onClick={() => setCompactMode(true)}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-sm transition-colors"
              title="Compact mode"
            >
              ⤡
            </button>
            <button
              onClick={() => setShowNotes(true)}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-sm transition-colors"
              title="Quick Notes"
            >
              Notes
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-sm transition-colors"
              title="Settings"
            >
              ⚙
            </button>
            {!showArchived && activeProjects.length < 5 && (
              <button
                onClick={addProject}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm transition-colors"
              >
                + Add Project
              </button>
            )}
          </div>
        </div>

        {restoreError && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
            {restoreError}
          </div>
        )}

        {showArchived ? (
          archivedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <p className="text-lg mb-2">No archived projects</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {archivedProjects
                .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
                .map((project) => (
                  <div
                    key={project.id}
                    className="rounded-xl bg-neutral-900 border border-neutral-800 p-4 flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <h3 className="font-medium text-neutral-400 truncate">
                        {project.name || 'Untitled Project'}
                      </h3>
                      {project.description && (
                        <p className="text-sm text-neutral-600 mt-0.5 truncate">{project.description}</p>
                      )}
                      <p className="text-xs text-neutral-600 mt-1">
                        Archived {new Date(project.archivedAt!).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestore(project.id)}
                      className="ml-4 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm transition-colors shrink-0"
                    >
                      Restore
                    </button>
                  </div>
                ))}
            </div>
          )
        ) : activeProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
            <p className="text-lg mb-2">No projects yet</p>
            <p className="text-sm">Add up to 5 projects to focus on</p>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 gap-3"
            onDragEnd={() => { draggedId.current = null; setDragOverId(null) }}
          >
            {activeProjects
              .sort((a, b) => a.order - b.order)
              .map((project) => (
                <ProjectTile
                  key={project.id}
                  project={project}
                  expanded={expandedProjectId === project.id}
                  onToggleExpand={() => toggleExpanded(project.id)}
                  onDragStart={() => { draggedId.current = project.id }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(project.id) }}
                  onDrop={() => {
                    if (!draggedId.current || draggedId.current === project.id) return
                    const sorted = [...activeProjects].sort((a, b) => a.order - b.order)
                    const ids = sorted.map((p) => p.id)
                    const fromIdx = ids.indexOf(draggedId.current)
                    const toIdx = ids.indexOf(project.id)
                    ids.splice(fromIdx, 1)
                    ids.splice(toIdx, 0, draggedId.current)
                    reorderProjects(ids)
                    draggedId.current = null
                    setDragOverId(null)
                  }}
                  isDragOver={dragOverId === project.id && draggedId.current !== project.id}
                />
              ))}
          </div>
        )}
      </div>

      <QuickNotes open={showNotes} onClose={() => setShowNotes(false)} />
      <Settings open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
