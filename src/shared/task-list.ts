/**
 * Shared task-list logic for computing visible (within-limit) tasks.
 * Single source of truth — used by main process (nudge, clean-view sizing).
 * Renderer's useTaskList layers React-specific extras (focus, winsLock, proposals) on top.
 */
import type { QuickTask, Task, Project, WinsLockState } from './types'
import { dateKey } from './schedule'

export interface VisibleTask {
  kind: 'quick' | 'pinned'
  id: string
  title: string
  order: number
  projectId?: string
  projectName?: string
  projectCode?: string
  taskId?: string
  taskNumber?: number
  repeatingTaskId?: string | null
  inProgress?: boolean
  dueDate?: string | null
  beyondLimit?: boolean
}

interface GetVisibleTasksInput {
  quickTasks: QuickTask[]
  projects: Project[]
  configLimit: number
  winsLock?: WinsLockState | null
}

export interface VisibleTasksResult {
  /** Repeating quick tasks (always visible, don't count against limit) */
  repeating: VisibleTask[]
  /** Scheduled tasks: due today or overdue (always visible, don't count against limit) */
  scheduled: VisibleTask[]
  /** Regular tasks within the config limit */
  withinLimit: VisibleTask[]
  /** Regular tasks beyond the config limit (overflow) */
  overflow: VisibleTask[]
  /** All visible tasks combined (repeating + scheduled + withinLimit) */
  allVisible: VisibleTask[]
}

export function getVisibleTasks(input: GetVisibleTasksInput): VisibleTasksResult {
  const { quickTasks, projects, configLimit, winsLock } = input
  const today = dateKey(new Date())
  const isLocked = winsLock?.locked ?? false
  const lockedTaskIds = new Set(
    (winsLock?.lockedTasks ?? []).flatMap((ref) =>
      [ref.quickTaskId, ref.taskId].filter(Boolean) as string[]
    )
  )

  const activeProjects = projects.filter((p) => !p.archivedAt && !p.suspendedAt)

  // Build all active tasks (same as useTaskList lines 96-135)
  const standalone: VisibleTask[] = quickTasks
    .filter((t) => !t.completed)
    .map((t) => {
      const proj = t.projectId ? projects.find((p) => p.id === t.projectId) : null
      return {
        kind: 'quick' as const,
        id: t.id,
        title: t.title,
        order: t.order,
        taskNumber: t.taskNumber,
        projectName: proj?.name,
        projectCode: proj?.code,
        repeatingTaskId: t.repeatingTaskId,
        inProgress: t.inProgress,
        dueDate: t.dueDate,
        beyondLimit: t.beyondLimit
      }
    })

  const pinned: VisibleTask[] = activeProjects.flatMap((p) =>
    p.tasks
      .filter((t: Task) => t.isToDoNext && !t.completed)
      .map((t: Task) => ({
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
        dueDate: t.dueDate,
        beyondLimit: t.beyondLimit
      }))
  )

  const allActive = [...standalone, ...pinned].sort((a, b) => a.order - b.order)

  // Split: repeating vs regular (same as useTaskList lines 246-247)
  const repeating = allActive.filter((t) => Boolean(t.repeatingTaskId))
  const regular = allActive.filter((t) => !t.repeatingTaskId)

  // Scheduled tasks: due today or overdue — always visible, don't count against limit
  const scheduled = regular.filter((t) => t.dueDate && t.dueDate <= today)
  const scheduledIds = new Set(scheduled.map((t) => t.id))
  const nonScheduled = regular.filter((t) => !scheduledIds.has(t.id))

  // In-progress get priority for limit slots
  const ordered = [
    ...nonScheduled.filter((t) => t.inProgress),
    ...nonScheduled.filter((t) => !t.inProgress)
  ]

  let withinLimit: VisibleTask[]
  let overflow: VisibleTask[]

  if (isLocked) {
    // Lock-aware: only locked tasks stay within limit, rest goes to overflow
    const isTaskLocked = (t: VisibleTask): boolean => {
      if (t.kind === 'quick') return lockedTaskIds.has(t.id)
      if (t.kind === 'pinned' && t.taskId) return lockedTaskIds.has(t.taskId)
      return false
    }
    withinLimit = ordered.filter((t) => isTaskLocked(t))
    overflow = ordered.filter((t) => !isTaskLocked(t))
  } else {
    // beyondLimit=true → forced overflow, rest subject to configLimit
    const forced = ordered.filter((t) => t.beyondLimit)
    const eligible = ordered.filter((t) => !t.beyondLimit)
    withinLimit = eligible.slice(0, configLimit)
    const naturalOverflow = eligible.slice(configLimit)
    overflow = [...naturalOverflow, ...forced].sort((a, b) => a.order - b.order)
  }

  const allVisible = [...repeating, ...scheduled, ...withinLimit]

  return { repeating, scheduled, withinLimit, overflow, allVisible }
}
