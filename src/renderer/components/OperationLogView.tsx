import { useEffect, useMemo, useState } from 'react'
import { projectColorValue } from '../utils/projects'
import type { OperationLogEntry, OperationType, Project } from '../types'

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
  focus_started: '#a855f7'
}

function describeOperation(entry: OperationLogEntry): string {
  const project = entry.projectName ? ` in ${entry.projectName}` : ''
  const task = entry.taskTitle ? `"${entry.taskTitle}"` : ''

  switch (entry.type) {
    case 'task_created': return `Created task ${task}${project}`
    case 'task_completed': return `Completed task ${task}${project}`
    case 'task_uncompleted': return `Reopened task ${task}${project}`
    case 'task_deleted': return `Deleted task ${task}${project}`
    case 'quick_task_created': return `Created quick task ${task}`
    case 'quick_task_completed': return `Completed quick task ${task}`
    case 'quick_task_uncompleted': return `Reopened quick task ${task}`
    case 'quick_task_deleted': return `Deleted quick task ${task}`
    case 'project_created': return `Created project ${entry.projectName ?? ''}`
    case 'project_updated': return `Updated project ${entry.projectName ?? ''}`
    case 'project_archived': return `Archived project ${entry.projectName ?? ''}`
    case 'project_unarchived': return `Unarchived project ${entry.projectName ?? ''}`
    case 'project_suspended': return `Suspended project ${entry.projectName ?? ''}`
    case 'project_unsuspended': return `Resumed project ${entry.projectName ?? ''}`
    case 'project_deleted': return `Deleted project ${entry.projectName ?? ''}`
    case 'focus_started': return `Started focus${project}`
    default: return entry.type
  }
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMin / 60)

  const today = now.toISOString().slice(0, 10)
  const entryDay = iso.slice(0, 10)
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  if (entryDay === today) {
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    return `${diffHrs}h ago`
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (entryDay === yesterday.toISOString().slice(0, 10)) {
    return `yesterday ${time}`
  }

  return `${date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`
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

export default function OperationLogView() {
  const [operations, setOperations] = useState<OperationLogEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [range, setRange] = useState<LogRange>('today')
  const [filter, setFilter] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      window.api.getOperations(),
      window.api.getAppData()
    ]).then(([ops, data]) => {
      setOperations(ops ?? [])
      setProjects(data.projects ?? [])
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
        if (q) {
          const text = `${op.taskTitle ?? ''} ${op.projectName ?? ''} ${op.type}`.toLowerCase()
          if (!text.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [operations, range, filter])

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

  const projectColorMap = useMemo(() => {
    const map: Record<string, string | undefined> = {}
    for (const p of projects) {
      map[p.id] = p.color
    }
    return map
  }, [projects])

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
                      <span className="text-t-secondary shrink-0 w-[80px]">
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                      <span className="text-t-primary">
                        {describeOperation(entry)}
                        {entry.projectId && projectColorMap[entry.projectId] && (
                          <span
                            className="inline-block w-2 h-2 rounded-full ml-1.5 align-middle"
                            style={{ backgroundColor: projectColorValue(projectColorMap[entry.projectId]) }}
                          />
                        )}
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
