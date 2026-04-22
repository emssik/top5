import { randomUUID } from 'crypto'
import type { Habit, HabitTodayEntry } from '../../shared/types'
import { getData, setData, isRecord, appendOperation } from '../store'
import { dateKey } from '../../shared/schedule'
import { addDays, isoWeekStart, isScheduledOn, computeStreak } from '../../shared/habit-schedule'

type ServiceError = { error: 'not_found' | 'validation' }

export function isValidHabit(v: unknown): v is Habit {
  if (!isRecord(v)) return false
  const { id, name, icon, createdAt, schedule, log, order } = v
  if (typeof id !== 'string' || typeof name !== 'string') return false
  if (typeof icon !== 'string' || typeof createdAt !== 'string') return false
  if (typeof order !== 'number') return false
  const validScheduleTypes = ['daily', 'weekdays', 'nPerWeek', 'interval', 'dailyMinutes', 'weeklyMinutes']
  if (!isRecord(schedule) || !validScheduleTypes.includes((schedule as Record<string, unknown>).type as string)) return false
  if (!isRecord(log)) return false
  return true
}

export function getHabits(): Habit[] {
  return getData().habits ?? []
}

export function saveHabit(input: unknown): Habit[] | ServiceError {
  if (!isValidHabit(input)) return { error: 'validation' }
  const data = getData()
  const habits = [...(data.habits ?? [])]
  const index = habits.findIndex((h) => h.id === input.id)
  if (index >= 0) {
    habits[index] = { ...input, order: habits[index].order, id: habits[index].id }
  } else {
    const maxOrder = habits.reduce((m, h) => Math.max(m, h.order), -1)
    const newHabit: Habit = { ...input, id: randomUUID().slice(0, 21), order: maxOrder + 1 }
    habits.push(newHabit)
  }
  setData('habits', habits)
  return habits
}

export function removeHabit(id: string): Habit[] | ServiceError {
  const data = getData()
  const habits = data.habits ?? []
  if (!habits.some((h) => h.id === id)) return { error: 'not_found' }
  const updated = habits.filter((h) => h.id !== id)
  setData('habits', updated)
  return updated
}

export function reorderHabits(orderedIds: unknown): Habit[] | ServiceError {
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === 'string')) return { error: 'validation' }
  const data = getData()
  const habits = [...(data.habits ?? [])]
  for (let i = 0; i < orderedIds.length; i++) {
    const habit = habits.find((h) => h.id === orderedIds[i])
    if (habit) habit.order = i
  }
  setData('habits', habits)
  return habits
}

export function tickHabit(id: string, mode: 'done' | 'freeze' | 'skip' | 'undo'): Habit[] | ServiceError {
  const data = getData()
  const habits = [...(data.habits ?? [])]
  const habit = habits.find((h) => h.id === id)
  if (!habit) return { error: 'not_found' }

  const today = dateKey(new Date())

  if (mode === 'undo') {
    const prev = habit.log[today]
    const wasFreeze = prev?.freeze === true
    const newLog = { ...habit.log }
    delete newLog[today]
    habit.log = newLog
    if (wasFreeze) habit.freezeAvailable = (habit.freezeAvailable ?? 0) + 1
  } else if (mode === 'freeze') {
    if ((habit.freezeAvailable ?? 0) <= 0) return { error: 'validation' }
    habit.freezeAvailable = habit.freezeAvailable - 1
    habit.log = { ...habit.log, [today]: { freeze: true } }
  } else if (mode === 'skip') {
    habit.log = { ...habit.log, [today]: { skip: true } }
  } else {
    const existing = habit.log[today] ?? {}
    habit.log = { ...habit.log, [today]: { ...existing, done: true } }
  }

  setData('habits', habits)
  if (mode === 'done') appendOperation({ type: 'habit_ticked', taskTitle: habit.name, details: today })
  else if (mode === 'freeze') appendOperation({ type: 'habit_freeze', taskTitle: habit.name, details: today })
  else if (mode === 'skip') appendOperation({ type: 'habit_skip', taskTitle: habit.name, details: today })
  return habits
}

export function retroTickHabit(id: string, dk: string, action: 'done' | 'freeze' | 'skip' | 'clear'): Habit[] | ServiceError {
  const data = getData()
  const habits = [...(data.habits ?? [])]
  const habit = habits.find((h) => h.id === id)
  if (!habit) return { error: 'not_found' }

  const prev = habit.log[dk]
  const newLog = { ...habit.log }

  if (action === 'clear') {
    const wasFreeze = prev?.freeze === true
    delete newLog[dk]
    habit.log = newLog
    if (wasFreeze) habit.freezeAvailable = (habit.freezeAvailable ?? 0) + 1
  } else if (action === 'freeze') {
    const wasFreeze = prev?.freeze === true
    if (!wasFreeze) {
      if ((habit.freezeAvailable ?? 0) <= 0) return { error: 'validation' }
      habit.freezeAvailable = habit.freezeAvailable - 1
    }
    habit.log = { ...newLog, [dk]: { freeze: true } }
  } else if (action === 'skip') {
    habit.log = { ...newLog, [dk]: { skip: true } }
  } else {
    const existing = newLog[dk] ?? {}
    habit.log = { ...newLog, [dk]: { ...existing, done: true } }
  }

  setData('habits', habits)
  if (action === 'done') appendOperation({ type: 'habit_ticked', taskTitle: habit.name, details: dk })
  else if (action === 'freeze') appendOperation({ type: 'habit_freeze', taskTitle: habit.name, details: dk })
  else if (action === 'skip') appendOperation({ type: 'habit_skip', taskTitle: habit.name, details: dk })
  return habits
}

export function logHabitMinutes(id: string, minutes: number): Habit[] | ServiceError {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return { error: 'validation' }
  const data = getData()
  const habits = [...(data.habits ?? [])]
  const habit = habits.find((h) => h.id === id)
  if (!habit) return { error: 'not_found' }

  const now = new Date()
  const today = dateKey(now)
  const existing = habit.log[today] ?? {}
  const total = (existing.minutes ?? 0) + minutes

  let isDone = existing.done ?? false
  if (habit.schedule.type === 'dailyMinutes') {
    isDone = total >= habit.schedule.minutes
  } else if (habit.schedule.type === 'weeklyMinutes') {
    const weekStart = isoWeekStart(now)
    let weekSum = 0
    for (let d = 0; d < 7; d++) {
      const k = dateKey(addDays(weekStart, d))
      weekSum += k === today ? total : (habit.log[k]?.minutes ?? 0)
    }
    isDone = weekSum >= habit.schedule.minutes
  }

  habit.log = { ...habit.log, [today]: { ...existing, minutes: total, done: isDone } }

  setData('habits', habits)
  return habits
}

function buildHabitEntry(habit: Habit, today: Date, dk: string): HabitTodayEntry {
  const isScheduled = isScheduledOn(habit, today)
  const logEntry = habit.log[dk]
  let status: HabitTodayEntry['status'] = 'pending'
  if (logEntry?.done) status = 'done'
  else if (logEntry?.freeze) status = 'freeze'
  else if (logEntry?.skip) status = 'skip'

  const { streak, unit } = computeStreak(habit, today)

  const entry: HabitTodayEntry = {
    id: habit.id,
    name: habit.name,
    icon: habit.icon,
    projectId: habit.projectId ?? null,
    schedule: habit.schedule,
    isScheduled,
    status,
    streak,
    streakUnit: unit
  }

  if (habit.schedule.type === 'dailyMinutes') {
    entry.minutesToday = logEntry?.minutes ?? 0
    entry.minutesGoal = habit.schedule.minutes
  } else if (habit.schedule.type === 'weeklyMinutes') {
    const weekStart = isoWeekStart(today)
    let weekSum = 0
    for (let d = 0; d < 7; d++) {
      weekSum += habit.log[dateKey(addDays(weekStart, d))]?.minutes ?? 0
    }
    entry.minutesToday = weekSum
    entry.minutesGoal = habit.schedule.minutes
  }

  return entry
}

export function getTodayHabits(date?: Date): HabitTodayEntry[] {
  const today = date ?? new Date()
  const dk = dateKey(today)
  return (getData().habits ?? [])
    .filter((h) => !h.archivedAt && isScheduledOn(h, today))
    .sort((a, b) => a.order - b.order)
    .map((h) => buildHabitEntry(h, today, dk))
}

export function getHabitsSummary(date?: Date): HabitTodayEntry[] {
  const today = date ?? new Date()
  const dk = dateKey(today)
  return (getData().habits ?? [])
    .filter((h) => !h.archivedAt)
    .sort((a, b) => a.order - b.order)
    .map((h) => buildHabitEntry(h, today, dk))
}

// Re-export for use in IPC type narrowing
export { isRecord }
