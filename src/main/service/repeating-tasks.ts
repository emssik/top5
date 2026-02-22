import { randomUUID } from 'crypto'
import type { QuickTask, RepeatingTask } from '../../shared/types'
import {
  getData,
  setData,
  isValidRepeatingTask
} from '../store'
import { normalizeRepeatSchedule, dateKey } from '../../shared/schedule'

type ServiceError = { error: 'not_found' | 'validation' }

function normalizeRepeatingTask(task: RepeatingTask): RepeatingTask {
  return { ...task, schedule: normalizeRepeatSchedule(task.schedule) }
}

export function getRepeatingTasks(): RepeatingTask[] {
  return getData().repeatingTasks
}

export function saveRepeatingTask(input: unknown): RepeatingTask[] | ServiceError {
  if (!isValidRepeatingTask(input)) return { error: 'validation' }
  const data = getData()
  const repeatingTasks = [...data.repeatingTasks]
  const normalizedTask = normalizeRepeatingTask(input)
  const index = repeatingTasks.findIndex((t) => t.id === input.id)
  if (index >= 0) {
    repeatingTasks[index] = normalizedTask
  } else {
    normalizedTask.order = repeatingTasks.length
    repeatingTasks.push(normalizedTask)
  }
  setData('repeatingTasks', repeatingTasks)
  return repeatingTasks
}

export function removeRepeatingTask(id: string): RepeatingTask[] | ServiceError {
  const data = getData()
  if (!data.repeatingTasks.some((t) => t.id === id)) return { error: 'not_found' }
  const repeatingTasks = data.repeatingTasks.filter((t) => t.id !== id)
  setData('repeatingTasks', repeatingTasks)
  return repeatingTasks
}

export function reorderRepeatingTasks(orderedIds: unknown): RepeatingTask[] | ServiceError {
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === 'string')) return { error: 'validation' }
  const data = getData()
  const repeatingTasks = [...data.repeatingTasks]
  for (let i = 0; i < orderedIds.length; i++) {
    const task = repeatingTasks.find((t) => t.id === orderedIds[i])
    if (task) task.order = i
  }
  setData('repeatingTasks', repeatingTasks)
  return repeatingTasks
}

export function acceptRepeatingProposal(id: string, _forDate?: string): { quickTasks: QuickTask[]; repeatingTasks: RepeatingTask[] } | ServiceError {
  const data = getData()
  const repeatingTasks = [...data.repeatingTasks]
  const rt = repeatingTasks.find((t) => t.id === id)
  if (!rt) return { error: 'not_found' }
  const quickTasks = [...data.quickTasks]
  const newTask: QuickTask = {
    id: randomUUID().slice(0, 21),
    title: rt.title,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: quickTasks.filter((t) => !t.completed).length,
    repeatingTaskId: id,
    ...(rt.projectId ? { projectId: rt.projectId } : {})
  }
  quickTasks.push(newTask)
  setData('quickTasks', quickTasks)
  rt.acceptedCount = (rt.acceptedCount || 0) + 1
  setData('repeatingTasks', repeatingTasks)
  return { quickTasks, repeatingTasks }
}

export function dismissRepeatingProposal(id: string, forDate?: string): void | ServiceError {
  const data = getData()
  if (!data.repeatingTasks.some((t) => t.id === id)) return { error: 'not_found' }
  const dk = forDate || dateKey(new Date())
  const dismissedMap = { ...data.dismissedRepeating }
  const existing = dismissedMap[dk] ?? []
  if (!existing.includes(id)) {
    dismissedMap[dk] = [...existing, id]
  }
  setData('dismissedRepeating', dismissedMap)
  const repeatingTasks = [...data.repeatingTasks]
  const rt = repeatingTasks.find((t) => t.id === id)
  if (rt) {
    rt.dismissedCount = (rt.dismissedCount || 0) + 1
    setData('repeatingTasks', repeatingTasks)
  }
}
