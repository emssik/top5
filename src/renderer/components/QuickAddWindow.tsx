import { useState, useEffect, useRef, useCallback } from 'react'
import { nanoid } from 'nanoid'
import type { Project, ProjectColor, QuickTask, RepeatSchedule, RepeatingTask, AppData } from '../types'
import { PROJECT_COLORS, projectColorValue, firstAvailableProjectColor } from '../utils/projects'
import { sortWeekdays, dateKey } from '../../shared/schedule'
import { buildQuickAddSchedule } from '../../shared/quick-add'

type Mode = 'task' | 'project' | 'repeat'
type ScheduleType = 'daily' | 'weekdays' | 'weekly' | 'interval' | 'monthly' | 'afterDone'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0]

export default function QuickAddWindow() {
  const [mode, setMode] = useState<Mode>('task')
  const [inputValue, setInputValue] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [pinToToday, setPinToToday] = useState(false)
  const [inProgress, setInProgress] = useState(false)
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [color, setColor] = useState<ProjectColor>('green')
  const [description, setDescription] = useState('')
  const [firstTask, setFirstTask] = useState('')
  const [scheduleType, setScheduleType] = useState<ScheduleType>('daily')
  const [weekdays, setWeekdays] = useState<number[]>([1]) // Monday
  const [intervalDays, setIntervalDays] = useState(3)
  const [afterDoneDays, setAfterDoneDays] = useState(1)
  const [monthlyDay, setMonthlyDay] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const firstTaskRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Load data — apply theme BEFORE first visible render
  useEffect(() => {
    window.api.getAppData().then((data: AppData) => {
      if (data.config.theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light')
      } else {
        document.documentElement.removeAttribute('data-theme')
      }
      const active = data.projects.filter((p) => !p.archivedAt)
      setProjects(active)
      setColor(firstAvailableProjectColor(active))
      setLoaded(true)
    })
  }, [])

  // Auto-focus input
  useEffect(() => {
    if (loaded) inputRef.current?.focus()
  }, [mode, loaded])

  // Auto-resize window to fit content
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const h = el.scrollHeight
      if (h > 0) window.api.resizeQuickAddWindow(Math.ceil(h))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [loaded])

  const buildSchedule = useCallback((): RepeatSchedule => {
    return buildQuickAddSchedule({
      scheduleType,
      weekdays,
      intervalDays,
      monthlyDay,
      afterDoneDays
    }) as RepeatSchedule
  }, [scheduleType, weekdays, intervalDays, monthlyDay, afterDoneDays])

  const handleSubmit = useCallback(async (): Promise<boolean> => {
    const title = inputValue.trim()
    if (!title) {
      inputRef.current?.focus()
      return false
    }

    let msg = ''
    try {
      if (mode === 'task') {
        if (selectedProjectId) {
          const data = await window.api.getAppData()
          const project = data.projects.find((p) => p.id === selectedProjectId)
          if (project) {
            const newTask = {
              id: nanoid(),
              title,
              completed: false,
              createdAt: new Date().toISOString(),
              isToDoNext: pinToToday,
              inProgress,
              ...(dueDate ? { dueDate } : {})
            }
            await window.api.saveProject({ ...project, tasks: [...project.tasks, newTask] })
            msg = `Task added to ${project.name}`
          }
        } else {
          const data = await window.api.getAppData()
          const maxOrder = data.quickTasks.reduce((m, t) => Math.max(m, t.order), 0)
          const task: QuickTask = {
            id: nanoid(),
            title,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null,
            order: maxOrder + 1,
            inProgress,
            ...(dueDate ? { dueDate } : {})
          }
          await window.api.saveQuickTask(task)
          msg = `Quick task added: "${title}"`
        }
      } else if (mode === 'project') {
        const data = await window.api.getAppData()
        const maxOrder = data.projects.reduce((m, p) => Math.max(m, p.order), -1)
        const tasks = firstTask.trim()
          ? [{ id: nanoid(), title: firstTask.trim(), completed: false, createdAt: new Date().toISOString() }]
          : []
        const project: Project = {
          id: nanoid(),
          name: title,
          description,
          order: maxOrder + 1,
          deadline: null,
          totalTimeMs: 0,
          timerStartedAt: null,
          color,
          tasks,
          archivedAt: null,
          suspendedAt: null
        }
        await window.api.saveProject(project)
        msg = `Project "${title}" created!`
      } else if (mode === 'repeat') {
        const data = await window.api.getAppData()
        const maxOrder = data.repeatingTasks.reduce((m, t) => Math.max(m, t.order), -1)
        const task: RepeatingTask = {
          id: nanoid(),
          title,
          schedule: buildSchedule(),
          createdAt: new Date().toISOString(),
          lastCompletedAt: null,
          order: maxOrder + 1,
          acceptedCount: 0,
          dismissedCount: 0,
          completedCount: 0
        }
        await window.api.saveRepeatingTask(task)
        msg = `Repeating task "${title}" created!`
      }

      setInputValue('')
      setToast(msg)
      setTimeout(() => setToast(null), 2500)
      inputRef.current?.focus()
      return true
    } catch (err) {
      console.error('Quick add failed:', err)
      return false
    }
  }, [inputValue, mode, selectedProjectId, pinToToday, inProgress, dueDate, color, description, firstTask, buildSchedule])

  const switchMode = useCallback((next: Mode) => {
    setMode(next)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        window.api.closeQuickAddWindow()
        return
      }

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'TEXTAREA') return
        e.preventDefault()
        handleSubmit().then((ok) => { if (ok) window.api.closeQuickAddWindow() })
        return
      }

      if (e.key === 'Enter') {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'TEXTAREA') return
        e.preventDefault()
        handleSubmit()
        return
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        const modes: Mode[] = ['task', 'project', 'repeat']
        const idx = modes.indexOf(mode)
        const next = e.shiftKey
          ? modes[(idx - 1 + modes.length) % modes.length]
          : modes[(idx + 1) % modes.length]
        switchMode(next)
        return
      }

      if (e.metaKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        if (mode !== 'task') switchMode('task')
        const idx = parseInt(e.key) - 1
        if (idx < projects.length) {
          setSelectedProjectId(projects[idx].id)
        }
        return
      }

      // Cmd+A..Z for projects 10+
      if (e.metaKey && /^[a-z]$/.test(e.key)) {
        const letterIdx = e.key.charCodeAt(0) - 97 // a=0, b=1, ...
        const projectIdx = 9 + letterIdx
        if (projectIdx < projects.length) {
          e.preventDefault()
          if (mode !== 'task') switchMode('task')
          setSelectedProjectId(projects[projectIdx].id)
        }
        return
      }

      if (e.metaKey && e.key === '0') {
        e.preventDefault()
        if (mode !== 'task') switchMode('task')
        setSelectedProjectId(null)
        return
      }

      if (mode === 'task' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        // null = standalone (index -1), then projects[0..n]
        const currentIdx = selectedProjectId ? projects.findIndex((p) => p.id === selectedProjectId) : -1
        let nextIdx: number
        if (e.key === 'ArrowDown') {
          nextIdx = Math.min(currentIdx + 1, projects.length - 1)
        } else {
          nextIdx = currentIdx - 1
        }
        setSelectedProjectId(nextIdx < 0 ? null : projects[nextIdx]?.id ?? null)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, projects, selectedProjectId, handleSubmit, switchMode])

  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null

  if (!loaded) return null

  return (
    <div ref={rootRef} className="bg-card rounded-[14px] overflow-hidden flex flex-col">
        {/* Input area */}
        <div className="px-[18px] pt-4 pb-3">
          <div className="flex items-center gap-[10px]">
            <span className="text-lg text-t-muted w-6 text-center shrink-0">
              {mode === 'task' ? '+' : mode === 'project' ? '\u25FB' : '\u21BB'}
            </span>
            <input
              ref={inputRef}
              className="flex-1 bg-transparent border-none text-[17px] text-t-primary outline-none font-normal"
              style={{ letterSpacing: '-0.2px' }}
              placeholder={mode === 'task' ? 'Add a task...' : mode === 'project' ? 'Project name...' : 'Repeating task name...'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              spellCheck={false}
            />
            {mode === 'task' && selectedProject && (
              <button
                className="flex items-center gap-[5px] px-2 py-[3px] rounded-[5px] bg-surface border border-b-subtle text-[11px] text-t-secondary shrink-0 hover:border-border"
                onClick={() => setSelectedProjectId(null)}
              >
                <span className="w-[6px] h-[6px] rounded-full" style={{ background: projectColorValue(selectedProject.color) }} />
                {selectedProject.name}
                <span className="text-[9px] text-t-muted ml-[2px]">{'\u2715'}</span>
              </button>
            )}
            <span className="text-[10px] px-[6px] py-[2px] rounded bg-surface border border-b-subtle text-t-muted shrink-0">
              esc
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-[2px] px-[18px] mb-3">
          {([
            { key: 'task' as Mode, icon: '+', label: 'Task' },
            { key: 'project' as Mode, icon: '\u25FB', label: 'Project' },
            { key: 'repeat' as Mode, icon: '\u21BB', label: 'Repeating' }
          ]).map((tab) => (
            <button
              key={tab.key}
              className={`px-3 py-[5px] rounded-md text-xs flex items-center gap-[5px] transition-all ${
                mode === tab.key
                  ? 'text-t-primary bg-surface font-medium'
                  : 'text-t-muted hover:text-t-secondary hover:bg-surface'
              }`}
              onClick={() => switchMode(tab.key)}
            >
              <span className="text-[11px] opacity-60">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-b-subtle mx-[18px]" />

        {/* Content panels */}
        <div className="px-[18px] py-3 min-h-[60px] overflow-y-auto">
          {mode === 'task' && (
            <TaskPanel
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              pinToToday={pinToToday}
              onTogglePin={() => setPinToToday(!pinToToday)}
              inProgress={inProgress}
              onToggleInProgress={() => setInProgress(!inProgress)}
              dueDate={dueDate}
              onDueDateChange={setDueDate}
            />
          )}
          {mode === 'project' && (
            <ProjectPanel
              color={color}
              onColorChange={setColor}
              description={description}
              onDescriptionChange={setDescription}
              firstTask={firstTask}
              onFirstTaskChange={setFirstTask}
              firstTaskRef={firstTaskRef}
              descRef={descRef}
            />
          )}
          {mode === 'repeat' && (
            <RepeatPanel
              scheduleType={scheduleType}
              onScheduleTypeChange={setScheduleType}
              weekdays={weekdays}
              onWeekdaysChange={setWeekdays}
              intervalDays={intervalDays}
              onIntervalDaysChange={setIntervalDays}
              afterDoneDays={afterDoneDays}
              onAfterDoneDaysChange={setAfterDoneDays}
              monthlyDay={monthlyDay}
              onMonthlyDayChange={setMonthlyDay}
            />
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="px-[18px] py-[6px] text-[12px] flex items-center gap-[6px]" style={{ color: 'var(--pc-green)' }}>
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'rgba(34,197,94,0.12)' }}>✓</span>
            {toast}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-[18px] py-[10px] bg-elevated border-t border-b-subtle">
          <div className="flex gap-[14px]">
            <span className="flex items-center gap-[5px] text-[11px] text-t-muted">
              <kbd className="text-[10px] px-[5px] py-[1px] rounded-[3px] bg-surface border border-b-subtle">Tab</kbd>
              switch mode
            </span>
            <span className="flex items-center gap-[5px] text-[11px] text-t-muted">
              <kbd className="text-[10px] px-[5px] py-[1px] rounded-[3px] bg-surface border border-b-subtle">{'\u2318\u23CE'}</kbd>
              add & close
            </span>
          </div>
          <button
            className="px-[14px] py-[5px] rounded-[7px] text-xs font-medium flex items-center gap-[5px] transition-all"
            style={{
              background: 'rgba(59,130,246,0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(59,130,246,0.3)'
            }}
            onClick={() => handleSubmit()}
          >
            {mode === 'project' ? 'Create' : 'Add'}
            <kbd className="text-[9px] px-[3px] rounded-sm" style={{ background: 'rgba(59,130,246,0.2)' }}>{'\u23CE'}</kbd>
          </button>
        </div>
      </div>
  )
}

// ── Task Panel ──

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return dateKey(d)
}

function formatDueDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CAL_DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function MiniCalendar({ onSelect, onClose }: { onSelect: (date: string) => void; onClose: () => void }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const firstDay = new Date(year, month, 1)
  // Monday=0 offset
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0) }
    else setMonth(month + 1)
  }

  const todayKey = dateKey(today)
  const cells: (number | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="mt-2 p-2 rounded-lg border border-b-subtle bg-surface">
      <div className="flex items-center justify-between mb-1">
        <button className="text-[11px] text-t-muted hover:text-t-primary px-1" onClick={prevMonth}>{'\u2039'}</button>
        <span className="text-[11px] font-medium text-t-primary">{MONTH_NAMES[month]} {year}</span>
        <button className="text-[11px] text-t-muted hover:text-t-primary px-1" onClick={nextMonth}>{'\u203A'}</button>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {CAL_DOW.map((d, i) => (
          <span key={i} className="text-[9px] text-t-muted text-center py-[2px]">{d}</span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />
          const dk = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = dk === todayKey
          const isPast = dk < todayKey
          return (
            <button
              key={dk}
              className={`text-[11px] rounded-[4px] py-[2px] transition-colors ${
                isToday
                  ? 'bg-blue-500/20 text-blue-400 font-semibold'
                  : isPast
                    ? 'text-t-muted/40 cursor-default'
                    : 'text-t-secondary hover:bg-hover hover:text-t-primary'
              }`}
              disabled={isPast}
              onClick={() => { if (!isPast) { onSelect(dk); onClose() } }}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TaskPanel({
  projects,
  selectedProjectId,
  onSelectProject,
  pinToToday,
  onTogglePin,
  inProgress,
  onToggleInProgress,
  dueDate,
  onDueDateChange
}: {
  projects: Project[]
  selectedProjectId: string | null
  onSelectProject: (id: string | null) => void
  pinToToday: boolean
  onTogglePin: () => void
  inProgress: boolean
  onToggleInProgress: () => void
  dueDate: string | null
  onDueDateChange: (date: string | null) => void
}) {
  const [showDatePicker, setShowDatePicker] = useState(false)

  return (
    <>
      <div className="mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-t-muted mb-1">
          Add to
        </div>
        <div className="grid grid-cols-3 gap-x-[2px]">
          {projects.map((project, i) => {
            const shortcut = i < 9 ? String(i + 1) : String.fromCharCode(65 + i - 9)
            return (
              <button
                key={project.id}
                className={`flex items-center gap-[4px] px-[5px] py-[3px] rounded-[5px] transition-all border-[1.5px] text-left min-w-0 ${
                  selectedProjectId === project.id
                    ? 'bg-surface border-border'
                    : 'border-transparent hover:bg-hover'
                }`}
                onClick={() => onSelectProject(project.id)}
              >
                <span className={`text-[9px] font-semibold tabular-nums shrink-0 ${
                  selectedProjectId === project.id ? '' : 'text-t-muted'
                }`} style={selectedProjectId === project.id ? { color: 'var(--pc-blue)' } : undefined}>
                  {'\u2318'}{shortcut}
                </span>
                <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: projectColorValue(project.color) }} />
                <span className="text-[11px] text-t-primary truncate flex-1">{project.name}</span>
                {selectedProjectId === project.id && (
                  <span className="text-[10px]" style={{ color: 'var(--pc-blue)' }}>✓</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          className={`flex items-center gap-1 px-[10px] py-1 rounded-md text-[11px] border transition-all ${
            pinToToday
              ? 'border-blue-500/30 text-blue-400 bg-blue-500/[0.08]'
              : 'border-b-subtle text-t-muted bg-surface hover:text-t-secondary hover:border-border'
          }`}
          onClick={onTogglePin}
        >
          <span className="text-[10px]">{'\uD83D\uDCCC'}</span> Pin to Today
        </button>
        <button
          className={`flex items-center gap-1 px-[10px] py-1 rounded-md text-[11px] border transition-all ${
            inProgress
              ? 'border-blue-500/30 text-blue-400 bg-blue-500/[0.08]'
              : 'border-b-subtle text-t-muted bg-surface hover:text-t-secondary hover:border-border'
          }`}
          onClick={onToggleInProgress}
        >
          <span className="text-[10px]">{'\u25B6'}</span> In Progress
        </button>
        <button
          className={`flex items-center gap-1 px-[10px] py-1 rounded-md text-[11px] border transition-all ${
            dueDate
              ? 'border-blue-500/30 text-blue-400 bg-blue-500/[0.08]'
              : 'border-b-subtle text-t-muted bg-surface hover:text-t-secondary hover:border-border'
          }`}
          onClick={() => {
            if (dueDate) {
              onDueDateChange(null)
              setShowDatePicker(false)
            } else {
              setShowDatePicker(!showDatePicker)
            }
          }}
        >
          <span className="text-[10px]">{'\uD83D\uDCC5'}</span>
          {dueDate ? formatDueDate(dueDate) : 'Schedule'}
          {dueDate && <span className="text-[9px] ml-[2px]">{'\u2715'}</span>}
        </button>
      </div>

      {showDatePicker && !dueDate && (
        <>
          <div className="flex items-center gap-[6px] mt-2">
            {[
              { label: 'Tomorrow', days: 1 },
              { label: '+2d', days: 2 },
              { label: '+3d', days: 3 },
              { label: '+1w', days: 7 }
            ].map((opt) => (
              <button
                key={opt.label}
                className="px-[8px] py-[4px] rounded-[5px] text-[11px] border border-b-subtle text-t-secondary bg-surface hover:border-border hover:text-t-primary transition-all"
                onClick={() => {
                  onDueDateChange(addDays(opt.days))
                  setShowDatePicker(false)
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <MiniCalendar onSelect={onDueDateChange} onClose={() => setShowDatePicker(false)} />
        </>
      )}
    </>
  )
}

// ── Project Panel ──

function ProjectPanel({
  color,
  onColorChange,
  description,
  onDescriptionChange,
  firstTask,
  onFirstTaskChange,
  firstTaskRef,
  descRef
}: {
  color: ProjectColor
  onColorChange: (c: ProjectColor) => void
  description: string
  onDescriptionChange: (v: string) => void
  firstTask: string
  onFirstTaskChange: (v: string) => void
  firstTaskRef: React.Ref<HTMLInputElement>
  descRef: React.Ref<HTMLTextAreaElement>
}) {
  return (
    <>
      <div className="mb-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-t-muted mb-[5px]">
          Description
        </div>
        <textarea
          ref={descRef}
          className="w-full px-[10px] py-[7px] rounded-md border border-border bg-surface text-t-primary text-[13px] outline-none resize-y min-h-[44px] max-h-[100px] transition-colors focus:border-t-secondary"
          placeholder="Optional description..."
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>

      <div className="mb-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-t-muted mb-[5px]">
          Color
        </div>
        <div className="flex gap-[6px]">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              className={`w-[22px] h-[22px] rounded-full border-2 transition-all hover:scale-110 ${
                color === c ? 'border-t-primary' : 'border-transparent'
              }`}
              style={{
                background: projectColorValue(c),
                boxShadow: color === c ? `0 0 0 2px var(--bg-card)` : undefined
              }}
              onClick={() => onColorChange(c)}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-t-muted mb-[5px]">
          First task <span className="font-normal normal-case tracking-normal opacity-60">(optional)</span>
        </div>
        <input
          ref={firstTaskRef}
          className="w-full px-[10px] py-[7px] rounded-md border border-border bg-surface text-t-primary text-[13px] outline-none transition-colors focus:border-t-secondary"
          placeholder="e.g. Setup project repo"
          value={firstTask}
          onChange={(e) => onFirstTaskChange(e.target.value)}
        />
      </div>
    </>
  )
}

// ── Repeat Panel ──

function RepeatPanel({
  scheduleType,
  onScheduleTypeChange,
  weekdays,
  onWeekdaysChange,
  intervalDays,
  onIntervalDaysChange,
  afterDoneDays,
  onAfterDoneDaysChange,
  monthlyDay,
  onMonthlyDayChange
}: {
  scheduleType: ScheduleType
  onScheduleTypeChange: (t: ScheduleType) => void
  weekdays: number[]
  onWeekdaysChange: (d: number[]) => void
  intervalDays: number
  onIntervalDaysChange: (n: number) => void
  afterDoneDays: number
  onAfterDoneDaysChange: (n: number) => void
  monthlyDay: number
  onMonthlyDayChange: (n: number) => void
}) {
  const toggleWeekday = (day: number) => {
    onWeekdaysChange(
      weekdays.includes(day)
        ? weekdays.filter((d) => d !== day)
        : sortWeekdays([...weekdays, day])
    )
  }

  const scheduleOptions: { key: ScheduleType; label: string }[] = [
    { key: 'daily', label: 'Every day' },
    { key: 'weekdays', label: 'Weekdays' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'interval', label: 'Every N days' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'afterDone', label: 'After done' }
  ]

  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-t-muted mb-[5px]">
        Schedule
      </div>
      <div className="flex gap-1 flex-wrap">
        {scheduleOptions.map((opt) => (
          <button
            key={opt.key}
            className={`px-[10px] py-[5px] rounded-md text-[11px] border transition-all ${
              scheduleType === opt.key
                ? 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                : 'border-b-subtle text-t-secondary bg-surface hover:border-border hover:text-t-primary'
            }`}
            onClick={() => onScheduleTypeChange(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {(scheduleType === 'weekly' || scheduleType === 'weekdays') && (
        <div className="flex gap-[3px] mt-2">
          {WEEKDAY_LABELS.map((label, i) => {
            const day = WEEKDAY_VALUES[i]
            const isActive = scheduleType === 'weekdays'
              ? i < 5
              : weekdays.includes(day)
            return (
              <button
                key={day}
                className={`w-[34px] h-7 rounded-[5px] text-[11px] flex items-center justify-center border transition-all ${
                  isActive
                    ? 'border-blue-500/30 text-blue-400 bg-blue-500/[0.15]'
                    : 'border-b-subtle text-t-secondary bg-surface hover:border-border hover:text-t-primary'
                }`}
                onClick={() => {
                  if (scheduleType === 'weekly') toggleWeekday(day)
                }}
                disabled={scheduleType === 'weekdays'}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {scheduleType === 'interval' && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-t-secondary">Every</span>
          <input
            className="w-[52px] px-2 py-[5px] rounded-[5px] border border-border bg-surface text-t-primary text-[13px] text-center outline-none focus:border-t-secondary"
            type="number"
            min={1}
            max={365}
            value={intervalDays}
            onChange={(e) => onIntervalDaysChange(parseInt(e.target.value) || 1)}
          />
          <span className="text-xs text-t-secondary">days</span>
        </div>
      )}

      {scheduleType === 'afterDone' && (
        <div className="flex items-center gap-2 mt-2">
          <input
            className="w-[52px] px-2 py-[5px] rounded-[5px] border border-border bg-surface text-t-primary text-[13px] text-center outline-none focus:border-t-secondary"
            type="number"
            min={1}
            max={365}
            value={afterDoneDays}
            onChange={(e) => onAfterDoneDaysChange(parseInt(e.target.value) || 1)}
          />
          <span className="text-xs text-t-secondary">days after completion</span>
        </div>
      )}

      {scheduleType === 'monthly' && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-t-secondary">Day</span>
          <input
            className="w-[52px] px-2 py-[5px] rounded-[5px] border border-border bg-surface text-t-primary text-[13px] text-center outline-none focus:border-t-secondary"
            type="number"
            min={1}
            max={31}
            value={monthlyDay}
            onChange={(e) => onMonthlyDayChange(parseInt(e.target.value) || 1)}
          />
          <span className="text-xs text-t-secondary">of every month</span>
        </div>
      )}
    </div>
  )
}
