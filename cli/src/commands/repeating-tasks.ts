import type { Command } from 'commander'
import type { ApiClient } from '../lib/api-client.js'
import { createClient } from '../lib/client.js'
import { resolveRepeatingTask } from '../lib/resolve.js'
import { printResult, formatTable, die } from '../lib/output.js'

type RepeatSchedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'interval'; days: number }
  | { type: 'afterCompletion'; days: number }
  | { type: 'monthlyDay'; day: number }
  | { type: 'monthlyNthWeekday'; week: number; weekday: number }
  | { type: 'everyNMonths'; months: number; day: number }
  | { type: 'monthlyLastDay' }

interface RepeatingTask {
  id: string
  title: string
  schedule: RepeatSchedule
  createdAt: string
  lastCompletedAt: string | null
  order: number
  acceptedCount: number
  dismissedCount: number
  completedCount: number
  projectId?: string | null
  link?: string | null
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_DEFAULT = [1, 2, 3, 4, 5]
const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th']
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatSchedule(schedule: RepeatSchedule): string {
  switch (schedule.type) {
    case 'daily': return 'Every day'
    case 'interval': return `Every ${schedule.days} days`
    case 'afterCompletion': return `${schedule.days}d after done`
    case 'weekdays': {
      const sorted = [...schedule.days].sort((a, b) => a - b)
      const isWorkWeek = sorted.length === 5 && WEEKDAY_DEFAULT.every((d, i) => d === sorted[i])
      if (isWorkWeek) return 'Weekdays'
      return sorted.map((d) => DAY_LABELS[(d + 6) % 7]).join(', ')
    }
    case 'monthlyDay': return `${schedule.day}. of month`
    case 'monthlyNthWeekday': return `${ORDINAL[schedule.week - 1]} ${WEEKDAY_NAMES[schedule.weekday]}`
    case 'everyNMonths': return `Every ${schedule.months} mo, day ${schedule.day}`
    case 'monthlyLastDay': return 'Last day of month'
    default: return 'Custom'
  }
}

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

function parseWeekdays(input: string): number[] {
  return input.split(',').map((s) => {
    const trimmed = s.trim().toLowerCase()
    if (WEEKDAY_MAP[trimmed] !== undefined) return WEEKDAY_MAP[trimmed]
    const num = parseInt(trimmed, 10)
    if (isNaN(num) || num < 0 || num > 6) die(`Invalid weekday: ${s.trim()}`)
    return num
  })
}

function buildSchedule(opts: Record<string, unknown>): RepeatSchedule {
  const flags = [opts.daily, opts.weekdays, opts.weekly, opts.interval, opts.afterDone, opts.monthlyDay, opts.monthlyLastDay]
    .filter(Boolean)
  if (flags.length > 1) die('Specify only one schedule flag')

  if (opts.weekdays) return { type: 'weekdays', days: [1, 2, 3, 4, 5] }
  if (opts.weekly) return { type: 'weekdays', days: parseWeekdays(opts.weekly as string) }
  if (opts.interval) return { type: 'interval', days: parseInt(opts.interval as string, 10) }
  if (opts.afterDone) return { type: 'afterCompletion', days: parseInt(opts.afterDone as string, 10) }
  if (opts.monthlyDay) return { type: 'monthlyDay', day: parseInt(opts.monthlyDay as string, 10) }
  if (opts.monthlyLastDay) return { type: 'monthlyLastDay' }

  return { type: 'daily' }
}

async function listTasks(client: ApiClient, endpoint: string, globalOpts: { json?: boolean }): Promise<void> {
  const tasks = await client.get<RepeatingTask[]>(endpoint)
  const sorted = [...tasks].sort((a, b) => a.order - b.order)

  printResult(sorted, {
    json: globalOpts.json,
    formatFn: () =>
      formatTable(sorted, [
        { header: '#', value: (_, i) => String(i + 1), align: 'right' },
        { header: 'TITLE', value: (t) => t.title },
        { header: 'SCHEDULE', value: (t) => formatSchedule(t.schedule) },
      ]),
  })
}

export function register(program: Command): void {
  const rt = program
    .command('rt')
    .description('Repeating tasks')
    .action(async (_opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        await listTasks(client, '/api/v1/repeating-tasks', globalOpts)
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 rt proposals
  rt.command('proposals')
    .description('Show today\'s pending repeating task proposals')
    .action(async (_opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        await listTasks(client, '/api/v1/repeating-tasks/proposals', globalOpts)
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 rt add <title>
  rt.command('add')
    .description('Add a repeating task')
    .argument('<title>', 'Task title')
    .option('--daily', 'Every day (default)')
    .option('--weekdays', 'Monday through Friday')
    .option('--weekly <days>', 'Specific weekdays (e.g. 1,3,5 or mon,wed,fri)')
    .option('--interval <n>', 'Every N days')
    .option('--after-done <n>', 'N days after completion')
    .option('--monthly-day <n>', 'Specific day of month')
    .option('--monthly-last-day', 'Last day of month')
    .action(async (title: string, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const schedule = buildSchedule(opts)
        const newTask = {
          id: crypto.randomUUID(),
          title,
          schedule,
          createdAt: new Date().toISOString(),
          lastCompletedAt: null,
          order: 0,
          acceptedCount: 0,
          dismissedCount: 0,
          completedCount: 0,
        }

        await client.post('/api/v1/repeating-tasks', newTask)

        printResult(newTask, {
          json: globalOpts.json,
          formatFn: () => `Created: ${title} (${formatSchedule(schedule)})`,
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 rt edit <ref>
  rt.command('edit')
    .description('Edit a repeating task')
    .argument('<ref>', 'Position (1-based) or UUID')
    .option('--title <title>', 'New title')
    .option('--daily', 'Every day')
    .option('--weekdays', 'Monday through Friday')
    .option('--weekly <days>', 'Specific weekdays (e.g. 1,3,5 or mon,wed,fri)')
    .option('--interval <n>', 'Every N days')
    .option('--after-done <n>', 'N days after completion')
    .option('--monthly-day <n>', 'Specific day of month')
    .option('--monthly-last-day', 'Last day of month')
    .action(async (ref: string, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const hasScheduleFlag = opts.daily || opts.weekdays || opts.weekly || opts.interval || opts.afterDone || opts.monthlyDay || opts.monthlyLastDay
        if (!opts.title && !hasScheduleFlag) die('Specify --title and/or a schedule flag')

        const task = await resolveRepeatingTask<RepeatingTask>(client, ref)
        const updates: Record<string, unknown> = { ...task }

        if (opts.title) updates.title = opts.title
        if (hasScheduleFlag) updates.schedule = buildSchedule(opts)

        const result = await client.put<RepeatingTask[]>(`/api/v1/repeating-tasks/${task.id}`, updates)
        const updated = result.find((t) => t.id === task.id) ?? task

        printResult(updated, {
          json: globalOpts.json,
          formatFn: () => `Updated: ${updated.title} (${formatSchedule(updated.schedule)})`,
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 rt rm <ref>
  rt.command('rm')
    .description('Delete a repeating task')
    .argument('<ref>', 'Position (1-based) or UUID')
    .action(async (ref: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const task = await resolveRepeatingTask<RepeatingTask>(client, ref)
        await client.delete(`/api/v1/repeating-tasks/${task.id}`)

        printResult(task, {
          json: globalOpts.json,
          formatFn: () => `Deleted: ${task.title}`,
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 rt accept <ref>
  rt.command('accept')
    .description('Accept a repeating task proposal (creates quick task)')
    .argument('<ref>', 'Position (1-based) or UUID')
    .action(async (ref: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const task = await resolveRepeatingTask<RepeatingTask>(client, ref, '/api/v1/repeating-tasks/proposals')
        const result = await client.post<{ quickTasks: Array<{ title: string }>; repeatingTasks: RepeatingTask[] }>(
          `/api/v1/repeating-tasks/${task.id}/accept`
        )

        printResult(result, {
          json: globalOpts.json,
          formatFn: () => `Accepted: ${task.title}`,
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })

  // top5 rt dismiss <ref>
  rt.command('dismiss')
    .description('Dismiss a repeating task proposal for today')
    .argument('<ref>', 'Position (1-based) or UUID')
    .action(async (ref: string, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals()
      const client = createClient(globalOpts)

      try {
        const task = await resolveRepeatingTask<RepeatingTask>(client, ref, '/api/v1/repeating-tasks/proposals')
        await client.post(`/api/v1/repeating-tasks/${task.id}/dismiss`)

        printResult(task, {
          json: globalOpts.json,
          formatFn: () => `Dismissed: ${task.title}`,
        })
      } catch (err: unknown) {
        die((err as Error).message)
      }
    })
}
