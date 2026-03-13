import { useEffect, useState } from 'react'

interface NudgeTask {
  projectId: string
  taskId: string
  title: string
  projectName?: string
  projectCode?: string
}

const SNOOZE_OPTIONS = [
  { label: '5m', minutes: 5 },
  { label: '10m', minutes: 10 },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 }
]

export default function NudgePopup() {
  const [tasks, setTasks] = useState<NudgeTask[]>([])

  useEffect(() => {
    window.api.nudgeGetTasks().then(setTasks)
  }, [])

  return (
    <div className="h-screen flex flex-col items-center justify-center p-5 rounded-xl bg-card/95 border border-border/50 select-none">
      <p className="text-[15px] text-t-primary font-semibold text-center mb-0.5">
        Masz zadania do zrobienia.
      </p>
      <p className="text-[12px] text-t-secondary text-center mb-3">
        Nie opierdalaj się — wybierz zadanie i do roboty!
      </p>

      {tasks.length > 0 && (
        <div className="w-full max-w-[340px] mb-3 max-h-[160px] overflow-y-auto">
          {tasks.map((task) => (
            <button
              key={`${task.projectId}-${task.taskId}`}
              onClick={() => window.api.nudgeStartFocus(task.projectId, task.taskId)}
              className="w-full text-left px-3 py-1.5 rounded-lg text-[12px] hover:bg-hover/80 transition-colors flex items-center gap-2 group"
            >
              {task.projectCode && (
                <span className="text-[10px] font-mono text-t-secondary opacity-60 shrink-0">
                  {task.projectCode}
                </span>
              )}
              <span className="text-t-primary truncate">{task.title}</span>
              <span className="ml-auto text-[10px] text-emerald-500 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity">
                Focus ▸
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => window.api.nudgeOpenQuickAdd()}
        className="w-full max-w-[340px] text-center px-3 py-1.5 rounded-lg text-[12px] text-t-secondary hover:bg-hover/80 transition-colors mb-3 border border-dashed border-border/50"
      >
        + Nowe zadanie
      </button>

      <div className="flex gap-1.5">
        {SNOOZE_OPTIONS.map((opt) => (
          <button
            key={opt.minutes}
            onClick={() => window.api.nudgeSnooze(opt.minutes)}
            className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-surface/80 hover:bg-hover/80 text-t-heading transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
