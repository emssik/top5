import { useState, useRef, useEffect } from 'react'
import { nanoid } from 'nanoid'
import { useProjects } from '../hooks/useProjects'
import type { RepeatingTask, RepeatSchedule } from '../types'

const WEEKDAY_NAMES_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th']

function formatSchedule(schedule: RepeatSchedule): string {
  if (schedule.type === 'daily') return 'Daily'
  if (schedule.type === 'weekdays') {
    return schedule.days.map((d) => WEEKDAY_NAMES_FULL[d]).join(', ')
  }
  if (schedule.type === 'interval') return `Every ${schedule.days}d`
  if (schedule.type === 'afterCompletion') return `${schedule.days}d after done`
  if (schedule.type === 'monthlyDay') return `${schedule.day}. of month`
  if (schedule.type === 'monthlyNthWeekday') return `${ORDINAL[schedule.week - 1]} ${WEEKDAY_NAMES_FULL[schedule.weekday]}`
  if (schedule.type === 'everyNMonths') return `Every ${schedule.months}mo, ${schedule.day}.`
  return '?'
}

type ScheduleType = RepeatSchedule['type']

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function SchedulePicker({ schedule, onChange }: { schedule: RepeatSchedule; onChange: (s: RepeatSchedule) => void }) {
  const activeType = schedule.type
  const days = (schedule.type === 'interval' || schedule.type === 'afterCompletion') ? schedule.days : 3
  const weekdays = schedule.type === 'weekdays' ? schedule.days : [1, 2, 3, 4, 5]
  const monthlyDay = schedule.type === 'monthlyDay' ? schedule.day : (schedule.type === 'everyNMonths' ? schedule.day : 1)
  const nthWeek = schedule.type === 'monthlyNthWeekday' ? schedule.week : 1
  const nthWeekday = schedule.type === 'monthlyNthWeekday' ? schedule.weekday : 1
  const everyNMonths = schedule.type === 'everyNMonths' ? schedule.months : 3

  const setType = (type: ScheduleType) => {
    if (type === 'daily') onChange({ type: 'daily' })
    else if (type === 'weekdays') onChange({ type: 'weekdays', days: weekdays })
    else if (type === 'interval') onChange({ type: 'interval', days })
    else if (type === 'afterCompletion') onChange({ type: 'afterCompletion', days })
    else if (type === 'monthlyDay') onChange({ type: 'monthlyDay', day: monthlyDay })
    else if (type === 'monthlyNthWeekday') onChange({ type: 'monthlyNthWeekday', week: nthWeek, weekday: nthWeekday })
    else if (type === 'everyNMonths') onChange({ type: 'everyNMonths', months: everyNMonths, day: monthlyDay })
  }

  const tabs: { type: ScheduleType; label: string }[] = [
    { type: 'daily', label: 'Daily' },
    { type: 'weekdays', label: 'Days' },
    { type: 'interval', label: 'Every N' },
    { type: 'afterCompletion', label: 'After done' },
    { type: 'monthlyDay', label: 'Monthly' },
    { type: 'monthlyNthWeekday', label: 'Nth day' },
    { type: 'everyNMonths', label: 'N mo.' }
  ]

  return (
    <div className="space-y-2">
      {/* Type tabs */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.type}
            onClick={() => setType(t.type)}
            className={`text-[11px] px-2 py-1 rounded transition-colors ${
              activeType === t.type
                ? 'bg-blue-600/20 text-blue-400'
                : 'bg-surface text-t-muted hover:text-t-secondary hover:bg-hover'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Weekday picker */}
      {activeType === 'weekdays' && (
        <div className="flex items-center gap-1">
          {DAY_NAMES.map((name, i) => (
            <button
              key={i}
              onClick={() => {
                const next = weekdays.includes(i)
                  ? weekdays.filter((d) => d !== i)
                  : [...weekdays, i].sort()
                if (next.length > 0) onChange({ type: 'weekdays', days: next })
              }}
              className={`w-7 h-7 rounded text-[11px] font-medium transition-colors ${
                weekdays.includes(i)
                  ? 'bg-blue-600/25 text-blue-400'
                  : 'bg-surface text-t-muted hover:text-t-secondary'
              }`}
            >
              {name}
            </button>
          ))}
          {weekdays.length > 1 && (
            <button
              onClick={() => onChange({ type: 'weekdays', days: [weekdays[0]] })}
              className="ml-1 text-[10px] text-t-muted hover:text-t-secondary transition-colors"
              title="Clear all except first"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Interval input */}
      {(activeType === 'interval' || activeType === 'afterCompletion') && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-t-muted">
            {activeType === 'interval' ? 'Every' : 'Wait'}
          </span>
          <input
            type="number"
            min="1"
            value={days}
            onChange={(e) => {
              const v = Math.max(1, parseInt(e.target.value) || 1)
              onChange({ type: activeType, days: v })
            }}
            className="w-14 text-xs px-1.5 py-1 rounded bg-base border border-border text-t-primary focus:outline-none focus:border-t-secondary"
          />
          <span className="text-xs text-t-muted">
            {activeType === 'interval' ? 'days' : 'days after completion'}
          </span>
        </div>
      )}

      {/* Monthly day picker */}
      {activeType === 'monthlyDay' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-t-muted">Day</span>
          <input
            type="number"
            min="1"
            max="31"
            value={monthlyDay}
            onChange={(e) => {
              const v = Math.max(1, Math.min(31, parseInt(e.target.value) || 1))
              onChange({ type: 'monthlyDay', day: v })
            }}
            className="w-14 text-xs px-1.5 py-1 rounded bg-base border border-border text-t-primary focus:outline-none focus:border-t-secondary"
          />
          <span className="text-xs text-t-muted">of every month</span>
        </div>
      )}

      {/* Nth weekday picker */}
      {activeType === 'monthlyNthWeekday' && (
        <div className="flex items-center gap-2">
          <select
            value={nthWeek}
            onChange={(e) => onChange({ type: 'monthlyNthWeekday', week: parseInt(e.target.value), weekday: nthWeekday })}
            className="text-xs px-1.5 py-1 rounded bg-base border border-border text-t-primary focus:outline-none focus:border-t-secondary"
          >
            {ORDINAL.map((label, i) => (
              <option key={i} value={i + 1}>{label}</option>
            ))}
          </select>
          <select
            value={nthWeekday}
            onChange={(e) => onChange({ type: 'monthlyNthWeekday', week: nthWeek, weekday: parseInt(e.target.value) })}
            className="text-xs px-1.5 py-1 rounded bg-base border border-border text-t-primary focus:outline-none focus:border-t-secondary"
          >
            {WEEKDAY_NAMES_FULL.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
          <span className="text-xs text-t-muted">of every month</span>
        </div>
      )}

      {/* Every N months picker */}
      {activeType === 'everyNMonths' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-t-muted">Every</span>
          <input
            type="number"
            min="1"
            value={everyNMonths}
            onChange={(e) => {
              const v = Math.max(1, parseInt(e.target.value) || 1)
              onChange({ type: 'everyNMonths', months: v, day: monthlyDay })
            }}
            className="w-14 text-xs px-1.5 py-1 rounded bg-base border border-border text-t-primary focus:outline-none focus:border-t-secondary"
          />
          <span className="text-xs text-t-muted">months, day</span>
          <input
            type="number"
            min="1"
            max="31"
            value={monthlyDay}
            onChange={(e) => {
              const v = Math.max(1, Math.min(31, parseInt(e.target.value) || 1))
              onChange({ type: 'everyNMonths', months: everyNMonths, day: v })
            }}
            className="w-14 text-xs px-1.5 py-1 rounded bg-base border border-border text-t-primary focus:outline-none focus:border-t-secondary"
          />
        </div>
      )}
    </div>
  )
}

function DateRangePicker({ startDate, endDate, onChange }: {
  startDate?: string | null
  endDate?: string | null
  onChange: (start: string | null, end: string | null) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-t-muted">From</span>
        <input
          type="date"
          value={startDate || ''}
          onChange={(e) => onChange(e.target.value || null, endDate || null)}
          className="text-[11px] px-1.5 py-0.5 rounded bg-base border border-border text-t-primary focus:outline-none focus:border-t-secondary"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-t-muted">Until</span>
        <input
          type="date"
          value={endDate || ''}
          onChange={(e) => onChange(startDate || null, e.target.value || null)}
          className="text-[11px] px-1.5 py-0.5 rounded bg-base border border-border text-t-primary focus:outline-none focus:border-t-secondary"
        />
      </div>
      {(startDate || endDate) && (
        <button
          onClick={() => onChange(null, null)}
          className="text-[10px] text-t-muted hover:text-t-secondary transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}

export default function RepeatingTasksTab() {
  const { repeatingTasks, saveRepeatingTask, removeRepeatingTask, reorderRepeatingTasks } = useProjects()
  const [newTitle, setNewTitle] = useState('')
  const [newSchedule, setNewSchedule] = useState<RepeatSchedule>({ type: 'daily' })
  const [newStartDate, setNewStartDate] = useState<string | null>(null)
  const [newEndDate, setNewEndDate] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editingTitleRef = useRef('')
  const editingIdRef = useRef<string | null>(null)
  const [schedulePickerId, setSchedulePickerId] = useState<string | null>(null)
  const draggedId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setShowAddForm(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (showAddForm) addInputRef.current?.focus()
  }, [showAddForm])

  const sorted = [...repeatingTasks].sort((a, b) => a.order - b.order)

  const addTask = async () => {
    if (!newTitle.trim()) return
    const task: RepeatingTask = {
      id: nanoid(),
      title: newTitle.trim(),
      schedule: newSchedule,
      createdAt: new Date().toISOString(),
      lastCompletedAt: null,
      order: repeatingTasks.length,
      acceptedCount: 0,
      dismissedCount: 0,
      completedCount: 0,
      startDate: newStartDate,
      endDate: newEndDate
    }
    await saveRepeatingTask(task)
    setNewTitle('')
    setNewSchedule({ type: 'daily' })
    setNewStartDate(null)
    setNewEndDate(null)
    setShowAddForm(false)
  }

  const startEditing = (task: RepeatingTask) => {
    editingIdRef.current = task.id
    editingTitleRef.current = task.title
    setEditingId(task.id)
    setEditingTitle(task.title)
  }

  const saveEdit = () => {
    const id = editingIdRef.current
    const title = editingTitleRef.current
    if (!id || !title.trim()) {
      editingIdRef.current = null
      setEditingId(null)
      return
    }
    editingIdRef.current = null
    setEditingId(null)
    const task = useProjects.getState().repeatingTasks.find((t) => t.id === id)
    if (task) saveRepeatingTask({ ...task, title: title.trim() })
  }

  const cancelEdit = () => {
    editingIdRef.current = null
    setEditingId(null)
  }

  const handleDragStart = (id: string) => { draggedId.current = id }
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id) }
  const handleDrop = async (targetId: string) => {
    if (!draggedId.current || draggedId.current === targetId) return
    const ids = sorted.map((t) => t.id)
    const fromIdx = ids.indexOf(draggedId.current)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) return
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, draggedId.current)
    await reorderRepeatingTasks(ids)
    draggedId.current = null
    setDragOverId(null)
  }
  const handleDragEnd = () => { draggedId.current = null; setDragOverId(null) }

  return (
    <div className="space-y-1">
      {sorted.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center h-40 text-t-secondary">
          <p className="text-sm">No repeating tasks yet</p>
          <p className="text-xs text-t-muted mt-1">Add tasks that repeat on a schedule</p>
        </div>
      )}

      <div className="space-y-1" onDragEnd={handleDragEnd}>
        {sorted.map((task) => {
          const isDragOver = dragOverId === task.id && draggedId.current !== task.id

          return (
            <div key={task.id}>
              <div
                className={`group flex items-center gap-2 py-1.5 px-3 rounded-lg bg-card border transition-colors cursor-grab active:cursor-grabbing ${
                  isDragOver ? 'border-blue-500/50' : 'border-border-subtle'
                }`}
                draggable
                onDragStart={() => handleDragStart(task.id)}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDrop={() => handleDrop(task.id)}
              >
                <span className="text-t-muted text-sm flex-shrink-0" style={{ opacity: 0.5 }}>↻</span>
                <div className="flex-1 min-w-0">
                  {editingId === task.id ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => { setEditingTitle(e.target.value); editingTitleRef.current = e.target.value }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      onBlur={saveEdit}
                      className="w-full text-sm bg-surface border border-border rounded px-1 py-0.5 text-t-primary focus:outline-none focus:border-t-secondary"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => startEditing(task)}
                      className="text-sm text-t-primary truncate block cursor-default"
                    >
                      {task.title}
                    </span>
                  )}
                </div>
                {((task.acceptedCount || 0) + (task.dismissedCount || 0) + (task.completedCount || 0) > 0) && (
                  <span className="text-[10px] text-t-muted flex-shrink-0 tabular-nums">
                    {(task.completedCount || 0) > 0 && <span title="Completed">✓{task.completedCount}</span>}
                    {(task.completedCount || 0) > 0 && ((task.dismissedCount || 0) > 0 || (task.acceptedCount || 0) > 0) && ' '}
                    {(task.dismissedCount || 0) > 0 && <span title="Skipped">✕{task.dismissedCount}</span>}
                    {(task.dismissedCount || 0) > 0 && (task.acceptedCount || 0) > 0 && ' '}
                    {(task.acceptedCount || 0) > 0 && <span title="Accepted">↓{task.acceptedCount}</span>}
                  </span>
                )}
                <button
                  onClick={() => setSchedulePickerId(schedulePickerId === task.id ? null : task.id)}
                  className="text-[10px] px-2 py-0.5 rounded bg-surface hover:bg-hover text-t-muted hover:text-t-secondary transition-colors flex-shrink-0"
                >
                  {formatSchedule(task.schedule)}
                </button>
                <button
                  onClick={() => removeRepeatingTask(task.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-surface hover:bg-hover text-t-secondary hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove"
                >
                  ✕
                </button>
              </div>

              {schedulePickerId === task.id && (
                <div className="ml-7 mt-1 mb-2 p-2.5 rounded-lg bg-surface border border-border space-y-2">
                  <SchedulePicker
                    schedule={task.schedule}
                    onChange={(schedule) => {
                      const fresh = useProjects.getState().repeatingTasks.find((t) => t.id === task.id)
                      if (fresh) saveRepeatingTask({ ...fresh, schedule })
                    }}
                  />
                  <DateRangePicker
                    startDate={task.startDate}
                    endDate={task.endDate}
                    onChange={(startDate, endDate) => {
                      const fresh = useProjects.getState().repeatingTasks.find((t) => t.id === task.id)
                      if (fresh) saveRepeatingTask({ ...fresh, startDate, endDate })
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add new repeating task */}
      <div className="pt-2">
        {showAddForm ? (
          <div className="p-3 rounded-lg bg-card border border-border-subtle space-y-3">
            <input
              ref={addInputRef}
              autoFocus
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim()) addTask()
                if (e.key === 'Escape') { setShowAddForm(false); setNewTitle(''); setNewSchedule({ type: 'daily' }); setNewStartDate(null); setNewEndDate(null) }
              }}
              placeholder="Task name..."
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-t-primary text-sm placeholder:text-t-muted focus:outline-none focus:border-t-secondary"
            />
            <SchedulePicker schedule={newSchedule} onChange={setNewSchedule} />
            <DateRangePicker
              startDate={newStartDate}
              endDate={newEndDate}
              onChange={(s, e) => { setNewStartDate(s); setNewEndDate(e) }}
            />
            <div className="flex gap-2">
              <button
                onClick={addTask}
                disabled={!newTitle.trim()}
                className="px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs transition-colors disabled:opacity-30"
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewTitle(''); setNewSchedule({ type: 'daily' }); setNewStartDate(null); setNewEndDate(null) }}
                className="px-3 py-1 rounded-lg bg-surface hover:bg-hover text-t-muted text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-t-muted hover:text-t-secondary text-sm transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add repeating task
          </button>
        )}
      </div>
    </div>
  )
}
