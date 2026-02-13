import { useEffect, useState, useRef, useCallback } from 'react'
import { useProjects } from '../hooks/useProjects'
import { getActiveLaunchers, launchByType, launcherMeta } from '../utils/launchers'
import { STANDALONE_PROJECT_ID } from '../utils/constants'

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

interface PickerTask {
  projectId: string
  taskId: string
  title: string
  projectName?: string
}

const FOCUS_WIDTH = 420
const FOCUS_HEIGHT_NORMAL = 110
const FOCUS_HEIGHT_PICKER = 350

export default function FocusMode() {
  const { projects, quickTasks, config, setFocus } = useProjects()
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ minutes: number; type: 'exit' | 'complete' } | null>(null)
  const [isDev, setIsDev] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [showTaskPicker, setShowTaskPicker] = useState(false)
  const [completedTaskKey, setCompletedTaskKey] = useState<string | null>(null) // "projectId:taskId" to exclude
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    hoverTimeout.current = setTimeout(() => setShowTooltip(true), 500)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    hoverTimeout.current = null
    setShowTooltip(false)
  }, [])

  useEffect(() => {
    window.api.getIsDev().then(setIsDev)
  }, [])

  useEffect(() => {
    return window.api.onCheckInCountdown((ms) => setRemainingMs(ms))
  }, [])

  // Resize focus window when picker opens/closes
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
  const contextLabel = isStandalone ? 'Quick Task' : project?.name

  // Build list of available tasks for picker (excluding completed task)
  const pickerTasks: PickerTask[] = []
  if (showTaskPicker) {
    // Quick tasks (standalone)
    for (const qt of quickTasks) {
      if (qt.completed) continue
      const key = `${STANDALONE_PROJECT_ID}:${qt.id}`
      if (key === completedTaskKey) continue
      pickerTasks.push({ projectId: STANDALONE_PROJECT_ID, taskId: qt.id, title: qt.title })
    }
    // Pinned tasks from projects
    for (const p of projects) {
      if (p.archivedAt) continue
      for (const t of p.tasks) {
        if (!t.isToDoNext || t.completed) continue
        const key = `${p.id}:${t.id}`
        if (key === completedTaskKey) continue
        pickerTasks.push({ projectId: p.id, taskId: t.id, title: t.title, projectName: p.name })
      }
    }
  }

  const completeCurrentTask = async () => {
    if (!config.focusProjectId || !config.focusTaskId) return

    if (isStandalone) {
      await window.api.completeQuickTask(config.focusTaskId)
    } else {
      // Complete pinned/project task — load fresh project
      const { projects: freshProjects } = await window.api.getAppData()
      const freshProject = freshProjects.find((p: { id: string }) => p.id === config.focusProjectId)
      if (freshProject) {
        const updatedTasks = freshProject.tasks.map((t: { id: string }) =>
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
    setShowTooltip(false)
    await window.api.switchFocusTask(pickerTask.projectId, pickerTask.taskId)
    setCompletedTaskKey(null)
  }

  const handleExitFromPicker = () => {
    setShowTaskPicker(false)
    setFocus(null, null)
  }

  if (confirmAction !== null) {
    return (
      <div
        className="h-[38px] flex items-center px-3 gap-2.5 rounded-xl bg-card/95 border border-border/50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-[12px] text-t-primary flex-shrink-0">
          Zapisać {confirmAction.minutes} min?
        </span>
        <div className="flex gap-1.5 flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={handleConfirmSave}
            className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-600/80 hover:bg-blue-500/80 text-white transition-colors"
          >
            Tak
          </button>
          <button
            onClick={handleConfirmDiscard}
            className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface/80 hover:bg-hover text-t-secondary transition-colors"
          >
            Nie
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="h-[38px] flex items-center px-3 gap-2.5 rounded-xl bg-card/95 border border-border/50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
        {isDev && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 flex-shrink-0">
            DEV
          </span>
        )}
        <div className="flex-1 min-w-0 flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <span className="text-[11px] text-blue-400/70 flex-shrink-0">{contextLabel}</span>
          <span className="text-[10px] text-t-muted flex-shrink-0">/</span>
          <span
            className="text-[13px] font-semibold truncate text-t-primary cursor-default"
            onDoubleClick={() => {
              if (task?.title) {
                navigator.clipboard.writeText(task.title)
              }
            }}
            title="Double-click to copy"
          >
            {task?.title || 'No task'}
          </span>
          {project?.launchers && getActiveLaunchers(project.launchers).length > 0 && (
            <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
              {getActiveLaunchers(project.launchers).map(([type, value]) => (
                <button
                  key={type}
                  title={launcherMeta[type].label}
                  onClick={() => launchByType(type, value)}
                  className="w-5 h-5 rounded flex items-center justify-center text-[10px] text-t-muted hover:text-t-primary hover:bg-surface/80 transition-colors"
                >
                  {launcherMeta[type].icon}
                </button>
              ))}
            </div>
          )}
        </div>
        {remainingMs !== null && (
          <span className={`text-[11px] tabular-nums flex-shrink-0 ${remainingMs === 0 ? 'text-amber-400' : 'text-t-muted'}`}>
            {remainingMs === 0 ? 'check-in' : formatCountdown(remainingMs)}
          </span>
        )}
        <button
          onClick={handleComplete}
          className="w-5 h-5 rounded-md flex items-center justify-center bg-surface/80 hover:bg-green-900/60 text-t-secondary hover:text-green-300 text-[10px] transition-colors flex-shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="Complete task"
        >
          ✓
        </button>
        <button
          onClick={handleExit}
          className="w-5 h-5 rounded-md flex items-center justify-center bg-surface/80 hover:bg-red-900/60 text-t-secondary hover:text-red-300 text-[10px] transition-colors flex-shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          ✕
        </button>
      </div>

      {/* Hover tooltip — full task title */}
      {showTooltip && task?.title && !showTaskPicker && (
        <div className="absolute top-[42px] left-3 right-3 px-3 py-2 rounded-lg bg-card/95 border border-border/50 shadow-lg">
          <p className="text-[12px] text-t-primary leading-snug whitespace-normal break-words">
            {task.title}
          </p>
        </div>
      )}

      {/* Task picker popup */}
      {showTaskPicker && (
        <div className="absolute top-[42px] left-0 right-0 mx-2 rounded-lg bg-card/95 border border-border/50 shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30">
            <span className="text-[11px] text-t-muted">Następne zadanie:</span>
          </div>
          <div className="max-h-[220px] overflow-y-auto">
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
                  {pt.projectName && (
                    <span className="text-[10px] text-blue-400/70 flex-shrink-0">{pt.projectName}</span>
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
