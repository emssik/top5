import { useMemo } from 'react'
import { useProjects } from './useProjects'
import type { RepeatingTask } from '../types'
import { getRepeatingTaskProposals } from '../../shared/schedule'
import { STANDALONE_PROJECT_ID } from '../utils/constants'

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
  noteRef?: string
}

export interface TaskListData {
  focusTask: MergedTask | null
  inProgressTasks: MergedTask[]
  upNextTasks: MergedTask[]
  activeTasks: MergedTask[]
  repeatingActive: MergedTask[]
  completedTasks: MergedTask[]
  proposals: RepeatingTask[]
  tomorrowProposals: RepeatingTask[]
  overflowTasks: MergedTask[]
  allActiveTasks: MergedTask[]
  limit: number
  configLimit: number
  activeSlots: number
  hasRepeatingSection: boolean
  hasCompletedSection: boolean
  isLocked: boolean
  lockedTaskIds: Set<string>
}

function isRepeating(task: { repeatingTaskId?: string | null }): boolean {
  return Boolean(task.repeatingTaskId)
}

/**
 * Shared hook for task list split (within-limit / overflow / repeating / completed).
 *
 * @param opts.excludeFocus — when true, the focus task is returned separately
 *   and excluded from activeTasks (used by TodayView which renders focus in its own section).
 *   When false/omitted, focus task stays in activeTasks (used by clean view).
 * @param opts.limitAdjust — offset added to config limit for the visual split (default 0).
 *   Used by TodayView to allow free drag between sections without changing the config.
 */
export function useTaskList(opts?: { excludeFocus?: boolean; limitAdjust?: number }): TaskListData {
  const {
    quickTasks,
    projects,
    config,
    repeatingTasks,
    dismissedRepeating,
    winsLock
  } = useProjects()

  const configLimit = config.quickTasksLimit ?? 5
  const limit = Math.max(1, configLimit + (opts?.limitAdjust ?? 0))
  const today = new Date().toISOString().slice(0, 10)
  const isLocked = winsLock?.locked ?? false
  const excludeFocus = opts?.excludeFocus ?? false

  const lockedTaskIds = useMemo(() => {
    if (!winsLock?.locked || !winsLock.lockedTasks) return new Set<string>()
    const ids = new Set<string>()
    for (const ref of winsLock.lockedTasks) {
      if (ref.kind === 'quick' && ref.quickTaskId) ids.add(ref.quickTaskId)
      if (ref.kind === 'pinned' && ref.taskId) ids.add(ref.taskId)
    }
    return ids
  }, [winsLock])

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.archivedAt && !p.suspendedAt),
    [projects]
  )

  // --- Build all active tasks ---

  const standaloneTasks: MergedTask[] = quickTasks
    .filter((t) => !t.completed)
    .map((t) => ({
      kind: 'quick' as const,
      id: t.id,
      title: t.title,
      order: t.order,
      taskNumber: t.taskNumber,
      repeatingTaskId: t.repeatingTaskId,
      inProgress: t.inProgress,
      noteRef: t.noteRef
    }))

  const pinnedTasks: MergedTask[] = activeProjects.flatMap((p) =>
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
        inProgress: t.inProgress,
        noteRef: t.noteRef
      }))
  )

  const allActiveTasks = [...standaloneTasks, ...pinnedTasks].sort((a, b) => a.order - b.order)

  // --- Proposals ---

  const proposals = useMemo(() => {
    return getRepeatingTaskProposals({
      repeatingTasks,
      quickTasks,
      dismissedRepeating
    })
  }, [repeatingTasks, quickTasks, dismissedRepeating, today])

  const tomorrowDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d
  }, [today])

  const tomorrowProposals = useMemo(() => {
    return getRepeatingTaskProposals({
      repeatingTasks,
      quickTasks,
      dismissedRepeating,
      date: tomorrowDate
    })
  }, [repeatingTasks, quickTasks, dismissedRepeating, tomorrowDate])

  // --- Focus task (only when excludeFocus) ---

  const focusTask = useMemo<MergedTask | null>(() => {
    if (!excludeFocus) return null
    const { focusProjectId, focusTaskId } = config
    if (!focusProjectId || !focusTaskId) return null

    if (focusProjectId === STANDALONE_PROJECT_ID) {
      const qt = quickTasks.find((t) => t.id === focusTaskId && !t.completed)
      if (!qt) return null
      return {
        kind: 'quick', id: qt.id, title: qt.title, order: qt.order,
        taskNumber: qt.taskNumber, inProgress: qt.inProgress,
        repeatingTaskId: qt.repeatingTaskId, noteRef: qt.noteRef
      }
    }

    const project = activeProjects.find((p) => p.id === focusProjectId)
    const task = project?.tasks.find((t) => t.id === focusTaskId)
    if (!project || !task || task.completed) return null

    return {
      kind: 'pinned', id: `pinned-${project.id}-${task.id}`,
      title: task.title, order: task.toDoNextOrder ?? 999,
      projectId: project.id, projectName: project.name,
      projectCode: project.code, taskId: task.id,
      taskNumber: task.taskNumber, inProgress: task.inProgress,
      noteRef: task.noteRef
    }
  }, [excludeFocus, config, quickTasks, activeProjects])

  // --- Completed today ---

  const todayCompletedStandalone: MergedTask[] = quickTasks
    .filter((t) => t.completed && t.completedAt?.startsWith(today))
    .map((t) => ({
      kind: 'quick' as const, id: t.id, title: t.title, order: t.order,
      completed: true, taskNumber: t.taskNumber, repeatingTaskId: t.repeatingTaskId
    }))

  const todayCompletedPinned: MergedTask[] = activeProjects.flatMap((p) =>
    p.tasks
      .filter((t) => t.isToDoNext && t.completed && t.completedAt?.startsWith(today))
      .map((t) => ({
        kind: 'pinned' as const, id: `pinned-${p.id}-${t.id}`,
        title: t.title, order: t.toDoNextOrder ?? 999, completed: true,
        projectId: p.id, projectName: p.name, projectCode: p.code,
        taskId: t.id, taskNumber: t.taskNumber
      }))
  )

  const completedTasks = [...todayCompletedStandalone, ...todayCompletedPinned]

  // --- Helpers ---

  function matchesFocus(task: MergedTask): boolean {
    if (!excludeFocus) return false
    const { focusProjectId, focusTaskId } = config
    if (!focusProjectId || !focusTaskId) return false
    if (task.kind === 'quick') return focusProjectId === STANDALONE_PROJECT_ID && focusTaskId === task.id
    return focusProjectId === task.projectId && focusTaskId === task.taskId
  }

  function isTaskLocked(task: MergedTask): boolean {
    if (!isLocked) return false
    if (task.kind === 'quick') return lockedTaskIds.has(task.id)
    if (task.kind === 'pinned' && task.taskId) return lockedTaskIds.has(task.taskId)
    return false
  }

  // --- Split: within-limit vs overflow ---

  const nonFocused = allActiveTasks.filter((t) => !matchesFocus(t))
  const repeatingActive = nonFocused.filter((t) => isRepeating(t))
  const regularActive = nonFocused.filter((t) => !isRepeating(t))

  // In-progress tasks get priority for limit slots (only when excludeFocus — TodayView)
  const orderedRegular = excludeFocus
    ? [...regularActive.filter((t) => t.inProgress), ...regularActive.filter((t) => !t.inProgress)]
    : regularActive

  const focusConsumesSlot = excludeFocus && focusTask ? !isRepeating(focusTask) : false
  const activeSlots = Math.max(0, limit - (focusConsumesSlot ? 1 : 0))

  let activeLimited: MergedTask[]
  let overflow: MergedTask[]

  if (isLocked) {
    // Lock-aware: locked tasks always stay within limit, non-locked go to overflow
    activeLimited = orderedRegular.filter((t) => isTaskLocked(t))
    overflow = orderedRegular.filter((t) => !isTaskLocked(t))
  } else {
    activeLimited = orderedRegular.slice(0, activeSlots)
    overflow = orderedRegular.slice(activeSlots)
  }

  // activeTasks = non-repeating within limit (QuickTasksView renders repeatingActive separately)
  const activeTasks = activeLimited
  // inProgressTasks/upNextTasks include repeating (TodayView splits by these)
  const allVisible = [...repeatingActive, ...activeLimited]
  const inProgressTasks = allVisible.filter((t) => t.inProgress)
  const upNextTasks = allVisible.filter((t) => !t.inProgress)

  const hasRepeatingSection = repeatingActive.length > 0 || proposals.length > 0
  const hasCompletedSection = completedTasks.length > 0

  return {
    focusTask,
    inProgressTasks,
    upNextTasks,
    activeTasks,
    repeatingActive,
    completedTasks,
    proposals,
    tomorrowProposals,
    overflowTasks: overflow,
    allActiveTasks,
    limit,
    configLimit,
    activeSlots,
    hasRepeatingSection,
    hasCompletedSection,
    isLocked,
    lockedTaskIds
  }
}
