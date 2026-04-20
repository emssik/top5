import { useProjects } from '../../hooks/useProjects'
import { isScheduledOn } from '../../../shared/habit-schedule'
import { dateKey } from '../../../shared/schedule'
import { HabitIcon } from './HabitIcon'
import { computeStreak } from '../../../shared/habit-schedule'

function fireConfetti(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect()
  const colors = ['#7fae6d', '#e9a825', '#3c6aa8', '#d88a3e', '#d67bb0']
  for (let i = 0; i < 14; i++) {
    const el = document.createElement('div')
    el.className = 'confetti'
    el.style.left = (rect.left + rect.width / 2) + 'px'
    el.style.top = (rect.top + rect.height / 2) + 'px'
    el.style.background = colors[i % colors.length]
    el.style.transform = `rotate(${Math.random() * 360}deg) translateX(${(Math.random() - 0.5) * 60}px)`
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1100)
  }
}

function showToast(msg: string) {
  const el = document.createElement('div')
  el.className = 'habit-toast'
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2000)
}

interface TodayHabitsSectionProps {
  onSelectView: (view: string) => void
}

export function TodayHabitsSection({ onSelectView }: TodayHabitsSectionProps) {
  const { habits, habitTick } = useProjects()
  const todayKey = dateKey(new Date())
  const today = new Date()

  const scheduled = habits.filter((h) => !h.archivedAt && isScheduledOn(h, today))
  if (scheduled.length === 0) return null

  const done = scheduled.filter((h) => h.log[todayKey]?.done).length

  const handleTick = async (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    await habitTick(id, 'done')
    fireConfetti(e.currentTarget)
    showToast('Chain nie pęka. ✓')
  }

  return (
    <div className="today-habits-section">
      <div className="today-habits-header">
        <span className="today-habits-title">Habits today · {done}/{scheduled.length}</span>
        <button
          className="today-habits-link"
          onClick={() => onSelectView('habits')}
        >
          all habits →
        </button>
      </div>
      <div className="today-habits-list">
        {scheduled.map((h) => {
          const isDone = !!h.log[todayKey]?.done
          const { streak, unit } = computeStreak(h)
          return (
            <div key={h.id} className={`today-habit-row${isDone ? ' done' : ''}`}>
              <button
                className="today-habit-check"
                onClick={(e) => !isDone && handleTick(h.id, e)}
                disabled={isDone}
                aria-label={isDone ? 'Zrobione' : 'Oznacz jako zrobione'}
              >
                {isDone ? '✓' : '○'}
              </button>
              <HabitIcon name={h.icon} size={14} stroke="var(--c-text-secondary)" />
              <span className="today-habit-code">HB-{h.id.slice(0, 3)}</span>
              <span className="today-habit-name">{h.name}</span>
              {streak > 0 && (
                <span className="streak-chip">
                  <HabitIcon name="flame" size={11} /> {streak} {unit}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
