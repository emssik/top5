import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { LockedTaskRef, WinsLockState, WinEntry, StreakStats } from '../../shared/types'
import { calcStreaks } from '../../shared/wins'
import { getData, setData, getConfigDir, appendOperation } from '../store'

const WINS_FILE_NAME = 'wins.jsonl'

function winsFilePath(): string {
  return join(getConfigDir(), WINS_FILE_NAME)
}

export function getWinsFilePath(): string {
  return winsFilePath()
}

function calcDeadline(lockedAt: Date): string {
  const hour = lockedAt.getHours()
  const deadline = new Date(lockedAt)
  if (hour >= 12) {
    // Next day midnight
    deadline.setDate(deadline.getDate() + 1)
  }
  deadline.setHours(23, 59, 59, 999)
  return deadline.toISOString()
}

export function lockTasks(tasks: LockedTaskRef[]): WinsLockState {
  if (tasks.length === 0) {
    return { locked: false, lockedAt: null, deadline: null, lockedTasks: [] }
  }

  const now = new Date()
  const lockState: WinsLockState = {
    locked: true,
    lockedAt: now.toISOString(),
    deadline: calcDeadline(now),
    lockedTasks: tasks
  }

  setData('winsLock', lockState)
  return lockState
}

export function unlockTasks(): WinsLockState {
  const empty: WinsLockState = { locked: false, lockedAt: null, deadline: null, lockedTasks: [] }
  setData('winsLock', empty)
  return empty
}

export function checkWinCondition(): boolean {
  const data = getData()
  const lock = data.winsLock
  if (!lock?.locked || !lock.lockedTasks.length) return false

  const quickTasks = data.quickTasks
  const projects = data.projects

  let completedCount = 0
  for (const ref of lock.lockedTasks) {
    if (ref.kind === 'quick' && ref.quickTaskId) {
      const qt = quickTasks.find((t) => t.id === ref.quickTaskId)
      if (qt?.completed) completedCount++
    } else if (ref.kind === 'pinned' && ref.projectId && ref.taskId) {
      const project = projects.find((p) => p.id === ref.projectId)
      const task = project?.tasks.find((t) => t.id === ref.taskId)
      if (task?.completed) completedCount++
    }
  }

  if (completedCount >= lock.lockedTasks.length) {
    resolveDay('win', lock, completedCount)
    return true
  }

  return false
}

export function checkDeadline(): boolean {
  const data = getData()
  const lock = data.winsLock
  if (!lock?.locked || !lock.deadline) return false

  const now = new Date()
  const deadline = new Date(lock.deadline)
  if (now <= deadline) return false

  // Count completed at deadline time
  const quickTasks = data.quickTasks
  const projects = data.projects
  let completedCount = 0
  for (const ref of lock.lockedTasks) {
    if (ref.kind === 'quick' && ref.quickTaskId) {
      const qt = quickTasks.find((t) => t.id === ref.quickTaskId)
      if (qt?.completed) completedCount++
    } else if (ref.kind === 'pinned' && ref.projectId && ref.taskId) {
      const project = projects.find((p) => p.id === ref.projectId)
      const task = project?.tasks.find((t) => t.id === ref.taskId)
      if (task?.completed) completedCount++
    }
  }

  // If all completed, it's a win (deadline passed but everything done)
  const result = completedCount >= lock.lockedTasks.length ? 'win' : 'loss'
  resolveDay(result, lock, completedCount)
  return true
}

function resolveDay(result: 'win' | 'loss', lock: WinsLockState, completedCount: number): void {
  const entry: WinEntry = {
    id: randomUUID().slice(0, 21),
    date: (lock.lockedAt ?? new Date().toISOString()).slice(0, 10),
    lockedAt: lock.lockedAt ?? new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
    result,
    taskCount: lock.lockedTasks.length,
    completedCount
  }

  // Compute streaks BEFORE appending (to detect milestone transitions)
  const historyBefore = loadWinHistory()
  const streaksBefore = calcStreaks(historyBefore)

  const filePath = winsFilePath()
  mkdirSync(getConfigDir(), { recursive: true })
  appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8')

  // Clear lock
  const empty: WinsLockState = { locked: false, lockedAt: null, deadline: null, lockedTasks: [] }
  setData('winsLock', empty)

  // Log day result
  appendOperation({
    type: result === 'win' ? 'wins_day_won' : 'wins_day_lost',
    details: `${completedCount}/${lock.lockedTasks.length} tasks`
  })

  // Compute streaks AFTER to detect week/month milestone changes
  const streaksAfter = calcStreaks([...historyBefore, entry])

  if (streaksAfter.currentWeekStreak > streaksBefore.currentWeekStreak) {
    appendOperation({ type: 'wins_week_won', details: `Week streak: ${streaksAfter.currentWeekStreak}` })
  } else if (streaksBefore.currentWeekStreak > 0 && streaksAfter.currentWeekStreak === 0) {
    appendOperation({ type: 'wins_week_lost' })
  }

  if (streaksAfter.currentMonthStreak > streaksBefore.currentMonthStreak) {
    appendOperation({ type: 'wins_month_won', details: `Month streak: ${streaksAfter.currentMonthStreak}` })
  } else if (streaksBefore.currentMonthStreak > 0 && streaksAfter.currentMonthStreak === 0) {
    appendOperation({ type: 'wins_month_lost' })
  }
}

export function loadWinHistory(): WinEntry[] {
  const filePath = winsFilePath()
  if (!existsSync(filePath)) return []
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const entries: WinEntry[] = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line) as WinEntry
        if (entry.id && entry.date && entry.result) {
          entries.push(entry)
        }
      } catch {
        // skip malformed
      }
    }
    return entries
  } catch {
    return []
  }
}

export function getStreaks(): StreakStats {
  const entries = loadWinHistory()
  return calcStreaks(entries)
}
