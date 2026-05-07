import { nanoid } from 'nanoid'
import type { Task, QuickTask } from '../types'

export function nextSplitTitle(title: string): string {
  const match = title.match(/^\(✂(\d+)\) (.*)$/)
  if (match) return `(✂${Number(match[1]) + 1}) ${match[2]}`
  return `(✂1) ${title}`
}

export function cleanSplitTitle(title: string): string {
  return title.replace(/^\(✂\d+\)\s*/, '')
}

export function buildSplitTaskCopy(
  orig: Task,
  opts: { newTitle: string; noteRef: string; toDoNextOrderFallback: number }
): Task {
  return {
    id: nanoid(),
    title: opts.newTitle,
    completed: false,
    createdAt: new Date().toISOString(),
    isToDoNext: true,
    toDoNextOrder: orig.toDoNextOrder ?? opts.toDoNextOrderFallback,
    beyondLimit: true,
    noteRef: opts.noteRef,
    links: orig.links,
    important: orig.important,
    dueDate: orig.dueDate,
    cycleRole: orig.cycleRole,
    images: orig.images
  }
}

export function buildSplitQuickTaskCopy(
  orig: QuickTask,
  opts: { newTitle: string; noteRef: string }
): QuickTask {
  return {
    id: nanoid(),
    title: opts.newTitle,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: orig.order,
    beyondLimit: true,
    noteRef: opts.noteRef,
    important: orig.important,
    dueDate: orig.dueDate,
    projectId: orig.projectId
  }
}
