import { useState, useRef } from 'react'
import { nanoid } from 'nanoid'
import { useProjects } from '../hooks/useProjects'
import type { QuickTask } from '../types'

const STANDALONE_PROJECT_ID = '__standalone__'

interface MergedTask {
  kind: 'quick' | 'pinned'
  id: string
  title: string
  order: number
  completed?: boolean
  projectId?: string
  projectName?: string
  taskId?: string
}

interface Props {
  showAll?: boolean
  cleanView?: boolean
}

export default function QuickTasksView({ showAll, cleanView }: Props) {
  const {
    quickTasks,
    projects,
    config,
    saveProject,
    saveQuickTask,
    removeQuickTask,
    completeQuickTask,
    uncompleteQuickTask,
    reorderQuickTasks,
    toggleTaskToDoNext,
    setFocus
  } = useProjects()
  const [newTitle, setNewTitle] = useState('')
  const [completedPinned, setCompletedPinned] = useState<MergedTask[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const draggedId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const activeQuickTasks = quickTasks.filter((t) => !t.completed)

  // Merge standalone quick tasks with pinned project tasks
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
          taskId: t.id
        }))
    )

  const standaloneTasks: MergedTask[] = activeQuickTasks
    .map((t) => ({
      kind: 'quick' as const,
      id: t.id,
      title: t.title,
      order: t.order
    }))

  const allActiveTasks = [...standaloneTasks, ...pinnedTasks].sort((a, b) => a.order - b.order)
  const limit = config.quickTasksLimit ?? 5

  // Today's completed tasks (standalone + pinned completed this session)
  const today = new Date().toISOString().slice(0, 10)
  const todayCompletedStandalone: MergedTask[] = quickTasks
    .filter((t) => t.completed && t.completedAt?.startsWith(today))
    .map((t) => ({
      kind: 'quick' as const,
      id: t.id,
      title: t.title,
      order: t.order,
      completed: true
    }))
  const todayCompleted = [...todayCompletedStandalone, ...completedPinned]

  // On main tab: show up to limit slots total (active + today's completed = no backfill)
  // On all-tasks tab: show all active
  const activeSlots = showAll ? allActiveTasks.length : Math.max(0, limit - todayCompleted.length)
  const visibleActive = showAll ? allActiveTasks : allActiveTasks.slice(0, activeSlots)
  const visibleCompleted = showAll ? [] : todayCompleted

  const addTask = async () => {
    if (!newTitle.trim()) return
    const task: QuickTask = {
      id: nanoid(),
      title: newTitle.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      order: activeQuickTasks.length
    }
    await saveQuickTask(task)
    setNewTitle('')
  }

  const handleComplete = async (merged: MergedTask) => {
    if (merged.kind === 'quick') {
      await completeQuickTask(merged.id)
    } else if (merged.projectId && merged.taskId) {
      // Track pinned task as completed locally so it doesn't backfill
      setCompletedPinned((prev) => [...prev, { ...merged, completed: true }])
      const project = projects.find((p) => p.id === merged.projectId)
      if (!project) return
      const updatedTasks = project.tasks.map((t) =>
        t.id === merged.taskId ? { ...t, completed: true, isToDoNext: false } : t
      )
      await saveProject({ ...project, tasks: updatedTasks })
    }
  }

  const handleUncomplete = async (merged: MergedTask) => {
    if (merged.kind === 'quick') {
      await uncompleteQuickTask(merged.id)
    } else if (merged.projectId && merged.taskId) {
      // Restore pinned task: mark as not completed and re-pin
      const fresh = useProjects.getState().projects.find((p) => p.id === merged.projectId)
      if (!fresh) return
      const updatedTasks = fresh.tasks.map((t) =>
        t.id === merged.taskId ? { ...t, completed: false, isToDoNext: true } : t
      )
      await saveProject({ ...fresh, tasks: updatedTasks })
      setCompletedPinned((prev) => prev.filter((t) => t.id !== merged.id))
    }
  }

  const startEditing = (merged: MergedTask) => {
    setEditingId(merged.id)
    setEditingTitle(merged.title)
  }

  const saveEdit = async () => {
    if (!editingId || !editingTitle.trim()) {
      setEditingId(null)
      return
    }
    const quickTask = quickTasks.find((t) => t.id === editingId)
    if (quickTask) {
      await saveQuickTask({ ...quickTask, title: editingTitle.trim() })
    } else {
      // Pinned task — get fresh project from store to avoid overwriting isToDoNext etc.
      const match = editingId.match(/^pinned-(.+)-(.+)$/)
      if (match) {
        const [, projectId, taskId] = match
        const fresh = useProjects.getState().projects.find((p) => p.id === projectId)
        if (fresh) {
          const updatedTasks = fresh.tasks.map((t) =>
            t.id === taskId ? { ...t, title: editingTitle.trim() } : t
          )
          await saveProject({ ...fresh, tasks: updatedTasks })
        }
      }
    }
    setEditingId(null)
  }

  const handleRemove = async (merged: MergedTask) => {
    if (merged.kind === 'quick') {
      await removeQuickTask(merged.id)
    } else if (merged.projectId && merged.taskId) {
      await toggleTaskToDoNext(merged.projectId, merged.taskId)
    }
  }

  const handleFocus = (merged: MergedTask) => {
    if (merged.kind === 'quick') {
      setFocus(STANDALONE_PROJECT_ID, merged.id)
    } else if (merged.projectId && merged.taskId) {
      setFocus(merged.projectId, merged.taskId)
    }
  }

  const handleDragStart = (id: string) => {
    draggedId.current = id
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    setDragOverId(id)
  }

  const handleDrop = async (targetId: string) => {
    if (!draggedId.current || draggedId.current === targetId) return
    const ids = allActiveTasks.map((t) => t.id)
    const fromIdx = ids.indexOf(draggedId.current)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) return
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, draggedId.current)

    const taskMap = new Map(allActiveTasks.map((t) => [t.id, t]))
    const reordered = ids.map((id, i) => ({ ...taskMap.get(id)!, order: i }))

    for (const t of reordered.filter((t) => t.kind === 'quick')) {
      const existing = quickTasks.find((qt) => qt.id === t.id)
      if (existing && existing.order !== t.order) {
        await saveQuickTask({ ...existing, order: t.order })
      }
    }

    const pinnedByProject = new Map<string, { taskId: string; order: number }[]>()
    for (const t of reordered.filter((r) => r.kind === 'pinned')) {
      if (!t.projectId || !t.taskId) continue
      if (!pinnedByProject.has(t.projectId)) pinnedByProject.set(t.projectId, [])
      pinnedByProject.get(t.projectId)!.push({ taskId: t.taskId, order: t.order })
    }
    for (const [projectId, updates] of pinnedByProject) {
      const project = projects.find((p) => p.id === projectId)
      if (!project) continue
      const updatedTasks = project.tasks.map((task) => {
        const update = updates.find((u) => u.taskId === task.id)
        return update ? { ...task, toDoNextOrder: update.order } : task
      })
      await saveProject({ ...project, tasks: updatedTasks })
    }

    draggedId.current = null
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    draggedId.current = null
    setDragOverId(null)
  }

  const renderTask = (task: MergedTask) => {
    const isCompleted = task.completed
    const isDragOver = dragOverId === task.id && draggedId.current !== task.id

    // --- Clean view ---
    if (cleanView) {
      if (isCompleted) {
        return (
          <div key={task.id} className="group flex items-center gap-2 py-2.5 px-1 border-b border-border-subtle/50">
            <div className="w-5 flex-shrink-0 flex justify-center">
              <button
                onClick={() => handleUncomplete(task)}
                className="w-3.5 h-3.5 rounded-full border border-border-subtle bg-hover flex-shrink-0 flex items-center justify-center text-[9px] text-t-muted hover:border-t-secondary transition-colors"
                title="Mark as not done"
              >
                ✓
              </button>
            </div>
            <span className="text-[15px] text-t-muted/60 line-through truncate">{task.title}</span>
          </div>
        )
      }

      return (
        <div
          key={task.id}
          className={`group flex items-center gap-2 py-2.5 px-1 border-b border-border-subtle/50 transition-colors cursor-grab active:cursor-grabbing ${isDragOver ? 'bg-hover/50' : ''}`}
          draggable
          onDragStart={() => handleDragStart(task.id)}
          onDragOver={(e) => handleDragOver(e, task.id)}
          onDrop={() => handleDrop(task.id)}
        >
          {/* Left controls: visible on hover */}
          <div className="w-5 flex-shrink-0 flex justify-center">
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleFocus(task)}
                className="text-t-muted/50 hover:text-blue-400 transition-colors"
                title="Focus"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
              </button>
              <button
                onClick={() => handleComplete(task)}
                className="w-3 h-3 rounded-full border border-border-subtle hover:border-t-secondary transition-colors"
                title="Complete"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            {editingId === task.id ? (
              <input
                autoFocus
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onBlur={saveEdit}
                className="w-full text-[15px] bg-transparent text-t-primary focus:outline-none py-0"
              />
            ) : (
              <span
                onDoubleClick={() => startEditing(task)}
                className="text-[15px] text-t-primary truncate block cursor-default"
              >
                {task.title}
              </span>
            )}
          </div>
        </div>
      )
    }

    // --- Normal view ---
    if (isCompleted) {
      return (
        <div
          key={task.id}
          className="group flex items-center gap-2 py-1.5 px-3 rounded-lg"
        >
          <button
            onClick={() => handleUncomplete(task)}
            className="w-4 h-4 rounded border bg-hover border-border flex-shrink-0 flex items-center justify-center text-[10px] text-t-secondary hover:border-t-secondary transition-colors"
            title="Mark as not done"
          >
            ✓
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-t-muted line-through truncate block">
              {task.title}
            </span>
            {task.kind === 'pinned' && task.projectName && (
              <span className="text-[10px] text-blue-400/50">{task.projectName}</span>
            )}
          </div>
        </div>
      )
    }

    return (
      <div
        key={task.id}
        className={`group flex items-center gap-2 py-1.5 px-3 rounded-lg bg-card border transition-colors cursor-grab active:cursor-grabbing ${
          isDragOver ? 'border-blue-500/50' : 'border-border-subtle'
        }`}
        draggable
        onDragStart={() => handleDragStart(task.id)}
        onDragOver={(e) => handleDragOver(e, task.id)}
        onDrop={() => handleDrop(task.id)}
      >
        <button
          onClick={() => handleComplete(task)}
          className="w-4 h-4 rounded border border-border hover:border-t-secondary flex-shrink-0 transition-colors"
          title="Complete"
        />
        <div className="flex-1 min-w-0">
          {editingId === task.id ? (
            <input
              autoFocus
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') setEditingId(null)
              }}
              onBlur={saveEdit}
              className="w-full text-sm bg-surface border border-border rounded px-1 py-0.5 text-t-primary focus:outline-none focus:border-t-secondary"
            />
          ) : (
            <>
              <span
                onDoubleClick={() => startEditing(task)}
                className="text-sm text-t-primary truncate block cursor-default"
              >
                {task.title}
              </span>
              {task.kind === 'pinned' && task.projectName && (
                <span className="text-[10px] text-blue-400/70">{task.projectName}</span>
              )}
            </>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => handleFocus(task)}
            className="text-[10px] px-2 py-0.5 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 transition-colors"
            title="Focus on this task"
          >
            Focus
          </button>
          <button
            onClick={() => handleRemove(task)}
            className="text-[10px] px-1.5 py-0.5 rounded bg-surface hover:bg-hover text-t-secondary hover:text-red-400 transition-colors"
            title={task.kind === 'pinned' ? 'Unpin' : 'Remove'}
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cleanView ? '' : 'space-y-1'}>
      {visibleActive.length === 0 && visibleCompleted.length === 0 ? (
        <div className={`flex flex-col items-center justify-center text-t-secondary ${cleanView ? 'h-24' : 'h-40'}`}>
          <p className={cleanView ? 'text-[15px] text-t-muted' : 'text-sm'}>
            {cleanView ? 'No tasks' : 'No quick tasks yet'}
          </p>
          {!cleanView && <p className="text-xs text-t-muted mt-1">Add tasks below or pin project tasks</p>}
        </div>
      ) : (
        <div className={cleanView ? '' : 'space-y-1'} onDragEnd={handleDragEnd}>
          {visibleActive.map(renderTask)}
          {visibleCompleted.map(renderTask)}
        </div>
      )}

      {/* Add task input */}
      {!cleanView && (
        <div className="flex gap-2 pt-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="Add a quick task..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-t-primary text-sm placeholder:text-t-muted focus:outline-none focus:border-t-secondary"
          />
          <button
            onClick={addTask}
            className="px-3 py-1.5 rounded-lg bg-surface hover:bg-hover text-t-secondary text-sm transition-colors"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
