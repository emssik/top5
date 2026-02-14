import { useEffect, useMemo, useState } from 'react'
import type { OperationLogEntry, OperationType } from '../types'

type LogRange = 'today' | '7d' | '30d'

const rangeOptions: { key: LogRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' }
]

const typeColors: Record<OperationType, string> = {
  task_created: '#22c55e',
  task_completed: '#3b82f6',
  task_uncompleted: '#f59e0b',
  task_deleted: '#ef4444',
  quick_task_created: '#22c55e',
  quick_task_completed: '#3b82f6',
  quick_task_uncompleted: '#f59e0b',
  quick_task_deleted: '#ef4444',
  project_created: '#22c55e',
  project_updated: '#f59e0b',
  project_archived: '#ef4444',
  project_unarchived: '#22c55e',
  project_suspended: '#f59e0b',
  project_unsuspended: '#22c55e',
  project_deleted: '#ef4444',
  task_moved: '#8b5cf6',
  focus_started: '#a855f7',
  focus_ended: '#a855f7',
  wins_day_won: '#4ade80',
  wins_day_lost: '#f87171',
  wins_week_won: '#4ade80',
  wins_week_lost: '#f87171',
  wins_month_won: '#4ade80',
  wins_month_lost: '#f87171'
}

function describeOperation(entry: OperationLogEntry): string {
  const project = entry.projectName ? ` in Project ${entry.projectName}` : ''
  const code = entry.taskCode ? `[${entry.taskCode}] ` : ''
  const task = entry.taskTitle ? `${code}"${entry.taskTitle}"` : ''
  const details = entry.details ? ` (${entry.details})` : ''

  switch (entry.type) {
    case 'task_created': return `Created task ${task}${project}`
    case 'task_completed': return `Completed task ${task}${project}${details}`
    case 'task_uncompleted': return `Reopened task ${task}${project}`
    case 'task_deleted': return `Deleted task ${task}${project}`
    case 'task_moved': return `Moved task ${task} to Project ${entry.projectName ?? ''}${details}`
    case 'quick_task_created': return `Created quick task ${task}`
    case 'quick_task_completed': return `Completed quick task ${task}${details}`
    case 'quick_task_uncompleted': return `Reopened quick task ${task}`
    case 'quick_task_deleted': return `Deleted quick task ${task}`
    case 'project_created': return `Created Project ${entry.projectName ?? ''}`
    case 'project_updated': return `Updated Project ${entry.projectName ?? ''}`
    case 'project_archived': return `Archived Project ${entry.projectName ?? ''}`
    case 'project_unarchived': return `Unarchived Project ${entry.projectName ?? ''}`
    case 'project_suspended': return `Suspended Project ${entry.projectName ?? ''}`
    case 'project_unsuspended': return `Resumed Project ${entry.projectName ?? ''}`
    case 'project_deleted': return `Deleted Project ${entry.projectName ?? ''}`
    case 'focus_started': return `Focus started: ${task || entry.projectName || 'task'}${project}`
    case 'focus_ended': return `Focus ended: ${task || entry.projectName || 'task'}${details}`
    case 'wins_day_won': return `🏆 Day won!${details}`
    case 'wins_day_lost': return `Day lost${details}`
    case 'wins_week_won': return `🏆 Week won!${details}`
    case 'wins_week_lost': return `Week streak lost`
    case 'wins_month_won': return `🏆 Month won!${details}`
    case 'wins_month_lost': return `Month streak lost`
    default: return entry.type
  }
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function dayLabel(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const entryDay = iso.slice(0, 10)

  if (entryDay === today) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (entryDay === yesterday.toISOString().slice(0, 10)) return 'Yesterday'

  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function getInitialFilter(): string {
  const hash = window.location.hash
  const qIdx = hash.indexOf('?')
  if (qIdx < 0) return ''
  const params = new URLSearchParams(hash.slice(qIdx + 1))
  return params.get('filter') ?? ''
}

export default function OperationLogView() {
  const [operations, setOperations] = useState<OperationLogEntry[]>([])
  const [range, setRange] = useState<LogRange>(getInitialFilter() ? '30d' : 'today')
  const [filter, setFilter] = useState(getInitialFilter)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'task' | 'project' | 'focus' | 'wins'>('all')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.api.getOperations().then((ops) => {
      setOperations(ops ?? [])
      setLoaded(true)
    })
  }, [])

  const filtered = useMemo(() => {
    const now = new Date()
    let since: Date
    if (range === 'today') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (range === '7d') {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else {
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
    const q = filter.toLowerCase()
    return operations
      .filter((op) => {
        if (new Date(op.timestamp).getTime() < since.getTime()) return false
        if (categoryFilter === 'task' && !op.type.includes('task')) return false
        if (categoryFilter === 'project' && !op.type.startsWith('project_')) return false
        if (categoryFilter === 'focus' && !op.type.startsWith('focus_')) return false
        if (categoryFilter === 'wins' && !op.type.startsWith('wins_')) return false
        if (q) {
          const desc = describeOperation(op).toLowerCase()
          if (!desc.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [operations, range, filter, categoryFilter])

  const grouped = useMemo(() => {
    const groups: { day: string; entries: OperationLogEntry[] }[] = []
    for (const entry of filtered) {
      const day = entry.timestamp.slice(0, 10)
      const last = groups[groups.length - 1]
      if (last && last.day === day) {
        last.entries.push(entry)
      } else {
        groups.push({ day, entries: [entry] })
      }
    }
    return groups
  }, [filtered])

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-base text-t-secondary">
        Loading...
      </div>
    )
  }

  return (
    <div className="h-screen bg-base text-t-primary flex flex-col">
      <div className="px-6 pt-6 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-lg font-semibold">Activity Log</h1>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as LogRange)}
            className="px-2.5 py-1.5 rounded-md text-xs bg-surface border border-border text-t-heading focus:outline-none focus:border-t-secondary cursor-pointer"
          >
            {rangeOptions.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 mb-2">
          {(['all', 'task', 'project', 'focus', 'wins'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                categoryFilter === cat
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-surface border border-border text-t-secondary hover:text-t-primary'
              }`}
            >
              {cat === 'all' ? 'All' : cat === 'task' ? 'Tasks' : cat === 'project' ? 'Projects' : cat === 'focus' ? 'Focus' : '5 Wins'}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          className="w-full px-2.5 py-1.5 rounded-md text-xs bg-surface border border-border text-t-primary placeholder:text-t-muted focus:outline-none focus:border-t-secondary"
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {filtered.length === 0 ? (
          <p className="text-t-secondary text-sm">No activity in this period</p>
        ) : (
          <div className="space-y-3">
            {grouped.map((group) => (
              <div key={group.day}>
                <div className="text-xs font-semibold text-t-secondary mb-1 uppercase tracking-wide">
                  {dayLabel(group.entries[0].timestamp)}
                </div>
                <div>
                  {group.entries.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2.5 py-0.5 text-xs">
                      <span
                        className="inline-block w-2 h-2 rounded-full mt-1 shrink-0"
                        style={{ backgroundColor: typeColors[entry.type] }}
                      />
                      <span className="text-t-secondary shrink-0 whitespace-nowrap">
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                      <span className="text-t-primary">
                        {describeOperation(entry)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
