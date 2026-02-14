import type { QuickTask } from '../../shared/types'
import { formatQuickTaskId } from '../../shared/taskId'
import {
  getData,
  setData,
  appendOperation,
  taskTimeMinutes,
  isValidQuickTask
} from '../store'

type ServiceError = { error: 'not_found' | 'validation' }

export function getQuickTasks(): QuickTask[] {
  return getData().quickTasks
}

export function saveQuickTask(input: unknown): QuickTask[] | ServiceError {
  if (!isValidQuickTask(input)) return { error: 'validation' }
  const data = getData()
  const quickTasks = [...data.quickTasks]
  const index = quickTasks.findIndex((t) => t.id === input.id)
  const isNew = index < 0
  if (index >= 0) {
    quickTasks[index] = input
  } else {
    input.order = quickTasks.filter((t) => !t.completed).length
    quickTasks.push(input)
  }
  if (isNew && input.taskNumber == null) {
    const data2 = getData()
    const nextNum = data2.nextQuickTaskNumber ?? 1
    input.taskNumber = nextNum
    data2.nextQuickTaskNumber = nextNum + 1
    setData('nextQuickTaskNumber', data2.nextQuickTaskNumber)
  }
  setData('quickTasks', quickTasks)
  if (isNew) {
    appendOperation({ type: 'quick_task_created', taskTitle: input.title, taskCode: formatQuickTaskId(input.taskNumber) || undefined })
  }
  return quickTasks
}

export function removeQuickTask(id: string): QuickTask[] | ServiceError {
  const data = getData()
  const removed = data.quickTasks.find((t) => t.id === id)
  if (!removed) return { error: 'not_found' }
  const quickTasks = data.quickTasks.filter((t) => t.id !== id)
  setData('quickTasks', quickTasks)
  appendOperation({ type: 'quick_task_deleted', taskTitle: removed.title, taskCode: formatQuickTaskId(removed.taskNumber) || undefined })
  return quickTasks
}

export function completeQuickTask(id: string): QuickTask[] | ServiceError {
  const data = getData()
  const quickTasks = [...data.quickTasks]
  const task = quickTasks.find((t) => t.id === id)
  if (!task) return { error: 'not_found' }
  task.completed = true
  task.completedAt = new Date().toISOString()
  task.inProgress = false
  setData('quickTasks', quickTasks)
  const mins = taskTimeMinutes(task.id)
  appendOperation({ type: 'quick_task_completed', taskTitle: task.title, taskCode: formatQuickTaskId(task.taskNumber) || undefined, ...(mins > 0 && { details: `${mins}min` }) })
  // Update repeating task stats
  if (task.repeatingTaskId) {
    const repeatingTasks = [...data.repeatingTasks]
    const rt = repeatingTasks.find((r) => r.id === task.repeatingTaskId)
    if (rt) {
      rt.completedCount = (rt.completedCount || 0) + 1
      if (rt.schedule.type === 'afterCompletion') {
        rt.lastCompletedAt = task.completedAt
      }
      setData('repeatingTasks', repeatingTasks)
    }
  }
  return quickTasks
}

export function uncompleteQuickTask(id: string): QuickTask[] | ServiceError {
  const data = getData()
  const quickTasks = [...data.quickTasks]
  const task = quickTasks.find((t) => t.id === id)
  if (!task) return { error: 'not_found' }
  task.completed = false
  task.completedAt = null
  task.order = quickTasks.filter((t) => !t.completed).length
  setData('quickTasks', quickTasks)
  appendOperation({ type: 'quick_task_uncompleted', taskTitle: task.title, taskCode: formatQuickTaskId(task.taskNumber) || undefined })
  return quickTasks
}

export function reorderQuickTasks(orderedIds: unknown): QuickTask[] | ServiceError {
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === 'string')) return { error: 'validation' }
  const data = getData()
  const quickTasks = [...data.quickTasks]
  for (let i = 0; i < orderedIds.length; i++) {
    const task = quickTasks.find((t) => t.id === orderedIds[i])
    if (task) task.order = i
  }
  setData('quickTasks', quickTasks)
  return quickTasks
}

export function toggleQuickTaskInProgress(id: string): QuickTask[] | ServiceError {
  const data = getData()
  const quickTasks = [...data.quickTasks]
  const task = quickTasks.find((t) => t.id === id)
  if (!task) return { error: 'not_found' }
  if (!task.completed) {
    task.inProgress = !task.inProgress
    setData('quickTasks', quickTasks)
  }
  return quickTasks
}
