import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import { useProjects } from '../hooks/useProjects'
import type { RepeatSchedule, RepeatingTask } from '../types'

type ScheduleMode = 'daily' | 'everyN' | 'weekdays' | 'custom' | 'afterDone'

type ModalState =
  | { open: false }
  | { open: true; task: RepeatingTask | null }

const WEEKDAY_DEFAULT = [1, 2, 3, 4, 5]
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatSchedule(schedule: RepeatSchedule): string {
  if (schedule.type === 'daily') return 'Every day'
  if (schedule.type === 'interval') return `Every ${schedule.days} days`
  if (schedule.type === 'afterCompletion') return `${schedule.days} days after done`
  if (schedule.type === 'weekdays') {
    const normalized = [...schedule.days].sort((a, b) => a - b)
    const isWorkWeek = normalized.length === 5 && WEEKDAY_DEFAULT.every((day, index) => day === normalized[index])
    if (isWorkWeek) return 'Weekdays'
    return normalized.map((day) => DAY_LABELS[(day + 6) % 7]).join(', ')
  }
  return 'Custom'
}

function scheduleToMode(schedule: RepeatSchedule): ScheduleMode {
  if (schedule.type === 'daily') return 'daily'
  if (schedule.type === 'interval') return 'everyN'
  if (schedule.type === 'afterCompletion') return 'afterDone'
  if (schedule.type === 'weekdays') {
    const normalized = [...schedule.days].sort((a, b) => a - b)
    const isWorkWeek = normalized.length === 5 && WEEKDAY_DEFAULT.every((day, index) => day === normalized[index])
    return isWorkWeek ? 'weekdays' : 'custom'
  }
  return 'daily'
}

export default function RepeatView() {
  const { repeatingTasks, saveRepeatingTask, removeRepeatingTask } = useProjects()
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<ScheduleMode>('daily')
  const [everyN, setEveryN] = useState(3)
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5])

  const sorted = useMemo(() => [...repeatingTasks].sort((a, b) => a.order - b.order), [repeatingTasks])

  const openCreate = () => {
    setModal({ open: true, task: null })
    setTitle('')
    setMode('daily')
    setEveryN(3)
    setCustomDays([1, 2, 3, 4, 5])
  }

  const openEdit = (task: RepeatingTask) => {
    setModal({ open: true, task })
    setTitle(task.title)
    setMode(scheduleToMode(task.schedule))

    if (task.schedule.type === 'interval' || task.schedule.type === 'afterCompletion') {
      setEveryN(task.schedule.days)
    } else {
      setEveryN(3)
    }

    if (task.schedule.type === 'weekdays') {
      setCustomDays([...task.schedule.days])
    } else {
      setCustomDays([1, 2, 3, 4, 5])
    }
  }

  const closeModal = () => setModal({ open: false })

  const buildSchedule = (): RepeatSchedule => {
    if (mode === 'daily') return { type: 'daily' }
    if (mode === 'everyN') return { type: 'interval', days: Math.max(1, everyN) }
    if (mode === 'afterDone') return { type: 'afterCompletion', days: Math.max(1, everyN) }
    if (mode === 'weekdays') return { type: 'weekdays', days: [1, 2, 3, 4, 5] }
    return { type: 'weekdays', days: customDays.length > 0 ? [...customDays].sort((a, b) => a - b) : [1] }
  }

  const save = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const task = modal.open && modal.task

    const payload: RepeatingTask = task
      ? {
        ...task,
        title: trimmedTitle,
        schedule: buildSchedule()
      }
      : {
        id: nanoid(),
        title: trimmedTitle,
        schedule: buildSchedule(),
        createdAt: new Date().toISOString(),
        lastCompletedAt: null,
        order: sorted.length,
        acceptedCount: 0,
        dismissedCount: 0,
        completedCount: 0
      }

    await saveRepeatingTask(payload)
    closeModal()
  }

  const deleteTask = async () => {
    if (!modal.open || !modal.task) return
    await removeRepeatingTask(modal.task.id)
    closeModal()
  }

  return (
    <>
      <div className="section-label" style={{ marginBottom: 16 }}>
        <span style={{ opacity: 0.5 }}>↻</span>
        <span>Repeating Tasks</span>
      </div>

      {sorted.map((task) => (
        <div key={task.id} className="repeat-item" style={{ cursor: 'pointer' }} onClick={() => openEdit(task)}>
          <span className="icon">↻</span>
          <span className="title">{task.title}</span>
          <span className="schedule">{formatSchedule(task.schedule)}</span>
        </div>
      ))}

      <button className="add-task-btn" style={{ marginTop: 8 }} onClick={openCreate}>
        <span className="plus">+</span> Add repeating task
      </button>

      <div className={`modal-overlay ${modal.open ? 'open' : ''}`} onClick={closeModal}>
        {modal.open && (
          <div className="modal" style={{ width: 400 }} onClick={(event) => event.stopPropagation()}>
            <h2>{modal.task ? 'Edit Repeating Task' : 'Add Repeating Task'}</h2>

            <div className="form-group">
              <label>Title</label>
              <input className="form-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Morning standup" />
            </div>

            <div className="form-group">
              <label>Schedule</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <button className={`form-btn ${mode === 'daily' ? 'form-btn-primary' : 'form-btn-secondary'}`} style={{ flex: 0, padding: '5px 10px', fontSize: 11 }} onClick={() => setMode('daily')}>Every day</button>
                <button className={`form-btn ${mode === 'everyN' ? 'form-btn-primary' : 'form-btn-secondary'}`} style={{ flex: 0, padding: '5px 10px', fontSize: 11 }} onClick={() => setMode('everyN')}>Every N days</button>
                <button className={`form-btn ${mode === 'weekdays' ? 'form-btn-primary' : 'form-btn-secondary'}`} style={{ flex: 0, padding: '5px 10px', fontSize: 11 }} onClick={() => setMode('weekdays')}>Weekdays</button>
                <button className={`form-btn ${mode === 'custom' ? 'form-btn-primary' : 'form-btn-secondary'}`} style={{ flex: 0, padding: '5px 10px', fontSize: 11 }} onClick={() => setMode('custom')}>Custom days</button>
                <button className={`form-btn ${mode === 'afterDone' ? 'form-btn-primary' : 'form-btn-secondary'}`} style={{ flex: 0, padding: '5px 10px', fontSize: 11 }} onClick={() => setMode('afterDone')}>After done</button>
              </div>

              {(mode === 'everyN' || mode === 'afterDone') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--c-text-secondary)' }}>{mode === 'everyN' ? 'Every' : 'Wait'}</span>
                  <input
                    className="form-input"
                    type="number"
                    value={everyN}
                    min={1}
                    style={{ width: 60, textAlign: 'center' }}
                    onChange={(event) => setEveryN(Math.max(1, Number(event.target.value) || 1))}
                  />
                  <select className="form-input" style={{ width: 'auto' }}>
                    <option>{mode === 'everyN' ? 'days' : 'days after completion'}</option>
                    <option>{mode === 'everyN' ? 'weeks' : 'weeks after completion'}</option>
                  </select>
                </div>
              )}

              {mode === 'custom' && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  {DAY_LABELS.map((label, index) => {
                    const day = (index + 1) % 7
                    const selected = customDays.includes(day)
                    return (
                      <button
                        key={label}
                        className={`form-btn ${selected ? 'form-btn-primary' : 'form-btn-secondary'}`}
                        style={{ flex: 0, padding: '4px 8px', fontSize: 11, minWidth: 36 }}
                        onClick={() => {
                          setCustomDays((prev) => {
                            if (prev.includes(day)) {
                              const next = prev.filter((item) => item !== day)
                              return next.length > 0 ? next : prev
                            }
                            return [...prev, day]
                          })
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>After completion</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="form-btn form-btn-primary" style={{ flex: 0, padding: '5px 10px', fontSize: 11 }}>Remove</button>
                <button className="form-btn form-btn-secondary" style={{ flex: 0, padding: '5px 10px', fontSize: 11 }}>Keep</button>
              </div>
            </div>

            <div className="form-actions">
              {modal.task && <button className="form-btn form-btn-danger" onClick={deleteTask}>Delete</button>}
              <button className="form-btn form-btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="form-btn form-btn-primary" onClick={save}>{modal.task ? 'Save' : 'Add'}</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
