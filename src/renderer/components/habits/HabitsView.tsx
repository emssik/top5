import React, { useState } from 'react'
import { useProjects } from '../../hooks/useProjects'
import { HabitRow } from './HabitRow'
import { HabitIcon } from './HabitIcon'
import { computeStreak, isScheduledOn } from '../../../../shared/habit-schedule'
import { dateKey } from '../../../../shared/schedule'
import type { Habit } from '../../types'

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

interface HabitsViewProps {
  onOpenDetail?: (habit: Habit) => void
  openEditor?: () => void
}

export function HabitsView({ onOpenDetail, openEditor }: HabitsViewProps) {
  const { habits, projects, habitTick } = useProjects()
  const [filter, setFilter] = useState<'all' | 'today' | 'active'>('all')

  const todayKey = dateKey(new Date())
  const today = new Date()

  const filtered = habits.filter((h) => {
    if (filter === 'today') return !h.log[todayKey]?.done && isScheduledOn(h, today)
    if (filter === 'active') return computeStreak(h).streak > 0
    return true
  })

  const activeStreaks = habits.filter((h) => computeStreak(h).streak > 0).length
  const doneToday = habits.filter((h) => h.log[todayKey]?.done).length
  const schedToday = habits.filter((h) => isScheduledOn(h, today)).length
  const bestEver = habits.length > 0 ? Math.max(...habits.map((h) => computeStreak(h).best)) : 0

  const handleTick = async (id: string, anchorEl: HTMLElement) => {
    await habitTick(id, 'done')
    fireConfetti(anchorEl)
    showToast('Chain nie pęka. ✓')
  }

  const handleOpen = (id: string) => {
    const habit = habits.find((h) => h.id === id)
    if (habit && onOpenDetail) onOpenDetail(habit)
  }

  const handleEdit = (habit: Habit) => {
    console.log('editor TODO', habit.id)
    if (openEditor) openEditor()
  }

  return (
    <div className="habits-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--c-text-heading)' }}>Habits</div>
          <div style={{ fontSize: 13, color: 'var(--c-text-muted)', marginTop: 2 }}>Don&#x27;t break the chain — powtarzalne nawyki z rozliczaniem serii</div>
        </div>
        <button className="btn primary" onClick={() => {
          console.log('editor TODO')
          if (openEditor) openEditor()
        }}>
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
          <div className="habits-stat-num blue">{habits.length}</div>
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
          onEdit={handleEdit}
        />
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--c-text-muted)', padding: '32px 0', fontSize: 13 }}>
          Brak nawyków do pokazania.
        </div>
      )}
    </div>
  )
}
