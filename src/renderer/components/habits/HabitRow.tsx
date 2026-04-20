import React from 'react'
import { HabitIcon } from './HabitIcon'
import { Heatmap } from './Heatmap'
import { HeatmapLegend } from './HeatmapLegend'
import { computeStreak, scheduleLabel } from '../../../../shared/habit-schedule'
import { dateKey } from '../../../../shared/schedule'
import type { Habit } from '../../types'
import type { Project } from '../../types'

interface HabitRowProps {
  habit: Habit
  projects: Project[]
  onTick: (id: string, anchorEl: HTMLElement) => void
  onOpen: (id: string) => void
  onEdit: (habit: Habit) => void
}

export function HabitRow({ habit, projects, onTick, onOpen, onEdit }: HabitRowProps) {
  const proj = projects.find((p) => p.id === habit.projectId)
  const { streak, unit } = computeStreak(habit)
  const isTimeBased = habit.schedule.type === 'dailyMinutes' || habit.schedule.type === 'weeklyMinutes'
  const today = dateKey(new Date())
  const doneToday = !!habit.log[today]?.done

  return (
    <div className="habit-card" onClick={() => onOpen(habit.id)}>
      <div className="habit-head">
        <span className="habit-bullet" style={{ background: proj?.color ? `var(--pc-${proj.color})` : undefined }} />
        <HabitIcon name={habit.icon} size={16} stroke="var(--c-text-secondary)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="habit-title">{habit.name}</div>
          <div className="habit-schedule">
            {scheduleLabel(habit.schedule)}
            {proj && ` · [${proj.code ?? proj.name.slice(0, 4).toUpperCase()}]`}
          </div>
        </div>
        <span className={`streak-chip${streak === 0 ? ' cold' : ''}`}>
          <HabitIcon name="flame" size={12} />
          {streak} {unit}
        </span>
        <button
          className="btn ghost small"
          onClick={(e) => { e.stopPropagation(); onEdit(habit) }}
        >
          <HabitIcon name="pen" size={13} />
        </button>
      </div>
      <Heatmap habit={habit} weeks={26} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <HeatmapLegend />
        <button
          className={`btn${doneToday ? '' : ' primary'}`}
          style={{ marginLeft: 'auto' }}
          onClick={(e) => { e.stopPropagation(); onTick(habit.id, e.currentTarget) }}
        >
          {doneToday ? '✓ Zrobione dziś' : isTimeBased ? 'Zaloguj czas' : 'Oznacz dziś'}
        </button>
      </div>
    </div>
  )
}
