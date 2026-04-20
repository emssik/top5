import { useEffect, useState } from 'react'
import type { Habit } from '../../types'

interface TimerModalProps {
  habit: Habit
  onSave: (minutes: number) => void
  onCancel: () => void
}

export function TimerModal({ habit, onSave, onCancel }: TimerModalProps) {
  const [running, setRunning] = useState(true)
  const [seconds, setSeconds] = useState(0)
  const [manualMin, setManualMin] = useState('')

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [running])

  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const mm = String(Math.floor(seconds / 60) % 60).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  const isTimeBased = habit.schedule.type === 'dailyMinutes' || habit.schedule.type === 'weeklyMinutes'
  const targetMin = isTimeBased ? (habit.schedule as { minutes: number }).minutes : 0
  const currentMin = Math.floor(seconds / 60)
  const pct = targetMin > 0 ? Math.min(100, (currentMin / targetMin) * 100) : 0

  const handleSave = () => {
    const val = manualMin ? Number(manualMin) : currentMin
    onSave(val)
  }

  return (
    <div className="modal-overlay open" onClick={onCancel}>
      <div className="modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <h2>Timer · {habit.name}</h2>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            fontSize: 48, fontWeight: 600, letterSpacing: '-1px',
            fontVariantNumeric: 'tabular-nums',
            color: running ? 'var(--accent)' : 'var(--c-text-heading)'
          }}>
            {hh}:{mm}:{ss}
          </div>
          {isTimeBased && (
            <>
              <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 4 }}>
                Cel: {targetMin} min {habit.schedule.type === 'weeklyMinutes' && '/ tydzień'}
              </div>
              <div style={{
                height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 4,
                overflow: 'hidden', margin: '14px auto 0', maxWidth: 280
              }}>
                <div style={{
                  width: pct + '%', height: '100%',
                  background: pct >= 100 ? '#7fae6d' : '#e9a825',
                  transition: 'width 300ms'
                }} />
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button className="btn" onClick={() => setRunning((r) => !r)}>
            {running ? 'Pauza' : 'Wznów'}
          </button>
          <button className="btn" onClick={() => setSeconds(0)}>Reset</button>
        </div>
        <div className="divider" />
        <div className="field-label">Albo dodaj czas ręcznie</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input" type="number" min={1} placeholder="minuty"
            value={manualMin} onChange={(e) => setManualMin(e.target.value)}
            style={{ width: 120 }}
          />
          <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>min</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {[5, 10, 15, 25, 30, 45, 60].map((v) => (
              <button key={v} className="pill-btn" onClick={() => setManualMin(String(v))}>{v}</button>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>Anuluj</button>
          <button className="btn primary" onClick={handleSave}>
            Zapisz ({manualMin || currentMin} min)
          </button>
        </div>
      </div>
    </div>
  )
}
