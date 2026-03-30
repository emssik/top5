/**
 * Parse human-friendly date strings into YYYY-MM-DD format.
 *
 * Supported formats:
 *   YYYY-MM-DD   — literal date
 *   today        — today's date
 *   tomorrow     — tomorrow's date
 *   +Nd          — N days from today (e.g. +3d)
 *   monday..sunday — next occurrence of that weekday
 *   none / clear — returns null (removes due date)
 */

const DAY_NAMES: Record<string, number> = {
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
  sunday: 0, sun: 0,
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + n)
  return result
}

function nextWeekday(dayOfWeek: number): Date {
  const today = new Date()
  const current = today.getDay()
  let diff = dayOfWeek - current
  if (diff <= 0) diff += 7
  return addDays(today, diff)
}

/**
 * Parse a date input string.
 * Returns YYYY-MM-DD string, null (clear), or throws on invalid input.
 */
export function parseDate(input: string): string | null {
  const s = input.trim().toLowerCase()

  if (s === 'none' || s === 'clear') return null

  if (s === 'today') return dateKey(new Date())
  if (s === 'tomorrow') return dateKey(addDays(new Date(), 1))

  // +Nd pattern
  const offsetMatch = /^\+(\d+)d$/.exec(s)
  if (offsetMatch) {
    return dateKey(addDays(new Date(), parseInt(offsetMatch[1], 10)))
  }

  // Day name
  if (s in DAY_NAMES) {
    return dateKey(nextWeekday(DAY_NAMES[s]))
  }

  // YYYY-MM-DD literal
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const parsed = new Date(s + 'T00:00:00')
    if (isNaN(parsed.getTime()) || dateKey(parsed) !== s) throw new Error(`Invalid date: ${input}`)
    return s
  }

  throw new Error(
    `Unrecognized date format: "${input}". Use YYYY-MM-DD, today, tomorrow, +Nd, or a day name (mon-sun).`
  )
}

/** Format a YYYY-MM-DD date for display (short). */
export function formatDueDate(dueDate: string | null | undefined): string {
  if (!dueDate) return ''
  const today = dateKey(new Date())
  const tomorrow = dateKey(addDays(new Date(), 1))
  if (dueDate === today) return 'today'
  if (dueDate === tomorrow) return 'tomorrow'
  if (dueDate < today) return `${dueDate} (overdue)`
  return dueDate
}
