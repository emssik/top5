export type RepeatScheduleLike =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'interval'; days: number }
  | { type: 'afterCompletion'; days: number }
  | { type: 'monthlyDay'; day: number }
  | { type: 'monthlyNthWeekday'; week: number; weekday: number }
  | { type: 'everyNMonths'; months: number; day: number }
  | { type: 'monthlyLastDay' }

export interface RepeatingTaskLike {
  id: string
  schedule: RepeatScheduleLike
  createdAt: string
  lastCompletedAt: string | null
  order: number
  startDate?: string | null
  endDate?: string | null
}

export interface QuickTaskLike {
  repeatingTaskId?: string | null
  completed: boolean
  completedAt?: string | null
}

export const MONDAY_TO_FRIDAY = [1, 2, 3, 4, 5]

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th']
export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatSchedule(schedule: RepeatScheduleLike): string {
  if (schedule.type === 'daily') return 'Every day'
  if (schedule.type === 'interval') return `Every ${schedule.days} days`
  if (schedule.type === 'afterCompletion') return `${schedule.days}d after done`
  if (schedule.type === 'weekdays') {
    const sorted = [...schedule.days].sort((a, b) => a - b)
    const isWorkWeek = sorted.length === 5 && MONDAY_TO_FRIDAY.every((d, i) => d === sorted[i])
    if (isWorkWeek) return 'Weekdays'
    return sorted.map((d) => DAY_LABELS[(d + 6) % 7]).join(', ')
  }
  if (schedule.type === 'monthlyDay') return `${schedule.day}. of month`
  if (schedule.type === 'monthlyNthWeekday') return `${ORDINAL[schedule.week - 1]} ${WEEKDAY_NAMES[schedule.weekday]}`
  if (schedule.type === 'everyNMonths') return `Every ${schedule.months} mo, day ${schedule.day}`
  if (schedule.type === 'monthlyLastDay') return 'Last day of month'
  return 'Custom'
}

export function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function daysBetween(fromDate: Date, toDate: Date): number {
  const from = dayStart(fromDate).getTime()
  const to = dayStart(toDate).getTime()
  return Math.floor((to - from) / (1000 * 60 * 60 * 24))
}

export function normalizeWeekday(day: number): number {
  if (!Number.isFinite(day)) return 0
  const rounded = Math.trunc(day)
  return ((rounded % 7) + 7) % 7
}

export function sortWeekdays(days: number[]): number[] {
  return [...days].sort((a, b) => {
    const da = normalizeWeekday(a)
    const db = normalizeWeekday(b)
    const oa = da === 0 ? 7 : da
    const ob = db === 0 ? 7 : db
    return oa - ob
  })
}

export function normalizeWeekdays(days: number[], fallback: number[] = [1]): number[] {
  const next = Array.from(new Set(days.map(normalizeWeekday)))
  if (next.length === 0) {
    return Array.from(new Set(fallback.map(normalizeWeekday)))
  }
  return sortWeekdays(next)
}

export function normalizeRepeatSchedule<T extends RepeatScheduleLike>(schedule: T): T {
  if (schedule.type !== 'weekdays') return schedule
  return {
    ...schedule,
    days: normalizeWeekdays(schedule.days, MONDAY_TO_FRIDAY)
  } as T
}

export function isScheduleDueOnDate(
  schedule: RepeatScheduleLike,
  createdAt: string,
  lastCompletedAt: string | null,
  onDate: Date = new Date()
): boolean {
  const normalized = normalizeRepeatSchedule(schedule)
  if (normalized.type === 'daily') return true
  if (normalized.type === 'weekdays') return normalized.days.includes(onDate.getDay())
  if (normalized.type === 'interval') {
    const created = new Date(createdAt)
    const diff = daysBetween(created, onDate)
    return diff >= 0 && diff % normalized.days === 0
  }
  if (normalized.type === 'afterCompletion') {
    if (!lastCompletedAt) return true
    const completed = new Date(lastCompletedAt)
    const diff = daysBetween(completed, onDate)
    return diff >= normalized.days
  }
  if (normalized.type === 'monthlyDay') {
    return onDate.getDate() === normalized.day
  }
  if (normalized.type === 'monthlyNthWeekday') {
    if (onDate.getDay() !== normalizeWeekday(normalized.weekday)) return false
    const weekOfMonth = Math.ceil(onDate.getDate() / 7)
    return weekOfMonth === normalized.week
  }
  if (normalized.type === 'everyNMonths') {
    if (onDate.getDate() !== normalized.day) return false
    const created = new Date(createdAt)
    const monthsDiff = (onDate.getFullYear() - created.getFullYear()) * 12 + (onDate.getMonth() - created.getMonth())
    return monthsDiff >= 0 && monthsDiff % normalized.months === 0
  }
  if (normalized.type === 'monthlyLastDay') {
    const lastDay = new Date(onDate.getFullYear(), onDate.getMonth() + 1, 0).getDate()
    return onDate.getDate() === lastDay
  }
  return false
}

export function isRepeatingTaskDueOnDate(task: RepeatingTaskLike, onDate: Date = new Date()): boolean {
  const today = dateKey(onDate)
  if (task.startDate && today < task.startDate) return false
  if (task.endDate && today > task.endDate) return false
  return isScheduleDueOnDate(task.schedule, task.createdAt, task.lastCompletedAt, onDate)
}

export function isMonthlyType(schedule: RepeatScheduleLike): boolean {
  return (
    schedule.type === 'monthlyDay' ||
    schedule.type === 'monthlyNthWeekday' ||
    schedule.type === 'monthlyLastDay' ||
    schedule.type === 'everyNMonths'
  )
}

/**
 * Was the schedule due on any day earlier in the current calendar month, from
 * max(createdAt, monthStart) up to (but not including) onDate? Used so that
 * missed monthly tasks still surface as proposals within the same month
 * instead of disappearing until next month.
 */
export function wasMonthlyScheduleDueEarlierThisMonth(
  schedule: RepeatScheduleLike,
  createdAt: string,
  onDate: Date
): boolean {
  if (!isMonthlyType(schedule)) return false
  const monthStart = new Date(onDate.getFullYear(), onDate.getMonth(), 1)
  const created = dayStart(new Date(createdAt))
  const startIter = created > monthStart ? created : monthStart
  const end = dayStart(onDate)
  if (startIter >= end) return false

  // Fast paths for single-day-per-month schedules — avoid iterating up to 31 days.
  if (schedule.type === 'monthlyDay') {
    const target = new Date(onDate.getFullYear(), onDate.getMonth(), schedule.day)
    if (target.getMonth() !== onDate.getMonth()) return false // e.g. Feb 31 → Mar
    return target >= startIter && target < end
  }
  if (schedule.type === 'monthlyLastDay') {
    const lastDay = new Date(onDate.getFullYear(), onDate.getMonth() + 1, 0)
    return lastDay >= startIter && lastDay < end
  }

  // General iteration for monthlyNthWeekday and everyNMonths.
  const cursor = new Date(startIter)
  while (cursor < end) {
    if (isScheduleDueOnDate(schedule, createdAt, null, cursor)) {
      return true
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return false
}

export interface DueDateTaskLike {
  id: string
  completed: boolean
  isToDoNext?: boolean
  someday?: boolean
  dueDate?: string | null
}

export interface DueDateProjectLike {
  id: string
  name: string
  code?: string
  archivedAt: string | null
  suspendedAt: string | null
  tasks: DueDateTaskLike[]
}

export interface DueDateProposal<T extends DueDateTaskLike = DueDateTaskLike, P extends DueDateProjectLike = DueDateProjectLike> {
  task: T
  project: P
}

export function getDueDateProposals<T extends DueDateTaskLike, P extends DueDateProjectLike>(params: {
  projects: P[]
  date?: Date
}): DueDateProposal<T, P>[] {
  const { projects, date = new Date() } = params
  const key = dateKey(date)
  const results: DueDateProposal<T, P>[] = []

  for (const project of projects) {
    if (project.archivedAt || project.suspendedAt) continue
    for (const task of project.tasks) {
      if (task.completed || task.isToDoNext || task.someday) continue
      if (task.dueDate === key) {
        results.push({ task: task as T, project })
      }
    }
  }

  return results
}

export function getRepeatingTaskProposals<T extends RepeatingTaskLike, Q extends QuickTaskLike>(params: {
  repeatingTasks: T[]
  quickTasks: Q[]
  dismissedRepeating: Record<string, string[]>
  date?: Date
  /**
   * When true (default), monthly-type schedules that were due earlier in the
   * current month but never acted on stay visible as proposals. Pass `false`
   * for forward-looking queries (e.g. tomorrow preview) so missed tasks don't
   * leak into the "Tomorrow" section.
   */
  catchUp?: boolean
}): T[] {
  const {
    repeatingTasks,
    quickTasks,
    dismissedRepeating,
    date = new Date(),
    catchUp: allowCatchUp = true
  } = params
  const key = dateKey(date)
  const dismissed = dismissedRepeating[key] ?? []
  const monthStartIso = new Date(date.getFullYear(), date.getMonth(), 1).toISOString()

  // Single pass over quickTasks → O(1) lookups in the filter loop.
  const activeByRepeating = new Set<string>()
  const completedTimesByRepeating = new Map<string, string[]>()
  for (const qt of quickTasks) {
    const rid = qt.repeatingTaskId
    if (!rid) continue
    if (!qt.completed) {
      activeByRepeating.add(rid)
    } else if (qt.completedAt) {
      const list = completedTimesByRepeating.get(rid)
      if (list) list.push(qt.completedAt)
      else completedTimesByRepeating.set(rid, [qt.completedAt])
    }
  }

  return repeatingTasks
    .filter((task) => {
      const dueToday = isRepeatingTaskDueOnDate(task, date)
      let catchUp = false
      if (allowCatchUp && !dueToday && isMonthlyType(task.schedule)) {
        if (task.startDate && key < task.startDate) return false
        if (task.endDate && key > task.endDate) return false
        catchUp = wasMonthlyScheduleDueEarlierThisMonth(task.schedule, task.createdAt, date)
      }
      if (!dueToday && !catchUp) return false

      if (dismissed.includes(task.id)) return false
      if (activeByRepeating.has(task.id)) return false

      const completedTimes = completedTimesByRepeating.get(task.id)
      if (completedTimes) {
        const blocked = catchUp
          ? completedTimes.some((at) => at >= monthStartIso)
          : completedTimes.some((at) => at.startsWith(key))
        if (blocked) return false
      }
      return true
    })
    .sort((a, b) => a.order - b.order)
}
