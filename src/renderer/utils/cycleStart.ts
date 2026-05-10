/**
 * Persistence + auto-init for the 12WY cycle start date.
 * Stored in localStorage so the cycle math is independent of task createdAt
 * timestamps — once a cycle starts on a specific Monday, that date stays
 * fixed until the user closes the cycle (which clears it).
 */
import { dateKey } from '../../shared/schedule'
import { nextMondayInclusive } from '../../shared/cycle'

const KEY = 'top5.cycleStartDate'

export function getStoredCycleStart(): string | null {
  try {
    const v = localStorage.getItem(KEY)
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
  } catch {
    return null
  }
}

export function setStoredCycleStart(date: string | null): void {
  try {
    if (date === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, date)
  } catch {
    /* no-op */
  }
}

/**
 * Resolve cycle start date for display. If the user has at least one task
 * with a cycleRole and no start is stored yet, lazily initialize to the
 * upcoming Monday (or today if today is Monday). Returns null when the user
 * has no cycle tasks at all (so the countdown is hidden entirely).
 */
export function ensureCycleStart(hasCycleTasks: boolean): string | null {
  const stored = getStoredCycleStart()
  if (stored) return stored
  if (!hasCycleTasks) return null
  const next = dateKey(nextMondayInclusive())
  setStoredCycleStart(next)
  return next
}
