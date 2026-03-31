// Synced from src/shared/schedule.ts — keep in sync (2026-03-31)

export type RepeatSchedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'interval'; days: number }
  | { type: 'afterCompletion'; days: number }
  | { type: 'monthlyDay'; day: number }
  | { type: 'monthlyNthWeekday'; week: number; weekday: number }
  | { type: 'everyNMonths'; months: number; day: number }
  | { type: 'monthlyLastDay' }

export interface RepeatingTask {
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
  startDate?: string | null
  endDate?: string | null
}

const MONDAY_TO_FRIDAY = [1, 2, 3, 4, 5]
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th']
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatSchedule(schedule: RepeatSchedule): string {
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
