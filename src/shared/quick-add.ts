import type { RepeatScheduleLike } from './schedule'
import { MONDAY_TO_FRIDAY, normalizeWeekdays } from './schedule'

export type QuickAddScheduleType = 'daily' | 'weekdays' | 'weekly' | 'interval' | 'monthly' | 'afterDone'

export interface QuickAddScheduleOptions {
  scheduleType: QuickAddScheduleType
  weekdays: number[]
  intervalDays: number
  monthlyDay: number
  afterDoneDays: number
}

export function buildQuickAddSchedule(options: QuickAddScheduleOptions): RepeatScheduleLike {
  switch (options.scheduleType) {
    case 'daily':
      return { type: 'daily' }
    case 'weekdays':
      return { type: 'weekdays', days: [...MONDAY_TO_FRIDAY] }
    case 'weekly':
      return { type: 'weekdays', days: normalizeWeekdays(options.weekdays, [1]) }
    case 'interval':
      return { type: 'interval', days: Math.max(1, options.intervalDays) }
    case 'monthly':
      return { type: 'monthlyDay', day: Math.max(1, Math.min(31, options.monthlyDay)) }
    case 'afterDone':
      return { type: 'afterCompletion', days: Math.max(1, options.afterDoneDays) }
    default:
      return { type: 'daily' }
  }
}
