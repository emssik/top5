import { useState } from 'react'
import { useProjects } from '../../hooks/useProjects'
import { HabitRow } from './HabitRow'
import { HabitIcon } from './HabitIcon'
import { HabitEditor } from './HabitEditor'
import { HabitDetail } from './HabitDetail'
import { fireConfetti, showHabitToast } from './effects'
import { computeStreak, isScheduledOn } from '../../../shared/habit-schedule'
import { dateKey } from '../../../shared/schedule'
import type { Habit } from '../../types'

export function HabitsView() {
  const { habits, projects, habitTick, saveHabit, removeHabit } = useProjects()
  const [filter, setFilter] = useState<'all' | 'today' | 'active'>('all')
  const [editingHabit, setEditingHabit] = useState<Habit | 'new' | null>(null)
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null)

  const todayKey = dateKey(new Date())
  const today = new Date()

  const filtered = habits.filter((h) => {
    if (h.archivedAt) return false
    if (filter === 'today') return !h.log[todayKey]?.done && isScheduledOn(h, today)
    if (filter === 'active') return computeStreak(h).streak > 0
    return true
  })

  const activeStreaks = habits.filter((h) => !h.archivedAt && computeStreak(h).streak > 0).length
  const doneToday = habits.filter((h) => !h.archivedAt && h.log[todayKey]?.done).length
  const schedToday = habits.filter((h) => !h.archivedAt && isScheduledOn(h, today)).length
  const bestEver = habits.filter((h) => !h.archivedAt).length > 0
    ? Math.max(...habits.filter((h) => !h.archivedAt).map((h) => computeStreak(h).best))
    : 0

  const handleTick = async (id: string, anchorEl: HTMLElement) => {
    await habitTick(id, 'done')
    fireConfetti(anchorEl)
    showHabitToast('Chain nie pęka. ✓')
  }

  const handleOpen = (id: string) => {
    const habit = habits.find((h) => h.id === id)
    if (habit) setDetailHabit(habit)
  }

  return (
    <div className="habits-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--c-text-heading)' }}>Habits</div>
          <div style={{ fontSize: 13, color: 'var(--c-text-muted)', marginTop: 2 }}>Don&#x27;t break the chain — powtarzalne nawyki z rozliczaniem serii</div>
        </div>
        <button className="btn primary" onClick={() => setEditingHabit('new')}>
          <HabitIcon name="flame" size={13} />
          {' '}Nowy nawyk
        </button>
      </div>

      <div className="habits-stat-grid">
        <div className="habits-stat-card">
          <div className="habits-stat-num green">{doneToday}/{schedToday}</div>
          <div className="habits-stat-label">Dziś</div>
        </div>
        <div className="habits-stat-card">
          <div className="habits-stat-num">{activeStreaks}</div>
          <div className="habits-stat-label">Aktywne chainy</div>
        </div>
        <div className="habits-stat-card">
          <div className="habits-stat-num blue">{habits.filter((h) => !h.archivedAt).length}</div>
          <div className="habits-stat-label">Total habits</div>
        </div>
        <div className="habits-stat-card">
          <div className="habits-stat-num orange">{bestEver}</div>
          <div className="habits-stat-label">Best streak</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="sub-tabs">
          <div className={`sub-tab${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>Wszystkie</div>
          <div className={`sub-tab${filter === 'today' ? ' active' : ''}`} onClick={() => setFilter('today')}>Do zrobienia dziś</div>
          <div className={`sub-tab${filter === 'active' ? ' active' : ''}`} onClick={() => setFilter('active')}>Aktywne chainy</div>
        </div>
      </div>

      {filtered.map((h) => (
        <HabitRow
          key={h.id}
          habit={h}
          projects={projects}
          onTick={handleTick}
          onOpen={handleOpen}
          onEdit={(habit) => setEditingHabit(habit)}
        />
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--c-text-muted)', padding: '32px 0', fontSize: 13 }}>
          Brak nawyków do pokazania.
        </div>
      )}

      {detailHabit && (
        <HabitDetail
          habit={detailHabit}
          projects={projects}
          onClose={() => setDetailHabit(null)}
          onEdit={(h) => { setEditingHabit(h); setDetailHabit(null) }}
          onTick={async (id, mode) => { await habitTick(id, mode) }}
        />
      )}

      {editingHabit !== null && (
        <HabitEditor
          habit={editingHabit === 'new' ? undefined : editingHabit}
          onSave={async (h) => { await saveHabit(h); setEditingHabit(null) }}
          onCancel={() => setEditingHabit(null)}
          onDelete={editingHabit !== 'new' ? async (id) => { await removeHabit(id); setEditingHabit(null) } : undefined}
        />
      )}
    </div>
  )
}
