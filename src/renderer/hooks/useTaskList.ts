import { useMemo } from 'react'
import { useProjects } from './useProjects'
import type { RepeatingTask } from '../types'
import { getRepeatingTaskProposals } from '../../shared/schedule'

export interface MergedTask {
  kind: 'quick' | 'pinned'
  id: string
  title: string
  order: number
  completed?: boolean
  projectId?: string
  projectName?: string
  projectCode?: string
  taskId?: string
  taskNumber?: number
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
          projectCode: p.code,
          taskId: t.id,
          taskNumber: t.taskNumber,
          inProgress: t.inProgress
        }))
    )

  const standaloneTasks: MergedTask[] = activeQuickTasks.map((t) => ({
    kind: 'quick' as const,
    id: t.id,
    title: t.title,
    order: t.order,
    taskNumber: t.taskNumber,
    repeatingTaskId: t.repeatingTaskId,
    inProgress: t.inProgress
  }))

  const allActiveTasks = [...standaloneTasks, ...pinnedTasks].sort((a, b) => a.order - b.order)

  const proposals = useMemo(() => {
    return getRepeatingTaskProposals({
      repeatingTasks,
      quickTasks,
      dismissedRepeating,
      dismissedRepeatingDate
    })
  }, [repeatingTasks, quickTasks, dismissedRepeating, dismissedRepeatingDate, today])

  const todayCompletedStandalone: MergedTask[] = quickTasks
    .filter((t) => t.completed && t.completedAt?.startsWith(today))
    .map((t) => ({
      kind: 'quick' as const,
      id: t.id,
      title: t.title,
      order: t.order,
      completed: true,
      taskNumber: t.taskNumber,
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
          projectCode: p.code,
          taskId: t.id,
          taskNumber: t.taskNumber
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
