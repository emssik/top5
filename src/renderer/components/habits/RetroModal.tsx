
import type { Habit } from '../../types'

interface RetroModalProps {
  habit: Habit
  dateKey: string
  onApply: (action: 'done' | 'freeze' | 'skip' | 'clear') => void
  onCancel: () => void
}

function parseDate(dk: string): Date {
  const [y, m, d] = dk.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function RetroModal({ habit, dateKey: dk, onApply, onCancel }: RetroModalProps) {
  const entry = habit.log[dk] ?? {}
  const d = parseDate(dk)
  const label = d.toLocaleDateString('pl', { weekday: 'long', day: 'numeric', month: 'long' })
  const currentState = entry.done ? 'zrobione' : entry.freeze ? 'freeze' : entry.skip ? 'skip' : 'pusty'

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
        <h2>{label}</h2>
        <div style={{ fontSize: 12.5, color: 'var(--c-text-muted)', marginBottom: 12 }}>
          {habit.name} — obecny stan: {currentState}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn primary" onClick={() => onApply('done')}>✓ Oznacz jako zrobione</button>
          {habit.freezeAvailable > 0 && (
            <button className="btn" onClick={() => onApply('freeze')}>Freeze</button>
          )}
          <button className="btn" onClick={() => onApply('skip')}>Skip (urlop)</button>
          <button className="btn" onClick={() => onApply('clear')}>Wyczyść</button>
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>Zamknij</button>
        </div>
      </div>
    </div>
  )
}
