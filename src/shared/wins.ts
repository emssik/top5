import type { WinEntry, StreakStats } from './types'
import { dateKey } from './schedule'

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
  return dateKey(w)
}

function isoMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Month key for a week (uses the Monday date of that week). */
function monthOfWeek(wk: string): string {
  const d = new Date(wk + 'T12:00:00')
  return isoMonthKey(d)
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

  // --- Grace: per month, max 2 weeks with exactly 1 loss are forgiven ---
  // Count 1-loss weeks per month
  const monthGraceCount = new Map<string, number>()
  for (const [wk, wr] of weekResults) {
    if (wr.losses === 1) {
      const mk = monthOfWeek(wk)
      monthGraceCount.set(mk, (monthGraceCount.get(mk) ?? 0) + 1)
    }
  }

  // Day streak: consecutive workdays with a win, going backwards from today
  // Weekends (Sat/Sun) are skipped. Only a 'loss' breaks the streak.
  // Missing entries on workdays are skipped (grace).
  let currentDayStreak = 0
  const cursor = new Date(now)
  cursor.setHours(0, 0, 0, 0)
  for (let i = 0; i < 365; i++) {
    const dow = cursor.getDay()
    if (dow === 0 || dow === 6) {
      // Skip weekends
      cursor.setDate(cursor.getDate() - 1)
      continue
    }
    const key = dateKey(cursor)
    const result = byDate.get(key)
    if (result === 'win') {
      currentDayStreak++
    } else if (result === 'loss') {
      break
    }
    // No entry on workday → skip (don't break streak)
    cursor.setDate(cursor.getDate() - 1)
  }

  // Week won:
  //   - 2+ losses → immediately lost
  //   - 0 losses, week fully played → won
  //   - 1 loss, week fully played → won IF month has ≤ 2 such grace weeks
  //   - not enough days played → not won yet
  function isWeekWon(wk: string): boolean {
    const wr = weekResults.get(wk)
    if (!wr || wr.played === 0) return false
    if (wr.losses >= 2) return false
    // Week must be substantially played (at least 5 days with entries)
    if (wr.played < 5) return false
    if (wr.losses === 0) return true
    // Exactly 1 loss — check month grace (max 2 grace weeks per month)
    const mk = monthOfWeek(wk)
    return (monthGraceCount.get(mk) ?? 0) <= 2
  }

  // Week is immediately lost (2+ losses, no need to wait for end of week)
  function isWeekLost(wk: string): boolean {
    const wr = weekResults.get(wk)
    if (!wr) return false
    return wr.losses >= 2
  }

  let currentWeekStreak = 0
  const weekCursor = new Date(now)
  for (let i = 0; i < 52; i++) {
    const wk = isoWeekKey(weekCursor)
    if (isWeekWon(wk)) {
      currentWeekStreak++
    } else if (isWeekLost(wk)) {
      break
    } else {
      // Incomplete or no entries — skip current week, break on past weeks
      const wr = weekResults.get(wk)
      if (i === 0 && (!wr || wr.played === 0 || !isWeekLost(wk))) {
        // skip current week (not yet resolved)
      } else {
        break
      }
    }
    weekCursor.setDate(weekCursor.getDate() - 7)
  }

  // Month won: all weeks in month are won
  function isMonthWon(mk: string): boolean {
    const mr = monthResults.get(mk)
    if (!mr || mr.played === 0) return false
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
