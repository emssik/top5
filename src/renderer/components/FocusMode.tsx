import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useProjects } from '../hooks/useProjects'
import { useTaskList } from '../hooks/useTaskList'
import { normalizeProjectLinks, normalizeLinks, openProjectLink, projectColorValue } from '../utils/projects'
import { checkInMinutes } from '../utils/checkInTime'
import { STANDALONE_PROJECT_ID } from '../utils/constants'
import type { Task, ProjectLink, QuickTask } from '../types'
import { formatTaskId, formatQuickTaskId } from '../../shared/taskId'
import { Linkify } from './Linkify'

function formatSessionTime(totalSeconds: number): string {
  const min = Math.floor(totalSeconds / 60)
  const sec = totalSeconds % 60
  if (min < 60) return `${min}:${sec.toString().padStart(2, '0')}`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function linkIcon(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('code')) return '</>'
  if (l.includes('term')) return '>_'
  if (l.includes('obsidian')) return '📓'
  if (l.includes('browser') || l.startsWith('http')) return '🌐'
  return '🔗'
}

function projectLabel(project: { code?: string; name: string } | null, isStandalone: boolean): string {
  if (isStandalone) return 'QT'
  if (!project) return ''
  return project.code || project.name.slice(0, 4)
}

interface PickerTask {
  projectId: string
  taskId: string
  title: string
  projectName?: string
  projectCode?: string
  taskNumber?: number
}

const FOCUS_WIDTH = 520
const FOCUS_HEIGHT_NORMAL = 58
const FOCUS_HEIGHT_PICKER = 320

export default function FocusMode() {
  const { projects, quickTasks, focusCheckIns, config, setFocus, repeatingTasks } = useProjects()
  const { activeTasks, repeatingActive } = useTaskList()
  const [confirmAction, setConfirmAction] = useState<{ minutes: number; type: 'exit' | 'complete' } | null>(null)
  const [isDev, setIsDev] = useState(false)
  const [showTaskPicker, setShowTaskPicker] = useState(false)
  const [completedTaskKey, setCompletedTaskKey] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [showManualTime, setShowManualTime] = useState(false)
  const [manualMinutes, setManualMinutes] = useState('')
  const sessionStartRef = useRef(Date.now())
  const manualInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.getIsDev().then(setIsDev)
  }, [])

  // Elapsed session time — tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Resize focus window based on open popups
  useEffect(() => {
    if (showTaskPicker) {
      window.api.resizeFocusWindow(FOCUS_WIDTH, FOCUS_HEIGHT_PICKER)
    } else {
      window.api.resizeFocusWindow(FOCUS_WIDTH, FOCUS_HEIGHT_NORMAL)
    }
  }, [showTaskPicker])


  const isStandalone = config.focusProjectId === STANDALONE_PROJECT_ID
  const project = isStandalone ? null : projects.find((p) => p.id === config.focusProjectId)
  const task = isStandalone
    ? quickTasks.find((t) => t.id === config.focusTaskId)
    : project?.tasks.find((t) => t.id === config.focusTaskId)

  const repeatingTaskLink = useMemo(() => {
    const quickTask = isStandalone ? (task as QuickTask | undefined) : null
    if (!quickTask?.repeatingTaskId) return null
    const parent = repeatingTasks.find((rt) => rt.id === quickTask.repeatingTaskId)
    return parent?.link?.trim() || null
  }, [isStandalone, task, repeatingTasks])

  const openRepeatingTaskLink = () => {
    if (!repeatingTaskLink) return
    window.api.openExternal(repeatingTaskLink)
  }
  // Project label for the bar (code or short name)
  const projLabel = projectLabel(project ?? null, isStandalone)
  const projColor = project ? projectColorValue(project.color) : undefined

  // Context menu data
  const taskLinks: ProjectLink[] = useMemo(() => {
    if (isStandalone || !task) return []
    return normalizeLinks((task as Task).links)
  }, [isStandalone, task])
  const projectLinks: ProjectLink[] = project ? normalizeProjectLinks(project) : []
  const obsidianEnabled = !!config.obsidianStoragePath
  const taskBadge = isStandalone
    ? formatQuickTaskId(task?.taskNumber)
    : formatTaskId(task?.taskNumber, project?.code)

  const openNote = () => {
    if (!task || !obsidianEnabled) return
    window.api.openTaskNote(task.id, task.title, project?.name, taskBadge, task.noteRef)
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const items: { id: string; label: string; type?: 'separator' }[] = []
    for (const link of taskLinks) {
      items.push({ id: `tasklink:${link.label}`, label: `🔗  ${link.label}` })
    }
    if (taskLinks.length > 0 && projectLinks.length > 0) {
      items.push({ id: 'sep-task-proj', label: '', type: 'separator' })
    }
    for (const link of projectLinks) {
      items.push({ id: `link:${link.label}`, label: `${linkIcon(link.label)}  ${link.label}` })
    }
    if (obsidianEnabled) {
      items.push({ id: 'obsidian-note', label: '📝  Obsidian note' })
    }
    if ((projectLinks.length > 0 || obsidianEnabled) && project) {
      items.push({ id: 'sep1', label: '', type: 'separator' })
    }
    if (project) {
      items.push({ id: 'open-project', label: '📂  Open project' })
    }
    if (projectLinks.length > 0 || obsidianEnabled || project) {
      items.push({ id: 'sep2', label: '', type: 'separator' })
    }
    items.push({ id: 'manual-time', label: '+   Dodaj czas' })
    items.push({ id: 'sep3', label: '', type: 'separator' })
    items.push({ id: 'complete', label: '✓   Complete task' })
    items.push({ id: 'exit', label: '✕   Exit focus' })
    window.api.showFocusContextMenu(items, e.clientX, e.clientY)
  }, [taskLinks, projectLinks, obsidianEnabled, project])

  // Handle context menu actions from popup window
  useEffect(() => {
    return window.api.onFocusMenuAction((actionId: string) => {
      if (actionId.startsWith('tasklink:')) {
        const label = actionId.slice(9)
        const link = taskLinks.find((l) => l.label === label)
        if (link) openProjectLink(link, project?.name)
      } else if (actionId.startsWith('link:')) {
        const label = actionId.slice(5)
        const link = projectLinks.find((l) => l.label === label)
        if (link) openProjectLink(link, project?.name)
      } else if (actionId === 'obsidian-note') {
        openNote()
      } else if (actionId === 'open-project') {
        if (project) window.api.showProjectInMain(project.id)
      } else if (actionId === 'manual-time') {
        openManualTime()
      } else if (actionId === 'complete') {
        handleComplete()
      } else if (actionId === 'exit') {
        handleExit()
      }
    })
  })

  // Confirmed time = check-ins recorded during this focus session.
  const confirmedSeconds = useMemo(() => {
    const sessionStart = sessionStartRef.current
    const confirmedMinutes = focusCheckIns
      .filter((c) => new Date(c.timestamp).getTime() >= sessionStart)
      .reduce((sum, c) => sum + checkInMinutes(c), 0)
    return confirmedMinutes * 60
  }, [focusCheckIns])

  // Main timer shows wall time from focus window start.
  const totalSeconds = elapsedSeconds

  // Build picker from visible tasks, excluding just-completed task
  const pickerTasks: PickerTask[] = []
  if (showTaskPicker) {
    for (const mt of [...activeTasks, ...repeatingActive]) {
      const projectId = mt.kind === 'pinned' ? mt.projectId! : STANDALONE_PROJECT_ID
      const taskId = mt.kind === 'pinned' ? mt.taskId! : mt.id
      const key = `${projectId}:${taskId}`
      if (key === completedTaskKey) continue
      pickerTasks.push({ projectId, taskId, title: mt.title, projectName: mt.projectName, projectCode: mt.projectCode, taskNumber: mt.taskNumber })
    }
  }

  const completeCurrentTask = async () => {
    if (!config.focusProjectId || !config.focusTaskId) return

    if (isStandalone) {
      await window.api.completeQuickTask(config.focusTaskId)
    } else {
      const { projects: freshProjects } = await window.api.getAppData()
      const freshProject = freshProjects.find((p: { id: string }) => p.id === config.focusProjectId)
      if (freshProject) {
        const updatedTasks = freshProject.tasks.map((t: Task) =>
          t.id === config.focusTaskId
            ? { ...t, completed: true, completedAt: new Date().toISOString(), inProgress: false }
            : t
        )
        await window.api.saveProject({ ...freshProject, tasks: updatedTasks })
      }
    }

    setCompletedTaskKey(`${config.focusProjectId}:${config.focusTaskId}`)
  }

  const saveTimeIfNeeded = async (minutes: number) => {
    if (minutes >= 1 && config.focusProjectId && config.focusTaskId) {
      await window.api.saveFocusCheckIn({
        id: crypto.randomUUID(),
        projectId: config.focusProjectId,
        taskId: config.focusTaskId,
        timestamp: new Date().toISOString(),
        response: 'yes',
        minutes
      })
    }
  }

  const handleExit = async () => {
    const unsavedMs = await window.api.getFocusUnsavedMs()
    const unsavedMin = Math.floor(unsavedMs / 60000)
    if (unsavedMin >= 1) {
      setConfirmAction({ minutes: unsavedMin, type: 'exit' })
    } else {
      setFocus(null, null)
    }
  }

  const handleComplete = async () => {
    const unsavedMs = await window.api.getFocusUnsavedMs()
    const unsavedMin = Math.floor(unsavedMs / 60000)
    if (unsavedMin >= 1) {
      setConfirmAction({ minutes: unsavedMin, type: 'complete' })
    } else {
      await completeCurrentTask()
      setShowTaskPicker(true)
    }
  }

  const handleConfirmSave = async () => {
    if (!confirmAction) return
    await saveTimeIfNeeded(confirmAction.minutes)

    if (confirmAction.type === 'exit') {
      setFocus(null, null)
    } else {
      await completeCurrentTask()
      setConfirmAction(null)
      setShowTaskPicker(true)
    }
  }

  const handleConfirmDiscard = async () => {
    if (!confirmAction) return

    if (confirmAction.type === 'exit') {
      setFocus(null, null)
    } else {
      await completeCurrentTask()
      setConfirmAction(null)
      setShowTaskPicker(true)
    }
  }

  const handlePickTask = async (pickerTask: PickerTask) => {
    setShowTaskPicker(false)
    await window.api.switchFocusTask(pickerTask.projectId, pickerTask.taskId)
    setCompletedTaskKey(null)
    sessionStartRef.current = Date.now()
    setElapsedSeconds(0)
  }

  const handleExitFromPicker = () => {
    setShowTaskPicker(false)
    setFocus(null, null)
  }

  const openManualTime = () => {
    setManualMinutes('')
    setShowManualTime(true)
    setTimeout(() => manualInputRef.current?.focus(), 50)
  }

  const handleManualTimeSave = async () => {
    const mins = parseInt(manualMinutes, 10)
    if (mins >= 1) {
      await saveTimeIfNeeded(mins)
    }
    setShowManualTime(false)
  }

  // Manual time entry
  if (showManualTime) {
    return (
      <div
        className="h-[44px] flex items-center px-4 gap-3 rounded-xl bg-clean-view/95 border border-border/50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-[13px] text-t-primary flex-shrink-0">
          Dodaj czas (min):
        </span>
        <div className="flex gap-2 items-center flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <input
            ref={manualInputRef}
            type="number"
            min="1"
            max="480"
            value={manualMinutes}
            onChange={(e) => setManualMinutes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleManualTimeSave()
              if (e.key === 'Escape') setShowManualTime(false)
            }}
            className="w-[60px] px-2 py-1 rounded-md text-[12px] text-t-primary bg-surface/80 border border-border/50 outline-none focus:border-blue-500/50 tabular-nums text-center"
            placeholder="15"
          />
          <button
            onClick={handleManualTimeSave}
            className="px-3 py-1 rounded-md text-[12px] font-medium bg-blue-600/80 hover:bg-blue-500/80 text-white transition-colors"
          >
            Zapisz
          </button>
          <button
            onClick={() => setShowManualTime(false)}
            className="px-3 py-1 rounded-md text-[12px] font-medium bg-surface/80 hover:bg-hover text-t-secondary transition-colors"
          >
            Esc
          </button>
        </div>
      </div>
    )
  }

  // Confirm save dialog
  if (confirmAction !== null) {
    return (
      <div
        className="h-[44px] flex items-center px-4 gap-3 rounded-xl bg-clean-view/95 border border-border/50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-[13px] text-t-primary flex-shrink-0">
          Zapisać {confirmAction.minutes} min?
        </span>
        <div className="flex gap-2 flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={handleConfirmSave}
            className="px-3 py-1 rounded-md text-[12px] font-medium bg-blue-600/80 hover:bg-blue-500/80 text-white transition-colors"
          >
            Tak
          </button>
          <button
            onClick={handleConfirmDiscard}
            className="px-3 py-1 rounded-md text-[12px] font-medium bg-surface/80 hover:bg-hover text-t-secondary transition-colors"
          >
            Nie
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-screen h-screen">
      {/* Main bar */}
      <div
        className="h-[44px] flex items-center pl-4 pr-1.5 gap-2 rounded-xl bg-clean-view/95 border border-border/50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        onContextMenu={handleContextMenu}
      >
        <div
          className="w-[7px] h-[7px] rounded-full animate-pulse flex-shrink-0"
          style={{ background: projColor || '#3b82f6' }}
        />
        {isDev && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 flex-shrink-0">
            DEV
          </span>
        )}
        {projLabel && (
          <button
            className="text-[12px] text-t-muted flex-shrink-0 opacity-50 hover:opacity-100 hover:text-t-primary transition-opacity cursor-pointer bg-transparent border-none p-0"
            style={{ fontFamily: 'monospace', WebkitAppRegion: 'no-drag', transform: 'translateY(1px)' } as React.CSSProperties}
            onClick={async () => {
              if (!project) return
              await window.api.showProjectInMain(project.id)
            }}
            title={project ? `Open ${project.name}` : undefined}
          >
            {projLabel}
          </button>
        )}
        <span
          className="text-[14px] font-semibold truncate text-t-primary flex-1 min-w-0 cursor-default"
          onDoubleClick={() => { if (task?.title) navigator.clipboard.writeText(task.title) }}
        >
          {task?.title ? <Linkify text={task.title.replace(/^\(✂\d+\)\s*/, '')} /> : 'No task'}
        </span>
        {repeatingTaskLink && (
          <button
            onClick={openRepeatingTaskLink}
            className="w-[24px] h-[24px] rounded-[6px] bg-transparent text-t-muted text-[11px] hover:bg-hover hover:text-t-secondary transition-all flex items-center justify-center cursor-pointer border-none flex-shrink-0"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title="Open link"
          >
            🔗
          </button>
        )}
        <button
          onClick={openManualTime}
          className="flex items-center gap-1 flex-shrink-0 whitespace-nowrap bg-blue-500/12 hover:bg-blue-500/20 rounded-[10px] px-2.5 py-[3px] border-none cursor-pointer transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="Dodaj czas"
        >
          <span className="text-[12px] font-semibold text-blue-400 tabular-nums">
            {formatSessionTime(totalSeconds)}
          </span>
          <span className="text-[11px] text-t-muted tabular-nums font-normal opacity-70">
            ({formatSessionTime(confirmedSeconds)})
          </span>
        </button>
        {/* Action buttons — always visible */}
        <div className="flex gap-0.5 flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={handleComplete}
            className="w-[28px] h-[28px] rounded-[7px] bg-transparent text-t-muted text-[12px] hover:bg-green-500/15 hover:text-green-400 transition-all flex items-center justify-center cursor-pointer border-none"
            title="Complete task"
          >
            ✓
          </button>
          <button
            onClick={handleExit}
            className="w-[28px] h-[28px] rounded-[7px] bg-transparent text-t-muted text-[12px] hover:bg-red-500/15 hover:text-red-400 transition-all flex items-center justify-center cursor-pointer border-none"
            title="Exit focus"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Task picker popup */}
      {showTaskPicker && (
        <div className="absolute top-[48px] left-0 right-0 mx-2 rounded-lg bg-clean-view/95 border border-border/50 shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30">
            <span className="text-[11px] text-t-muted">Następne zadanie:</span>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {pickerTasks.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-t-muted text-center">
                Brak dostępnych zadań
              </div>
            ) : (
              pickerTasks.map((pt) => (
                <button
                  key={`${pt.projectId}:${pt.taskId}`}
                  onClick={() => handlePickTask(pt)}
                  className="w-full text-left px-3 py-2 hover:bg-hover transition-colors flex items-center gap-2"
                >
                  {pt.taskNumber != null && (
                    <span className="text-[10px] text-t-muted flex-shrink-0" style={{ fontFamily: 'monospace', opacity: 0.5 }}>
                      {pt.projectCode ? formatTaskId(pt.taskNumber, pt.projectCode) : formatQuickTaskId(pt.taskNumber)}
                    </span>
                  )}
                  <span className="text-[12px] text-t-primary truncate">{pt.title}</span>
                </button>
              ))
            )}
          </div>
          <div className="px-3 py-2 border-t border-border/30">
            <button
              onClick={handleExitFromPicker}
              className="text-[11px] text-t-muted hover:text-t-secondary transition-colors"
            >
              Zakończ focus
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
