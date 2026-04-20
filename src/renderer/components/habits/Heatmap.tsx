import React from 'react'
import { dateKey } from '../../../shared/schedule'
import { dayStatus, isScheduledOn } from '../../../shared/habit-schedule'
import type { Habit } from '../../types'

interface HeatmapProps {
  habit: Habit
  weeks?: number
  onCellClick?: (dateKey: string) => void
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function dayOfWeekMon(d: Date): number {
  return (d.getDay() + 6) % 7 // 0=Mon..6=Sun
}

export function Heatmap({ habit, weeks = 32, onCellClick }: HeatmapProps) {
  const today = new Date()
  const todayKey = dateKey(today)
  const dow = dayOfWeekMon(today)
  // ostatnia kolumna: od Pn bieżącego tygodnia do dziś (brak przyszłości)
  const start = addDays(today, -dow - (weeks - 1) * 7)
  const total = (weeks - 1) * 7 + dow + 1

  const cells: React.ReactNode[] = []
  const monthMarkers: Record<string, number> = {}

  for (let i = 0; i < total; i++) {
    const d = addDays(start, i)
    const key = dateKey(d)
    const status = dayStatus(habit, key)
    const scheduled = isScheduledOn(habit, d)

    let cls = 'heat-cell'
    if (status === 'empty' && scheduled) {
      cls += ' miss'
    } else if (status !== 'empty') {
      cls += ' ' + status
    }
    if (key === todayKey) cls += ' today'

    if (i % 7 === 0) {
      const m = d.toLocaleDateString('pl', { month: 'short' })
      if (!monthMarkers[m]) monthMarkers[m] = Math.floor(i / 7)
    }

    const minutesNote = habit.log[key]?.minutes ? ` · ${habit.log[key].minutes} min` : ''
    cells.push(
      <div
        key={key}
        className={cls}
        title={`${key}${minutesNote}`}
        onClick={() => { if (onCellClick) onCellClick(key) }}
      />
    )
  }

  const monthKeys = Object.keys(monthMarkers)

  return (
    <div className="heatmap-wrapper">
      <div className="heatmap-weekdays">
        <span>Pn</span><span></span><span>Śr</span><span></span><span>Pt</span><span></span><span>Nd</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
        <div className="heatmap-months">
          {monthKeys.map((m, i) => (
            <span
              key={i}
              style={{ flexGrow: i === monthKeys.length - 1 ? 1 : 0, minWidth: 32 }}
            >
              {m}
            </span>
          ))}
        </div>
        <div className="heatmap">{cells}</div>
      </div>
    </div>
  )
}
