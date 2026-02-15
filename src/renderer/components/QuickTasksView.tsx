import { useState, useRef, useEffect } from 'react'
import { nanoid } from 'nanoid'
import { useProjects } from '../hooks/useProjects'
import { useTaskList } from '../hooks/useTaskList'
import type { MergedTask } from '../hooks/useTaskList'
import { calcTaskTime, calcQuickTaskTime, formatCheckInTime } from '../utils/checkInTime'
import type { QuickTask, RepeatingTask, WinEntry } from '../types'
import { STANDALONE_PROJECT_ID } from '../utils/constants'
import TaskIdBadge from './TaskIdBadge'

interface Props {
  showAll?: boolean
  cleanView?: boolean
}

export default function QuickTasksView({ showAll, cleanView }: Props) {
  const {
    quickTasks,
    repeatingTasks,
    config,
    focusCheckIns,
    winsLock,
    saveProject,
    saveQuickTask,
    saveRepeatingTask,
    removeQuickTask,
    completeQuickTask,
    uncompleteQuickTask,
    toggleQuickTaskInProgress,
    toggleTaskInProgress,
    toggleTaskToDoNext,
    setFocus,
    acceptRepeatingProposal,
    dismissRepeatingProposal
  } = useProjects()

  const {
    activeTasks, repeatingActive, completedTasks, proposals,
    overflowTasks, allActiveTasks, isLocked,
    hasRepeatingSection, hasCompletedSection
  } = useTaskList()

  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [showWinCelebration, setShowWinCelebration] = useState(false)
  const [winHistory, setWinHistory] = useState<WinEntry[]>([])
  const editingIdRef = useRef<string | null>(null)
  const editingTitleRef = useRef('')
  const editingProjectIdRef = useRef<string | undefined>(undefined)
  const editingTaskIdRef = useRef<string | undefined>(undefined)
  const [repeatUpdatePrompt, setRepeatUpdatePrompt] = useState<{ repeatingTaskId: string; newTitle: string } | null>(null)
  const [showAddInput, setShowAddInput] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)
  const draggedId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const prevLockedRef = useRef(winsLock?.locked ?? false)

  const [showLossBanner, setShowLossBanner] = useState(false)

  // Detect lock cleared: win or loss
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (prevLockedRef.current && !isLocked) {
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

  // Load win history for post-win encouragement
  useEffect(() => {
    window.api.winsGetHistory().then(setWinHistory).catch(() => {})
  }, [isLocked])

  // Separator for clean view
  const cleanSeparator = <div className="my-1.5 border-t border-current" style={{ opacity: 0.08 }} />

  const activeQuickTasks = quickTasks.filter((t) => !t.completed)

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
    } else if (merged.kind === 'pinned' && merged.projectId && merged.taskId) {
      const project = useProjects.getState().projects.find((p) => p.id === merged.projectId)
      if (!project) return
      const updatedTasks = project.tasks.map((t) =>
        t.id === merged.taskId ? { ...t, completed: true, completedAt: new Date().toISOString(), inProgress: false } : t
      )
      await saveProject({ ...project, tasks: updatedTasks })
    }
  }

  const handleUncomplete = async (merged: MergedTask) => {
    if (merged.kind === 'quick') {
      await uncompleteQuickTask(merged.id)
    } else if (merged.projectId && merged.taskId) {
      const fresh = useProjects.getState().projects.find((p) => p.id === merged.projectId)
      if (!fresh) return
      const updatedTasks = fresh.tasks.map((t) =>
        t.id === merged.taskId ? { ...t, completed: false, completedAt: null } : t
      )
      await saveProject({ ...fresh, tasks: updatedTasks })
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
    const trimmed = title.trim()
    const qt = useProjects.getState().quickTasks.find((t) => t.id === id)
    if (qt) {
      saveQuickTask({ ...qt, title: trimmed })
      if (qt.repeatingTaskId && trimmed !== qt.title) {
        setRepeatUpdatePrompt({ repeatingTaskId: qt.repeatingTaskId, newTitle: trimmed })
      }
    } else if (projectId && taskId) {
      const fresh = useProjects.getState().projects.find((p) => p.id === projectId)
      if (fresh) {
        const updatedTasks = fresh.tasks.map((t) =>
          t.id === taskId ? { ...t, title: trimmed } : t
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

  const handleToggleInProgress = (task: MergedTask) => {
    if (task.kind === 'quick') {
      toggleQuickTaskInProgress(task.id)
    } else if (task.projectId && task.taskId) {
      toggleTaskInProgress(task.projectId, task.taskId)
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

    const quickReordered = reordered.filter((t) => t.kind === 'quick')
    if (quickReordered.length > 0) {
      const orderedQuickIds = quickReordered.sort((a, b) => a.order - b.order).map((t) => t.id)
      await window.api.reorderQuickTasks(orderedQuickIds)
    }

    const pinnedUpdates: { projectId: string; taskId: string; order: number }[] = []
    for (const t of reordered.filter((r) => r.kind === 'pinned')) {
      if (t.projectId && t.taskId) {
        pinnedUpdates.push({ projectId: t.projectId, taskId: t.taskId, order: t.order })
      }
    }
    if (pinnedUpdates.length > 0) {
      await window.api.reorderPinnedTasks(pinnedUpdates)
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

  const renderTask = (task: MergedTask, small = false) => {
    const isCompleted = task.completed
    const isDragOver = dragOverId === task.id && draggedId.current !== task.id

    // --- Clean view (bullet journal style) ---
    if (cleanView) {
      const marker = isCompleted ? '×' : task.repeatingTaskId ? '↻' : task.inProgress ? '▸' : task.kind === 'pinned' ? '→' : '•'
      const mins = getTaskMinutes(task)
      const isFocused = !isCompleted && (
        (task.kind === 'quick' && config.focusProjectId === STANDALONE_PROJECT_ID && config.focusTaskId === task.id) ||
        (task.kind === 'pinned' && config.focusProjectId === task.projectId && config.focusTaskId === task.taskId)
      )
      const textSize = small ? 'text-[15px]' : 'text-[18px]'

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
          {/* In-progress indicator */}
          {!isCompleted && task.inProgress && !isFocused && (
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 self-center -mr-1" />
          )}
          {/* Focus indicator */}
          {isFocused && (
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0 self-center -mr-1" />
          )}

          {/* Bullet marker — clickable */}
          <button
            onClick={() => isCompleted ? handleUncomplete(task) : handleComplete(task)}
            className={`w-5 flex-shrink-0 text-center ${textSize} leading-none transition-opacity`}
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
                className={`w-full ${textSize} bg-transparent focus:outline-none py-0`}
                style={{ color: 'inherit' }}
              />
            ) : (
              <span
                onDoubleClick={() => !isCompleted && startEditing(task)}
                className={`${textSize} leading-snug truncate block cursor-default ${isCompleted ? 'line-through' : ''}`}
                style={{ opacity: isCompleted ? 0.3 : 1 }}
                title={task.title}
              >
                {task.title}
              </span>
            )}
          </div>

          {/* Time + hover actions */}
          {isCompleted ? (
            <button
              onClick={() => {
                if (task.repeatingTaskId) dismissRepeatingProposal(task.repeatingTaskId)
                if (task.kind === 'quick') removeQuickTask(task.id)
                else if (task.projectId && task.taskId) toggleTaskToDoNext(task.projectId, task.taskId)
              }}
              className="opacity-0 group-hover:opacity-40 hover:!opacity-70 transition-all"
              title="Remove"
              style={{ fontFamily: 'system-ui' }}
            >
              ✕
            </button>
          ) : (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {mins > 0 && (
                <span className="text-[15px]" style={{ opacity: 0.25 }}>{formatCheckInTime(mins)}</span>
              )}
              <button
                onClick={() => handleToggleInProgress(task)}
                className="text-[11px] transition-all opacity-0 group-hover:opacity-40 hover:!opacity-70"
                title={task.inProgress ? 'Stop working' : 'Mark as in progress'}
                style={{ fontFamily: 'system-ui' }}
              >
                ●
              </button>
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
              <TaskIdBadge taskNumber={task.taskNumber} projectCode={task.projectCode} kind={task.kind} />
              {task.title}
            </span>
            {task.kind === 'pinned' && task.projectName && (
              <span className="text-[10px] text-blue-400/50">{task.projectName}</span>
            )}
          </div>
          <button
            onClick={() => {
              if (task.repeatingTaskId) dismissRepeatingProposal(task.repeatingTaskId)
              if (task.kind === 'quick') removeQuickTask(task.id)
              else if (task.projectId && task.taskId) toggleTaskToDoNext(task.projectId, task.taskId)
            }}
            className="text-[10px] px-1.5 py-0.5 rounded bg-surface hover:bg-hover text-t-secondary hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            title="Remove"
          >
            ✕
          </button>
        </div>
      )
    }

    return (
      <div
        key={task.id}
        className={`group flex items-center gap-2 py-1.5 px-3 rounded-lg bg-card border transition-colors cursor-grab active:cursor-grabbing ${
          isDragOver ? 'border-blue-500/50' : task.inProgress ? 'border-amber-500/40' : 'border-border-subtle'
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
                {task.repeatingTaskId && <span className="text-t-muted mr-1" style={{ opacity: 0.5 }}>↻</span>}
                <TaskIdBadge taskNumber={task.taskNumber} projectCode={task.projectCode} kind={task.kind} />
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
            onClick={() => handleToggleInProgress(task)}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              task.inProgress
                ? 'bg-amber-600/30 hover:bg-amber-600/50 text-amber-400 hover:text-amber-300'
                : 'bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 hover:text-amber-300'
            }`}
            title={task.inProgress ? 'Stop working' : 'In progress'}
          >
            ▶
          </button>
          <button
            onClick={() => handleFocus(task)}
            className="text-[10px] px-2 py-0.5 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 transition-colors"
            title="Focus on this task"
          >
            Focus
          </button>
          {config.obsidianStoragePath && (
            <button
              onClick={() => window.api.openTaskNote(task.id, task.title, task.projectName)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-surface hover:bg-hover text-t-secondary transition-colors"
              title="Open note"
            >
              📝
            </button>
          )}
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

  const renderProposal = (rt: RepeatingTask) => {
    if (cleanView) {
      return (
        <div key={`proposal-${rt.id}`} className="group flex items-baseline gap-2.5 py-[6px]" style={{ opacity: 0.45 }}>
          <button
            onClick={() => acceptRepeatingProposal(rt.id)}
            className="w-5 flex-shrink-0 text-center text-[15px] leading-none transition-opacity hover:opacity-80"
            title="Accept"
          >
            ↻
          </button>
          <span className="flex-1 text-[15px] leading-snug truncate block cursor-default">
            {rt.title}
          </span>
          <button
            onClick={() => dismissRepeatingProposal(rt.id)}
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all text-[15px]"
            title="Skip"
            style={{ fontFamily: 'system-ui' }}
          >
            ✕
          </button>
        </div>
      )
    }
    return (
      <div key={`proposal-${rt.id}`} className="group flex items-center gap-2 py-1.5 px-3 rounded-lg bg-card/50 border border-dashed border-border-subtle">
        <span className="text-t-muted text-sm flex-shrink-0" style={{ opacity: 0.5 }}>↻</span>
        <span className="flex-1 text-sm text-t-secondary truncate">{rt.title}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => acceptRepeatingProposal(rt.id)}
            className="text-[10px] px-2 py-0.5 rounded bg-green-600/20 hover:bg-green-600/40 text-green-400 hover:text-green-300 transition-colors"
            title="Accept"
          >
            ✓
          </button>
          <button
            onClick={() => dismissRepeatingProposal(rt.id)}
            className="text-[10px] px-1.5 py-0.5 rounded bg-surface hover:bg-hover text-t-secondary hover:text-red-400 transition-colors"
            title="Skip"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  // Check if today was already won (for encouragement)
  const todayWon = winHistory.some((e) => e.date === new Date().toISOString().slice(0, 10) && e.result === 'win')
  const currentStreak = (() => {
    if (winHistory.length === 0) return 0
    const byDate = new Map(winHistory.map((e) => [e.date, e.result]))
    const today = new Date()
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const r = byDate.get(d.toISOString().slice(0, 10))
      if (r === 'win') streak++
      else if (r === 'loss') break
      else if (streak > 0) break
    }
    return streak
  })()

  const handleRepeatUpdate = () => {
    if (!repeatUpdatePrompt) return
    const rt = repeatingTasks.find((t) => t.id === repeatUpdatePrompt.repeatingTaskId)
    if (rt) saveRepeatingTask({ ...rt, title: repeatUpdatePrompt.newTitle })
    setRepeatUpdatePrompt(null)
  }

  return (
    <div className={cleanView ? '' : 'space-y-1'}>
      {repeatUpdatePrompt && !cleanView && (
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
            {currentStreak > 1 && (
              <div className="wins-victory-streak">seria {currentStreak} dni</div>
            )}
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

      {!isLocked && todayWon && activeTasks.length === 0 && !hasRepeatingSection ? (
        <div className={`flex flex-col items-center justify-center ${cleanView ? 'py-6' : 'h-40'}`}>
          <p className={cleanView ? 'text-[20px]' : 'text-base'} style={{ opacity: 0.6 }}>
            🏆 Wygrana!
          </p>
          <p className={cleanView ? 'text-[15px] mt-2' : 'text-sm mt-1'} style={{ opacity: 0.3 }}>
            Dodaj nowe zadania i zablokuj je, by utrzymać serię
          </p>
        </div>
      ) : activeTasks.length === 0 && !hasRepeatingSection && !hasCompletedSection ? (
        <div className={`flex flex-col items-center justify-center text-t-secondary ${cleanView ? 'h-16' : 'h-40'}`}>
          <p className={cleanView ? 'text-[18px]' : 'text-sm'} style={cleanView ? { opacity: 0.25 } : undefined}>
            {cleanView ? 'Brak zadań' : 'No quick tasks yet'}
          </p>
          {!cleanView && <p className="text-xs text-t-muted mt-1">Press <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-[10px]">n</kbd> to add a task or pin project tasks</p>}
        </div>
      ) : showAll ? (
        <div className="space-y-1" onDragEnd={handleDragEnd}>
          {activeTasks.map((t) => renderTask(t))}
          {hasRepeatingSection && (
            <div className="space-y-1 mt-2">
              {repeatingActive.map((t) => renderTask(t))}
              {proposals.map(renderProposal)}
            </div>
          )}
          {hasCompletedSection && completedTasks.map((t) => renderTask(t))}
          {overflowTasks.length > 0 && (
            <div className="space-y-1 opacity-40 mt-2">
              {overflowTasks.map((t) => renderTask(t))}
            </div>
          )}
        </div>
      ) : (
        <div className={cleanView ? '' : 'space-y-1'} onDragEnd={handleDragEnd}>
          {activeTasks.map((t) => renderTask(t))}
          {hasRepeatingSection && (cleanView ? repeatingActive.length > 0 : true) && (
            <>
              {cleanView && activeTasks.length > 0 && cleanSeparator}
              {repeatingActive.map((t) => renderTask(t, cleanView))}
              {!cleanView && proposals.map(renderProposal)}
            </>
          )}
          {hasCompletedSection && (
            <>
              {cleanView && (activeTasks.length > 0 || repeatingActive.length > 0) && cleanSeparator}
              {completedTasks.map((t) => renderTask(t))}
            </>
          )}
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
