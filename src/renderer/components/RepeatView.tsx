import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import { useProjects } from '../hooks/useProjects'
import type { RepeatSchedule, RepeatingTask } from '../types'
import { formatSchedule, DAY_LABELS, ORDINAL, WEEKDAY_NAMES } from '../../shared/schedule'
import { Linkify } from './Linkify'

type ScheduleMode = 'daily' | 'weekly' | 'interval' | 'monthly'
type MonthlySubMode = 'day' | 'nthWeekday' | 'everyN' | 'lastDay'

type ModalState =
  | { open: false }
  | { open: true; task: RepeatingTask | null }

function scheduleToMode(schedule: RepeatSchedule): ScheduleMode {
  if (schedule.type === 'daily') return 'daily'
  if (schedule.type === 'interval' || schedule.type === 'afterCompletion') return 'interval'
  if (schedule.type === 'weekdays') return 'weekly'
  if (schedule.type === 'monthlyDay' || schedule.type === 'monthlyNthWeekday' || schedule.type === 'everyNMonths' || schedule.type === 'monthlyLastDay') return 'monthly'
  return 'daily'
}

function scheduleToMonthlySubMode(schedule: RepeatSchedule): MonthlySubMode {
  if (schedule.type === 'monthlyNthWeekday') return 'nthWeekday'
  if (schedule.type === 'everyNMonths') return 'everyN'
  if (schedule.type === 'monthlyLastDay') return 'lastDay'
  return 'day'
}

export default function RepeatView() {
  const { repeatingTasks, saveRepeatingTask, removeRepeatingTask, projects } = useProjects()
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<ScheduleMode>('daily')
  const [everyN, setEveryN] = useState(3)
  const [afterCompletion, setAfterCompletion] = useState(false)
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [monthDay, setMonthDay] = useState(1)
  const [monthlySubMode, setMonthlySubMode] = useState<MonthlySubMode>('day')
  const [nthWeek, setNthWeek] = useState(1)
  const [nthWeekday, setNthWeekday] = useState(1)
  const [everyMonths, setEveryMonths] = useState(3)
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [showDateRange, setShowDateRange] = useState(false)
  const [link, setLink] = useState('')
  const [projectId, setProjectId] = useState<string | null>(null)

  const activeProjects = useMemo(() => projects.filter((p) => !p.archivedAt && !p.suspendedAt), [projects])

  const sorted = useMemo(() => [...repeatingTasks].sort((a, b) => a.order - b.order), [repeatingTasks])

  const resetForm = () => {
    setTitle('')
    setMode('daily')
    setEveryN(3)
    setAfterCompletion(false)
    setCustomDays([1, 2, 3, 4, 5])
    setMonthDay(1)
    setMonthlySubMode('day')
    setNthWeek(1)
    setNthWeekday(1)
    setEveryMonths(3)
    setStartDate(null)
    setEndDate(null)
    setShowDateRange(false)
    setLink('')
    setProjectId(null)
  }

  const openCreate = () => {
    resetForm()
    setModal({ open: true, task: null })
  }

  const openEdit = (task: RepeatingTask) => {
    setModal({ open: true, task })
    setTitle(task.title)
    setMode(scheduleToMode(task.schedule))
    setMonthlySubMode(scheduleToMonthlySubMode(task.schedule))
    setAfterCompletion(task.schedule.type === 'afterCompletion')

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

    if (task.schedule.type === 'monthlyDay') {
      setMonthDay(task.schedule.day)
    } else if (task.schedule.type === 'everyNMonths') {
      setMonthDay(task.schedule.day)
      setEveryMonths(task.schedule.months)
    } else {
      setMonthDay(new Date().getDate())
      setEveryMonths(3)
    }

    if (task.schedule.type === 'monthlyNthWeekday') {
      setNthWeek(task.schedule.week)
      setNthWeekday(task.schedule.weekday)
    } else {
      setNthWeek(1)
      setNthWeekday(1)
    }

    const hasDateRange = !!(task.startDate || task.endDate)
    setStartDate(task.startDate || null)
    setEndDate(task.endDate || null)
    setShowDateRange(hasDateRange)
    setLink(task.link || '')
    setProjectId(task.projectId || null)
  }

  const closeModal = () => setModal({ open: false })

  const buildSchedule = (): RepeatSchedule => {
    if (mode === 'daily') return { type: 'daily' }
    if (mode === 'weekly') return { type: 'weekdays', days: customDays.length > 0 ? [...customDays].sort((a, b) => a - b) : [1] }
    if (mode === 'interval') {
      const days = Math.max(1, everyN)
      return afterCompletion ? { type: 'afterCompletion', days } : { type: 'interval', days }
    }
    if (mode === 'monthly') {
      if (monthlySubMode === 'lastDay') return { type: 'monthlyLastDay' }
      if (monthlySubMode === 'nthWeekday') return { type: 'monthlyNthWeekday', week: nthWeek, weekday: nthWeekday }
      if (monthlySubMode === 'everyN') return { type: 'everyNMonths', months: Math.max(1, everyMonths), day: Math.max(1, Math.min(31, monthDay)) }
      return { type: 'monthlyDay', day: Math.max(1, Math.min(31, monthDay)) }
    }
    return { type: 'daily' }
  }

  const save = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const task = modal.open && modal.task

    const payload: RepeatingTask = task
      ? {
        ...task,
        title: trimmedTitle,
        schedule: buildSchedule(),
        startDate,
        endDate,
        link: link.trim() || null,
        projectId: projectId || null
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
        completedCount: 0,
        startDate,
        endDate,
        link: link.trim() || null,
        projectId: projectId || null
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

      {sorted.map((task) => {
        const proj = task.projectId ? projects.find((p) => p.id === task.projectId) : null
        return (
          <div key={task.id} className="repeat-item" style={{ cursor: 'pointer' }} onClick={() => openEdit(task)}>
            <span className="icon">↻</span>
            <span className="title"><Linkify text={task.title} /></span>
            {proj?.code && <span style={{ opacity: 0.45, fontSize: 11, marginLeft: 6 }}>[{proj.code}]</span>}
            {task.link && <span className="link" style={{ opacity: 0.5, fontSize: 12, marginLeft: 6 }}>🔗</span>}
            <span className="schedule">{formatSchedule(task.schedule)}</span>
          </div>
        )
      })}

      <button className="add-task-btn" style={{ marginTop: 8 }} onClick={openCreate}>
        <span className="plus">+</span> Add repeating task
      </button>

      <div className={`modal-overlay ${modal.open ? 'open' : ''}`} onClick={closeModal}>
        {modal.open && (
          <div className="modal" style={{ width: 380 }} onClick={(event) => event.stopPropagation()}>
            <h2>{modal.task ? 'Edit Repeating Task' : 'Add Repeating Task'}</h2>

            <div className="form-group">
              <label>Title</label>
              <input className="form-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Morning standup" />
            </div>

            <div className="form-group">
              <label>Link</label>
              <input className="form-input" value={link} onChange={(event) => setLink(event.target.value)} placeholder="Optional URL or file path" />
            </div>

            <div className="form-group">
              <label>Project</label>
              <select
                className="form-input"
                value={projectId || ''}
                onChange={(event) => setProjectId(event.target.value || null)}
              >
                <option value="">None</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Schedule</label>
              {/* Main tabs — 4 categories */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {([
                  ['daily', 'Daily'],
                  ['weekly', 'Weekly'],
                  ['interval', 'Interval'],
                  ['monthly', 'Monthly']
                ] as [ScheduleMode, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    className={`form-btn ${mode === key ? 'form-btn-primary' : 'form-btn-secondary'}`}
                    style={{ flex: 1, padding: '6px 0', fontSize: 12 }}
                    onClick={() => setMode(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Weekly — weekday picker */}
              {mode === 'weekly' && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {DAY_LABELS.map((label, index) => {
                    const day = (index + 1) % 7
                    const selected = customDays.includes(day)
                    return (
                      <button
                        key={label}
                        className={`form-btn ${selected ? 'form-btn-primary' : 'form-btn-secondary'}`}
                        style={{ flex: 1, padding: '5px 0', fontSize: 11, minWidth: 0 }}
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

              {/* Interval — every N days + from start / after completion toggle */}
              {mode === 'interval' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--c-text-secondary)' }}>Every</span>
                    <input
                      className="form-input"
                      type="number"
                      value={everyN}
                      min={1}
                      style={{ width: 56, textAlign: 'center' }}
                      onChange={(event) => setEveryN(Math.max(1, Number(event.target.value) || 1))}
                    />
                    <span style={{ fontSize: 13, color: 'var(--c-text-secondary)' }}>days</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className={`form-btn ${!afterCompletion ? 'form-btn-primary' : 'form-btn-secondary'}`}
                      style={{ flex: 1, padding: '4px 0', fontSize: 11 }}
                      onClick={() => setAfterCompletion(false)}
                    >
                      From start
                    </button>
                    <button
                      className={`form-btn ${afterCompletion ? 'form-btn-primary' : 'form-btn-secondary'}`}
                      style={{ flex: 1, padding: '4px 0', fontSize: 11 }}
                      onClick={() => setAfterCompletion(true)}
                    >
                      After completion
                    </button>
                  </div>
                </div>
              )}

              {/* Monthly — sub-mode selector + config */}
              {mode === 'monthly' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([
                      ['day', 'Day of month'],
                      ['lastDay', 'Last day'],
                      ['nthWeekday', 'Nth weekday'],
                      ['everyN', 'Every N mo.']
                    ] as [MonthlySubMode, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        className={`form-btn ${monthlySubMode === key ? 'form-btn-primary' : 'form-btn-secondary'}`}
                        style={{ flex: 1, padding: '4px 0', fontSize: 11 }}
                        onClick={() => setMonthlySubMode(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {monthlySubMode === 'day' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--c-text-secondary)' }}>On day</span>
                      <input
                        className="form-input"
                        type="number"
                        value={monthDay}
                        min={1}
                        max={31}
                        style={{ width: 56, textAlign: 'center' }}
                        onChange={(event) => setMonthDay(Math.max(1, Math.min(31, Number(event.target.value) || 1)))}
                      />
                      <span style={{ fontSize: 13, color: 'var(--c-text-secondary)' }}>every month</span>
                    </div>
                  )}

                  {monthlySubMode === 'nthWeekday' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <select
                        className="form-input"
                        style={{ width: 'auto' }}
                        value={nthWeek}
                        onChange={(event) => setNthWeek(Number(event.target.value))}
                      >
                        {ORDINAL.map((label, i) => (
                          <option key={i} value={i + 1}>{label}</option>
                        ))}
                      </select>
                      <select
                        className="form-input"
                        style={{ width: 'auto' }}
                        value={nthWeekday}
                        onChange={(event) => setNthWeekday(Number(event.target.value))}
                      >
                        {WEEKDAY_NAMES.map((name, i) => (
                          <option key={i} value={i}>{name}</option>
                        ))}
                      </select>
                      <span style={{ fontSize: 13, color: 'var(--c-text-secondary)' }}>every month</span>
                    </div>
                  )}

                  {monthlySubMode === 'everyN' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--c-text-secondary)' }}>Day</span>
                      <input
                        className="form-input"
                        type="number"
                        value={monthDay}
                        min={1}
                        max={31}
                        style={{ width: 56, textAlign: 'center' }}
                        onChange={(event) => setMonthDay(Math.max(1, Math.min(31, Number(event.target.value) || 1)))}
                      />
                      <span style={{ fontSize: 13, color: 'var(--c-text-secondary)' }}>every</span>
                      <input
                        className="form-input"
                        type="number"
                        value={everyMonths}
                        min={1}
                        style={{ width: 56, textAlign: 'center' }}
                        onChange={(event) => setEveryMonths(Math.max(1, Number(event.target.value) || 1))}
                      />
                      <span style={{ fontSize: 13, color: 'var(--c-text-secondary)' }}>months</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Collapsible date range */}
            {!showDateRange ? (
              <button
                onClick={() => setShowDateRange(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--c-text-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: '2px 0',
                  marginBottom: 14
                }}
              >
                + Set date range
              </button>
            ) : (
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ margin: 0 }}>Date range</label>
                  <button
                    onClick={() => { setShowDateRange(false); setStartDate(null); setEndDate(null) }}
                    style={{ background: 'none', border: 'none', color: 'var(--c-text-muted)', fontSize: 11, cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>From</span>
                  <input
                    className="form-input"
                    type="date"
                    value={startDate || ''}
                    style={{ width: 'auto', flex: 1, fontSize: 12 }}
                    onChange={(event) => setStartDate(event.target.value || null)}
                  />
                  <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>to</span>
                  <input
                    className="form-input"
                    type="date"
                    value={endDate || ''}
                    style={{ width: 'auto', flex: 1, fontSize: 12 }}
                    onChange={(event) => setEndDate(event.target.value || null)}
                  />
                </div>
              </div>
            )}

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
