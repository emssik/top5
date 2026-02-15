import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useProjects } from '../hooks/useProjects'
import { useTaskList } from '../hooks/useTaskList'
import type { MergedTask } from '../hooks/useTaskList'
import { calcQuickTaskTime, calcTaskTime, formatCheckInTime } from '../utils/checkInTime'
import { STANDALONE_PROJECT_ID } from '../utils/constants'
import type { QuickTask, LockedTaskRef, WinEntry } from '../types'
import { projectColorValue } from '../utils/projects'
import TaskIdBadge from './TaskIdBadge'

function formatFocusTimer(seconds: number): string {
  const mm = Math.floor(seconds / 60)
  const ss = seconds % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function isRepeatingEntry(task: { repeatingTaskId?: string | null }): boolean {
  return Boolean(task.repeatingTaskId)
}

function formatCountdown(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function taskToRef(task: MergedTask): LockedTaskRef {
  if (task.kind === 'quick') {
    return { kind: 'quick', quickTaskId: task.id }
  }
  return { kind: 'pinned', projectId: task.projectId, taskId: task.taskId }
}

export default function TodayView() {
  const {
    projects,
    quickTasks,
    repeatingTasks,
    focusCheckIns,
    winsLock,
    saveProject,
    saveQuickTask,
    saveRepeatingTask,
    removeQuickTask,
    completeQuickTask,
    uncompleteQuickTask,
    reorderQuickTasks,
    toggleQuickTaskInProgress,
    toggleTaskInProgress,
    toggleTaskToDoNext,
    setFocus,
    acceptRepeatingProposal,
    dismissRepeatingProposal,
    lockWinsTasks,
    unlockWinsTasks,
    loadWinsLock
  } = useProjects()

  const [limitAdjust, setLimitAdjust] = useState(0)

  const {
    focusTask,
    inProgressTasks,
    upNextTasks,
    activeTasks,
    completedTasks: completedToday,
    proposals,
    overflowTasks,
    allActiveTasks,
    configLimit,
    isLocked,
    lockedTaskIds
  } = useTaskList({ excludeFocus: true, limitAdjust })

  const [repeatUpdatePrompt, setRepeatUpdatePrompt] = useState<{ repeatingTaskId: string; newTitle: string } | null>(null)
  const [showAddInput, setShowAddInput] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [showOverflow, setShowOverflow] = useState(false)
  const [focusTick, setFocusTick] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [showWinCelebration, setShowWinCelebration] = useState(false)
  const [winHistory, setWinHistory] = useState<WinEntry[]>([])
  const editingTaskRef = useRef<MergedTask | null>(null)
  const addInputRef = useRef<HTMLInputElement | null>(null)
  const draggedId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverZone, setDragOverZone] = useState<'top' | 'overflow' | null>(null)
  const [showLossBanner, setShowLossBanner] = useState(false)
  const prevLockedRef = useRef(winsLock?.locked ?? false)

  // Load win history for 30-day strip
  useEffect(() => {
    window.api.winsGetHistory().then(setWinHistory).catch(() => {})
  }, [isLocked]) // reload after lock changes (win/loss resolved)

  // 30-day strip data
  const last30 = useMemo(() => {
    if (winHistory.length === 0) return null
    const byDate = new Map<string, 'win' | 'loss'>()
    for (const e of winHistory) byDate.set(e.date, e.result)
    const today = new Date()
    const days: { date: string; result: 'win' | 'loss' | null }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push({ date: key, result: byDate.get(key) ?? null })
    }
    // Current streak (consecutive wins from today backwards)
    let streak = 0
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].result === 'win') streak++
      else if (days[i].result === 'loss') break
      else if (streak > 0) break // gap after streak started
    }
    return { days, streak }
  }, [winHistory])

  function isTaskLocked(task: MergedTask): boolean {
    if (!isLocked) return false
    if (task.kind === 'quick') return lockedTaskIds.has(task.id)
    if (task.kind === 'pinned' && task.taskId) return lockedTaskIds.has(task.taskId)
    return false
  }

  // Detect lock cleared: win or loss
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (prevLockedRef.current && !isLocked) {
      // Check if last entry is win or loss
      window.api.winsGetHistory().then((history) => {
        setWinHistory(history)
        const today = new Date().toISOString().slice(0, 10)
        const todayEntry = history.find((e) => e.date === today)
        if (todayEntry?.result === 'win') {
          setShowWinCelebration(true)
          timer = setTimeout(() => setShowWinCelebration(false), 5000)
        } else if (todayEntry?.result === 'loss') {
          setShowLossBanner(true)
          timer = setTimeout(() => setShowLossBanner(false), 6000)
        }
      }).catch(() => {})
    }
    prevLockedRef.current = isLocked
    return () => { if (timer) clearTimeout(timer) }
  }, [isLocked])

  // Countdown tick for deadline display
  const [, setCountdownTick] = useState(0)
  useEffect(() => {
    if (!isLocked || !winsLock?.deadline) return
    const interval = window.setInterval(() => setCountdownTick((v) => v + 1), 60_000)
    return () => window.clearInterval(interval)
  }, [isLocked, winsLock?.deadline])

  // Tasks that would be locked (within-limit, non-repeating + focus)
  const lockableTasks = useMemo(() => {
    const withinLimit = activeTasks.filter((t) => !isRepeatingEntry(t))
    if (focusTask && !isRepeatingEntry(focusTask)) {
      return [focusTask, ...withinLimit]
    }
    return withinLimit
  }, [activeTasks, focusTask])

  // Lock progress: how many locked tasks are completed
  const lockProgress = useMemo(() => {
    if (!isLocked || !winsLock?.lockedTasks) return { completed: 0, total: 0 }
    let completed = 0
    for (const ref of winsLock.lockedTasks) {
      if (ref.kind === 'quick' && ref.quickTaskId) {
        const qt = quickTasks.find((t) => t.id === ref.quickTaskId)
        if (qt?.completed) completed++
      } else if (ref.kind === 'pinned' && ref.projectId && ref.taskId) {
        const project = projects.find((p) => p.id === ref.projectId)
        const task = project?.tasks.find((t) => t.id === ref.taskId)
        if (task?.completed) completed++
      }
    }
    return { completed, total: winsLock.lockedTasks.length }
  }, [isLocked, winsLock, quickTasks, projects])

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

  const completeTask = async (task: MergedTask) => {
    if (task.kind === 'quick') {
      await completeQuickTask(task.id)
    } else if (task.projectId && task.taskId) {
      const project = projects.find((item) => item.id === task.projectId)
      if (!project) return
      const tasks = project.tasks.map((item) => (
        item.id === task.taskId
          ? { ...item, completed: true, completedAt: new Date().toISOString(), inProgress: false }
          : item
      ))
      await saveProject({ ...project, tasks })
    }

    // Check if win condition was met (lock cleared by main process)
    if (isLocked) {
      await loadWinsLock()
    }
  }

  const uncompleteTask = async (task: MergedTask) => {
    if (task.kind === 'quick') {
      await uncompleteQuickTask(task.id)
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

  const removeTask = async (task: MergedTask) => {
    if (task.kind === 'quick') {
      await removeQuickTask(task.id)
      return
    }

    if (!task.projectId || !task.taskId) return
    await toggleTaskToDoNext(task.projectId, task.taskId)
  }

  const toggleInProgress = async (task: MergedTask) => {
    if (task.kind === 'quick') {
      await toggleQuickTaskInProgress(task.id)
      return
    }

    if (!task.projectId || !task.taskId) return
    await toggleTaskInProgress(task.projectId, task.taskId)
  }

  const focusOnTask = async (task: MergedTask) => {
    if (task.kind === 'quick') {
      await setFocus(STANDALONE_PROJECT_ID, task.id)
      return
    }

    if (!task.projectId || !task.taskId) return
    await setFocus(task.projectId, task.taskId)
  }

  const stopFocus = async () => {
    await setFocus(null, null)
  }

  const handleLock = async () => {
    if (lockableTasks.length === 0) return
    const refs = lockableTasks.map(taskToRef)
    await lockWinsTasks(refs)
  }

  const handleUnlock = async () => {
    await unlockWinsTasks()
  }

  const startEditing = (task: MergedTask) => {
    editingTaskRef.current = task
    setEditingId(task.id)
    setEditingTitle(task.title)
  }

  const saveEdit = async () => {
    const task = editingTaskRef.current
    const title = editingTitle.trim()
    setEditingId(null)
    editingTaskRef.current = null
    if (!task || !title) return

    if (task.kind === 'quick') {
      const qt = quickTasks.find((t) => t.id === task.id)
      if (qt) {
        await saveQuickTask({ ...qt, title })
        if (qt.repeatingTaskId && title !== qt.title) {
          setRepeatUpdatePrompt({ repeatingTaskId: qt.repeatingTaskId, newTitle: title })
        }
      }
    } else if (task.projectId && task.taskId) {
      const project = useProjects.getState().projects.find((p) => p.id === task.projectId)
      if (!project) return
      const tasks = project.tasks.map((t) => (t.id === task.taskId ? { ...t, title } : t))
      await saveProject({ ...project, tasks })
    }
  }

  const clearDragState = () => {
    draggedId.current = null
    setDragOverId(null)
    setDragOverZone(null)
  }

  const handleDragStart = (event: React.DragEvent, task: MergedTask) => {
    draggedId.current = task.id
    if (task.kind === 'pinned' && task.projectId && task.taskId) {
      event.dataTransfer.setData('application/top5-task', JSON.stringify({
        kind: task.kind,
        projectId: task.projectId,
        taskId: task.taskId
      }))
    }
  }

  const handleDragOver = (event: React.DragEvent, id: string) => {
    event.preventDefault()
    if (!draggedId.current || draggedId.current === id) return
    setDragOverId(id)
  }

  const handleDrop = async (targetId: string) => {
    if (!draggedId.current || draggedId.current === targetId) return

    // Detect cross-section drag (above-limit ↔ overflow)
    const overflowIds = new Set(overflowTasks.map((t) => t.id))
    const draggedInOverflow = overflowIds.has(draggedId.current)
    const targetInOverflow = overflowIds.has(targetId)
    const draggedTask = allActiveTasks.find((t) => t.id === draggedId.current)
    const isCrossSection = draggedTask && !isRepeatingEntry(draggedTask) && draggedInOverflow !== targetInOverflow

    const ids = allActiveTasks.map((task) => task.id)
    const fromIndex = ids.indexOf(draggedId.current)
    const toIndex = ids.indexOf(targetId)
    if (fromIndex === -1 || toIndex === -1) {
      clearDragState()
      return
    }

    ids.splice(fromIndex, 1)
    ids.splice(toIndex, 0, draggedId.current)

    const taskById = new Map(allActiveTasks.map((task) => [task.id, task]))
    const reordered = ids.map((id, order) => ({ ...taskById.get(id)!, order }))

    // Adjust visual split when dragging between sections
    if (isCrossSection) {
      if (draggedInOverflow) {
        // Only expand if below config limit (limitAdjust < 0 means we removed some earlier)
        if (limitAdjust < 0) setLimitAdjust((prev) => prev + 1)
        // At limit (limitAdjust >= 0): no adjust → reorder naturally swaps last task out
      } else {
        // Always allow shrinking (top → overflow)
        setLimitAdjust((prev) => prev - 1)
      }
    }

    const orderedQuickIds = reordered
      .filter((task) => task.kind === 'quick')
      .sort((a, b) => a.order - b.order)
      .map((task) => task.id)

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

  const handleZoneDragOver = (event: React.DragEvent, zone: 'top' | 'overflow') => {
    event.preventDefault()
    if (!draggedId.current) return
    setDragOverZone(zone)
  }

  const handleDropOnZone = async (zone: 'top' | 'overflow') => {
    if (!draggedId.current) return

    const overflowIds = new Set(overflowTasks.map((t) => t.id))
    const draggedInOverflow = overflowIds.has(draggedId.current)
    const draggedTask = allActiveTasks.find((t) => t.id === draggedId.current)

    // Only cross-section drops on non-repeating tasks
    if (!draggedTask || isRepeatingEntry(draggedTask)) { clearDragState(); return }
    if (zone === 'top' && !draggedInOverflow) { clearDragState(); return }
    if (zone === 'overflow' && draggedInOverflow) { clearDragState(); return }

    const ids = allActiveTasks.map((t) => t.id)
    const fromIndex = ids.indexOf(draggedId.current)
    if (fromIndex === -1) { clearDragState(); return }

    ids.splice(fromIndex, 1)

    // Insert at the limit boundary (before first remaining overflow task)
    const firstOverflow = overflowTasks.find((t) => t.id !== draggedId.current)
    const insertPos = firstOverflow ? ids.indexOf(firstOverflow.id) : ids.length
    ids.splice(insertPos, 0, draggedId.current)

    const taskById = new Map(allActiveTasks.map((t) => [t.id, t]))
    const reordered = ids.map((id, order) => ({ ...taskById.get(id)!, order }))

    if (zone === 'top') {
      // Only expand if below config limit
      if (limitAdjust < 0) setLimitAdjust((prev) => prev + 1)
      // At limit: reorder inserts at boundary, naturally pushing last task to overflow (swap)
    } else {
      setLimitAdjust((prev) => prev - 1)
    }

    const orderedQuickIds = reordered
      .filter((t) => t.kind === 'quick')
      .sort((a, b) => a.order - b.order)
      .map((t) => t.id)

    if (orderedQuickIds.length > 0) {
      await reorderQuickTasks(orderedQuickIds)
    }

    const pinnedUpdates = reordered
      .filter((t) => t.kind === 'pinned' && t.projectId && t.taskId)
      .map((t) => ({ projectId: t.projectId!, taskId: t.taskId!, order: t.order }))

    if (pinnedUpdates.length > 0) {
      await window.api.reorderPinnedTasks(pinnedUpdates)
    }

    clearDragState()
  }

  const getTaskMinutes = (task: MergedTask): number => {
    if (task.kind === 'quick') {
      return calcQuickTaskTime(focusCheckIns, task.id)
    }
    if (task.taskId) {
      return calcTaskTime(focusCheckIns, task.taskId)
    }
    return 0
  }

  const renderMeta = (task: MergedTask) => {
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

  const renderTask = (task: MergedTask, section: 'in-progress' | 'up-next' | 'overflow') => {
    const canShowActions = section !== 'overflow'
    const isDragOver = dragOverId === task.id && draggedId.current !== task.id
    const locked = isTaskLocked(task)

    return (
      <div
        key={task.id}
        className={`task-card draggable-task ${task.inProgress ? 'in-progress' : ''} ${isDragOver ? 'drag-over' : ''} ${locked ? 'wins-locked' : ''}`}
        draggable={!isLocked}
        onDragStart={(event) => handleDragStart(event, task)}
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
              <TaskIdBadge taskNumber={task.taskNumber} projectCode={task.projectCode} kind={task.kind} />
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
            {useProjects.getState().config.obsidianStoragePath && (
              <button className="task-action-btn" title="Open note" onClick={() => window.api.openTaskNote(task.id, task.title, task.projectName)} style={{ opacity: 0.5, fontSize: 11 }}>📝</button>
            )}
            {!locked && (section === 'up-next' || task.repeatingTaskId) && (
              <button className="task-action-btn btn-remove" title="Remove" onClick={() => removeTask(task)}>✕</button>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderDoneTask = (task: MergedTask) => (
    <div key={task.id} className="task-card done-card">
      <button className="task-checkbox checked" onClick={() => uncompleteTask(task)} />
      <div className="task-content">
        <div className="task-title completed">
          <TaskIdBadge taskNumber={task.taskNumber} projectCode={task.projectCode} kind={task.kind} />
          {task.title}
        </div>
        {renderMeta(task)}
      </div>
      <div className="task-actions">
        {!isTaskLocked(task) && (
          <button className="task-action-btn btn-remove" onClick={() => removeTask(task)} title="Remove">✕</button>
        )}
      </div>
    </div>
  )

  const focusTimer = (() => {
    if (!focusTask) return '00:00'
    const minutes = getTaskMinutes(focusTask)
    const liveSeconds = minutes * 60 + focusTick
    return formatFocusTimer(liveSeconds)
  })()

  const handleRepeatUpdate = () => {
    if (!repeatUpdatePrompt) return
    const rt = repeatingTasks.find((t) => t.id === repeatUpdatePrompt.repeatingTaskId)
    if (rt) saveRepeatingTask({ ...rt, title: repeatUpdatePrompt.newTitle })
    setRepeatUpdatePrompt(null)
  }

  return (
    <div>
      {repeatUpdatePrompt && (
        <div
          className="modal-overlay open"
          tabIndex={-1}
          ref={(el) => el?.focus()}
          onClick={() => setRepeatUpdatePrompt(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'y' || e.key === 'Y') { e.preventDefault(); handleRepeatUpdate() }
            if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') { e.preventDefault(); setRepeatUpdatePrompt(null) }
          }}
        >
          <div className="modal" style={{ width: 340, padding: '20px 24px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--c-text-heading)' }}>
              Update repeating template?
            </div>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
              Also change the title in the repeating task template?
            </div>
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button className="form-btn form-btn-secondary" onClick={() => setRepeatUpdatePrompt(null)}>No <kbd style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>N</kbd></button>
              <button className="form-btn form-btn-primary" onClick={handleRepeatUpdate}>Yes, update <kbd style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>Y</kbd></button>
            </div>
          </div>
        </div>
      )}

      {showWinCelebration && (
        <div className="wins-victory-overlay" onClick={() => setShowWinCelebration(false)}>
          <div className="wins-victory-card">
            <div className="wins-victory-trophy">🏆</div>
            <div className="wins-victory-title">Victory!</div>
            <div className="wins-victory-sub">Wszystkie zadania wykonane</div>
            {last30 && last30.streak > 1 && (
              <div className="wins-victory-streak">seria {last30.streak} dni</div>
            )}
          </div>
        </div>
      )}

      {last30 && !showWinCelebration && !showLossBanner && (
        <div className="wins-30d-strip">
          {last30.streak > 0 && (
            <span className="wins-30d-streak" title="Current win streak">
              🏆 {last30.streak}
            </span>
          )}
          <div className="wins-30d-dots">
            {last30.days.map((d) => (
              <span
                key={d.date}
                className={`wins-30d-dot ${d.result === 'win' ? 'win' : d.result === 'loss' ? 'loss' : ''}`}
                title={d.date}
              />
            ))}
          </div>
        </div>
      )}

      {!isLocked && !showWinCelebration && !showLossBanner && last30 && last30.days[last30.days.length - 1]?.result === 'win' && lockableTasks.length === 0 && (
        <div className="wins-day-won-banner">
          <span className="wins-day-won-icon">🏆</span>
          <div>
            <div className="wins-day-won-title">Wygrana!</div>
            <div className="wins-day-won-sub">Dodaj nowe zadania i zablokuj je, by utrzymać serię</div>
          </div>
        </div>
      )}

      {!isLocked && !showWinCelebration && !showLossBanner && last30 && last30.days[last30.days.length - 1]?.result === 'loss' && (
        <div className="wins-day-lost-banner">
          <span className="wins-day-lost-icon">💪</span>
          <div>
            <div className="wins-day-lost-title">Nie tym razem</div>
            <div className="wins-day-lost-sub">Nie przejmuj się — jutro na pewno będzie lepiej!</div>
          </div>
        </div>
      )}

      {showLossBanner && (
        <div className="wins-loss-overlay" onClick={() => setShowLossBanner(false)}>
          <div className="wins-loss-card">
            <div className="wins-loss-emoji">💪</div>
            <div className="wins-loss-title">Nie tym razem</div>
            <div className="wins-loss-sub">Nie przejmuj się, jutro będzie lepiej!</div>
          </div>
        </div>
      )}

      {isLocked && winsLock && (
        <div className="wins-lock-bar">
          <span className="wins-lock-icon">&#x1f512;</span>
          <span className="wins-lock-progress">{lockProgress.completed}/{lockProgress.total}</span>
          {winsLock.deadline && (
            <span className="wins-lock-deadline">{formatCountdown(winsLock.deadline)}</span>
          )}
          <button className="wins-unlock-btn" onClick={handleUnlock} title="Unlock tasks">&#x2715;</button>
        </div>
      )}

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
                <div className="task-title" onDoubleClick={() => startEditing(focusTask)}>
                  <TaskIdBadge taskNumber={focusTask.taskNumber} projectCode={focusTask.projectCode} kind={focusTask.kind} />
                  {focusTask.title}
                </div>
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

      <div
        className={`limit-indicator ${dragOverZone ? 'drag-over-zone' : ''}`}
        onDragOver={(e) => handleZoneDragOver(e, overflowTasks.length > 0 ? 'top' : 'overflow')}
        onDragLeave={() => setDragOverZone(null)}
        onDrop={() => handleDropOnZone(overflowTasks.length > 0 ? 'top' : 'overflow')}
        onDragEnd={clearDragState}
      >
        {!isLocked && lockableTasks.length > 0 && (
          <button className="wins-lock-btn" onClick={handleLock} title="Lock tasks for today's challenge">
            &#x1f513;
          </button>
        )}
        <span>limit {configLimit}</span>
      </div>

      {overflowTasks.length > 0 && (
        <div className="overflow-section">
          <div
            className={`done-toggle ${showOverflow ? 'open' : ''} ${dragOverZone === 'overflow' ? 'drag-over-zone' : ''}`}
            onClick={() => setShowOverflow((value) => !value)}
            onDragOver={(e) => handleZoneDragOver(e, 'overflow')}
            onDragLeave={() => setDragOverZone(null)}
            onDrop={() => handleDropOnZone('overflow')}
            onDragEnd={clearDragState}
          >
            <span style={{ opacity: 0.4 }}>⋯</span>
            <span>Beyond limit ({overflowTasks.length})</span>
            <span className="chevron">▸</span>
          </div>
          <div className={`done-list ${showOverflow ? 'open' : ''}`}>
            {overflowTasks.map((task) => renderTask(task, 'overflow'))}
          </div>
        </div>
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

      {!isLocked && (
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
      )}
    </div>
  )
}
