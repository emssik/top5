import { useEffect, useState } from 'react'
import { projectColorValue } from '../utils/projects'
import type { NudgeTask } from '../types'

const SNOOZE_OPTIONS = [
  { label: '5m', minutes: 5 },
  { label: '10m', minutes: 10 },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 }
]

const VISIBLE_LIMIT = 3

export default function NudgePopup() {
  const [tasks, setTasks] = useState<NudgeTask[]>([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    window.api.nudgeGetTasks().then(setTasks)
  }, [])

  const visible = showAll ? tasks : tasks.slice(0, VISIBLE_LIMIT)
  const hiddenCount = Math.max(0, tasks.length - VISIBLE_LIMIT)

  return (
    <div className="pop">
      <div className="head">
        <h1>Masz zadania do zrobienia.</h1>
        <p>— wybierz coś i zaczynaj</p>
      </div>

      <div className="nudge-body">
        {visible.map((task) => (
          <button
            key={`${task.projectId}-${task.taskId}`}
            className="task"
            onClick={() => window.api.nudgeStartFocus(task.projectId, task.taskId)}
          >
            {task.projectCode && <span className="proj-tag">{task.projectCode}</span>}
            <span className="proj" style={{ background: projectColorValue(task.projectColor) }} />
            <span className="title">{task.title}</span>
            <span className="arrow">Focus →</span>
          </button>
        ))}

        {!showAll && hiddenCount > 0 && (
          <button className="more-toggle" onClick={() => setShowAll(true)}>
            + jeszcze {hiddenCount} {hiddenCount === 1 ? 'zadanie' : hiddenCount < 5 ? 'zadania' : 'zadań'}
          </button>
        )}

        <button className="new-task" onClick={() => window.api.nudgeOpenQuickAdd()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nowe zadanie
        </button>
      </div>

      <div className="foot">
        <span className="pause-label">snooze</span>
        {SNOOZE_OPTIONS.map((opt) => (
          <button key={opt.minutes} className="pill" onClick={() => window.api.nudgeSnooze(opt.minutes)}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
