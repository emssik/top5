/**
 * 12 Week Year cycle date math.
 *
 * The cycle start date is persisted by the renderer (localStorage). This module
 * is pure: given a start date string ("YYYY-MM-DD"), compute the range and
 * remaining time. End is the last day inclusive — Sunday of week 12 — so a
 * cycle starting on Mon 2026-05-11 ends on Sun 2026-08-02 (84 calendar days).
 */
import { dateKey } from './schedule'

export const CYCLE_LENGTH_WEEKS = 12
export const CYCLE_LENGTH_DAYS = CYCLE_LENGTH_WEEKS * 7 // 84

export interface CycleDateRange {
  /** First day of the cycle (Monday). YYYY-MM-DD. */
  start: string
  /** Last day of the cycle (Sunday, inclusive). YYYY-MM-DD. */
  end: string
  /** Whole days from `now` (midnight) to `end` (midnight). 0 = ends today. Negative = past. */
  daysRemaining: number
  /** 1..12 during cycle, 0 before start, 13 after end. */
  currentWeek: number
  /** Milliseconds remaining until end-of-day on `end`. Used for the ticking countdown. */
  msRemaining: number
}

/** Returns the next Monday on or after `now` (today if today is Monday). */
export function nextMondayInclusive(now: Date = new Date()): Date {
  const result = new Date(now)
  result.setHours(0, 0, 0, 0)
  const day = result.getDay() // 0=Sun .. 6=Sat
  const distance = (8 - day) % 7 // Mon→0, Sun→1, Tue→6, ...
  result.setDate(result.getDate() + distance)
  return result
}

export function computeCycleRange(startDate: string, now: Date = new Date()): CycleDateRange | null {
  const start = new Date(startDate + 'T00:00:00')
  if (Number.isNaN(start.getTime())) return null
  start.setHours(0, 0, 0, 0)

  const endMidnight = new Date(start)
  endMidnight.setDate(endMidnight.getDate() + CYCLE_LENGTH_DAYS - 1)

  const endOfDay = new Date(endMidnight)
  endOfDay.setHours(23, 59, 59, 999)

  const todayMidnight = new Date(now)
  todayMidnight.setHours(0, 0, 0, 0)

  const dayMs = 86_400_000
  const daysRemaining = Math.round((endMidnight.getTime() - todayMidnight.getTime()) / dayMs)
  const daysSinceStart = Math.round((todayMidnight.getTime() - start.getTime()) / dayMs)

  let currentWeek = 0
  if (daysSinceStart >= 0) {
    currentWeek = daysSinceStart >= CYCLE_LENGTH_DAYS
      ? CYCLE_LENGTH_WEEKS + 1
      : Math.floor(daysSinceStart / 7) + 1
  }

  return {
    start: dateKey(start),
    end: dateKey(endMidnight),
    daysRemaining,
    currentWeek,
    msRemaining: endOfDay.getTime() - now.getTime()
  }
}
