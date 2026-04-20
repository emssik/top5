import { dateKey } from './schedule'
import type { Habit, HabitSchedule, HabitLogEntry } from './types'

export const HABIT_ICONS: readonly string[] = [
  'flame', 'book', 'dumbbell', 'leaf', 'mic', 'pen', 'code', 'no-sugar', 'note', 'clock'
]

export const DEFAULT_FREEZE_AVAILABLE = 1

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDays(date: Date, n: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + n)
  return result
}

// Returns ISO week start (Monday) for a given date
function isoWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // adjust to Monday
  d.setDate(d.getDate() + diff)
  return d
}

export function isScheduledOn(habit: Habit, date: Date): boolean {
  const s = habit.schedule
  if (s.type === 'daily') return true
  if (s.type === 'weekdays') return s.days.includes(date.getDay()) // 0=Sun..6=Sat
  if (s.type === 'interval') {
    const start = parseDate(habit.createdAt)
    const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
    const dateMs = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const diff = Math.round((dateMs - startMs) / 86400000)
    return diff >= 0 && diff % s.every === 0
  }
  // nPerWeek, dailyMinutes, weeklyMinutes — always true (weekly scheduling)
  return true
}

export function dayStatus(habit: Habit, dk: string): 'empty' | 'l1' | 'l2' | 'l3' | 'l4' | 'freeze' | 'skip' {
  const entry: HabitLogEntry | undefined = habit.log[dk]
  if (!entry) return 'empty'
  if (entry.freeze) return 'freeze'
  if (entry.skip) return 'skip'
  if (entry.done) {
    if (habit.schedule.type === 'dailyMinutes' && entry.minutes != null) {
      const pct = entry.minutes / habit.schedule.minutes
      if (pct >= 1.5) return 'l4'
      if (pct >= 1.2) return 'l3'
      if (pct >= 1.0) return 'l2'
      return 'l1'
    }
    return 'l3'
  }
  return 'empty'
}

export function computeStreak(habit: Habit, today: Date = new Date()): { streak: number; best: number; unit: 'dni' | 'tyg' } {
  const start = parseDate(habit.createdAt)
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  if (habit.schedule.type === 'nPerWeek' || habit.schedule.type === 'weeklyMinutes') {
    const startWeek = isoWeekStart(start)
    const todayWeek = isoWeekStart(today)
    const nWeeks = Math.round((todayWeek.getTime() - startWeek.getTime()) / (7 * 86400000))
    const goal = habit.schedule.type === 'nPerWeek' ? habit.schedule.count : habit.schedule.minutes
    let wCur = 0
    let weekBest = 0
    for (let w = 0; w <= nWeeks; w++) {
      const wStart = addDays(startWeek, w * 7)
      let got = 0
      for (let d = 0; d < 7; d++) {
        const key = dateKey(addDays(wStart, d))
        const e = habit.log[key]
        if (!e || !e.done) continue
        got += habit.schedule.type === 'nPerWeek' ? 1 : (e.minutes ?? 0)
      }
      const isCurrent = w === nWeeks
      if (got >= goal) {
        wCur++
      } else if (!isCurrent) {
        weekBest = Math.max(weekBest, wCur)
        wCur = 0
      }
    }
    weekBest = Math.max(weekBest, wCur)
    return { streak: wCur, best: weekBest, unit: 'tyg' }
  }

  const startMs = start.getTime()
  const dayCount = Math.round((todayMs - startMs) / 86400000)
  let cur = 0
  let best = 0
  for (let i = 0; i <= dayCount; i++) {
    const d = addDays(start, i)
    if (!isScheduledOn(habit, d)) continue
    const key = dateKey(d)
    const status = dayStatus(habit, key)
    if (status === 'empty') {
      best = Math.max(best, cur)
      cur = 0
    } else {
      cur++
    }
  }
  best = Math.max(best, cur)
  return { streak: cur, best, unit: 'dni' }
}

export function weeklyProgress(habit: Habit, weekStart?: Date): { got: number; goal: number } {
  const wStart = weekStart ?? isoWeekStart(new Date())
  let got = 0
  for (let d = 0; d < 7; d++) {
    const key = dateKey(addDays(wStart, d))
    const e = habit.log[key]
    if (e && e.done) {
      got += habit.schedule.type === 'nPerWeek' ? 1 : (e.minutes ?? 0)
    }
  }
  const goal =
    habit.schedule.type === 'nPerWeek'
      ? habit.schedule.count
      : habit.schedule.type === 'weeklyMinutes'
        ? habit.schedule.minutes
        : 1
  return { got, goal }
}

export function scheduleLabel(schedule: HabitSchedule): string {
  if (schedule.type === 'daily') return 'Codziennie'
  if (schedule.type === 'weekdays') {
    const map = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'] // 0=Sun..6=Sat
    return schedule.days.map((d) => map[d]).join(' · ')
  }
  if (schedule.type === 'interval') return `Co ${schedule.every} dni`
  if (schedule.type === 'nPerWeek') return `${schedule.count}× w tygodniu`
  if (schedule.type === 'dailyMinutes') return `Min ${schedule.minutes} min/dzień`
  if (schedule.type === 'weeklyMinutes') return `Min ${schedule.minutes} min/tydzień`
  return ''
}
