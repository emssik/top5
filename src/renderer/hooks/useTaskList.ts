import { useMemo } from 'react'
import { useProjects } from './useProjects'
import type { RepeatingTask, RepeatSchedule } from '../types'

export interface MergedTask {
  kind: 'quick' | 'pinned'
  id: string
  title: string
  order: number
  completed?: boolean
  projectId?: string
  projectName?: string
  taskId?: string
  repeatingTaskId?: string | null
  inProgress?: boolean
}

export interface TaskListData {
  activeTasks: MergedTask[]
  repeatingActive: MergedTask[]
  completedTasks: MergedTask[]
  proposals: RepeatingTask[]
  overflowTasks: MergedTask[]
  allActiveTasks: MergedTask[]
  limit: number
  activeSlots: number
  hasRepeatingSection: boolean
  hasCompletedSection: boolean
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function isScheduleDueToday(schedule: RepeatSchedule, createdAt: string, lastCompletedAt: string | null): boolean {
  if (schedule.type === 'daily') return true
  if (schedule.type === 'weekdays') return schedule.days.includes(new Date().getDay())
  if (schedule.type === 'interval') return daysSince(createdAt) % schedule.days === 0
  if (schedule.type === 'afterCompletion') {
    if (!lastCompletedAt) return true
    return daysSince(lastCompletedAt) >= schedule.days
  }
  if (schedule.type === 'monthlyDay') {
    return new Date().getDate() === schedule.day
  }
  if (schedule.type === 'monthlyNthWeekday') {
    const today = new Date()
    if (today.getDay() !== schedule.weekday) return false
    const weekOfMonth = Math.ceil(today.getDate() / 7)
    return weekOfMonth === schedule.week
  }
  if (schedule.type === 'everyNMonths') {
    const today = new Date()
    if (today.getDate() !== schedule.day) return false
    const created = new Date(createdAt)
    const monthsDiff = (today.getFullYear() - created.getFullYear()) * 12 + (today.getMonth() - created.getMonth())
    return monthsDiff % schedule.months === 0
  }
  return false
}

export function useTaskList(): TaskListData {
  const {
    quickTasks,
    projects,
    config,
    repeatingTasks,
    dismissedRepeating,
    dismissedRepeatingDate
  } = useProjects()

  const limit = config.quickTasksLimit ?? 5
  const today = new Date().toISOString().slice(0, 10)

  const activeQuickTasks = quickTasks.filter((t) => !t.completed)

  const pinnedTasks: MergedTask[] = projects
    .filter((p) => !p.archivedAt)
    .flatMap((p) =>
      p.tasks
        .filter((t) => t.isToDoNext && !t.completed)
        .map((t) => ({
          kind: 'pinned' as const,
          id: `pinned-${p.id}-${t.id}`,
          title: t.title,
          order: t.toDoNextOrder ?? 999,
          projectId: p.id,
          projectName: p.name,
          taskId: t.id,
          inProgress: t.inProgress
        }))
    )

  const standaloneTasks: MergedTask[] = activeQuickTasks.map((t) => ({
    kind: 'quick' as const,
    id: t.id,
    title: t.title,
    order: t.order,
    repeatingTaskId: t.repeatingTaskId,
    inProgress: t.inProgress
  }))

  const allActiveTasks = [...standaloneTasks, ...pinnedTasks].sort((a, b) => a.order - b.order)

  const proposals = useMemo(() => {
    const todayDismissed = dismissedRepeatingDate === today ? dismissedRepeating : []
    return repeatingTasks
      .filter((rt) => {
        if (rt.startDate && today < rt.startDate) return false
        if (rt.endDate && today > rt.endDate) return false
        if (!isScheduleDueToday(rt.schedule, rt.createdAt, rt.lastCompletedAt)) return false
        if (todayDismissed.includes(rt.id)) return false
        if (quickTasks.some((qt) => qt.repeatingTaskId === rt.id && !qt.completed)) return false
        if (quickTasks.some((qt) => qt.repeatingTaskId === rt.id && qt.completed && qt.completedAt?.startsWith(today))) return false
        return true
      })
      .sort((a, b) => a.order - b.order)
  }, [repeatingTasks, quickTasks, dismissedRepeating, dismissedRepeatingDate, today])

  const todayCompletedStandalone: MergedTask[] = quickTasks
    .filter((t) => t.completed && t.completedAt?.startsWith(today))
    .map((t) => ({
      kind: 'quick' as const,
      id: t.id,
      title: t.title,
      order: t.order,
      completed: true,
      repeatingTaskId: t.repeatingTaskId
    }))

  const todayCompletedPinned: MergedTask[] = projects
    .filter((p) => !p.archivedAt)
    .flatMap((p) =>
      p.tasks
        .filter((t) => t.isToDoNext && t.completed && t.completedAt?.startsWith(today))
        .map((t) => ({
          kind: 'pinned' as const,
          id: `pinned-${p.id}-${t.id}`,
          title: t.title,
          order: t.toDoNextOrder ?? 999,
          completed: true,
          projectId: p.id,
          projectName: p.name,
          taskId: t.id
        }))
    )

  const completedTasks: MergedTask[] = [...todayCompletedStandalone, ...todayCompletedPinned]

  const regularActive = allActiveTasks.filter((t) => !t.repeatingTaskId)
  const repeatingActive = allActiveTasks.filter((t) => t.repeatingTaskId)
  const regularCompleted = completedTasks.filter((t) => !t.repeatingTaskId)

  const activeSlots = Math.max(0, limit - regularCompleted.length)
  const activeTasks = regularActive.slice(0, activeSlots)
  const overflowTasks = regularActive.slice(activeSlots)

  const hasRepeatingSection = repeatingActive.length > 0 || proposals.length > 0
  const hasCompletedSection = completedTasks.length > 0

  return {
    activeTasks,
    repeatingActive,
    completedTasks,
    proposals,
    overflowTasks,
    allActiveTasks,
    limit,
    activeSlots,
    hasRepeatingSection,
    hasCompletedSection
  }
}
