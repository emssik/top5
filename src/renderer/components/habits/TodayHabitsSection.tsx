import { useProjects } from '../../hooks/useProjects'
import { isScheduledOn, computeStreak, scheduleLabel } from '../../../shared/habit-schedule'
import { dateKey } from '../../../shared/schedule'
import { HabitIcon } from './HabitIcon'
import { fireConfetti, showHabitToast } from './effects'

interface TodayHabitsSectionProps {
  onSelectView: (view: string) => void
}

export function TodayHabitsSection({ onSelectView }: TodayHabitsSectionProps) {
  const { habits, projects, habitTick } = useProjects()
  const todayKey = dateKey(new Date())
  const today = new Date()

  const scheduled = habits.filter((h) => !h.archivedAt && isScheduledOn(h, today))
  if (scheduled.length === 0) return null

  const done = scheduled.filter((h) => h.log[todayKey]?.done).length

  const handleTick = async (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    await habitTick(id, 'done')
    fireConfetti(e.currentTarget)
    showHabitToast('Chain nie pęka. ✓')
  }

  return (
    <div className="today-habits-section">
      <div className="today-habits-header">
        <span className="today-habits-title">
          <HabitIcon name="flame" size={11} /> Habits today · {done}/{scheduled.length}
        </span>
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
          const proj = projects.find((p) => p.id === h.projectId)
          return (
            <div key={h.id} className={`today-habit-row${isDone ? ' done' : ''}`}>
              <button
                className="today-habit-check"
                onClick={(e) => !isDone && handleTick(h.id, e)}
                disabled={isDone}
                aria-label={isDone ? 'Zrobione' : 'Oznacz jako zrobione'}
              >
                {isDone ? '✓' : ''}
              </button>
              <HabitIcon name={h.icon} size={14} stroke="var(--c-text-secondary)" />
              <span className="today-habit-code">HB-{h.id.slice(0, 3)}</span>
              <span className="today-habit-name">{h.name}</span>
              <span
                className="today-habit-bullet"
                style={{ background: proj?.color ? `var(--pc-${proj.color})` : 'var(--c-border)' }}
                title={proj?.name ?? ''}
              />
              <span className="today-habit-schedule">{scheduleLabel(h.schedule)}</span>
              <span className={`streak-chip${streak === 0 ? ' cold' : ''}`}>
                <HabitIcon name="flame" size={11} /> {streak} {streak > 0 ? unit : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
