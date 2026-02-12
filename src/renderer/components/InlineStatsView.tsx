import { useMemo, useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import { checkInMinutes, formatCheckInTime } from '../utils/checkInTime'
import { projectColorValue } from '../utils/projects'
import { STANDALONE_PROJECT_ID } from '../utils/constants'

type Range = '7d' | '14d' | 'month' | 'prev_month' | '6m' | '12m'

const rangeLabels: { key: Range; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '14d', label: '14 days' },
  { key: 'month', label: 'Month' },
  { key: 'prev_month', label: 'Prev month' },
  { key: '6m', label: '6 months' },
  { key: '12m', label: '12 months' }
]

function startOfWeek(date: Date): Date {
  const value = new Date(date)
  const day = value.getDay()
  const diff = day === 0 ? -6 : 1 - day
  value.setDate(value.getDate() + diff)
  value.setHours(0, 0, 0, 0)
  return value
}

function calcDayStreak(activeDays: string[]): number {
  if (activeDays.length === 0) return 0
  const uniqueDays = Array.from(new Set(activeDays)).sort().reverse()
  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  for (const day of uniqueDays) {
    const current = cursor.toISOString().slice(0, 10)
    if (day === current) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
      continue
    }
    if (streak === 0) {
      cursor.setDate(cursor.getDate() - 1)
      if (day === cursor.toISOString().slice(0, 10)) {
        streak += 1
        cursor.setDate(cursor.getDate() - 1)
        continue
      }
    }
    break
  }

  return streak
}

function buildBuckets(range: Range): { keys: string[]; label: (k: string) => string; bucketFor: (iso: string) => string | null } {
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  const dayKey = (d: Date) => d.toISOString().split('T')[0]
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  const formatDay = (iso: string): string => {
    const d = new Date(iso + 'T12:00:00')
    const todayStr = dayKey(new Date())
    const base = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    return iso === todayStr ? `${base}  today` : base
  }

  const formatMonth = (ym: string): string => {
    const [y, m] = ym.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }

  if (range === '7d' || range === '14d') {
    const n = range === '7d' ? 7 : 14
    const keys: string[] = []
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      keys.push(dayKey(d))
    }
    const keySet = new Set(keys)
    return { keys, label: formatDay, bucketFor: (iso) => { const k = iso.split('T')[0]; return keySet.has(k) ? k : null } }
  }

  if (range === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const keys: string[] = []
    const d = new Date(start)
    while (d <= today) {
      keys.push(dayKey(d))
      d.setDate(d.getDate() + 1)
    }
    const keySet = new Set(keys)
    return { keys, label: formatDay, bucketFor: (iso) => { const k = iso.split('T')[0]; return keySet.has(k) ? k : null } }
  }

  if (range === 'prev_month') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth(), 0)
    const keys: string[] = []
    const d = new Date(start)
    while (d <= end) {
      keys.push(dayKey(d))
      d.setDate(d.getDate() + 1)
    }
    const keySet = new Set(keys)
    return { keys, label: formatDay, bucketFor: (iso) => { const k = iso.split('T')[0]; return keySet.has(k) ? k : null } }
  }

  // 6m or 12m — group by month
  const n = range === '6m' ? 6 : 12
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    keys.push(monthKey(d))
  }
  const keySet = new Set(keys)
  return {
    keys,
    label: formatMonth,
    bucketFor: (iso) => {
      const d = new Date(iso)
      const k = monthKey(d)
      return keySet.has(k) ? k : null
    }
  }
}

export default function InlineStatsView() {
  const { projects, quickTasks, focusCheckIns } = useProjects()
  const [range, setRange] = useState<Range>('7d')

  const activeProjects = useMemo(
    () => projects.filter((project) => !project.archivedAt && !project.suspendedAt).sort((a, b) => a.order - b.order),
    [projects]
  )

  const stats = useMemo(() => {
    const weekStart = startOfWeek(new Date())
    const tasksDone =
      quickTasks.filter((task) => task.completed).length +
      activeProjects.reduce((count, project) => count + project.tasks.filter((task) => task.completed).length, 0)

    const focusedMinutes = focusCheckIns.reduce((sum, checkIn) => sum + checkInMinutes(checkIn), 0)
    const streak = calcDayStreak(focusCheckIns.map((checkIn) => checkIn.timestamp.slice(0, 10)))

    const weeklyByProject = activeProjects.map((project) => {
      const doneThisWeek = project.tasks.filter((task) => {
        if (!task.completedAt) return false
        return new Date(task.completedAt).getTime() >= weekStart.getTime()
      }).length

      return {
        id: project.id,
        name: project.name,
        color: project.color,
        doneThisWeek
      }
    })

    return {
      tasksDone,
      focusedMinutes,
      streak,
      weeklyByProject
    }
  }, [activeProjects, focusCheckIns, quickTasks])

  // Work Stats table data
  const hasStandaloneCheckIns = focusCheckIns.some((c) => c.projectId === STANDALONE_PROJECT_ID)
  const standaloneEntry = hasStandaloneCheckIns ? { id: STANDALONE_PROJECT_ID, name: 'Quick Tasks', color: undefined as string | undefined } : null
  const allEntries = [...activeProjects.map((p) => ({ id: p.id, name: p.name, color: p.color })), ...(standaloneEntry ? [standaloneEntry] : [])]

  const { keys, label, bucketFor } = useMemo(() => buildBuckets(range), [range])
  const displayKeys = useMemo(() => [...keys].reverse(), [keys])

  const { grid, projectTotals, maxTime } = useMemo(() => {
    const g: Record<string, Record<string, number>> = {}
    for (const k of keys) {
      g[k] = {}
      for (const e of allEntries) g[k][e.id] = 0
    }

    for (const c of focusCheckIns) {
      const bucket = bucketFor(c.timestamp)
      if (!bucket || !g[bucket]) continue
      if (g[bucket][c.projectId] === undefined) continue
      g[bucket][c.projectId] += checkInMinutes(c)
    }

    const totals: Record<string, number> = {}
    for (const e of allEntries) {
      totals[e.id] = 0
      for (const k of keys) totals[e.id] += g[k][e.id]
    }

    const allVals = keys.flatMap((k) => allEntries.map((e) => g[k][e.id]))
    return { grid: g, projectTotals: totals, maxTime: Math.max(...allVals, 1) }
  }, [keys, allEntries, focusCheckIns])

  const cellColor = (minutes: number): string => {
    if (minutes === 0) return 'bg-card'
    const intensity = Math.min(minutes / maxTime, 1)
    if (intensity < 0.33) return 'bg-cell-lo'
    if (intensity < 0.66) return 'bg-cell-mid'
    return 'bg-cell-hi'
  }

  return (
    <div>
      <div className="section-label" style={{ marginBottom: 16 }}>
        <span style={{ opacity: 0.5 }}>📊</span>
        <span>Statistics</span>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="number">{stats.tasksDone}</div>
          <div className="label">Tasks Done</div>
        </div>
        <div className="stat-card">
          <div className="number">{formatCheckInTime(stats.focusedMinutes)}</div>
          <div className="label">Focused Time</div>
        </div>
        <div className="stat-card">
          <div className="number">{stats.streak}</div>
          <div className="label">Day Streak</div>
        </div>
      </div>

      <div className="section-label">This Week</div>
      <div className="stat-grid" style={{ gridTemplateColumns: `repeat(${Math.min(stats.weeklyByProject.length, 5)},1fr)`, marginBottom: 24 }}>
        {stats.weeklyByProject.slice(0, 5).map((project) => (
          <div key={project.id} className="stat-card">
            <div className="number" style={{ fontSize: 20, color: projectColorValue(project.color) }}>{project.doneThisWeek}</div>
            <div className="label">{project.name || 'Untitled'}</div>
          </div>
        ))}
      </div>

      <div className="section-label" style={{ marginBottom: 12 }}>
        <span>Work Stats</span>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
          className="ml-3 px-2 py-1 rounded-md text-xs bg-surface border border-border text-t-heading focus:outline-none focus:border-t-secondary cursor-pointer"
        >
          {rangeLabels.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
      </div>

      {allEntries.length === 0 ? (
        <p className="text-t-secondary text-xs">No active projects</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 pr-3 text-t-secondary font-medium sticky left-0 bg-base">
                  {range === '6m' || range === '12m' ? 'Month' : 'Date'}
                </th>
                {allEntries.map((e) => (
                  <th key={e.id} className="py-2 px-2 text-t-secondary font-medium text-center truncate max-w-[100px]">
                    {e.name || 'Untitled'}
                  </th>
                ))}
              </tr>
              <tr className="bg-accent-row">
                <td className="py-2.5 pr-3 text-accent-row-heading font-semibold sticky left-0 bg-accent-row">
                  Total
                </td>
                {allEntries.map((e) => (
                  <td key={e.id} className="py-2.5 px-2 text-center text-accent-row-text font-semibold">
                    {formatCheckInTime(projectTotals[e.id])}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayKeys.map((k) => (
                <tr key={k} className="border-t border-border-subtle/50">
                  <td className="py-1.5 pr-3 text-t-secondary whitespace-nowrap sticky left-0 bg-base">
                    {label(k)}
                  </td>
                  {allEntries.map((e) => {
                    const mins = grid[k][e.id]
                    return (
                      <td key={e.id} className="py-1.5 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded ${cellColor(mins)} ${mins > 0 ? 'text-cell-text' : 'text-t-muted'}`}>
                          {mins > 0 ? formatCheckInTime(mins) : '-'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
