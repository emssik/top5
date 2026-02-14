import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useProjects } from '../hooks/useProjects'
import { calcQuickTaskTime, calcTaskTime, formatCheckInTime } from '../utils/checkInTime'
import { STANDALONE_PROJECT_ID } from '../utils/constants'
import type { QuickTask, RepeatingTask } from '../types'
import { projectColorValue } from '../utils/projects'
import { getRepeatingTaskProposals } from '../../shared/schedule'

interface ActiveTask {
  kind: 'quick' | 'pinned'
  id: string
  title: string
  order: number
  quickTaskId?: string
  projectId?: string
  projectName?: string
  taskId?: string
  inProgress?: boolean
  repeatingTaskId?: string | null
}

interface CompletedTask {
  kind: 'quick' | 'pinned'
  id: string
  title: string
  quickTaskId?: string
  projectId?: string
  projectName?: string
  taskId?: string
  repeatingTaskId?: string | null
}

function matchesFocus(task: ActiveTask, focusProjectId: string | null, focusTaskId: string | null): boolean {
  if (!focusProjectId || !focusTaskId) return false
  if (task.kind === 'quick') {
    return focusProjectId === STANDALONE_PROJECT_ID && focusTaskId === task.quickTaskId
  }
  return focusProjectId === task.projectId && focusTaskId === task.taskId
}

function formatFocusTimer(seconds: number): string {
  const mm = Math.floor(seconds / 60)
  const ss = seconds % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function isRepeatingEntry(task: { repeatingTaskId?: string | null }): boolean {
  return Boolean(task.repeatingTaskId)
}

export default function TodayView() {
  const {
    projects,
    quickTasks,
    repeatingTasks,
    dismissedRepeating,
    dismissedRepeatingDate,
    config,
    focusCheckIns,
    saveProject,
    saveQuickTask,
    removeQuickTask,
    completeQuickTask,
    uncompleteQuickTask,
    reorderQuickTasks,
    toggleQuickTaskInProgress,
    toggleTaskInProgress,
    toggleTaskToDoNext,
    setFocus,
    acceptRepeatingProposal,
    dismissRepeatingProposal
  } = useProjects()

  const [showAddInput, setShowAddInput] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [showOverflow, setShowOverflow] = useState(false)
  const [focusTick, setFocusTick] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editingKindRef = useRef<'quick' | 'pinned' | null>(null)
  const editingQuickTaskIdRef = useRef<string | undefined>(undefined)
  const editingProjectIdRef = useRef<string | undefined>(undefined)
  const editingTaskIdRef = useRef<string | undefined>(undefined)
  const addInputRef = useRef<HTMLInputElement | null>(null)
  const draggedId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const activeProjects = useMemo(
    () => projects.filter((project) => !project.archivedAt && !project.suspendedAt),
    [projects]
  )

  const allActive = useMemo<ActiveTask[]>(() => {
    const activeQuick = quickTasks
      .filter((task) => !task.completed)
      .map((task) => ({
        kind: 'quick' as const,
        id: task.id,
        quickTaskId: task.id,
        title: task.title,
        order: task.order,
        inProgress: task.inProgress,
        repeatingTaskId: task.repeatingTaskId
      }))

    const pinned = activeProjects.flatMap((project) =>
      project.tasks
        .filter((task) => task.isToDoNext && !task.completed)
        .map((task) => ({
          kind: 'pinned' as const,
          id: `pinned-${project.id}-${task.id}`,
          title: task.title,
          order: task.toDoNextOrder ?? 999,
          projectId: project.id,
          projectName: project.name,
          taskId: task.id,
          inProgress: task.inProgress
        }))
    )

    return [...activeQuick, ...pinned].sort((a, b) => a.order - b.order)
  }, [activeProjects, quickTasks])

  const focusTask = useMemo<ActiveTask | null>(() => {
    const focusProjectId = config.focusProjectId
    const focusTaskId = config.focusTaskId
    if (!focusProjectId || !focusTaskId) return null

    if (focusProjectId === STANDALONE_PROJECT_ID) {
      const quickTask = quickTasks.find((task) => task.id === focusTaskId && !task.completed)
      if (!quickTask) return null
      return {
        kind: 'quick',
        id: quickTask.id,
        quickTaskId: quickTask.id,
        title: quickTask.title,
        order: quickTask.order,
        inProgress: quickTask.inProgress,
        repeatingTaskId: quickTask.repeatingTaskId
      }
    }

    const project = activeProjects.find((item) => item.id === focusProjectId)
    const task = project?.tasks.find((item) => item.id === focusTaskId)
    if (!project || !task || task.completed) return null

    return {
      kind: 'pinned',
      id: `focus-${project.id}-${task.id}`,
      title: task.title,
      order: task.toDoNextOrder ?? 999,
      projectId: project.id,
      projectName: project.name,
      taskId: task.id,
      inProgress: task.inProgress
    }
  }, [activeProjects, config.focusProjectId, config.focusTaskId, quickTasks])

  const proposals = useMemo<RepeatingTask[]>(() => {
    return getRepeatingTaskProposals({
      repeatingTasks,
      quickTasks,
      dismissedRepeating,
      dismissedRepeatingDate
    })
  }, [dismissedRepeating, dismissedRepeatingDate, quickTasks, repeatingTasks])

  const completedToday = useMemo<CompletedTask[]>(() => {
    const today = new Date().toISOString().slice(0, 10)

    const completedQuick = quickTasks
      .filter((task) => task.completed && task.completedAt?.startsWith(today))
      .map((task) => ({
        kind: 'quick' as const,
        id: `done-quick-${task.id}`,
        quickTaskId: task.id,
        title: task.title,
        repeatingTaskId: task.repeatingTaskId
      }))

    const completedPinned = activeProjects.flatMap((project) =>
      project.tasks
        .filter((task) => task.isToDoNext && task.completed && task.completedAt?.startsWith(today))
        .map((task) => ({
          kind: 'pinned' as const,
          id: `done-pinned-${project.id}-${task.id}`,
          title: task.title,
          projectId: project.id,
          projectName: project.name,
          taskId: task.id
        }))
    )

    return [...completedQuick, ...completedPinned]
  }, [activeProjects, quickTasks])

  const limit = config.quickTasksLimit ?? 5

  const { inProgressTasks, upNextTasks, overflowTasks } = useMemo(() => {
    const nonFocused = allActive.filter((task) => !matchesFocus(task, config.focusProjectId, config.focusTaskId))
    const repeatingActive = nonFocused.filter((task) => isRepeatingEntry(task))
    const limitedActive = nonFocused.filter((task) => !isRepeatingEntry(task))
    const orderedLimited = [
      ...limitedActive.filter((task) => task.inProgress),
      ...limitedActive.filter((task) => !task.inProgress)
    ]
    const completedForLimit = completedToday.filter((task) => !isRepeatingEntry(task)).length
    const focusConsumesSlot = focusTask ? !isRepeatingEntry(focusTask) : false
    const slotsForActive = Math.max(0, limit - completedForLimit)
    const slotsWithoutFocus = Math.max(0, slotsForActive - (focusConsumesSlot ? 1 : 0))
    const visibleLimited = orderedLimited.slice(0, slotsWithoutFocus)
    const visibleLimitedIds = new Set(visibleLimited.map((task) => task.id))
    const visible = [
      ...repeatingActive,
      ...limitedActive.filter((task) => visibleLimitedIds.has(task.id))
    ]

    return {
      inProgressTasks: visible.filter((task) => task.inProgress),
      upNextTasks: visible.filter((task) => !task.inProgress),
      overflowTasks: orderedLimited.slice(slotsWithoutFocus)
    }
  }, [allActive, completedToday, config.focusProjectId, config.focusTaskId, focusTask, limit])

  useEffect(() => {
    if (!showAddInput) return
    addInputRef.current?.focus()
  }, [showAddInput])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (event.key === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        setShowAddInput(true)
      }
      if (event.key === 'Escape') {
        setShowAddInput(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!focusTask) return

    const interval = window.setInterval(() => {
      setFocusTick((value) => value + 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [focusTask])

  const addTask = async () => {
    const title = newTitle.trim()
    if (!title) return

    const task: QuickTask = {
      id: nanoid(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      order: quickTasks.filter((item) => !item.completed).length
    }

    await saveQuickTask(task)
    setNewTitle('')
    setShowAddInput(false)
  }

  const completeTask = async (task: ActiveTask) => {
    if (task.kind === 'quick' && task.quickTaskId) {
      await completeQuickTask(task.quickTaskId)
      return
    }

    if (!task.projectId || !task.taskId) return
    const project = projects.find((item) => item.id === task.projectId)
    if (!project) return

    const tasks = project.tasks.map((item) => (
      item.id === task.taskId
        ? { ...item, completed: true, completedAt: new Date().toISOString(), inProgress: false }
        : item
    ))

    await saveProject({ ...project, tasks })
  }

  const uncompleteTask = async (task: CompletedTask) => {
    if (task.kind === 'quick' && task.quickTaskId) {
      await uncompleteQuickTask(task.quickTaskId)
      return
    }

    if (!task.projectId || !task.taskId) return
    const project = projects.find((item) => item.id === task.projectId)
    if (!project) return

    const tasks = project.tasks.map((item) => (
      item.id === task.taskId ? { ...item, completed: false, completedAt: null } : item
    ))

    await saveProject({ ...project, tasks })
  }

  const removeTask = async (task: ActiveTask | CompletedTask) => {
    if (task.kind === 'quick' && task.quickTaskId) {
      await removeQuickTask(task.quickTaskId)
      return
    }

    if (!task.projectId || !task.taskId) return
    await toggleTaskToDoNext(task.projectId, task.taskId)
  }

  const toggleInProgress = async (task: ActiveTask) => {
    if (task.kind === 'quick' && task.quickTaskId) {
      await toggleQuickTaskInProgress(task.quickTaskId)
      return
    }

    if (!task.projectId || !task.taskId) return
    await toggleTaskInProgress(task.projectId, task.taskId)
  }

  const focusOnTask = async (task: ActiveTask) => {
    if (task.kind === 'quick' && task.quickTaskId) {
      await setFocus(STANDALONE_PROJECT_ID, task.quickTaskId)
      return
    }

    if (!task.projectId || !task.taskId) return
    await setFocus(task.projectId, task.taskId)
  }

  const stopFocus = async () => {
    await setFocus(null, null)
  }

  const startEditing = (task: ActiveTask) => {
    editingKindRef.current = task.kind
    editingQuickTaskIdRef.current = task.quickTaskId
    editingProjectIdRef.current = task.projectId
    editingTaskIdRef.current = task.taskId
    setEditingId(task.id)
    setEditingTitle(task.title)
  }

  const saveEdit = async () => {
    const title = editingTitle.trim()
    const kind = editingKindRef.current
    setEditingId(null)
    if (!title || !kind) return

    if (kind === 'quick') {
      const quickTaskId = editingQuickTaskIdRef.current
      if (!quickTaskId) return
      const qt = quickTasks.find((t) => t.id === quickTaskId)
      if (qt) await saveQuickTask({ ...qt, title })
    } else {
      const projectId = editingProjectIdRef.current
      const taskId = editingTaskIdRef.current
      if (!projectId || !taskId) return
      const project = useProjects.getState().projects.find((p) => p.id === projectId)
      if (!project) return
      const tasks = project.tasks.map((t) => (t.id === taskId ? { ...t, title } : t))
      await saveProject({ ...project, tasks })
    }
  }

  const clearDragState = () => {
    draggedId.current = null
    setDragOverId(null)
  }

  const handleDragStart = (id: string) => {
    draggedId.current = id
  }

  const handleDragOver = (event: React.DragEvent, id: string) => {
    event.preventDefault()
    if (!draggedId.current || draggedId.current === id) return
    setDragOverId(id)
  }

  const handleDrop = async (targetId: string) => {
    if (!draggedId.current || draggedId.current === targetId) return

    const ids = allActive.map((task) => task.id)
    const fromIndex = ids.indexOf(draggedId.current)
    const toIndex = ids.indexOf(targetId)
    if (fromIndex === -1 || toIndex === -1) {
      clearDragState()
      return
    }

    ids.splice(fromIndex, 1)
    ids.splice(toIndex, 0, draggedId.current)

    const taskById = new Map(allActive.map((task) => [task.id, task]))
    const reordered = ids.map((id, order) => ({ ...taskById.get(id)!, order }))

    const orderedQuickIds = reordered
      .filter((task) => task.kind === 'quick')
      .sort((a, b) => a.order - b.order)
      .map((task) => task.quickTaskId ?? task.id)

    if (orderedQuickIds.length > 0) {
      await reorderQuickTasks(orderedQuickIds)
    }

    const pinnedUpdates = reordered
      .filter((task) => task.kind === 'pinned' && task.projectId && task.taskId)
      .map((task) => ({
        projectId: task.projectId!,
        taskId: task.taskId!,
        order: task.order
      }))

    if (pinnedUpdates.length > 0) {
      await window.api.reorderPinnedTasks(pinnedUpdates)
    }

    clearDragState()
  }

  const getTaskMinutes = (task: ActiveTask | CompletedTask): number => {
    if (task.kind === 'quick' && task.quickTaskId) {
      return calcQuickTaskTime(focusCheckIns, task.quickTaskId)
    }
    if (task.taskId) {
      return calcTaskTime(focusCheckIns, task.taskId)
    }
    return 0
  }

  const renderMeta = (task: ActiveTask | CompletedTask) => {
    if (task.kind === 'pinned' && task.projectId) {
      const project = projects.find((item) => item.id === task.projectId)
      const minutes = getTaskMinutes(task)
      return (
        <div className="task-meta">
          <span className="dot" style={{ background: projectColorValue(project?.color) }} />
          <span>{task.projectName || 'Project'}</span>
          {minutes > 0 && <span>· {formatCheckInTime(minutes)}</span>}
        </div>
      )
    }

    if (task.repeatingTaskId) {
      return (
        <div className="task-meta" style={{ opacity: 0.55 }}>
          <span>↻ repeating</span>
        </div>
      )
    }

    return (
      <div className="task-meta">
        <span className="task-source">quick task</span>
      </div>
    )
  }

  const renderTask = (task: ActiveTask, section: 'in-progress' | 'up-next' | 'overflow') => {
    const canShowActions = section !== 'overflow'
    const isDragOver = dragOverId === task.id && draggedId.current !== task.id

    return (
      <div
        key={task.id}
        className={`task-card draggable-task ${task.inProgress ? 'in-progress' : ''} ${isDragOver ? 'drag-over' : ''}`}
        draggable
        onDragStart={() => handleDragStart(task.id)}
        onDragOver={(event) => handleDragOver(event, task.id)}
        onDrop={() => handleDrop(task.id)}
        onDragEnd={clearDragState}
      >
        <button className="task-checkbox" onClick={() => completeTask(task)} />
        <div className="task-content">
          {editingId === task.id ? (
            <input
              autoFocus
              className="inline-edit-input"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') setEditingId(null)
              }}
            />
          ) : (
            <div className="task-title" onDoubleClick={() => startEditing(task)}>
              {task.repeatingTaskId && <span style={{ opacity: 0.6, marginRight: 4 }}>↻</span>}
              {task.title}
            </div>
          )}
          {renderMeta(task)}
        </div>
        {canShowActions && (
          <div className="task-actions">
            <button
              className="task-action-btn btn-progress"
              title={task.inProgress ? 'Stop in progress' : 'Set in progress'}
              onClick={() => toggleInProgress(task)}
            >
              {task.inProgress ? '■' : '▶'}
            </button>
            <button
              className="task-action-btn btn-focus"
              title="Focus"
              onClick={() => focusOnTask(task)}
            >
              ▶
            </button>
            {(section === 'up-next' || task.repeatingTaskId) && (
              <button className="task-action-btn btn-remove" title="Remove" onClick={() => removeTask(task)}>✕</button>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderDoneTask = (task: CompletedTask) => (
    <div key={task.id} className="task-card done-card">
      <button className="task-checkbox checked" onClick={() => uncompleteTask(task)} />
      <div className="task-content">
        <div className="task-title completed">{task.title}</div>
        {renderMeta(task)}
      </div>
      <div className="task-actions">
        <button className="task-action-btn btn-remove" onClick={() => removeTask(task)} title="Remove">✕</button>
      </div>
    </div>
  )

  const focusTimer = (() => {
    if (!focusTask) return '00:00'
    const minutes = getTaskMinutes(focusTask)
    const liveSeconds = minutes * 60 + focusTick
    return formatFocusTimer(liveSeconds)
  })()

  return (
    <div>
      {focusTask && (
        <>
          <div className="section-label">
            <span style={{ color: '#3b82f6' }}>●</span>
            <span>Focus</span>
          </div>
          <div className="focus-card">
            <div className="focus-dot" />
            <button className="task-checkbox" onClick={() => completeTask(focusTask)} />
            <div className="task-content">
              {editingId === focusTask.id ? (
                <input
                  autoFocus
                  className="inline-edit-input"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <div className="task-title" onDoubleClick={() => startEditing(focusTask)}>{focusTask.title}</div>
              )}
              {renderMeta(focusTask)}
            </div>
            <span className="focus-timer">{focusTimer}</span>
            <div className="task-actions">
              <button className="task-action-btn btn-focus" title="Stop focus" onClick={stopFocus}>■</button>
            </div>
          </div>
        </>
      )}

      {inProgressTasks.length > 0 && (
        <>
          <div className="section-label mt-section">
            <span style={{ color: '#f59e0b' }}>●</span>
            <span>In Progress</span>
          </div>
          {inProgressTasks.map((task) => renderTask(task, 'in-progress'))}
        </>
      )}

      {upNextTasks.filter((t) => !isRepeatingEntry(t)).length > 0 && (
        <>
          {(focusTask || inProgressTasks.length > 0) && (
            <div className="section-label mt-section">Up Next</div>
          )}
          {upNextTasks.filter((t) => !isRepeatingEntry(t)).map((task) => renderTask(task, 'up-next'))}
        </>
      )}

      {upNextTasks.filter((t) => isRepeatingEntry(t)).length > 0 && (
        <>
          <div className="repeating-separator" />
          {upNextTasks.filter((t) => isRepeatingEntry(t)).map((task) => renderTask(task, 'up-next'))}
        </>
      )}

      {proposals.length > 0 && (
        <>
          <div className="section-label mt-section">
            <span style={{ opacity: 0.5 }}>↻</span>
            <span>Repeating</span>
          </div>
          {proposals.map((proposal) => (
            <div key={proposal.id} className="proposal-card">
              <span className="repeat-icon">↻</span>
              <span className="title">{proposal.title}</span>
              <button className="proposal-btn accept" onClick={() => acceptRepeatingProposal(proposal.id)}>✓</button>
              <button className="proposal-btn dismiss" onClick={() => dismissRepeatingProposal(proposal.id)}>✕</button>
            </div>
          ))}
        </>
      )}

      {overflowTasks.length > 0 && (
        <>
          <div className="limit-indicator">limit {limit}</div>
          <div className="overflow-section">
            <div className={`done-toggle ${showOverflow ? 'open' : ''}`} onClick={() => setShowOverflow((value) => !value)}>
              <span style={{ opacity: 0.4 }}>⋯</span>
              <span>Beyond limit ({overflowTasks.length})</span>
              <span className="chevron">▸</span>
            </div>
            <div className={`done-list ${showOverflow ? 'open' : ''}`}>
              {overflowTasks.map((task) => renderTask(task, 'overflow'))}
            </div>
          </div>
        </>
      )}

      {completedToday.length > 0 && (
        <div className="mt-sm">
          <div className={`done-toggle ${showDone ? 'open' : ''}`} onClick={() => setShowDone((value) => !value)}>
            <span className="done-check">✓</span>
            <span>Done today ({completedToday.length})</span>
            <span className="chevron">▸</span>
          </div>
          <div className={`done-list ${showDone ? 'open' : ''}`}>
            {completedToday.map(renderDoneTask)}
          </div>
        </div>
      )}

      <div className="today-add-task-wrap">
        {showAddInput ? (
          <div className="today-add-input-row">
            <input
              ref={addInputRef}
              className="form-input"
              placeholder="Add a quick task..."
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addTask()
                if (event.key === 'Escape') {
                  setShowAddInput(false)
                  setNewTitle('')
                }
              }}
              onBlur={() => {
                if (!newTitle.trim()) {
                  setShowAddInput(false)
                  setNewTitle('')
                }
              }}
            />
            <button className="task-action-btn btn-focus" onClick={addTask}>Add</button>
          </div>
        ) : (
          <button className="add-task-btn" onClick={() => setShowAddInput(true)}>
            <span className="plus">+</span> Add task
          </button>
        )}
      </div>
    </div>
  )
}
