import React, { useState } from 'react'
import { useProjects } from '../../hooks/useProjects'
import { HabitIcon } from './HabitIcon'
import { HabitEditor } from './HabitEditor'
import { TimerModal } from './TimerModal'
import { RetroModal } from './RetroModal'
import { Heatmap } from './Heatmap'
import { HeatmapLegend } from './HeatmapLegend'
import { computeStreak, scheduleLabel } from '../../../shared/habit-schedule'
import { dateKey } from '../../../shared/schedule'
import type { Habit, Project } from '../../types'

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

interface HabitDetailProps {
  habit: Habit
  projects: Project[]
  onClose: () => void
  onEdit: (habit: Habit) => void
  onTick: (id: string, mode: 'done' | 'freeze' | 'skip' | 'undo') => Promise<void>
  onRetroCell?: (dateKey: string) => void
}

export function HabitDetail({ habit, projects, onClose, onEdit, onTick, onRetroCell }: HabitDetailProps) {
  const { saveHabit, removeHabit, habitLogMinutes, habitRetroTick } = useProjects()
  const [showEditor, setShowEditor] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [retroDateKey, setRetroDateKey] = useState<string | null>(null)

  const proj = projects.find((p) => p.id === habit.projectId)
  const { streak, best, unit } = computeStreak(habit)
  const today = dateKey(new Date())
  const isTimeBased = habit.schedule.type === 'dailyMinutes' || habit.schedule.type === 'weeklyMinutes'

  const totalDone = Object.values(habit.log).filter((e) => e.done).length
  const totalMin = Object.values(habit.log).reduce((s, e) => s + (e.minutes ?? 0), 0)
  const freezeUsed = Object.values(habit.log).filter((e) => e.freeze).length
  const skipUsed = Object.values(habit.log).filter((e) => e.skip).length

  const handleTickDone = async (e: React.MouseEvent<HTMLButtonElement>) => {
    await onTick(habit.id, 'done')
    fireConfetti(e.currentTarget)
    showToast('Chain nie pęka. ✓')
  }

  const handleCellClick = (dk: string) => {
    setRetroDateKey(dk)
    if (onRetroCell) onRetroCell(dk)
  }

  const handleRetroApply = async (action: 'done' | 'freeze' | 'skip' | 'clear') => {
    if (!retroDateKey) return
    await habitRetroTick(habit.id, retroDateKey, action)
    setRetroDateKey(null)
  }

  const handleSaveEdit = async (h: Habit) => {
    await saveHabit(h)
    setShowEditor(false)
    onEdit(h)
  }

  const handleDelete = async (id: string) => {
    await removeHabit(id)
    setShowEditor(false)
    onClose()
  }

  const handleTimerSave = async (minutes: number) => {
    await habitLogMinutes(habit.id, minutes)
    setShowTimer(false)
    showToast(`Zapisano ${minutes} min. ✓`)
  }

  return (
    <div className="habit-detail">
      <div className="hd-head">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: proj?.color ? `color-mix(in srgb, var(--pc-${proj.color}) 20%, transparent)` : 'var(--bg-surface)',
            display: 'grid', placeItems: 'center', flexShrink: 0
          }}>
            <HabitIcon name={habit.icon} size={22} stroke={proj?.color ? `var(--pc-${proj.color})` : 'var(--c-text-secondary)'} />
          </div>
          <div>
            <div className="hd-title">{habit.name}</div>
            <div className="hd-meta">
              {scheduleLabel(habit.schedule)}
              {proj && ` · ${proj.name}`}
              {habit.note && <> · <em>"{habit.note}"</em></>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn ghost small" onClick={() => setShowEditor(true)}>
            <HabitIcon name="pen" size={14} />
          </button>
          {isTimeBased && !habit.log[today]?.done && (
            <button className="btn ghost small" onClick={() => setShowTimer(true)}>
              <HabitIcon name="clock" size={14} />
            </button>
          )}
          <button className="btn ghost small" onClick={onClose}>
            <HabitIcon name="no-sugar" size={14} />
          </button>
        </div>
      </div>

      <div className="habit-stat-grid">
        <div className="habit-stat-card">
          <div className="habit-stat-num green">{streak}</div>
          <div className="habit-stat-label">Streak ({unit})</div>
        </div>
        <div className="habit-stat-card">
          <div className="habit-stat-num">{best}</div>
          <div className="habit-stat-label">Best</div>
        </div>
        <div className="habit-stat-card">
          <div className="habit-stat-num blue">{totalDone}</div>
          <div className="habit-stat-label">Razem</div>
        </div>
        <div className="habit-stat-card">
          <div className="habit-stat-num orange">{habit.freezeAvailable}</div>
          <div className="habit-stat-label">Freeze</div>
          <div className="habit-stat-sub">{freezeUsed} użytych</div>
        </div>
        <div className="habit-stat-card">
          <div className="habit-stat-num">{isTimeBased ? `${totalMin}m` : skipUsed}</div>
          <div className="habit-stat-label">{isTimeBased ? 'Total time' : 'Skip'}</div>
        </div>
      </div>

      <div className="section-label">
        <HabitIcon name="flame" size={12} /> Chain
      </div>
      <Heatmap habit={habit} weeks={32} onCellClick={handleCellClick} />
      <HeatmapLegend />

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {habit.log[today]?.done ? (
          <button className="btn" onClick={() => onTick(habit.id, 'undo')}>
            Cofnij dzisiejszy tick
          </button>
        ) : (
          <button className="btn primary" onClick={handleTickDone}>
            <HabitIcon name="flame" size={13} /> Oznacz dziś jako zrobione
          </button>
        )}
        {isTimeBased && !habit.log[today]?.done && (
          <button className="btn" onClick={() => setShowTimer(true)}>
            <HabitIcon name="clock" size={13} /> Uruchom timer
          </button>
        )}
        {habit.freezeAvailable > 0 && !habit.log[today]?.done && (
          <button className="btn" onClick={() => onTick(habit.id, 'freeze')}>
            <HabitIcon name="note" size={13} /> Użyj freeze ({habit.freezeAvailable})
          </button>
        )}
        {!habit.log[today]?.done && (
          <button className="btn" onClick={() => onTick(habit.id, 'skip')}>
            <HabitIcon name="leaf" size={13} /> Skip (planowana przerwa)
          </button>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--c-text-muted)', marginTop: 10 }}>
        Kliknij dowolny kafelek na chainie, żeby retroaktywnie oznaczyć dzień.
      </div>

      {showEditor && (
        <HabitEditor
          habit={habit}
          onSave={handleSaveEdit}
          onCancel={() => setShowEditor(false)}
          onDelete={handleDelete}
        />
      )}

      {showTimer && (
        <TimerModal
          habit={habit}
          onSave={handleTimerSave}
          onCancel={() => setShowTimer(false)}
        />
      )}

      {retroDateKey !== null && (
        <RetroModal
          habit={habit}
          dateKey={retroDateKey}
          onApply={handleRetroApply}
          onCancel={() => setRetroDateKey(null)}
        />
      )}
    </div>
  )
}
