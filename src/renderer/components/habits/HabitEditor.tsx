import { useState } from 'react'
import { useProjects } from '../../hooks/useProjects'
import { HABIT_ICONS, scheduleLabel } from '../../../shared/habit-schedule'
import { HabitIcon } from './HabitIcon'
import type { Habit, HabitSchedule } from '../../types'

interface HabitEditorProps {
  habit?: Habit
  onSave: (habit: Habit) => void
  onCancel: () => void
  onDelete?: (id: string) => void
}

const SCHEDULE_DEFAULTS: Record<string, HabitSchedule> = {
  daily: { type: 'daily' },
  weekdays: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
  nPerWeek: { type: 'nPerWeek', count: 3 },
  interval: { type: 'interval', every: 2 },
  dailyMinutes: { type: 'dailyMinutes', minutes: 10 },
  weeklyMinutes: { type: 'weeklyMinutes', minutes: 180 },
}

export function HabitEditor({ habit, onSave, onCancel, onDelete }: HabitEditorProps) {
  const { projects } = useProjects()
  const [name, setName] = useState(habit?.name ?? '')
  const [projectId, setProjectId] = useState(habit?.projectId ?? '')
  const [icon, setIcon] = useState(habit?.icon ?? 'flame')
  const [note, setNote] = useState(habit?.note ?? '')
  const [freezeAvailable, setFreezeAvailable] = useState(habit?.freezeAvailable ?? 1)
  const [schedule, setSchedule] = useState<HabitSchedule>(habit?.schedule ?? { type: 'daily' })

  const setType = (type: string) => {
    setSchedule(SCHEDULE_DEFAULTS[type] ?? { type: 'daily' })
  }

  const save = () => {
    if (!name.trim()) return
    if (habit) {
      onSave({ ...habit, name: name.trim(), projectId: projectId || null, icon, note, freezeAvailable, schedule })
    } else {
      onSave({
        id: '',
        name: name.trim(),
        projectId: projectId || null,
        icon,
        note,
        createdAt: new Date().toISOString().split('T')[0],
        freezeAvailable,
        order: 0,
        schedule,
        log: {},
        archivedAt: undefined,
      })
    }
  }

  return (
    <div className="modal-overlay open" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{habit ? 'Edytuj nawyk' : 'Nowy nawyk'}</h2>

        <div className="field-label">Nazwa nawyku</div>
        <input
          className="input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="np. Medytacja, Siłownia, Czytanie..."
        />

        <div className="field-label">Projekt</div>
        <select className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">— brak —</option>
          {projects.filter((p) => !p.archivedAt).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="field-label">Ikona</div>
        <div className="pill-group">
          {HABIT_ICONS.map((ic) => (
            <button
              key={ic}
              className={`pill-btn${icon === ic ? ' selected' : ''}`}
              onClick={() => setIcon(ic)}
              style={{ padding: '6px 8px' }}
            >
              <HabitIcon name={ic} size={15} />
            </button>
          ))}
        </div>

        <div className="divider" />

        <div className="field-label">Harmonogram</div>
        <div className="pill-group">
          {([
            ['daily', 'Codziennie'],
            ['weekdays', 'Dni tyg.'],
            ['nPerWeek', 'N× / tydz.'],
            ['interval', 'Co X dni'],
            ['dailyMinutes', 'Min/dzień'],
            ['weeklyMinutes', 'Min/tydz.'],
          ] as [string, string][]).map(([t, l]) => (
            <button
              key={t}
              className={`pill-btn${schedule.type === t ? ' selected' : ''}`}
              onClick={() => setType(t)}
            >{l}</button>
          ))}
        </div>

        {schedule.type === 'weekdays' && (
          <div style={{ marginTop: 10 }}>
            <div className="pill-group">
              {(['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'] as string[]).map((d, i) => {
                const dayIndex = i + 1 > 6 ? 0 : i + 1 // Pn=1..Sb=6,Nd=0
                const selected = schedule.days.includes(dayIndex)
                return (
                  <button
                    key={i}
                    className={`pill-btn${selected ? ' selected' : ''}`}
                    onClick={() => {
                      const days = selected
                        ? schedule.days.filter((x) => x !== dayIndex)
                        : [...schedule.days, dayIndex].sort((a, b) => a - b)
                      setSchedule({ ...schedule, days })
                    }}
                  >{d}</button>
                )
              })}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <button className="pill-btn" onClick={() => setSchedule({ type: 'weekdays', days: [1, 2, 3, 4, 5] })}>Weekdays</button>
              <button className="pill-btn" onClick={() => setSchedule({ type: 'weekdays', days: [6, 0] })}>Weekend</button>
            </div>
          </div>
        )}

        {schedule.type === 'nPerWeek' && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number" min={1} max={7} className="input" style={{ width: 80 }}
              value={schedule.count}
              onChange={(e) => setSchedule({ ...schedule, count: Math.max(1, Math.min(7, Number(e.target.value) || 1)) })}
            />
            <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>razy w tygodniu</span>
          </div>
        )}

        {schedule.type === 'interval' && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>Co</span>
            <input
              type="number" min={1} max={60} className="input" style={{ width: 80 }}
              value={schedule.every}
              onChange={(e) => setSchedule({ ...schedule, every: Math.max(1, Number(e.target.value) || 1) })}
            />
            <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>dni</span>
          </div>
        )}

        {(schedule.type === 'dailyMinutes' || schedule.type === 'weeklyMinutes') && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>Minimum</span>
            <input
              type="number" min={1} className="input" style={{ width: 90 }}
              value={schedule.minutes}
              onChange={(e) => setSchedule({ ...schedule, minutes: Math.max(1, Number(e.target.value) || 1) })}
            />
            <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>
              min {schedule.type === 'dailyMinutes' ? 'dziennie' : 'tygodniowo'}
            </span>
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--c-text-muted)' }}>
          → {scheduleLabel(schedule)}
        </div>

        <div className="divider" />

        <div className="field-label">Freeze days (tarcze)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="number" min={0} max={10} className="input" style={{ width: 80 }}
            value={freezeAvailable}
            onChange={(e) => setFreezeAvailable(Math.max(0, Number(e.target.value) || 0))}
          />
          <span style={{ fontSize: 12.5, color: 'var(--c-text-muted)' }}>zapasowych żetonów na miesiąc</span>
        </div>

        <div className="field-label">Notatka</div>
        <textarea
          className="input"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Po co ten nawyk?"
          style={{ resize: 'vertical' }}
        />

        <div className="modal-actions">
          {habit && onDelete && (
            <button
              className="btn danger left"
              onClick={() => {
                if (window.confirm(`Usunąć habit „${habit.name}"? Tego nie można cofnąć.`)) {
                  onDelete(habit.id)
                }
              }}
            >Usuń</button>
          )}
          <button className="btn ghost" onClick={onCancel}>Anuluj</button>
          <button className="btn primary" onClick={save} disabled={!name.trim()}>Zapisz</button>
        </div>
      </div>
    </div>
  )
}
