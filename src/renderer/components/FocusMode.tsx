import { useProjects } from '../hooks/useProjects'

export default function FocusMode() {
  const { projects, config, setFocus } = useProjects()

  const project = projects.find((p) => p.id === config.focusProjectId)
  const task = project?.tasks.find((t) => t.id === config.focusTaskId)

  const handleExit = () => {
    setFocus(null, null)
  }

  return (
    <div
      className="h-screen flex items-center px-3 gap-2.5 rounded-xl bg-neutral-900/95 border border-neutral-700/50"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0 flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="text-[11px] text-blue-400/70 flex-shrink-0">{project?.name}</span>
        <span className="text-[10px] text-neutral-600 flex-shrink-0">/</span>
        <span className="text-[13px] font-semibold truncate text-neutral-100">{task?.title || 'No task'}</span>
      </div>
      <button
        onClick={handleExit}
        className="w-5 h-5 rounded-md flex items-center justify-center bg-neutral-800/80 hover:bg-red-900/60 text-neutral-500 hover:text-red-300 text-[10px] transition-colors flex-shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        ✕
      </button>
    </div>
  )
}
