import { useEffect, useState, useMemo } from 'react'
import { useProjects } from '../hooks/useProjects'
import { checkInMinutes, formatCheckInTime } from '../utils/checkInTime'
import type { FocusCheckIn } from '../types'

type Range = '1d' | '7d' | '14d' | 'month' | 'prev_month' | '6m' | '12m'

const rangeLabels: { key: Range; label: string }[] = [
  { key: '1d', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '14d', label: '14 days' },
  { key: 'month', label: 'Month' },
  { key: 'prev_month', label: 'Prev month' },
  { key: '6m', label: '6 months' },
  { key: '12m', label: '12 months' }
]

function buildBuckets(range: Range): { keys: string[]; label: (k: string) => string; bucketFor: (iso: string) => string | null } {
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  const dayKey = (d: Date) => d.toISOString().split('T')[0]
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  const formatDay = (iso: string): string => {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const formatMonth = (ym: string): string => {
    const [y, m] = ym.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }

  if (range === '1d') {
    const k = dayKey(today)
    return { keys: [k], label: formatDay, bucketFor: (iso) => iso.startsWith(k) ? k : null }
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

export default function StatsView() {
  const { projects, focusCheckIns, loaded, loadData } = useProjects()
  const [range, setRange] = useState<Range>('7d')

  useEffect(() => {
    loadData()
  }, [])

  const activeProjects = projects.filter((p) => !p.archivedAt)

  const { keys, label, bucketFor } = useMemo(() => buildBuckets(range), [range])

  const { grid, projectTotals, maxTime } = useMemo(() => {
    const g: Record<string, Record<string, number>> = {}
    for (const k of keys) {
      g[k] = {}
      for (const p of activeProjects) g[k][p.id] = 0
    }

    for (const c of focusCheckIns) {
      const bucket = bucketFor(c.timestamp)
      if (!bucket || !g[bucket]) continue
      if (g[bucket][c.projectId] === undefined) continue
      g[bucket][c.projectId] += checkInMinutes(c.response)
    }

    const totals: Record<string, number> = {}
    for (const p of activeProjects) {
      totals[p.id] = 0
      for (const k of keys) totals[p.id] += g[k][p.id]
    }

    const allVals = keys.flatMap((k) => activeProjects.map((p) => g[k][p.id]))
    return { grid: g, projectTotals: totals, maxTime: Math.max(...allVals, 1) }
  }, [keys, activeProjects, focusCheckIns])

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-950 text-neutral-400">
        Loading...
      </div>
    )
  }

  const cellColor = (minutes: number): string => {
    if (minutes === 0) return 'bg-neutral-900'
    const intensity = Math.min(minutes / maxTime, 1)
    if (intensity < 0.33) return 'bg-emerald-900/40'
    if (intensity < 0.66) return 'bg-emerald-800/60'
    return 'bg-emerald-700/80'
  }

  const isSummaryOnly = range === '1d'

  return (
    <div className="h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-lg font-semibold">Work Stats</h1>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
          className="mt-3 px-2.5 py-1.5 rounded-md text-xs bg-neutral-800 border border-neutral-700 text-neutral-200 focus:outline-none focus:border-neutral-500 cursor-pointer"
        >
          {rangeLabels.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {activeProjects.length === 0 ? (
          <p className="text-neutral-500">No active projects</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  {!isSummaryOnly && (
                    <th className="text-left py-2 pr-3 text-neutral-500 font-medium sticky left-0 bg-neutral-950">
                      {range === '6m' || range === '12m' ? 'Month' : 'Date'}
                    </th>
                  )}
                  {activeProjects.map((p) => (
                    <th key={p.id} className="py-2 px-2 text-neutral-500 font-medium text-center truncate max-w-[100px]">
                      {p.name || 'Untitled'}
                    </th>
                  ))}
                </tr>
                <tr className="bg-emerald-950/40">
                  <td className="py-2.5 pr-3 text-emerald-400 font-semibold sticky left-0 bg-emerald-950/40">
                    {isSummaryOnly ? 'Today' : 'Total'}
                  </td>
                  {activeProjects.map((p) => (
                    <td key={p.id} className="py-2.5 px-2 text-center text-emerald-300 font-semibold">
                      {formatCheckInTime(projectTotals[p.id])}
                    </td>
                  ))}
                </tr>
              </thead>
              {!isSummaryOnly && (
                <tbody>
                  {keys.map((k) => (
                    <tr key={k} className="border-t border-neutral-800/50">
                      <td className="py-1.5 pr-3 text-neutral-400 whitespace-nowrap sticky left-0 bg-neutral-950">
                        {label(k)}
                      </td>
                      {activeProjects.map((p) => {
                        const mins = grid[k][p.id]
                        return (
                          <td key={p.id} className="py-1.5 px-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded ${cellColor(mins)} ${mins > 0 ? 'text-emerald-300' : 'text-neutral-700'}`}>
                              {mins > 0 ? formatCheckInTime(mins) : '-'}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
