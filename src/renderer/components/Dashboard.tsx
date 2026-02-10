import { useState, useEffect, useCallback, useRef } from 'react'
import { useProjects } from '../hooks/useProjects'
import ProjectTile from './ProjectTile'
import QuickNotes from './QuickNotes'
import Settings from './Settings'

export default function Dashboard() {
  const { projects, addProject, reorderProjects } = useProjects()
  const [showNotes, setShowNotes] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
  const draggedId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const toggleExpanded = useCallback((projectId: string) => {
    setExpandedProjectId((prev) => (prev === projectId ? null : projectId))
  }, [])

  const handleShortcutAction = useCallback((data: { action: string; index?: number }) => {
    if (data.action === 'select-project' && data.index !== undefined) {
      const sorted = [...projects].sort((a, b) => a.order - b.order)
      if (data.index < sorted.length) {
        const targetId = sorted[data.index].id
        setExpandedProjectId((prev) => (prev === targetId ? null : targetId))
      }
    } else if (data.action === 'toggle-quick-notes') {
      setShowNotes((prev) => !prev)
    }
  }, [projects])

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
          <h1 className="text-xl font-semibold tracking-tight text-neutral-200">Projects</h1>
          <div className="flex items-center gap-2">
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
            {projects.length < 5 && (
              <button
                onClick={addProject}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm transition-colors"
              >
                + Add Project
              </button>
            )}
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
            <p className="text-lg mb-2">No projects yet</p>
            <p className="text-sm">Add up to 5 projects to focus on</p>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 gap-3"
            onDragEnd={() => { draggedId.current = null; setDragOverId(null) }}
          >
            {projects
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
                    const sorted = [...projects].sort((a, b) => a.order - b.order)
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
