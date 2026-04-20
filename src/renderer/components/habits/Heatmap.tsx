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
  const columns = Math.ceil(total / 7)

  const cells: React.ReactNode[] = []
  const monthMarkers: Array<{ label: string; col: number; span: number }> = []

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
      const label = d.toLocaleDateString('pl', { month: 'short' })
      const col = Math.floor(i / 7)
      const prev = monthMarkers[monthMarkers.length - 1]
      if (!prev || prev.label !== label) {
        if (prev) prev.span = col - prev.col
        monthMarkers.push({ label, col, span: 1 })
      }
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

  if (monthMarkers.length > 0) {
    const last = monthMarkers[monthMarkers.length - 1]
    last.span = columns - last.col
  }

  const gridTemplateColumns = `repeat(${columns}, 10px)`

  return (
    <div className="heatmap-wrapper">
      <div className="heatmap-weekdays">
        <span>Pn</span><span></span><span>Śr</span><span></span><span>Pt</span><span></span><span>Nd</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
        <div className="heatmap-months" style={{ gridTemplateColumns }}>
          {monthMarkers.map(({ label, col, span }) => (
            <span key={col} style={{ gridColumn: `${col + 1} / span ${span}` }}>{label}</span>
          ))}
        </div>
        <div className="heatmap" style={{ gridTemplateColumns }}>{cells}</div>
      </div>
    </div>
  )
}
