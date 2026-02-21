export type RepeatScheduleLike =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'interval'; days: number }
  | { type: 'afterCompletion'; days: number }
  | { type: 'monthlyDay'; day: number }
  | { type: 'monthlyNthWeekday'; week: number; weekday: number }
  | { type: 'everyNMonths'; months: number; day: number }

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

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
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
  return false
}

export function isRepeatingTaskDueOnDate(task: RepeatingTaskLike, onDate: Date = new Date()): boolean {
  const today = dateKey(onDate)
  if (task.startDate && today < task.startDate) return false
  if (task.endDate && today > task.endDate) return false
  return isScheduleDueOnDate(task.schedule, task.createdAt, task.lastCompletedAt, onDate)
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
}): T[] {
  const {
    repeatingTasks,
    quickTasks,
    dismissedRepeating,
    date = new Date()
  } = params
  const key = dateKey(date)
  const dismissed = dismissedRepeating[key] ?? []

  return repeatingTasks
    .filter((task) => {
      if (!isRepeatingTaskDueOnDate(task, date)) return false
      if (dismissed.includes(task.id)) return false
      if (quickTasks.some((quickTask) => quickTask.repeatingTaskId === task.id && !quickTask.completed)) return false
      if (
        quickTasks.some(
          (quickTask) =>
            quickTask.repeatingTaskId === task.id &&
            quickTask.completed &&
            quickTask.completedAt?.startsWith(key)
        )
      ) {
        return false
      }
      return true
    })
    .sort((a, b) => a.order - b.order)
}
