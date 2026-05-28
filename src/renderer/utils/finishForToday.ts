import type { FocusCheckIn } from '../types'
import { checkInMinutes } from './checkInTime'

// Logical day starts at 06:00 local — same boundary the energy tracker uses.
const DAY_START_HOUR = 6

/**
 * ISO datetime of the next 06:00 boundary — when a "finished for today" task
 * should reappear. Before 06:00 it's today at 06:00, otherwise tomorrow at 06:00.
 */
export function nextRolloverIso(): string {
  const d = new Date()
  if (d.getHours() >= DAY_START_HOUR) d.setDate(d.getDate() + 1)
  d.setHours(DAY_START_HOUR, 0, 0, 0)
  return d.toISOString()
}

/** Start of the current logical day (last 06:00 boundary) in ms. */
function lastRolloverMs(): number {
  const d = new Date()
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1)
  d.setHours(DAY_START_HOUR, 0, 0, 0)
  return d.getTime()
}

/** Minutes worked on a task within the current logical day (since the last 06:00). */
export function minutesWorkedToday(checkIns: FocusCheckIn[], taskId: string): number {
  const since = lastRolloverMs()
  return checkIns
    .filter((c) => c.taskId === taskId && Date.parse(c.timestamp) >= since)
    .reduce((sum, c) => sum + checkInMinutes(c), 0)
}
