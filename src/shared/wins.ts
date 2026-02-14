import type { WinEntry, StreakStats } from './types'

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function isoWeekKey(date: Date): string {
  const w = startOfWeek(date)
  return w.toISOString().slice(0, 10)
}

function isoMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function calcStreaks(entries: WinEntry[]): StreakStats {
  const now = new Date()
  const thisWeekStart = isoWeekKey(now)
  const thisMonthKey = isoMonthKey(now)

  let totalWins = 0
  let totalLosses = 0
  let thisWeekWins = 0
  let thisWeekLosses = 0
  let thisMonthWins = 0
  let thisMonthLosses = 0

  // Group by date, week, month
  const byDate = new Map<string, 'win' | 'loss'>()
  const weekResults = new Map<string, { wins: number; losses: number; played: number }>()
  const monthWeeks = new Map<string, Set<string>>()
  const monthResults = new Map<string, { losses: number; played: number }>()

  for (const entry of entries) {
    byDate.set(entry.date, entry.result)
    if (entry.result === 'win') totalWins++
    else totalLosses++

    const entryDate = new Date(entry.date + 'T12:00:00')
    const wk = isoWeekKey(entryDate)
    const mk = isoMonthKey(entryDate)

    // Week stats
    if (!weekResults.has(wk)) weekResults.set(wk, { wins: 0, losses: 0, played: 0 })
    const wr = weekResults.get(wk)!
    wr.played++
    if (entry.result === 'win') wr.wins++
    else wr.losses++

    // Month stats
    if (!monthResults.has(mk)) monthResults.set(mk, { losses: 0, played: 0 })
    const mr = monthResults.get(mk)!
    mr.played++
    if (entry.result === 'loss') mr.losses++

    if (!monthWeeks.has(mk)) monthWeeks.set(mk, new Set())
    monthWeeks.get(mk)!.add(wk)

    // This week/month
    if (wk === thisWeekStart) {
      if (entry.result === 'win') thisWeekWins++
      else thisWeekLosses++
    }
    if (mk === thisMonthKey) {
      if (entry.result === 'win') thisMonthWins++
      else thisMonthLosses++
    }
  }

  // Day streak: consecutive days with a win, going backwards from today
  let currentDayStreak = 0
  const cursor = new Date(now)
  cursor.setHours(0, 0, 0, 0)
  // Allow starting from today or yesterday
  let started = false
  for (let i = 0; i < 365; i++) {
    const key = cursor.toISOString().slice(0, 10)
    const result = byDate.get(key)
    if (result === 'win') {
      currentDayStreak++
      started = true
    } else if (result === 'loss') {
      break
    } else {
      // No entry — skip if streak hasn't started (grace for today), break otherwise
      if (started) break
      if (i > 0) break // only skip today
    }
    cursor.setDate(cursor.getDate() - 1)
  }

  // Week streak: weeks where losses <= 1 and played >= 1
  function isWeekWon(wk: string): boolean {
    const wr = weekResults.get(wk)
    if (!wr || wr.played === 0) return false
    return wr.losses <= 1
  }

  let currentWeekStreak = 0
  const weekCursor = new Date(now)
  for (let i = 0; i < 52; i++) {
    const wk = isoWeekKey(weekCursor)
    if (isWeekWon(wk)) {
      currentWeekStreak++
    } else {
      // If current week has no entries yet, skip it
      const wr = weekResults.get(wk)
      if (i === 0 && (!wr || wr.played === 0)) {
        // skip
      } else {
        break
      }
    }
    weekCursor.setDate(weekCursor.getDate() - 7)
  }

  // Month streak: all weeks in month won AND month losses <= 2
  function isMonthWon(mk: string): boolean {
    const mr = monthResults.get(mk)
    if (!mr || mr.played === 0) return false
    if (mr.losses > 2) return false
    const weeks = monthWeeks.get(mk)
    if (!weeks) return false
    for (const wk of weeks) {
      if (!isWeekWon(wk)) return false
    }
    return true
  }

  let currentMonthStreak = 0
  const monthCursor = new Date(now)
  for (let i = 0; i < 12; i++) {
    const mk = isoMonthKey(monthCursor)
    if (isMonthWon(mk)) {
      currentMonthStreak++
    } else {
      const mr = monthResults.get(mk)
      if (i === 0 && (!mr || mr.played === 0)) {
        // skip current month if no entries
      } else {
        break
      }
    }
    monthCursor.setMonth(monthCursor.getMonth() - 1)
  }

  return {
    currentDayStreak,
    currentWeekStreak,
    currentMonthStreak,
    totalWins,
    totalLosses,
    thisWeekWins,
    thisWeekLosses,
    thisMonthWins,
    thisMonthLosses
  }
}
