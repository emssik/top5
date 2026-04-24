import { useState, useEffect } from 'react'
import { useProjects } from '../hooks/useProjects'
import { getScheduledHabits, computeStreak } from '../../shared/habit-schedule'
import { dateKey } from '../../shared/schedule'

export default function CleanViewHabitsSection() {
  const { habits, habitTick } = useProjects()
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setToday(new Date())
    const interval = setInterval(tick, 60_000)
    return () => clearInterval(interval)
  }, [])
  const todayKey = dateKey(today)

  const scheduled = getScheduledHabits(habits, today)
  if (scheduled.length === 0) return null

  const handleTick = async (id: string, isDone: boolean) => {
    if (isDone) return
    await habitTick(id, 'done')
  }

  return (
    <>
      <div className="clean-view-divider"><span>nawyki</span></div>
      {scheduled.map((h) => {
        const isDone = !!h.log[todayKey]?.done
        const { streak, unit } = computeStreak(h)
        const shortUnit = unit === 'tyg' ? 't' : 'd'
        const marker = isDone ? '⊘' : '○'
        return (
          <div key={h.id} className="group flex items-baseline gap-2.5 py-[2px]">
            <button
              onClick={() => handleTick(h.id, isDone)}
              disabled={isDone}
              className="w-5 flex-shrink-0 text-center text-[18px] leading-none transition-colors"
              style={{ color: isDone ? 'var(--cv-ink-done)' : 'var(--cv-ink-faint)' }}
              title={isDone ? 'Zrobione' : 'Oznacz jako zrobione'}
            >
              {marker}
            </button>
            <span
              className={`flex-1 text-[18px] leading-snug truncate block ${isDone ? 'line-through' : ''}`}
              style={{ color: isDone ? 'var(--cv-ink-done)' : 'var(--cv-ink)', fontWeight: 500 }}
              title={h.name}
            >
              {h.name}
            </span>
            <span
              className="text-[15px] flex-shrink-0"
              style={{ color: isDone ? 'var(--cv-ink-done)' : streak >= 7 ? 'var(--cv-gold)' : 'var(--cv-ink-faint)' }}
            >
              {streak > 0 ? `${streak}${shortUnit}` : '—'}
            </span>
          </div>
        )
      })}
    </>
  )
}
