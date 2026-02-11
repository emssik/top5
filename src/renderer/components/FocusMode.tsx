import { useEffect, useState } from 'react'
import { useProjects } from '../hooks/useProjects'

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export default function FocusMode() {
  const { projects, config, setFocus } = useProjects()
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    return window.api.onCheckInCountdown((ms) => setRemainingMs(ms))
  }, [])

  const project = projects.find((p) => p.id === config.focusProjectId)
  const task = project?.tasks.find((t) => t.id === config.focusTaskId)

  const handleExit = () => {
    setFocus(null, null)
  }

  const handlePause = () => {
    window.api.pauseFocusMode()
  }

  return (
    <div
      className="h-screen flex items-center px-3 gap-2.5 rounded-xl bg-card/95 border border-border/50"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0 flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="text-[11px] text-blue-400/70 flex-shrink-0">{project?.name}</span>
        <span className="text-[10px] text-t-muted flex-shrink-0">/</span>
        <span className="text-[13px] font-semibold truncate text-t-primary">{task?.title || 'No task'}</span>
      </div>
      {remainingMs !== null && (
        <span className={`text-[11px] tabular-nums flex-shrink-0 ${remainingMs === 0 ? 'text-amber-400' : 'text-t-muted'}`}>
          {remainingMs === 0 ? 'check-in' : formatCountdown(remainingMs)}
        </span>
      )}
      <button
        onClick={handlePause}
        className="w-5 h-5 rounded-md flex items-center justify-center bg-surface/80 hover:bg-amber-900/60 text-t-secondary hover:text-amber-300 text-[10px] transition-colors flex-shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title="Pause focus"
      >
        ⏸
      </button>
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
