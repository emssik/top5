import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useProjects } from '../hooks/useProjects'
import { useTaskList } from '../hooks/useTaskList'
import type { MergedTask } from '../hooks/useTaskList'
import { calcQuickTaskTime, calcTaskTime, formatCheckInTime } from '../utils/checkInTime'
import { STANDALONE_PROJECT_ID } from '../utils/constants'
import type { Task, QuickTask, LockedTaskRef, WinEntry, ProjectLink } from '../types'
import { projectColorValue, normalizeProjectLinks, normalizeLinks, openProjectLink } from '../utils/projects'
import TaskLinksIndicator from './TaskLinksIndicator'
import TaskLinksPopover from './TaskLinksPopover'
import ProjectLinksMenu from './ProjectLinksMenu'
import TaskIdBadge from './TaskIdBadge'
import { formatTaskId, formatQuickTaskId, computeNotePath } from '../../shared/taskId'
import { dateKey } from '../../shared/schedule'
import RepeatUpdateModal from './RepeatUpdateModal'
import { Linkify } from './Linkify'

function formatFocusTimer(seconds: number): string {
  const mm = Math.floor(seconds / 60)
  const ss = seconds % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function isRepeatingEntry(task: { repeatingTaskId?: string | null }): boolean {
  return Boolean(task.repeatingTaskId)
}

function continuationTitle(title: string): string {
  const match = title.match(/^\(✂(\d+)\) (.*)$/)
  if (match) {
    return `(✂${Number(match[1]) + 1}) ${match[2]}`
  }
  return `(✂1) ${title}`
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return dateKey(d)
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
    config,
    lockWinsTasks,
    unlockWinsTasks,
    loadWinsLock
  } = useProjects()

  const {
    focusTask,
    scheduledTasks,
    inProgressTasks,
    upNextTasks,
    activeTasks,
    completedTasks: completedToday,
    proposals,
    tomorrowProposals,
    dueDateProposals,
    dueDateTomorrowProposals,
    overflowTasks,
    allActiveTasks,
    configLimit,
    isLocked,
    lockedTaskIds
  } = useTaskList({ excludeFocus: true })

  const [repeatUpdatePrompt, setRepeatUpdatePrompt] = useState<{ repeatingTaskId: string; newTitle: string } | null>(null)
  const [showAddInput, setShowAddInput] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [showOverflow, setShowOverflow] = useState(false)
  const [selectedOverflowIds, setSelectedOverflowIds] = useState<Set<string>>(new Set())
  const [focusTick, setFocusTick] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [showWinCelebration, setShowWinCelebration] = useState(false)
  const [winHistory, setWinHistory] = useState<WinEntry[]>([])
  const editingTaskRef = useRef<MergedTask | null>(null)
  const addInputRef = useRef<HTMLInputElement | null>(null)
  const draggedId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverZone, setDragOverZone] = useState<'top' | 'overflow' | 'limit' | null>(null)
  const [showLossBanner, setShowLossBanner] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: MergedTask; section: string } | null>(null)
  const [linksMenu, setLinksMenu] = useState<{ x: number; y: number } | null>(null)
  const [showWinsRules, setShowWinsRules] = useState(false)
  const [dueDateDismissId, setDueDateDismissId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [dueDatePickerId, setDueDatePickerId] = useState<string | null>(null)
  const [linksEditId, setLinksEditId] = useState<string | null>(null)
  const hoveredTaskRef = useRef<{ task: MergedTask; section: string } | null>(null)
  const prevLockedRef = useRef(winsLock?.locked ?? false)

  // Load win history for 30-day strip
  useEffect(() => {
    window.api.winsGetHistory().then(setWinHistory).catch(() => {})
  }, [isLocked]) // reload after lock changes (win/loss resolved)

  const tomorrowKey = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return dateKey(d)
  }, [])

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
      const key = dateKey(d)
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

  // Detect lock cleared: win or loss (ignore manual unlock which doesn't create an entry)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (prevLockedRef.current && !isLocked) {
      window.api.winsGetHistory().then((history) => {
        setWinHistory(history)
        const recent = history.length > 0 ? history[history.length - 1] : null
        // Only show celebration/loss if the entry was just resolved (within last 5s)
        const isRecent = recent?.resolvedAt && (Date.now() - new Date(recent.resolvedAt).getTime()) < 5000
        if (!isRecent) return
        if (recent.result === 'win') {
          setShowWinCelebration(true)
          timer = setTimeout(() => setShowWinCelebration(false), 5000)
        } else if (recent.result === 'loss') {
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

  // Tasks that would be locked (within-limit + scheduled, non-repeating + focus)
  const lockableTasks = useMemo(() => {
    const withinLimit = activeTasks.filter((t) => !isRepeatingEntry(t))
    const all = [...scheduledTasks, ...withinLimit]
    if (focusTask && !isRepeatingEntry(focusTask)) {
      return [focusTask, ...all]
    }
    return all
  }, [activeTasks, scheduledTasks, focusTask])

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


  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

  // Close task overflow menu on click outside
  useEffect(() => {
    if (!menuOpenId) return
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.task-overflow-menu, .task-overflow-trigger')) return
      setMenuOpenId(null)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpenId(null)
    }
    const raf = requestAnimationFrame(() => {
      window.addEventListener('click', handleClick)
      window.addEventListener('keydown', handleKey)
    })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [menuOpenId])

  // Close due date dismiss popover on click outside or Escape
  useEffect(() => {
    if (!dueDateDismissId) return
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.due-date-dismiss-popover')) return
      setDueDateDismissId(null)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDueDateDismissId(null)
    }
    // Defer so the opening click doesn't immediately close the popover
    const raf = requestAnimationFrame(() => {
      window.addEventListener('click', handleClick)
      window.addEventListener('keydown', handleKey)
    })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [dueDateDismissId])

  // Close task menu due-date picker on click outside or Escape
  useEffect(() => {
    if (!dueDatePickerId) return
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.due-date-dismiss-popover')) return
      setDueDatePickerId(null)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDueDatePickerId(null)
    }
    const raf = requestAnimationFrame(() => {
      window.addEventListener('click', handleClick)
      window.addEventListener('keydown', handleKey)
    })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [dueDatePickerId])

  // Task keyboard shortcuts: work on hovered task OR context menu task
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const tag = (event.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      // Escape always closes context menu / add input
      if (event.key === 'Escape') {
        if (contextMenu) { setContextMenu(null); return }
        setShowAddInput(false)
        return
      }

      // Determine target task: context menu takes priority, then hover
      const target = contextMenu ?? hoveredTaskRef.current
      if (!target) {
        // No task targeted — global shortcuts only
        if (event.key === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault()
          setShowAddInput(true)
        }
        if (event.key === 'j' && !event.metaKey && !event.ctrlKey && !event.altKey && config.obsidianStoragePath) {
          event.preventDefault()
          handleJournal()
        }
        return
      }

      const { task, section } = target
      const locked = isTaskLocked(task)
      const isFocusCard = section === 'focus'
      const key = event.key.toLowerCase()

      // Helper: clear refs after destructive actions to prevent double-fire
      const consume = () => { setContextMenu(null); hoveredTaskRef.current = null }

      if (key === 'f' && !isFocusCard) { consume(); focusOnTask(task); return }
      if (key === 'p' && !isFocusCard) { consume(); toggleInProgress(task); return }
      if (key === 's' && isFocusCard) { consume(); stopFocus(); return }
      if (key === 'n' && config.obsidianStoragePath) {
        consume()
        window.api.openTaskNote(task.id, task.title, task.projectName, task.kind === 'quick' ? formatQuickTaskId(task.taskNumber) : formatTaskId(task.taskNumber, task.projectCode), task.noteRef)
        return
      }
      if (key === 'c' && !task.repeatingTaskId) { consume(); splitTask(task); return }
      if ((key === 'backspace' || key === 'delete') && !isFocusCard && !locked && (section === 'up-next' || task.repeatingTaskId)) {
        consume(); removeTask(task); return
      }

      // 'n' not consumed by note — fall through to global add
      if (key === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        setShowAddInput(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [contextMenu, config.obsidianStoragePath])

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
      const project = useProjects.getState().projects.find((item) => item.id === task.projectId)
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
    const project = useProjects.getState().projects.find((item) => item.id === task.projectId)
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

  const splitTask = async (task: MergedTask) => {
    const newTitle = continuationTitle(task.title)

    // Preserve note reference: use existing noteRef or compute from original task
    const noteRef = task.noteRef || (() => {
      const badge = task.kind === 'quick'
        ? formatQuickTaskId(task.taskNumber)
        : formatTaskId(task.taskNumber, task.projectCode)
      return computeNotePath(badge, task.title, task.projectName)
    })()

    if (task.kind === 'pinned' && task.projectId && task.taskId) {
      const project = useProjects.getState().projects.find((p) => p.id === task.projectId)
      if (!project) return
      const origTask = project.tasks.find((t) => t.id === task.taskId)
      const newTask: Task = {
        id: nanoid(),
        title: newTitle,
        completed: false,
        createdAt: new Date().toISOString(),
        isToDoNext: true,
        toDoNextOrder: origTask?.toDoNextOrder ?? task.order,
        noteRef
      }
      await saveProject({ ...project, tasks: [...project.tasks, newTask] })
    } else if (task.kind === 'quick') {
      const qt: QuickTask = {
        id: nanoid(),
        title: newTitle,
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        order: task.order,
        noteRef
      }
      await saveQuickTask(qt)
    }

    await completeTask(task)
  }

  const toggleInProgress = async (task: MergedTask) => {
    if (task.kind === 'quick') {
      await toggleQuickTaskInProgress(task.id)
      return
    }

    if (!task.projectId || !task.taskId) return
    await toggleTaskInProgress(task.projectId, task.taskId)
  }

  const updateTaskLinks = async (task: MergedTask, links: ProjectLink[]) => {
    const normalized = normalizeLinks(links)
    if (task.kind === 'pinned' && task.projectId && task.taskId) {
      const project = useProjects.getState().projects.find((p) => p.id === task.projectId)
      if (!project) return
      const nextTasks = project.tasks.map((t) =>
        t.id === task.taskId ? { ...t, links: normalized.length > 0 ? normalized : undefined } : t
      )
      await saveProject({ ...project, tasks: nextTasks })
    }
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
    if (tomorrowProposals.length > 0) {
      const confirmed = window.confirm('You have unapproved recurring tasks for tomorrow. Are you sure you want to lock today\'s tasks?')
      if (!confirmed) return
    }
    const refs = lockableTasks.map(taskToRef)
    await lockWinsTasks(refs)
  }

  const handleUnlock = async () => {
    await unlockWinsTasks()
  }

  // Tasks that can be swept to overflow (non-locked, non-repeating, within limit + focus)
  const sweepableTasks = useMemo(() => {
    const isTaskLocked = (task: MergedTask): boolean => {
      if (!isLocked) return false
      if (task.kind === 'quick') return lockedTaskIds.has(task.id)
      if (task.kind === 'pinned' && task.taskId) return lockedTaskIds.has(task.taskId)
      return false
    }
    const ids = new Set<string>()
    if (focusTask && !isRepeatingEntry(focusTask) && !isTaskLocked(focusTask)) {
      ids.add(focusTask.id)
    }
    for (const task of activeTasks) {
      if (!isTaskLocked(task)) ids.add(task.id)
    }
    return ids
  }, [focusTask, activeTasks, isLocked, lockedTaskIds])

  const persistBeyondLimit = async (tasks: MergedTask[], beyondLimit: boolean) => {
    const quickTaskIds = tasks.filter((t) => t.kind === 'quick').map((t) => t.id)
    const pinnedTasks = tasks
      .filter((t) => t.kind === 'pinned' && t.projectId && t.taskId)
      .map((t) => ({ projectId: t.projectId!, taskId: t.taskId! }))
    await window.api.setBeyondLimit({ quickTaskIds, pinnedTasks, beyondLimit })
  }

  const handleSweepToOverflow = async () => {
    if (sweepableTasks.size === 0) return

    // Clear focus first if it will be swept
    if (focusTask && sweepableTasks.has(focusTask.id)) {
      await setFocus(null, null)
    }

    // Mark all sweepable tasks + any unmarked overflow tasks as beyondLimit
    const tasksToSweep = allActiveTasks.filter((t) => sweepableTasks.has(t.id))
    const unmarkedOverflow = overflowTasks.filter((t) => !t.beyondLimit)
    await persistBeyondLimit([...tasksToSweep, ...unmarkedOverflow], true)
    setSelectedOverflowIds(new Set())
  }

  // Visual rendering order — matches actual JSX rendering order for correct D&D
  const visualOrderTasks = useMemo(() => {
    const tasks: MergedTask[] = []
    if (focusTask) tasks.push(focusTask)
    tasks.push(...scheduledTasks)
    tasks.push(...inProgressTasks)
    tasks.push(...upNextTasks.filter((t) => !isRepeatingEntry(t)))
    tasks.push(...upNextTasks.filter((t) => isRepeatingEntry(t)))
    tasks.push(...overflowTasks)
    return tasks
  }, [focusTask, scheduledTasks, inProgressTasks, upNextTasks, overflowTasks])

  const reorderAndPersist = async (newIds: string[], tasks: MergedTask[]) => {
    const taskById = new Map(tasks.map((t) => [t.id, t]))
    const reordered = newIds.map((id, order) => ({ ...taskById.get(id)!, order }))

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
  }

  const isPromotable = (task: MergedTask): boolean => {
    return !isRepeatingEntry(task) && !getTaskDueDate(task)
  }

  const toggleOverflowSelection = (id: string) => {
    setSelectedOverflowIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handlePromoteToTop = async () => {
    if (selectedOverflowIds.size === 0) return

    // Respect hard limit: only promote as many as there are free slots
    const topCount = activeTasks.length + (focusTask && !isRepeatingEntry(focusTask) ? 1 : 0)
    const freeSlots = Math.max(0, configLimit - topCount)
    if (freeSlots === 0) return

    const selectedTasks = overflowTasks.filter((t) => selectedOverflowIds.has(t.id))
    const toPromote = selectedTasks.slice(0, freeSlots)
    const promoteIds = new Set(toPromote.map((t) => t.id))

    // Clear beyondLimit on promoted tasks
    await persistBeyondLimit(toPromote, false)

    // Reorder: place promoted tasks at end of top section
    const ids = visualOrderTasks.map((t) => t.id)
    const overflowIds = new Set(overflowTasks.map((t) => t.id))
    const topIds = ids.filter((id) => !overflowIds.has(id))
    const promotedIds = ids.filter((id) => promoteIds.has(id))
    const remainingOverflow = ids.filter((id) => overflowIds.has(id) && !promoteIds.has(id))

    await reorderAndPersist([...topIds, ...promotedIds, ...remainingOverflow], visualOrderTasks)
    setSelectedOverflowIds(new Set())
  }

  const handleJournal = async () => {
    const result = await window.api.journalGenerateDaily()
    if (result?.notePath) {
      await window.api.journalOpen(result.notePath)
    }
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

    const ids = visualOrderTasks.map((task) => task.id)
    const fromIndex = ids.indexOf(draggedId.current)
    const toIndex = ids.indexOf(targetId)
    if (fromIndex === -1 || toIndex === -1) {
      clearDragState()
      return
    }

    // Detect cross-section drops and update beyondLimit marker
    const overflowIdSet = new Set(overflowTasks.map((t) => t.id))
    const draggedInOverflow = overflowIdSet.has(draggedId.current)
    const targetInOverflow = overflowIdSet.has(targetId)
    const draggedTask = visualOrderTasks.find((t) => t.id === draggedId.current)

    if (draggedTask && !isRepeatingEntry(draggedTask)) {
      if (!draggedInOverflow && targetInOverflow) {
        // Top → overflow: mark dragged + freeze all current overflow tasks
        const toMark = [draggedTask, ...overflowTasks.filter((t) => !t.beyondLimit)]
        await persistBeyondLimit(toMark, true)
      } else if (draggedInOverflow && !targetInOverflow) {
        // Overflow → top: block if top is full
        const topCount = activeTasks.length + (focusTask && !isRepeatingEntry(focusTask) ? 1 : 0)
        if (topCount >= configLimit) { clearDragState(); return }
        await persistBeyondLimit([draggedTask], false)
      }
    }

    ids.splice(fromIndex, 1)
    ids.splice(toIndex, 0, draggedId.current)

    await reorderAndPersist(ids, visualOrderTasks)
    clearDragState()
  }

  const handleZoneDragOver = (event: React.DragEvent, zone: 'top' | 'overflow' | 'limit') => {
    event.preventDefault()
    if (!draggedId.current) return
    setDragOverZone(zone)
  }

  const handleDropOnZone = async (zone: 'top' | 'overflow') => {
    if (!draggedId.current) return

    const overflowIdSet = new Set(overflowTasks.map((t) => t.id))
    const draggedInOverflow = overflowIdSet.has(draggedId.current)
    const draggedTask = visualOrderTasks.find((t) => t.id === draggedId.current)

    // Only cross-section drops on non-repeating tasks
    if (!draggedTask || isRepeatingEntry(draggedTask)) { clearDragState(); return }
    if (zone === 'top' && !draggedInOverflow) { clearDragState(); return }
    if (zone === 'overflow' && draggedInOverflow) { clearDragState(); return }

    if (zone === 'overflow') {
      // Top → overflow: mark dragged + freeze all current overflow tasks
      const toMark = [draggedTask, ...overflowTasks.filter((t) => !t.beyondLimit)]
      await persistBeyondLimit(toMark, true)
    } else {
      // Overflow → top: block if top is full
      const topCount = activeTasks.length + (focusTask && !isRepeatingEntry(focusTask) ? 1 : 0)
      if (topCount >= configLimit) { clearDragState(); return }
      await persistBeyondLimit([draggedTask], false)
    }

    const ids = visualOrderTasks.map((t) => t.id)
    const fromIndex = ids.indexOf(draggedId.current)
    if (fromIndex === -1) { clearDragState(); return }

    ids.splice(fromIndex, 1)

    // Insert at the limit boundary (before first remaining overflow task)
    const firstOverflow = overflowTasks.find((t) => t.id !== draggedId.current)
    const insertPos = firstOverflow ? ids.indexOf(firstOverflow.id) : ids.length
    ids.splice(insertPos, 0, draggedId.current)

    await reorderAndPersist(ids, visualOrderTasks)
    clearDragState()
  }

  // Drop on limit indicator — detect direction from dragged task origin
  const handleDropOnLimit = () => {
    if (!draggedId.current) return
    const overflowIdSet = new Set(overflowTasks.map((t) => t.id))
    handleDropOnZone(overflowIdSet.has(draggedId.current) ? 'top' : 'overflow')
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

  const getTaskDueDate = (task: MergedTask): string | null | undefined => {
    if (task.kind === 'quick') {
      return quickTasks.find((t) => t.id === task.id)?.dueDate
    }
    if (task.kind === 'pinned' && task.projectId && task.taskId) {
      const proj = projects.find((p) => p.id === task.projectId)
      return proj?.tasks.find((t) => t.id === task.taskId)?.dueDate
    }
    return undefined
  }

  const formatDueDateBadge = (dueDate: string): { label: string; overdue: boolean } => {
    const today = dateKey(new Date())
    const overdue = dueDate < today
    const d = new Date(dueDate + 'T00:00:00')
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { label, overdue }
  }

  const renderMeta = (task: MergedTask, done = false) => {
    const dueDate = getTaskDueDate(task)

    if (task.kind === 'pinned' && task.projectId) {
      const project = projects.find((item) => item.id === task.projectId)
      const minutes = getTaskMinutes(task)
      return (
        <div className="task-meta">
          {dueDate && (() => {
            const { label, overdue } = formatDueDateBadge(dueDate)
            return <span className={`due-date-badge ${!done && overdue ? 'overdue' : ''}`}>📅 {label}</span>
          })()}
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
        {dueDate && (() => {
          const { label, overdue } = formatDueDateBadge(dueDate)
          return <span className={`due-date-badge ${!done && overdue ? 'overdue' : ''}`}>📅 {label}</span>
        })()}
        <span className="task-source">quick task</span>
      </div>
    )
  }

  const renderTask = (task: MergedTask, section: 'in-progress' | 'up-next' | 'overflow') => {
    const isDragOver = dragOverId === task.id && draggedId.current !== task.id
    const locked = isTaskLocked(task)
    const isOverflow = section === 'overflow'

    return (
      <div
        key={task.id}
        className={`task-card draggable-task ${task.inProgress ? 'in-progress' : ''} ${isDragOver ? 'drag-over' : ''} ${locked ? 'wins-locked' : ''} ${isOverflow && selectedOverflowIds.has(task.id) ? 'selected' : ''}`}
        draggable={!isLocked}
        onDragStart={(event) => handleDragStart(event, task)}
        onDragOver={(event) => handleDragOver(event, task.id)}
        onDrop={() => handleDrop(task.id)}
        onDragEnd={clearDragState}
        onContextMenu={(e) => { e.stopPropagation(); if (!isOverflow) { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, task, section }) } }}
        onMouseEnter={() => { if (!isOverflow) hoveredTaskRef.current = { task, section } }}
        onMouseLeave={() => { if (hoveredTaskRef.current?.task.id === task.id) hoveredTaskRef.current = null }}
      >
        {isOverflow && isPromotable(task) && (
          <input
            type="checkbox"
            className="overflow-select-checkbox"
            checked={selectedOverflowIds.has(task.id)}
            onChange={() => toggleOverflowSelection(task.id)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
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
              <Linkify text={task.title} />
              <TaskLinksIndicator links={task.links ?? []} projectName={task.projectName} />
            </div>
          )}
          {renderMeta(task)}
        </div>
        <div className="task-actions">
          {!isOverflow && (
            <button
              className="task-action-btn btn-focus"
              title="Focus"
              onClick={() => focusOnTask(task)}
            >
              ▶
            </button>
          )}
          {!locked && (
            <button className="task-action-btn btn-remove" onClick={() => removeTask(task)} title="Remove">✕</button>
          )}
          <button className="task-overflow-trigger" onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === task.id ? null : task.id) }}>⋯</button>
        </div>
        {menuOpenId === task.id && (
          <div className="task-overflow-menu" ref={(el) => {
            if (!el) return
            const rect = el.getBoundingClientRect()
            if (rect.bottom > window.innerHeight) {
              el.style.top = 'auto'
              el.style.bottom = 'calc(100% + 4px)'
            }
          }}>
            <button className="task-overflow-item" onClick={() => { focusOnTask(task); setMenuOpenId(null) }}><span className="toi-icon">▶</span>Focus</button>
            <button className="task-overflow-item" onClick={() => { toggleInProgress(task); setMenuOpenId(null) }}><span className="toi-icon">{task.inProgress ? '⏹' : '⏩'}</span>{task.inProgress ? 'Stop In Progress' : 'In Progress'}</button>
            {task.kind === 'pinned' && task.projectId && task.taskId && (
              <button className="task-overflow-item" onClick={() => { setMenuOpenId(null); setDueDatePickerId(task.id) }}><span className="toi-icon">📅</span>{task.dueDate ? 'Change due date' : 'Set due date'}</button>
            )}
            {task.kind === 'pinned' && task.projectId && task.taskId && (
              <button className="task-overflow-item" onClick={() => { setMenuOpenId(null); setLinksEditId(task.id) }}><span className="toi-icon">🔗</span>Links{task.links && task.links.length > 0 ? ` (${task.links.length})` : ''}</button>
            )}
            {config.obsidianStoragePath && (
              <button className="task-overflow-item" onClick={() => { window.api.openTaskNote(task.id, task.title, task.projectName, task.kind === 'quick' ? formatQuickTaskId(task.taskNumber) : formatTaskId(task.taskNumber, task.projectCode), task.noteRef); setMenuOpenId(null) }}><span className="toi-icon">📝</span>Open note</button>
            )}
            {!task.repeatingTaskId && (
              <button className="task-overflow-item" onClick={() => { splitTask(task); setMenuOpenId(null) }}><span className="toi-icon">✂</span>Split & Continue</button>
            )}
            <div className="task-overflow-sep" />
            {!locked && (
              <button className="task-overflow-item danger" onClick={() => { removeTask(task); setMenuOpenId(null) }}><span className="toi-icon">×</span>{task.repeatingTaskId ? 'Unpin' : 'Remove'}</button>
            )}
          </div>
        )}
        {dueDatePickerId === task.id && (
          <div className="due-date-dismiss-popover">
            <div className="due-date-quick-btns">
              {[{ label: '+1d', days: 1 }, { label: '+2d', days: 2 }, { label: '+3d', days: 3 }, { label: '+1w', days: 7 }].map((opt) => (
                <button key={opt.label} onClick={() => { window.api.updateTaskDueDate(task.projectId!, task.taskId!, addDays(opt.days)); setDueDatePickerId(null) }}>{opt.label}</button>
              ))}
            </div>
            <input type="date" defaultValue={task.dueDate ?? ''} autoFocus onChange={(e) => { window.api.updateTaskDueDate(task.projectId!, task.taskId!, e.target.value || null); setDueDatePickerId(null) }} />
            {task.dueDate && <button onClick={() => { window.api.updateTaskDueDate(task.projectId!, task.taskId!, null); setDueDatePickerId(null) }}>Remove</button>}
          </div>
        )}
        {linksEditId === task.id && (
          <TaskLinksPopover
            links={task.links ?? []}
            onSave={(links) => { updateTaskLinks(task, links); setLinksEditId(null) }}
            onClose={() => setLinksEditId(null)}
            projectName={task.projectName}
          />
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
          <Linkify text={task.title} />
        </div>
        {renderMeta(task, true)}
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

  return (
    <div
      style={{ minHeight: '100%' }}
      onContextMenu={(e) => {
        const hasLinks = projects
          .filter((p) => !p.archivedAt && !p.suspendedAt)
          .some((p) => normalizeProjectLinks(p).length > 0)
        if (!hasLinks) return
        e.preventDefault()
        if (contextMenu) setContextMenu(null)
        setLinksMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {linksMenu && (
        <ProjectLinksMenu
          projects={projects}
          x={linksMenu.x}
          y={linksMenu.y}
          onClose={() => setLinksMenu(null)}
        />
      )}

      {repeatUpdatePrompt && (
        <RepeatUpdateModal
          prompt={repeatUpdatePrompt}
          repeatingTasks={repeatingTasks}
          saveRepeatingTask={saveRepeatingTask}
          onClose={() => setRepeatUpdatePrompt(null)}
        />
      )}

      {contextMenu && (() => {
        const { task, section } = contextMenu
        const locked = isTaskLocked(task)
        const isFocusCard = section === 'focus'
        const items: { label: string; kbd: string; action: () => void; danger?: boolean }[] = []

        if (!isFocusCard) {
          items.push({ label: 'Focus', kbd: 'F', action: () => focusOnTask(task) })
          items.push({ label: task.inProgress ? 'Stop In Progress' : 'In Progress', kbd: 'P', action: () => toggleInProgress(task) })
        }
        if (isFocusCard) {
          items.push({ label: 'Stop Focus', kbd: 'S', action: () => stopFocus() })
        }
        if (config.obsidianStoragePath) {
          items.push({ label: 'Open Note', kbd: 'N', action: () => window.api.openTaskNote(task.id, task.title, task.projectName, task.kind === 'quick' ? formatQuickTaskId(task.taskNumber) : formatTaskId(task.taskNumber, task.projectCode), task.noteRef) })
        }
        if (!task.repeatingTaskId) {
          items.push({ label: 'Split & Continue', kbd: 'C', action: () => splitTask(task) })
        }
        if (task.links && task.links.length > 0) {
          for (const link of task.links) {
            items.push({ label: `🔗 ${link.label}`, kbd: '', action: () => openProjectLink(link, task.projectName) })
          }
        }
        if (!isFocusCard && !locked && (section === 'up-next' || task.repeatingTaskId)) {
          items.push({ label: task.repeatingTaskId ? 'Unpin' : 'Remove', kbd: '⌫', action: () => removeTask(task), danger: true })
        }

        return (
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item, i) => (
              <div
                key={i}
                className={`context-menu-item ${item.danger ? 'danger' : ''}`}
                onClick={() => { setContextMenu(null); item.action() }}
              >
                <span>{item.label}</span>
                <span className="context-menu-kbd">{item.kbd}</span>
              </div>
            ))}
          </div>
        )
      })()}

      {showWinsRules && (
        <div className="wins-rules-overlay" onClick={() => setShowWinsRules(false)}>
          <div className="wins-rules-card" onClick={(e) => e.stopPropagation()}>
            <button className="wr-close" onClick={() => setShowWinsRules(false)}>&#x2715;</button>

            <div className="wr-header">
              <h2>🏆 5 Wins</h2>
              <p>Zablokuj zadania, wykonaj wszystkie, wygraj dzień</p>
            </div>

            <div className="wr-grid">

              <div className="wr-section">
                <div className="wr-title">🔒 Blokada</div>
                <div className="wr-rule"><b>Co:</b> zadania w limicie <span className="wr-dim">(kłódka przy separatorze)</span></div>
                <div className="wr-rule"><b>Które:</b> zwykłe + przypięte + fokus. <b>Powtarzalne nie wchodzą.</b></div>
                <div className="wr-rule"><b>Ile:</b> dowolnie, od 1 w górę</div>
                <div className="wr-rule"><b>Odblokowanie (✕):</b> anuluje bez zapisu wyniku</div>
              </div>

              <div className="wr-section">
                <div className="wr-title">📊 Hierarchia</div>
                <div className="wr-h-row">
                  <span className="wr-h-label">Dzień</span>
                  <span className="wr-h-desc">Wszystko zrobione przed terminem</span>
                </div>
                <div className="wr-h-row">
                  <span className="wr-h-label">Tydzień</span>
                  <span className="wr-h-desc">5 dni rozegranych, max 1 przegrana<br /><span className="wr-h-note"><span className="wr-tag wr-tag-grace">ulga</span> max 2 takie tygodnie / miesiąc</span></span>
                </div>
                <div className="wr-h-row">
                  <span className="wr-h-label">Miesiąc</span>
                  <span className="wr-h-desc">Wszystkie tygodnie wygrane</span>
                </div>
                <div className="wr-h-row">
                  <span className="wr-h-label">Rok</span>
                  <span className="wr-h-desc">Min. 11/12 miesięcy<br /><span className="wr-h-note"><span className="wr-tag wr-tag-grace">ulga</span> 1 przegrany miesiąc dozwolony</span></span>
                </div>
              </div>

              <div className="wr-section">
                <div className="wr-title">⏰ Termin</div>
                <div className="wr-rule"><b>Przed 20:00</b> — koniec tego dnia <span className="wr-dim">(23:59)</span></div>
                <div className="wr-rule"><b>Od 20:00</b> — koniec następnego dnia <span className="wr-dim">(23:59)</span></div>
              </div>

              <div className="wr-section">
                <div className="wr-title">🔥 Serie</div>
                <div className="wr-rule"><b>Dzienna:</b> kolejne wygrane dni wstecz. Brak wpisu = pominięcie. Przegrana przerywa.</div>
                <div className="wr-rule"><b>Tygodniowa:</b> kolejne wygrane tygodnie. 2+ przegrane = przerwanie.</div>
                <div className="wr-rule"><b>Miesięczna:</b> kolejne wygrane miesiące wstecz.</div>
              </div>

              <div className="wr-section wr-full">
                <div className="wr-title">⚡ Wynik dnia</div>
                <div style={{ display: 'flex', gap: '20px', fontSize: '12px' }}>
                  <div><span className="wr-tag wr-tag-win">WYGRANA</span> &nbsp;wszystko ukończone — rozliczenie automatyczne</div>
                  <div><span className="wr-tag wr-tag-loss">PRZEGRANA</span> &nbsp;termin minął, nie wszystko zrobione</div>
                </div>
              </div>

              <div className="wr-section wr-full" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--c-text-secondary)', whiteSpace: 'nowrap' }}>Podczas blokady:</div>
                <div className="wr-chips">
                  <span className="wr-chip">przeciąganie</span>
                  <span className="wr-chip">usuwanie</span>
                  <span className="wr-chip">odpinanie</span>
                  <span className="wr-chip">dodawanie</span>
                  <span className="wr-chip wr-chip-ok">kończenie</span>
                  <span className="wr-chip wr-chip-ok">fokus</span>
                  <span className="wr-chip wr-chip-ok">edycja</span>
                  <span className="wr-chip wr-chip-ok">w trakcie</span>
                </div>
              </div>

              <div className="wr-full wr-dots">
                <span className="wr-dot-item"><span className="wr-dot wr-dot-w"></span> wygrana</span>
                <span className="wr-dot-item"><span className="wr-dot wr-dot-l"></span> przegrana</span>
                <span className="wr-dot-item"><span className="wr-dot wr-dot-e"></span> brak</span>
              </div>

              <div className="wr-section wr-full">
                <div className="wr-title">💬 Dobre pytania</div>
                <div className="wr-rule"><b>Mniej niż 5 zadań?</b> Tak — blokujesz ile chcesz (nawet 1). Kończysz wszystkie = wygrana.</div>
                <div className="wr-rule"><b>Powtarzalne się liczą?</b> Nie — blokada obejmuje tylko zwykłe i przypięte zadania.</div>
                <div className="wr-rule"><b>Odblokowanie = przegrana?</b> Nie — odblokowanie anuluje dzień bez zapisu. Można zmienić zadania i zablokować ponownie.</div>
                <div className="wr-rule"><b>Dzień bez blokady?</b> Neutralny — nie jest ani wygraną, ani przegraną. Nie wpływa na tydzień, nie przerywa serii dziennej.</div>
                <div className="wr-rule"><b>Nie grasz codziennie?</b> Nie musisz. Tydzień wymaga 5 rozegranych dni — nie muszą być pod rząd ani konkretne. Pominięty dzień (bez blokady) jest neutralny, nie liczy się jako przegrana.</div>
                <div className="wr-rule"><b>Weekendy?</b> Można grać. Wygrana w sobotę/niedzielę liczy się do tygodnia. W serii dziennej weekendy są pomijane — nie przerywają, ale nie budują.</div>
                <div className="wr-rule"><b>Blokada po 20:00 a data?</b> Termin przesuwa się na następny dzień, ale wygrana zapisywana jest na dzień blokady.</div>
              </div>

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
          {config.obsidianStoragePath && (
            <button className="journal-btn" onClick={handleJournal} title="Open daily journal (J)">
              📓
            </button>
          )}
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
          <button className="wins-rules-btn" onClick={() => setShowWinsRules(true)} title="Zasady gry">?</button>
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
          <div
            className="focus-card"
            onContextMenu={(e) => { e.stopPropagation(); e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, task: focusTask, section: 'focus' }) }}
            onMouseEnter={() => { hoveredTaskRef.current = { task: focusTask, section: 'focus' } }}
            onMouseLeave={() => { hoveredTaskRef.current = null }}
          >
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
                  <Linkify text={focusTask.title} />
                </div>
              )}
              {renderMeta(focusTask)}
            </div>
            <span className="focus-timer">{focusTimer}</span>
          </div>
        </>
      )}

      {scheduledTasks.length > 0 && (
        <>
          {scheduledTasks.map((task) => renderTask(task, 'up-next'))}
          <div className="repeating-separator" />
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
              <span className="title"><Linkify text={proposal.title} /></span>
              <button className="proposal-btn accept" onClick={() => acceptRepeatingProposal(proposal.id)}>✓</button>
              <button className="proposal-btn dismiss" onClick={() => dismissRepeatingProposal(proposal.id)}>✕</button>
            </div>
          ))}
        </>
      )}

      {dueDateProposals.length > 0 && (
        <>
          <div className="section-label mt-section">
            <span style={{ opacity: 0.7 }}>📅</span>
            <span>Due</span>
          </div>
          {dueDateProposals.map(({ task, project: proj }) => (
            <div key={task.id} className="proposal-card due-date-proposal">
              <span className="due-date-icon">📅</span>
              <span className="title">
                {proj.code && <span style={{ opacity: 0.6, marginRight: 4 }}>[{proj.code}]</span>}
                <Linkify text={task.title} />
              </span>
              <button className="proposal-btn accept" onClick={() => toggleTaskToDoNext(proj.id, task.id)} title="Pin to today">✓</button>
              <div style={{ position: 'relative' }}>
                <button className="proposal-btn dismiss" onClick={() => setDueDateDismissId(dueDateDismissId === task.id ? null : task.id)} title="Dismiss">✕</button>
                {dueDateDismissId === task.id && (
                  <div className="due-date-dismiss-popover">
                    <div className="due-date-quick-btns">
                      {[{ label: '+1d', days: 1 }, { label: '+2d', days: 2 }, { label: '+3d', days: 3 }, { label: '+1w', days: 7 }].map((opt) => (
                        <button key={opt.label} onClick={() => { window.api.updateTaskDueDate(proj.id, task.id, addDays(opt.days)); setDueDateDismissId(null) }}>{opt.label}</button>
                      ))}
                    </div>
                    <input type="date" onChange={(e) => { if (e.target.value) { window.api.updateTaskDueDate(proj.id, task.id, e.target.value); setDueDateDismissId(null) } }} />
                    <button onClick={() => { window.api.updateTaskDueDate(proj.id, task.id, null); setDueDateDismissId(null) }}>Remove due date</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {tomorrowProposals.length > 0 && (
        <>
          <div className="section-label mt-section" style={{ opacity: 0.7 }}>
            <span style={{ opacity: 0.5 }}>↻</span>
            <span>Tomorrow</span>
          </div>
          {tomorrowProposals.map((proposal) => (
            <div key={proposal.id} className="proposal-card tomorrow-proposal">
              <span className="repeat-icon">↻</span>
              <span className="tomorrow-badge">tomorrow</span>
              <span className="title"><Linkify text={proposal.title} /></span>
              <button className="proposal-btn accept" onClick={() => acceptRepeatingProposal(proposal.id, tomorrowKey)}>✓</button>
              <button className="proposal-btn dismiss" onClick={() => dismissRepeatingProposal(proposal.id, tomorrowKey)}>✕</button>
            </div>
          ))}
        </>
      )}

      <div
        className={`limit-indicator ${dragOverZone === 'limit' ? 'drag-over-zone' : ''}`}
        onDragOver={(e) => handleZoneDragOver(e, 'limit')}
        onDragLeave={() => setDragOverZone(null)}
        onDrop={handleDropOnLimit}
        onDragEnd={clearDragState}
      >
        {!isLocked && lockableTasks.length > 0 && (
          <button className="wins-lock-btn" onClick={handleLock} title="Lock tasks for today's challenge">
            &#x1f513;
          </button>
        )}
        <span>limit {configLimit}</span>
        {sweepableTasks.size > 0 && (
          <button className="sweep-btn" onClick={handleSweepToOverflow} title="Clear all tasks to overflow">
            &#x21e9;
          </button>
        )}
      </div>

      {dueDateTomorrowProposals.length > 0 && (
        <>
          <div className="section-label mt-section">
            <span style={{ opacity: 0.7 }}>📅</span>
            <span>Due Tomorrow</span>
          </div>
          {dueDateTomorrowProposals.map(({ task, project: proj }) => (
            <div key={task.id} className="proposal-card due-date-proposal due-date-tomorrow">
              <span className="due-date-icon">📅</span>
              <span className="tomorrow-badge">tomorrow</span>
              <span className="title">
                {proj.code && <span style={{ opacity: 0.6, marginRight: 4 }}>[{proj.code}]</span>}
                <Linkify text={task.title} />
              </span>
              <div style={{ position: 'relative' }}>
                <button className="proposal-btn dismiss" onClick={() => setDueDateDismissId(dueDateDismissId === task.id ? null : task.id)} title="Reschedule / remove">✕</button>
                {dueDateDismissId === task.id && (
                  <div className="due-date-dismiss-popover">
                    <div className="due-date-quick-btns">
                      {[{ label: '+1d', days: 1 }, { label: '+2d', days: 2 }, { label: '+3d', days: 3 }, { label: '+1w', days: 7 }].map((opt) => (
                        <button key={opt.label} onClick={() => { window.api.updateTaskDueDate(proj.id, task.id, addDays(opt.days)); setDueDateDismissId(null) }}>{opt.label}</button>
                      ))}
                    </div>
                    <input type="date" onChange={(e) => { if (e.target.value) { window.api.updateTaskDueDate(proj.id, task.id, e.target.value); setDueDateDismissId(null) } }} />
                    <button onClick={() => { window.api.updateTaskDueDate(proj.id, task.id, null); setDueDateDismissId(null) }}>Remove due date</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {overflowTasks.length > 0 && (
        <div className="overflow-section">
          <div
            className={`done-toggle ${showOverflow ? 'open' : ''} ${dragOverZone === 'overflow' ? 'drag-over-zone' : ''}`}
            onClick={() => {
              if (showOverflow) setSelectedOverflowIds(new Set())
              setShowOverflow((value) => !value)
            }}
            onDragOver={(e) => handleZoneDragOver(e, 'overflow')}
            onDragLeave={() => setDragOverZone(null)}
            onDrop={() => handleDropOnZone('overflow')}
            onDragEnd={clearDragState}
          >
            <span style={{ opacity: 0.4 }}>⋯</span>
            <span>Beyond limit ({overflowTasks.length})</span>
            {selectedOverflowIds.size > 0 && (
              <button
                className="promote-btn"
                onClick={(e) => { e.stopPropagation(); handlePromoteToTop() }}
                title="Promote selected to top"
              >
                &#x21e7; {selectedOverflowIds.size}
              </button>
            )}
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
            <button
              className="done-clear-btn"
              title="Clear all done tasks"
              onClick={(e) => {
                e.stopPropagation()
                for (const task of completedToday) removeTask(task)
              }}
            >
              Clear
            </button>
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
