import { useState, useRef, useEffect } from 'react'
import { nanoid } from 'nanoid'
import { useProjects } from '../hooks/useProjects'
import { calcTaskTime, calcQuickTaskTime, formatCheckInTime } from '../utils/checkInTime'
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
    focusCheckIns,
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
  const editingIdRef = useRef<string | null>(null)
  const editingTitleRef = useRef('')
  const editingProjectIdRef = useRef<string | undefined>(undefined)
  const editingTaskIdRef = useRef<string | undefined>(undefined)
  const [showAddInput, setShowAddInput] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)
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

  // showAll: display all tasks with a separator at the limit position
  // Clean view: respect the limit (no backfill)
  const activeSlots = showAll ? allActiveTasks.length : Math.max(0, limit - todayCompleted.length)
  const visibleActive = showAll ? allActiveTasks : allActiveTasks.slice(0, activeSlots)
  const visibleCompleted = showAll ? [] : todayCompleted
  // For showAll mode: tasks above and below the clean view limit
  const aboveLimitTasks = showAll ? allActiveTasks.slice(0, limit) : visibleActive
  const belowLimitTasks = showAll ? allActiveTasks.slice(limit) : []

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
    setShowAddInput(false)
  }

  // Keyboard shortcut: 'n' to show add input (normal view only)
  useEffect(() => {
    if (cleanView) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setShowAddInput(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cleanView])

  useEffect(() => {
    if (showAddInput) addInputRef.current?.focus()
  }, [showAddInput])

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
    editingIdRef.current = merged.id
    editingTitleRef.current = merged.title
    editingProjectIdRef.current = merged.projectId
    editingTaskIdRef.current = merged.taskId
    setEditingId(merged.id)
    setEditingTitle(merged.title)
  }

  const saveEdit = () => {
    const id = editingIdRef.current
    const title = editingTitleRef.current
    const projectId = editingProjectIdRef.current
    const taskId = editingTaskIdRef.current
    if (!id || !title.trim()) {
      editingIdRef.current = null
      editingProjectIdRef.current = undefined
      editingTaskIdRef.current = undefined
      setEditingId(null)
      return
    }
    editingIdRef.current = null
    editingProjectIdRef.current = undefined
    editingTaskIdRef.current = undefined
    setEditingId(null)
    // Fire-and-forget: UI is already cleared, save in background
    const qt = useProjects.getState().quickTasks.find((t) => t.id === id)
    if (qt) {
      saveQuickTask({ ...qt, title: title.trim() })
    } else if (projectId && taskId) {
      const fresh = useProjects.getState().projects.find((p) => p.id === projectId)
      if (fresh) {
        const updatedTasks = fresh.tasks.map((t) =>
          t.id === taskId ? { ...t, title: title.trim() } : t
        )
        saveProject({ ...fresh, tasks: updatedTasks })
      }
    }
  }

  const cancelEdit = () => {
    editingIdRef.current = null
    editingProjectIdRef.current = undefined
    editingTaskIdRef.current = undefined
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

  const getTaskMinutes = (task: MergedTask): number => {
    if (task.kind === 'quick') return calcQuickTaskTime(focusCheckIns, task.id)
    if (task.taskId) return calcTaskTime(focusCheckIns, task.taskId)
    return 0
  }

  const renderTask = (task: MergedTask) => {
    const isCompleted = task.completed
    const isDragOver = dragOverId === task.id && draggedId.current !== task.id

    // --- Clean view (bullet journal style) ---
    if (cleanView) {
      const marker = isCompleted ? '×' : task.kind === 'pinned' ? '→' : '•'
      const mins = getTaskMinutes(task)
      const isFocused = !isCompleted && (
        (task.kind === 'quick' && config.focusProjectId === STANDALONE_PROJECT_ID && config.focusTaskId === task.id) ||
        (task.kind === 'pinned' && config.focusProjectId === task.projectId && config.focusTaskId === task.taskId)
      )

      return (
        <div
          key={task.id}
          className={`group flex items-baseline gap-2.5 py-[6px] transition-colors ${!isCompleted ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={isDragOver ? { opacity: 0.6 } : undefined}
          draggable={!isCompleted}
          onDragStart={!isCompleted ? () => handleDragStart(task.id) : undefined}
          onDragOver={!isCompleted ? (e) => handleDragOver(e, task.id) : undefined}
          onDrop={!isCompleted ? () => handleDrop(task.id) : undefined}
        >
          {/* Focus indicator */}
          {isFocused && (
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0 self-center -mr-1" />
          )}

          {/* Bullet marker — clickable */}
          <button
            onClick={() => isCompleted ? handleUncomplete(task) : handleComplete(task)}
            className="w-5 flex-shrink-0 text-center text-[22px] leading-none transition-opacity"
            style={{ opacity: isCompleted ? 0.3 : 0.5 }}
            title={isCompleted ? 'Mark as not done' : 'Complete'}
          >
            {marker}
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            {editingId === task.id ? (
              <input
                autoFocus
                value={editingTitle}
                onChange={(e) => { setEditingTitle(e.target.value); editingTitleRef.current = e.target.value }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') cancelEdit()
                }}
                onBlur={saveEdit}
                className="w-full text-[22px] bg-transparent focus:outline-none py-0"
                style={{ color: 'inherit' }}
              />
            ) : (
              <span
                onDoubleClick={() => !isCompleted && startEditing(task)}
                className={`text-[22px] leading-snug truncate block cursor-default ${isCompleted ? 'line-through' : ''}`}
                style={{ opacity: isCompleted ? 0.3 : 1 }}
              >
                {task.title}
              </span>
            )}
          </div>

          {/* Time + hover actions */}
          {isCompleted ? null : (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {mins > 0 && (
                <span className="text-[15px]" style={{ opacity: 0.25 }}>{formatCheckInTime(mins)}</span>
              )}
              <button
                onClick={() => handleFocus(task)}
                className="opacity-0 group-hover:opacity-40 hover:!opacity-70 transition-all"
                title="Focus"
                style={{ fontFamily: 'system-ui' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
              </button>
            </div>
          )}
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
              onChange={(e) => { setEditingTitle(e.target.value); editingTitleRef.current = e.target.value }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') cancelEdit()
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
        <div className={`flex flex-col items-center justify-center text-t-secondary ${cleanView ? 'h-16' : 'h-40'}`}>
          <p className={cleanView ? 'text-[22px]' : 'text-sm'} style={cleanView ? { opacity: 0.25 } : undefined}>
            {cleanView ? 'Brak zadań' : 'No quick tasks yet'}
          </p>
          {!cleanView && <p className="text-xs text-t-muted mt-1">Press <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-[10px]">n</kbd> to add a task or pin project tasks</p>}
        </div>
      ) : showAll ? (
        <div className="space-y-1" onDragEnd={handleDragEnd}>
          {aboveLimitTasks.map(renderTask)}
          {belowLimitTasks.length > 0 && (
            <div className="space-y-1 opacity-40 mt-2">
              {belowLimitTasks.map(renderTask)}
            </div>
          )}
        </div>
      ) : (
        <div className={cleanView ? '' : 'space-y-1'} onDragEnd={handleDragEnd}>
          {visibleActive.map(renderTask)}
          {visibleCompleted.map(renderTask)}
        </div>
      )}

      {/* Add task: "+" button toggles input, "n" shortcut */}
      {!cleanView && (
        <div className="pt-2">
          {showAddInput ? (
            <div className="flex gap-2">
              <input
                ref={addInputRef}
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTask()
                  if (e.key === 'Escape') { setShowAddInput(false); setNewTitle('') }
                }}
                onBlur={() => { if (!newTitle.trim()) { setShowAddInput(false); setNewTitle('') } }}
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
          ) : (
            <button
              onClick={() => setShowAddInput(true)}
              className="flex items-center gap-1 text-t-muted hover:text-t-secondary text-sm transition-colors"
              title="Add task (n)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add task
            </button>
          )}
        </div>
      )}
    </div>
  )
}
