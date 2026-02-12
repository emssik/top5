import { useEffect, useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import { getActiveLaunchers, launchByType, launcherMeta } from '../utils/launchers'

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

const STANDALONE_PROJECT_ID = '__standalone__'

export default function FocusMode() {
  const { projects, quickTasks, config, setFocus } = useProjects()
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [confirmExit, setConfirmExit] = useState<number | null>(null) // unsaved minutes

  useEffect(() => {
    return window.api.onCheckInCountdown((ms) => setRemainingMs(ms))
  }, [])

  const isStandalone = config.focusProjectId === STANDALONE_PROJECT_ID
  const project = isStandalone ? null : projects.find((p) => p.id === config.focusProjectId)
  const task = isStandalone
    ? quickTasks.find((t) => t.id === config.focusTaskId)
    : project?.tasks.find((t) => t.id === config.focusTaskId)
  const contextLabel = isStandalone ? 'Quick Task' : project?.name

  const handleExit = async () => {
    const unsavedMs = await window.api.getFocusUnsavedMs()
    const unsavedMin = Math.floor(unsavedMs / 60000)
    if (unsavedMin >= 1) {
      setConfirmExit(unsavedMin)
    } else {
      setFocus(null, null)
    }
  }

  const handleSaveAndExit = () => {
    if (confirmExit && config.focusProjectId && config.focusTaskId) {
      window.api.saveFocusCheckIn({
        id: crypto.randomUUID(),
        projectId: config.focusProjectId,
        taskId: config.focusTaskId,
        timestamp: new Date().toISOString(),
        response: 'yes',
        minutes: confirmExit
      })
    }
    setFocus(null, null)
  }

  const handleDiscardAndExit = () => {
    setFocus(null, null)
  }

  if (confirmExit !== null) {
    return (
      <div
        className="h-screen flex items-center px-3 gap-2.5 rounded-xl bg-card/95 border border-border/50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-[12px] text-t-primary flex-shrink-0">
          Zapisać {confirmExit} min?
        </span>
        <div className="flex gap-1.5 flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={handleSaveAndExit}
            className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-600/80 hover:bg-blue-500/80 text-white transition-colors"
          >
            Tak
          </button>
          <button
            onClick={handleDiscardAndExit}
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
      className="h-screen flex items-center px-3 gap-2.5 rounded-xl bg-card/95 border border-border/50"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0 flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="text-[11px] text-blue-400/70 flex-shrink-0">{contextLabel}</span>
        <span className="text-[10px] text-t-muted flex-shrink-0">/</span>
        <span className="text-[13px] font-semibold truncate text-t-primary">{task?.title || 'No task'}</span>
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
        onClick={handleExit}
        className="w-5 h-5 rounded-md flex items-center justify-center bg-surface/80 hover:bg-red-900/60 text-t-secondary hover:text-red-300 text-[10px] transition-colors flex-shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        ✕
      </button>
    </div>
  )
}
