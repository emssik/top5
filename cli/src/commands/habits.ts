import type { Command } from 'commander'
import { createClient } from '../lib/client.js'
import { printResult, formatTable, die } from '../lib/output.js'

type HabitSchedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'nPerWeek'; count: number }
  | { type: 'interval'; every: number }
  | { type: 'dailyMinutes'; minutes: number }
  | { type: 'weeklyMinutes'; minutes: number }

interface HabitEntry {
  id: string
  name: string
  icon: string
  projectId: string | null
  schedule: HabitSchedule
  isScheduled: boolean
  status: 'done' | 'freeze' | 'skip' | 'pending'
  streak: number
  streakUnit: 'dni' | 'tyg'
  minutesToday?: number
  minutesGoal?: number
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function scheduleLabel(s: HabitSchedule): string {
  switch (s.type) {
    case 'daily': return 'daily'
    case 'weekdays': return `weekdays ${s.days.map((d) => DAY_SHORT[d] ?? d).join('/')}`
    case 'nPerWeek': return `${s.count}×/week`
    case 'interval': return `every ${s.every}d`
    case 'dailyMinutes': return `${s.minutes}m/day`
    case 'weeklyMinutes': return `${s.minutes}m/week`
  }
}

function todayStatus(h: HabitEntry): string {
  if (!h.isScheduled) return '—'
  if (h.status === 'done') return '✓ done'
  if (h.status === 'freeze') return '🛡 freeze'
  if (h.status === 'skip') return '⏸ skip'
  if (h.minutesGoal != null) {
    const cur = h.minutesToday ?? 0
    return `${cur}/${h.minutesGoal}m`
  }
  return 'pending'
}

export function register(program: Command): void {
  program
    .command('habits')
    .description('List habits (read-only; schedule, today status, current streak)')
    .action(async (_opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const habits = await client.get<HabitEntry[]>('/api/v1/habits')

        printResult(habits, {
          json: globalOpts.json,
          formatFn: () =>
            formatTable(habits, [
              { header: '#', value: (h) => `HB-${h.id.slice(0, 3)}`, align: 'right' },
              { header: 'NAME', value: (h) => h.name },
              { header: 'SCHEDULE', value: (h) => scheduleLabel(h.schedule) },
              { header: 'TODAY', value: (h) => todayStatus(h) },
              { header: 'STREAK', value: (h) => `${h.streak} ${h.streakUnit}` },
            ]),
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })
}
