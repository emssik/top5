import { useCallback, useEffect, useMemo, useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import Sidebar from './Sidebar'
import QuickNotesPanel from './QuickNotesPanel'
import Settings from './Settings'
import CleanViewHeader from './CleanViewHeader'
import QuickTasksView from './QuickTasksView'
import ProjectEditor from './ProjectEditor'
import ProjectCodeMigration from './ProjectCodeMigration'
import TodayView from './TodayView'
import ProjectDetailView from './ProjectDetailView'
import RepeatView from './RepeatView'
import InlineStatsView from './InlineStatsView'

export default function Dashboard() {
  const { projects, config, saveConfig, saveProject, archiveProject, unarchiveProject, unsuspendProject, suspendProject, reorderProjects, moveTaskToProject } = useProjects()
  const cleanView = config.cleanView ?? false
  const activeProjectsLimit = config.activeProjectsLimit ?? 5

  const [activeView, setActiveView] = useState('today')
  const [showNotes, setShowNotes] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [suspendedOpen, setSuspendedOpen] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [editorProjectId, setEditorProjectId] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const activeProjects = useMemo(
    () => projects.filter((project) => !project.archivedAt && !project.suspendedAt).sort((a, b) => a.order - b.order),
    [projects]
  )
  const suspendedProjects = useMemo(
    () => projects.filter((project) => project.suspendedAt && !project.archivedAt).sort((a, b) => (b.suspendedAt ?? '').localeCompare(a.suspendedAt ?? '')),
    [projects]
  )
  const archivedProjects = useMemo(
    () => projects.filter((project) => project.archivedAt).sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
    [projects]
  )

  const editingProject = useMemo(
    () => (editorProjectId ? projects.find((project) => project.id === editorProjectId) : undefined),
    [editorProjectId, projects]
  )

  const selectedProject = useMemo(() => {
    if (!activeView.startsWith('project-')) return null
    const projectId = activeView.slice('project-'.length)
    return projects.find((project) => project.id === projectId) ?? null
  }, [activeView, projects])

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
    if (!activeView.startsWith('project-')) return
    const projectId = activeView.slice('project-'.length)
    const exists = projects.some((project) => project.id === projectId && !project.archivedAt)
    if (!exists) {
      setActiveView('today')
    }
  }, [activeView, projects])

  const handleRestoreArchived = async (id: string) => {
    setRestoreError(null)
    const error = await unarchiveProject(id)
    if (error) {
      setRestoreError(error)
      setTimeout(() => setRestoreError(null), 3000)
      return
    }
    setActiveView(`project-${id}`)
  }

  const handleUnsuspendDrop = async (projectId: string, targetIndex?: number) => {
    setRestoreError(null)
    const error = await unsuspendProject(projectId)
    if (error) {
      setRestoreError(error)
      setTimeout(() => setRestoreError(null), 3000)
      return
    }

    const nextIds = [...activeProjects.map((project) => project.id), projectId]
    const fromIndex = nextIds.lastIndexOf(projectId)
    const toIndex = typeof targetIndex === 'number'
      ? Math.max(0, Math.min(targetIndex, nextIds.length - 1))
      : nextIds.length - 1

    if (fromIndex !== toIndex) {
      nextIds.splice(fromIndex, 1)
      nextIds.splice(toIndex, 0, projectId)
    }
    await reorderProjects(nextIds)
    setActiveView(`project-${projectId}`)
  }

  const handleSuspendDrop = async (projectId: string) => {
    await suspendProject(projectId)
    if (activeView === `project-${projectId}`) {
      setActiveView('today')
    }
  }

  const handleArchiveDrop = async (projectId: string) => {
    await archiveProject(projectId)
    if (activeView === `project-${projectId}`) {
      setActiveView('today')
    }
  }

  const handleRestoreArchivedToSuspended = async (projectId: string) => {
    setRestoreError(null)
    const error = await unarchiveProject(projectId)
    if (error) {
      setRestoreError(error)
      setTimeout(() => setRestoreError(null), 3000)
      return
    }
    await suspendProject(projectId)
  }

  const handleShortcutAction = useCallback((data: { action: string; index?: number }) => {
    if (data.action === 'select-project' && data.index !== undefined) {
      if (data.index >= 0 && data.index < activeProjects.length) {
        setActiveView(`project-${activeProjects[data.index].id}`)
      }
      return
    }

    if (data.action === 'toggle-quick-notes') {
      setShowNotes((value) => !value)
    }
  }, [activeProjects])

  useEffect(() => {
    const cleanup = window.api.onShortcutAction(handleShortcutAction)
    return cleanup
  }, [handleShortcutAction])

  const needsCodeMigration = projects.length > 0 && projects.some((p) => !p.code)

  const handleCodeMigration = async (codes: Record<string, string>) => {
    for (const p of projects) {
      const code = codes[p.id]
      if (code && code !== p.code) {
        await saveProject({ ...p, code })
      }
    }
  }

  if (needsCodeMigration) {
    return <ProjectCodeMigration projects={projects} onSave={handleCodeMigration} />
  }

  if (cleanView) {
    return (
      <div
        className="group/window h-screen flex flex-col clean-view-dots"
        style={{ fontFamily: `'${config.cleanViewFont || 'Caveat'}', cursive` }}
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
    <div className="h-screen app-shell">
      <Sidebar
        activeView={activeView}
        activeProjects={activeProjects}
        suspendedProjects={suspendedProjects}
        archivedProjects={archivedProjects}
        suspendedOpen={suspendedOpen}
        archivedOpen={archivedOpen}
        theme={config.theme}
        onSelectView={setActiveView}
        onToggleCleanView={toggleCleanView}
        onToggleNotes={() => setShowNotes((value) => !value)}
        onToggleSettings={() => setShowSettings(true)}
        onToggleTheme={toggleTheme}
        onAddProject={() => {
          setEditorProjectId(null)
          setShowEditor(true)
        }}
        onToggleSuspended={() => setSuspendedOpen((value) => !value)}
        onToggleArchived={() => setArchivedOpen((value) => !value)}
        onRestoreArchived={handleRestoreArchived}
        onRestoreArchivedToSuspended={handleRestoreArchivedToSuspended}
        onReorderActiveProjects={reorderProjects}
        onUnsuspendProject={handleUnsuspendDrop}
        onSuspendProject={handleSuspendDrop}
        onArchiveProject={handleArchiveDrop}
        onMoveTaskToProject={moveTaskToProject}
        activeProjectsLimit={activeProjectsLimit}
      />

      <div className="main-panel-wrap">
        <div className="dashboard-titlebar" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

        <div className="main">
          {restoreError && (
            <div className="restore-error">
              {restoreError}
            </div>
          )}

          {activeView === 'today' && <TodayView />}
          {activeView === 'repeat' && <RepeatView />}
          {activeView === 'stats' && <InlineStatsView />}

          {selectedProject && (
            <ProjectDetailView
              project={selectedProject}
              onEdit={() => {
                setEditorProjectId(selectedProject.id)
                setShowEditor(true)
              }}
              onDelete={() => setActiveView('today')}
            />
          )}
        </div>
      </div>

      <QuickNotesPanel open={showNotes} onClose={() => setShowNotes(false)} />
      <Settings open={showSettings} onClose={() => setShowSettings(false)} />

      <div className={`modal-overlay ${showEditor ? 'open' : ''}`} onClick={() => setShowEditor(false)}>
        {showEditor && (
          <div onClick={(event) => event.stopPropagation()}>
            <ProjectEditor
              project={editingProject}
              onClose={() => {
                setShowEditor(false)
                setEditorProjectId(null)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
