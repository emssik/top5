import { useState, useEffect, useCallback, useRef } from 'react'
import { useProjects } from '../hooks/useProjects'
import ProjectTile from './ProjectTile'
import type { TaskListHandle } from './TaskList'
import QuickNotes from './QuickNotes'
import Settings from './Settings'
import QuickTasksView from './QuickTasksView'
import TabBar, { type Tab } from './TabBar'
import DashboardToolbar from './DashboardToolbar'
import CleanViewHeader from './CleanViewHeader'

export default function Dashboard() {
  const { projects, config, saveConfig, reorderProjects, unarchiveProject, unsuspendProject, setCompactMode } = useProjects()
  const cleanView = config.cleanView ?? false
  const [showNotes, setShowNotes] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('tasks')
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const draggedId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const taskListRef = useRef<TaskListHandle | null>(null)
  const [isDev, setIsDev] = useState(false)

  const activeProjects = projects.filter((p) => !p.archivedAt && !p.suspendedAt)
  const suspendedProjects = projects.filter((p) => p.suspendedAt && !p.archivedAt)
  const archivedProjects = projects.filter((p) => p.archivedAt)

  useEffect(() => {
    window.api.getIsDev().then(setIsDev)
  }, [])

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

  const handleUnsuspend = async (id: string) => {
    setRestoreError(null)
    const error = await unsuspendProject(id)
    if (error) {
      setRestoreError(error)
      setTimeout(() => setRestoreError(null), 3000)
    }
  }

  const toggleTheme = () => {
    const newTheme = config.theme === 'light' ? 'dark' : 'light'
    saveConfig({ ...config, theme: newTheme })
  }

  const toggleCleanView = async () => {
    const entering = !cleanView
    saveConfig({ ...config, cleanView: entering })
    if (entering) {
      await window.api.enterCleanView()
    } else {
      await window.api.exitCleanView()
    }
  }

  useEffect(() => {
    if (cleanView) {
      window.api.enterCleanView()
    }
  }, [cleanView])

  useEffect(() => {
    if (activeTab === 'archive' && archivedProjects.length === 0) {
      setActiveTab('tasks')
    }
    if (activeTab === 'suspended' && suspendedProjects.length === 0) {
      setActiveTab('tasks')
    }
  }, [activeTab, archivedProjects.length, suspendedProjects.length])

  const handleShortcutAction = useCallback((data: { action: string; index?: number }) => {
    if (data.action === 'select-project' && data.index !== undefined) {
      setActiveTab('projects')
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

  useEffect(() => {
    if (activeTab !== 'projects' || !expandedProjectId) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        taskListRef.current?.focusAddInput()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, expandedProjectId])

  if (cleanView) {
    return (
      <div
        className="group/window h-screen flex flex-col clean-view-dots"
        style={{ fontFamily: "'Caveat', cursive" }}
        onMouseEnter={() => window.api.setTrafficLightsVisible(true)}
        onMouseLeave={() => window.api.setTrafficLightsVisible(false)}
      >
        <div className="h-7 flex-shrink-0 flex items-center justify-end px-3" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <button
            onClick={toggleCleanView}
            className="opacity-0 group-hover/window:opacity-100 transition-opacity p-1 rounded hover:opacity-60"
            title="Exit clean view"
            style={{ WebkitAppRegion: 'no-drag', fontFamily: 'system-ui' } as React.CSSProperties}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 pb-3">
          <CleanViewHeader />
          <QuickTasksView cleanView />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-base text-t-primary flex flex-col">
      <div className="h-8 flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      <div className="flex items-center justify-between px-6 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between w-full">
          <TabBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isDev={isDev}
            suspendedCount={suspendedProjects.length}
            archivedCount={archivedProjects.length}
          />
          <DashboardToolbar
            config={config}
            onToggleTheme={toggleTheme}
            onToggleCleanView={toggleCleanView}
            onShowNotes={() => setShowNotes(true)}
            onShowSettings={() => setShowSettings(true)}
            onCompactMode={() => setCompactMode(true)}
            showAddProject={activeTab === 'projects' && activeProjects.length < 5}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {restoreError && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
            {restoreError}
          </div>
        )}

        {activeTab === 'tasks' && <QuickTasksView showAll />}

        {activeTab === 'projects' && (
          activeProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-t-secondary">
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
                    taskListRef={expandedProjectId === project.id ? taskListRef : undefined}
                  />
                ))}
            </div>
          )
        )}

        {activeTab === 'suspended' && (
          suspendedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-t-secondary">
              <p className="text-lg mb-2">No suspended projects</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {suspendedProjects
                .sort((a, b) => (b.suspendedAt ?? '').localeCompare(a.suspendedAt ?? ''))
                .map((project) => (
                  <ProjectTile
                    key={project.id}
                    project={project}
                    expanded={expandedProjectId === project.id}
                    onToggleExpand={() => toggleExpanded(project.id)}
                    onDragStart={() => {}}
                    onDragOver={() => {}}
                    onDrop={() => {}}
                    isDragOver={false}
                    isSuspended
                    onUnsuspend={() => handleUnsuspend(project.id)}
                    taskListRef={expandedProjectId === project.id ? taskListRef : undefined}
                  />
                ))}
            </div>
          )
        )}

        {activeTab === 'archive' && (
          archivedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-t-secondary">
              <p className="text-lg mb-2">No archived projects</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {archivedProjects
                .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
                .map((project) => (
                  <div
                    key={project.id}
                    className="rounded-xl bg-card border border-border-subtle p-4 flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <h3 className="font-medium text-t-secondary truncate">
                        {project.name || 'Untitled Project'}
                      </h3>
                      {project.description && (
                        <p className="text-sm text-t-muted mt-0.5 truncate">{project.description}</p>
                      )}
                      <p className="text-xs text-t-muted mt-1">
                        Archived {new Date(project.archivedAt!).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestore(project.id)}
                      className="ml-4 px-3 py-1.5 rounded-lg bg-surface hover:bg-hover text-t-primary text-sm transition-colors shrink-0"
                    >
                      Restore
                    </button>
                  </div>
                ))}
            </div>
          )
        )}
      </div>

      <QuickNotes open={showNotes} onClose={() => setShowNotes(false)} />
      <Settings open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
