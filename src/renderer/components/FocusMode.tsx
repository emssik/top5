import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useProjects } from '../hooks/useProjects'
import { useTaskList } from '../hooks/useTaskList'
import { normalizeProjectLinks, normalizeLinks, openProjectLink, projectColorValue } from '../utils/projects'
import { calcTaskTime } from '../utils/checkInTime'
import { STANDALONE_PROJECT_ID } from '../utils/constants'
import type { Task, ProjectLink, QuickTask } from '../types'
import { formatTaskId, formatQuickTaskId } from '../../shared/taskId'
import { collectAnchorCodes } from '../../shared/task-list'
import { CYCLE_BADGE_LABEL } from '../../shared/types'
import { Linkify } from './Linkify'
import { cleanSplitTitle } from '../utils/splitTask'
import { nextRolloverIso, minutesWorkedToday } from '../utils/finishForToday'

function formatSessionTime(totalSeconds: number): string {
  const min = Math.floor(totalSeconds / 60)
  const sec = totalSeconds % 60
  if (min < 60) return `${min}:${sec.toString().padStart(2, '0')}`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function linkIcon(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('code')) return '</>'
  if (l.includes('term')) return '>_'
  if (l.includes('obsidian')) return '📓'
  if (l.includes('browser') || l.startsWith('http')) return '🌐'
  return '🔗'
}

function projectLabel(project: { code?: string; name: string } | null, isStandalone: boolean): string {
  if (isStandalone) return 'QT'
  if (!project) return ''
  return project.code || project.name.slice(0, 4)
}

// Total logged time on the task, e.g. "33 min total" / "1h 20min total".
function formatTotalLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min total`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min total` : `${h}h total`
}

interface PickerTask {
  projectId: string
  taskId: string
  title: string
  projectName?: string
  projectCode?: string
  taskNumber?: number
}

const FOCUS_WIDTH = 520
const FOCUS_HEIGHT_NORMAL = 64
const FOCUS_HEIGHT_PICKER = 480
const FOCUS_HEIGHT_BLOCKS = 520

interface BlockMeta { key: string; label: string; groups: string[]; sites: string[]; apps: string[] }
interface BlockStatePayload {
  groups: { key: string; label: string }[]
  metas: BlockMeta[]
  defaultMeta: string | null
}
interface BlockSel { groups: string[]; sites: string[]; apps: string[] }

export default function FocusMode() {
  const { projects, quickTasks, focusCheckIns, config, setFocus, repeatingTasks } = useProjects()
  const { scheduledTasks, inProgressTasks, upNextTasks } = useTaskList()
  const [confirmAction, setConfirmAction] = useState<{ minutes: number; type: 'exit' | 'complete' | 'finishToday' } | null>(null)
  const [isDev, setIsDev] = useState(false)
  const [showTaskPicker, setShowTaskPicker] = useState(false)
  const [completedTaskKey, setCompletedTaskKey] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [showManualTime, setShowManualTime] = useState(false)
  const [manualMinutes, setManualMinutes] = useState('')
  // Focus blocker config panel
  const [showBlockConfig, setShowBlockConfig] = useState(false)
  const [blockState, setBlockState] = useState<BlockStatePayload | null>(null)
  const [blockSel, setBlockSel] = useState<BlockSel>({ groups: [], sites: [], apps: [] })
  const [selectedMeta, setSelectedMeta] = useState<string | null>(null)
  const [setAsDefault, setSetAsDefault] = useState(false)
  const [newSite, setNewSite] = useState('')
  const [newApp, setNewApp] = useState('')
  // True while the mouse is over the focus window AND Cmd is held — turns ✓ into 🌙 (finished for today).
  const [cmdHover, setCmdHover] = useState(false)
  const sessionStartRef = useRef(Date.now())
  const manualInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.getIsDev().then(setIsDev)
  }, [])

  // Elapsed session time — tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Resize focus window based on open popups
  useEffect(() => {
    if (showTaskPicker) {
      window.api.resizeFocusWindow(FOCUS_WIDTH, FOCUS_HEIGHT_PICKER)
    } else if (showBlockConfig) {
      window.api.resizeFocusWindow(FOCUS_WIDTH, FOCUS_HEIGHT_BLOCKS)
    } else {
      window.api.resizeFocusWindow(FOCUS_WIDTH, FOCUS_HEIGHT_NORMAL)
    }
  }, [showTaskPicker, showBlockConfig])

  // Load the blocker state for the focused task; on first launch (nothing saved)
  // open the config panel pre-filled with the default meta.
  useEffect(() => {
    const taskId = config.focusTaskId
    if (!taskId) return
    let cancelled = false
    window.api.getFocusBlockState(taskId).then((s) => {
      if (cancelled || !s) return
      setBlockState({ groups: s.groups, metas: s.metas, defaultMeta: s.defaultMeta })
      setBlockSel(s.selection)
      setSelectedMeta(s.isSaved ? null : s.defaultMeta)
      setSetAsDefault(false)
      if (!s.isSaved) setShowBlockConfig(true)
    })
    return () => {
      cancelled = true
    }
  }, [config.focusTaskId])


  const isStandalone = config.focusProjectId === STANDALONE_PROJECT_ID
  const project = isStandalone ? null : projects.find((p) => p.id === config.focusProjectId)
  const task = isStandalone
    ? quickTasks.find((t) => t.id === config.focusTaskId)
    : project?.tasks.find((t) => t.id === config.focusTaskId)

  const repeatingTaskLink = useMemo(() => {
    const quickTask = isStandalone ? (task as QuickTask | undefined) : null
    if (!quickTask?.repeatingTaskId) return null
    const parent = repeatingTasks.find((rt) => rt.id === quickTask.repeatingTaskId)
    return parent?.link?.trim() || null
  }, [isStandalone, task, repeatingTasks])

  const canFinishToday = !!task && !(isStandalone && (task as QuickTask).repeatingTaskId)
  const showFinishToday = cmdHover && canFinishToday

  // Total logged time on this task across all sessions (updates on reload-data).
  const totalMinutes = useMemo(
    () => (task ? calcTaskTime(focusCheckIns, task.id) : 0),
    [focusCheckIns, task]
  )

  const openRepeatingTaskLink = () => {
    if (!repeatingTaskLink) return
    window.api.openExternal(repeatingTaskLink)
  }
  // Project label for the bar (code or short name)
  const projLabel = projectLabel(project ?? null, isStandalone)
  const projColor = project ? projectColorValue(project.color) : undefined

  // Cycle badge (12WY) shown when the task is a sub-task of a cycle anchor.
  const showCycleBadge =
    !isStandalone && !!project && !!task &&
    !!(task as Task).parentCode &&
    collectAnchorCodes(project).has((task as Task).parentCode!)
  const isImportant = !!task?.important
  const isMoney = !!task?.money

  // Context menu data
  const taskLinks: ProjectLink[] = useMemo(() => {
    if (isStandalone || !task) return []
    return normalizeLinks((task as Task).links)
  }, [isStandalone, task])
  const projectLinks: ProjectLink[] = project ? normalizeProjectLinks(project) : []
  const obsidianEnabled = !!config.obsidianStoragePath
  const taskBadge = isStandalone
    ? formatQuickTaskId(task?.taskNumber)
    : formatTaskId(task?.taskNumber, project?.code)

  const openNote = () => {
    if (!task || !obsidianEnabled) return
    window.api.openTaskNote(task.id, task.title, project?.name, taskBadge, task.noteRef)
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const items: { id: string; label: string; type?: 'separator' }[] = []
    for (const link of taskLinks) {
      items.push({ id: `tasklink:${link.label}`, label: `🔗  ${link.label}` })
    }
    if (taskLinks.length > 0 && projectLinks.length > 0) {
      items.push({ id: 'sep-task-proj', label: '', type: 'separator' })
    }
    for (const link of projectLinks) {
      items.push({ id: `link:${link.label}`, label: `${linkIcon(link.label)}  ${link.label}` })
    }
    if (obsidianEnabled) {
      items.push({ id: 'obsidian-note', label: '📝  Obsidian note' })
    }
    if ((projectLinks.length > 0 || obsidianEnabled) && project) {
      items.push({ id: 'sep1', label: '', type: 'separator' })
    }
    if (project) {
      items.push({ id: 'open-project', label: '📂  Open project' })
    }
    if (projectLinks.length > 0 || obsidianEnabled || project) {
      items.push({ id: 'sep2', label: '', type: 'separator' })
    }
    items.push({ id: 'manual-time', label: '+   Dodaj czas' })
    items.push({ id: 'sep3', label: '', type: 'separator' })
    items.push({ id: 'complete', label: '✓   Complete task' })
    if (canFinishToday) {
      items.push({ id: 'finish-today', label: '🌙   Skończone na dzisiaj' })
    }
    items.push({ id: 'exit', label: '✕   Exit focus' })
    window.api.showFocusContextMenu(items, e.clientX, e.clientY)
  }, [taskLinks, projectLinks, obsidianEnabled, project, canFinishToday])

  // Handle context menu actions from popup window
  useEffect(() => {
    return window.api.onFocusMenuAction((actionId: string) => {
      if (actionId.startsWith('tasklink:')) {
        const label = actionId.slice(9)
        const link = taskLinks.find((l) => l.label === label)
        if (link) openProjectLink(link, project?.name)
      } else if (actionId.startsWith('link:')) {
        const label = actionId.slice(5)
        const link = projectLinks.find((l) => l.label === label)
        if (link) openProjectLink(link, project?.name)
      } else if (actionId === 'obsidian-note') {
        openNote()
      } else if (actionId === 'open-project') {
        if (project) window.api.showProjectInMain(project.id)
      } else if (actionId === 'manual-time') {
        openManualTime()
      } else if (actionId === 'complete') {
        handleComplete()
      } else if (actionId === 'finish-today') {
        handleFinishToday()
      } else if (actionId === 'exit') {
        handleExit()
      }
    })
  })

  // Main timer shows wall time from focus window start.
  const totalSeconds = elapsedSeconds

  // Build picker from visible tasks, excluding just-completed task.
  // Matches TodayView's visual order within the limit: scheduled → in-progress → up-next.
  // Overflow (beyond limit) is intentionally excluded — Daniel zepchnął je tam świadomie.
  const pickerTasks: PickerTask[] = []
  if (showTaskPicker) {
    for (const mt of [...scheduledTasks, ...inProgressTasks, ...upNextTasks]) {
      const projectId = mt.kind === 'pinned' ? mt.projectId! : STANDALONE_PROJECT_ID
      const taskId = mt.kind === 'pinned' ? mt.taskId! : mt.id
      const key = `${projectId}:${taskId}`
      if (key === completedTaskKey) continue
      pickerTasks.push({ projectId, taskId, title: mt.title, projectName: mt.projectName, projectCode: mt.projectCode, taskNumber: mt.taskNumber })
    }
  }

  const completeCurrentTask = async () => {
    if (!config.focusProjectId || !config.focusTaskId) return

    if (isStandalone) {
      await window.api.completeQuickTask(config.focusTaskId)
    } else {
      const { projects: freshProjects } = await window.api.getAppData()
      const freshProject = freshProjects.find((p: { id: string }) => p.id === config.focusProjectId)
      if (freshProject) {
        const updatedTasks = freshProject.tasks.map((t: Task) =>
          t.id === config.focusTaskId
            ? { ...t, completed: true, completedAt: new Date().toISOString(), inProgress: false }
            : t
        )
        await window.api.saveProject({ ...freshProject, tasks: updatedTasks })
      }
    }

    setCompletedTaskKey(`${config.focusProjectId}:${config.focusTaskId}`)
  }

  // "Skończone na dzisiaj" — keep the task active (completed=false, same id/number)
  // but hide it from Today until tomorrow (06:00), and log the postpone with minutes
  // worked today. The task stays visible to external tools (top5 tasks) the whole time.
  const finishCurrentForToday = async () => {
    if (!task || !canFinishToday || !config.focusProjectId || !config.focusTaskId) return

    const hideUntil = nextRolloverIso()
    if (isStandalone) {
      const origQt = useProjects.getState().quickTasks.find((q) => q.id === config.focusTaskId)
      if (!origQt) return
      await useProjects.getState().saveQuickTask({ ...origQt, hideUntil, inProgress: false })
    } else {
      const freshProject = useProjects.getState().projects.find((p) => p.id === config.focusProjectId)
      if (!freshProject) return
      const tasks = freshProject.tasks.map((t) =>
        t.id === config.focusTaskId ? { ...t, hideUntil, inProgress: false } : t
      )
      await useProjects.getState().saveProject({ ...freshProject, tasks })
    }

    window.api.logTaskPostponed({
      projectId: isStandalone ? undefined : config.focusProjectId,
      projectName: isStandalone ? undefined : project?.name,
      taskTitle: cleanSplitTitle(task.title),
      taskCode: taskBadge || undefined,
      minutes: minutesWorkedToday(focusCheckIns, config.focusTaskId)
    })

    setCompletedTaskKey(`${config.focusProjectId}:${config.focusTaskId}`)
  }

  const saveTimeIfNeeded = async (minutes: number) => {
    if (minutes >= 1 && config.focusProjectId && config.focusTaskId) {
      await window.api.saveFocusCheckIn({
        id: crypto.randomUUID(),
        projectId: config.focusProjectId,
        taskId: config.focusTaskId,
        timestamp: new Date().toISOString(),
        response: 'yes',
        minutes
      })
    }
  }

  const handleExit = async () => {
    const unsavedMs = await window.api.getFocusUnsavedMs()
    const unsavedMin = Math.floor(unsavedMs / 60000)
    if (unsavedMin >= 1) {
      setConfirmAction({ minutes: unsavedMin, type: 'exit' })
    } else {
      setFocus(null, null)
    }
  }

  const handleComplete = async () => {
    const unsavedMs = await window.api.getFocusUnsavedMs()
    const unsavedMin = Math.floor(unsavedMs / 60000)
    if (unsavedMin >= 1) {
      setConfirmAction({ minutes: unsavedMin, type: 'complete' })
    } else {
      await completeCurrentTask()
      setShowTaskPicker(true)
    }
  }

  const handleFinishToday = async () => {
    if (!canFinishToday) return
    const unsavedMs = await window.api.getFocusUnsavedMs()
    const unsavedMin = Math.floor(unsavedMs / 60000)
    if (unsavedMin >= 1) {
      setConfirmAction({ minutes: unsavedMin, type: 'finishToday' })
    } else {
      await finishCurrentForToday()
      setShowTaskPicker(true)
    }
  }

  const finishConfirm = async (save: boolean) => {
    if (!confirmAction) return
    if (save) await saveTimeIfNeeded(confirmAction.minutes)

    if (confirmAction.type === 'exit') {
      setFocus(null, null)
      return
    }

    if (confirmAction.type === 'finishToday') {
      await finishCurrentForToday()
    } else {
      await completeCurrentTask()
    }
    setConfirmAction(null)
    setShowTaskPicker(true)
  }

  const handlePickTask = async (pickerTask: PickerTask) => {
    setShowTaskPicker(false)
    await window.api.switchFocusTask(pickerTask.projectId, pickerTask.taskId)
    setCompletedTaskKey(null)
    sessionStartRef.current = Date.now()
    setElapsedSeconds(0)
  }

  const handleExitFromPicker = () => {
    setShowTaskPicker(false)
    setFocus(null, null)
  }

  const openManualTime = () => {
    setManualMinutes('')
    setShowManualTime(true)
    setTimeout(() => manualInputRef.current?.focus(), 50)
  }

  const handleManualTimeSave = async () => {
    const mins = parseInt(manualMinutes, 10)
    if (mins >= 1) {
      await saveTimeIfNeeded(mins)
    }
    setShowManualTime(false)
  }

  // --- Focus blocker config ---
  const pickMeta = (m: BlockMeta) => {
    setSelectedMeta(m.key)
    setBlockSel({ groups: [...m.groups], sites: [...m.sites], apps: [...m.apps] })
  }
  const toggleBlockGroup = (key: string) => {
    setSelectedMeta(null)
    setBlockSel((s) => ({
      ...s,
      groups: s.groups.includes(key) ? s.groups.filter((g) => g !== key) : [...s.groups, key]
    }))
  }
  const addBlockSite = () => {
    const v = newSite.trim().toLowerCase()
    if (!v) return
    setSelectedMeta(null)
    setBlockSel((s) => (s.sites.includes(v) ? s : { ...s, sites: [...s.sites, v] }))
    setNewSite('')
  }
  const addBlockApp = () => {
    const v = newApp.trim()
    if (!v) return
    setSelectedMeta(null)
    setBlockSel((s) => (s.apps.includes(v) ? s : { ...s, apps: [...s.apps, v] }))
    setNewApp('')
  }
  const saveBlocks = async () => {
    const taskId = config.focusTaskId
    if (!taskId) return
    const def = setAsDefault && selectedMeta ? selectedMeta : undefined
    const next = await window.api.saveFocusBlockSelection(taskId, blockSel, def)
    if (next) setBlockState({ groups: next.groups, metas: next.metas, defaultMeta: next.defaultMeta })
    setShowBlockConfig(false)
  }

  // Manual time entry
  if (showManualTime) {
    return (
      <div
        className="h-[50px] flex items-center px-4 gap-3 rounded-xl bg-clean-view/95 border border-border/50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-[13px] text-t-primary flex-shrink-0">
          Dodaj czas (min):
        </span>
        <div className="flex gap-2 items-center flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <input
            ref={manualInputRef}
            type="number"
            min="1"
            max="480"
            value={manualMinutes}
            onChange={(e) => setManualMinutes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleManualTimeSave()
              if (e.key === 'Escape') setShowManualTime(false)
            }}
            className="w-[60px] px-2 py-1 rounded-md text-[12px] text-t-primary bg-surface/80 border border-border/50 outline-none focus:border-blue-500/50 tabular-nums text-center"
            placeholder="15"
          />
          <button
            onClick={handleManualTimeSave}
            className="px-3 py-1 rounded-md text-[12px] font-medium bg-blue-600/80 hover:bg-blue-500/80 text-white transition-colors"
          >
            Zapisz
          </button>
          <button
            onClick={() => setShowManualTime(false)}
            className="px-3 py-1 rounded-md text-[12px] font-medium bg-surface/80 hover:bg-hover text-t-secondary transition-colors"
          >
            Esc
          </button>
        </div>
      </div>
    )
  }

  // Confirm save dialog
  if (confirmAction !== null) {
    return (
      <div
        className="h-[50px] flex items-center px-4 gap-3 rounded-xl bg-clean-view/95 border border-border/50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-[13px] text-t-primary flex-shrink-0">
          Zapisać {confirmAction.minutes} min?
        </span>
        <div className="flex gap-2 flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => finishConfirm(true)}
            className="px-3 py-1 rounded-md text-[12px] font-medium bg-blue-600/80 hover:bg-blue-500/80 text-white transition-colors"
          >
            Tak
          </button>
          <button
            onClick={() => finishConfirm(false)}
            className="px-3 py-1 rounded-md text-[12px] font-medium bg-surface/80 hover:bg-hover text-t-secondary transition-colors"
          >
            Nie
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative w-screen h-screen"
      onMouseMove={(e) => setCmdHover(e.metaKey)}
      onMouseLeave={() => setCmdHover(false)}
    >
      {/* Main bar */}
      <div
        className="h-[50px] flex items-center pl-4 pr-1.5 gap-2.5 rounded-xl bg-clean-view/95 border border-border/50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        onContextMenu={handleContextMenu}
      >
        <div
          className="w-[7px] h-[7px] rounded-full animate-pulse flex-shrink-0 self-center"
          style={{ background: projColor || '#3b82f6' }}
        />
        {isDev && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 flex-shrink-0 self-center">
            DEV
          </span>
        )}

        {/* Title + meta, stacked */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-[1px]">
          <div className="flex items-center gap-1.5 min-w-0">
            {isImportant && (
              <span
                className="text-[13px] flex-shrink-0"
                style={{ color: 'var(--pc-amber)', lineHeight: 1 }}
                title="Important"
              >★</span>
            )}
            {isMoney && (
              <span
                className="text-[13px] flex-shrink-0"
                style={{ color: 'var(--pc-gold)', fontWeight: 700, lineHeight: 1 }}
                title="Money"
              >$</span>
            )}
            <span
              className="text-[15px] font-semibold leading-tight truncate text-t-primary min-w-0 cursor-default"
              onDoubleClick={() => { if (task?.title) navigator.clipboard.writeText(task.title) }}
            >
              {task?.title ? <Linkify text={cleanSplitTitle(task.title)} /> : 'No task'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0 text-[11px] leading-tight text-t-muted">
            {projLabel && (
              <button
                className="flex-shrink-0 hover:text-t-primary transition-colors cursor-pointer bg-transparent border-none p-0"
                style={{ fontFamily: 'monospace', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                onClick={async () => {
                  if (!project) return
                  await window.api.showProjectInMain(project.id)
                }}
                title={project ? `Open ${project.name}` : undefined}
              >
                {projLabel}
              </button>
            )}
            {showCycleBadge && (
              <>
                <span className="opacity-50 flex-shrink-0">·</span>
                <span className="task-cycle-badge flex-shrink-0" title="Sub-task of cycle anchor">{CYCLE_BADGE_LABEL}</span>
              </>
            )}
            {totalMinutes > 0 && (
              <>
                <span className="opacity-50 flex-shrink-0">·</span>
                <span className="truncate" style={{ fontFamily: 'monospace' }}>{formatTotalLabel(totalMinutes)}</span>
              </>
            )}
          </div>
        </div>

        {repeatingTaskLink && (
          <button
            onClick={openRepeatingTaskLink}
            className="w-[24px] h-[24px] rounded-[6px] bg-transparent text-t-muted text-[11px] hover:bg-hover hover:text-t-secondary transition-all flex items-center justify-center cursor-pointer border-none flex-shrink-0 self-center"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title="Open link"
          >
            🔗
          </button>
        )}
        <button
          onClick={openManualTime}
          className="flex items-center flex-shrink-0 self-center whitespace-nowrap bg-blue-500/12 hover:bg-blue-500/20 rounded-[10px] px-2.5 py-[4px] border-none cursor-pointer transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="Dodaj czas"
        >
          <span className="text-[13px] font-semibold text-blue-400 tabular-nums">
            {formatSessionTime(totalSeconds)}
          </span>
        </button>
        {/* Action buttons — ✓ becomes 🌙 (finished for today) while Cmd is held over the window */}
        <div
          className="flex gap-0.5 flex-shrink-0 self-center"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onMouseMove={(e) => setCmdHover(e.metaKey)}
        >
          <button
            onClick={() => setShowBlockConfig((v) => !v)}
            className={`w-[28px] h-[28px] rounded-[7px] bg-transparent text-[12px] transition-all flex items-center justify-center cursor-pointer border-none ${
              showBlockConfig ? 'text-amber-400 bg-amber-500/15' : 'text-t-muted hover:bg-amber-500/15 hover:text-amber-400'
            }`}
            title="Blokady focusa"
          >
            🔒
          </button>
          <button
            onClick={showFinishToday ? handleFinishToday : handleComplete}
            className={`w-[28px] h-[28px] rounded-[7px] bg-transparent text-t-muted text-[12px] transition-all flex items-center justify-center cursor-pointer border-none ${
              showFinishToday ? 'hover:bg-blue-500/15 hover:text-blue-400' : 'hover:bg-green-500/15 hover:text-green-400'
            }`}
            title={showFinishToday ? 'Skończone na dzisiaj' : 'Complete task'}
          >
            {showFinishToday ? '🌙' : '✓'}
          </button>
          <button
            onClick={handleExit}
            className="w-[28px] h-[28px] rounded-[7px] bg-transparent text-t-muted text-[12px] hover:bg-red-500/15 hover:text-red-400 transition-all flex items-center justify-center cursor-pointer border-none"
            title="Exit focus"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Task picker popup */}
      {showTaskPicker && (
        <div className="absolute top-[54px] left-0 right-0 mx-2 rounded-lg bg-clean-view/95 border border-border/50 shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30">
            <span className="text-[11px] text-t-muted">Następne zadanie:</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <button
              onClick={handleExitFromPicker}
              className="w-full text-left px-3 py-2 hover:bg-red-500/10 transition-colors flex items-center gap-2 border-b border-border/20 text-t-secondary"
            >
              <span className="text-[10px] flex-shrink-0 opacity-60">✕</span>
              <span className="text-[12px] truncate">Zakończ bez wybierania nowego zadania</span>
            </button>
            {pickerTasks.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-t-muted text-center">
                Brak dostępnych zadań
              </div>
            ) : (
              pickerTasks.map((pt) => (
                <button
                  key={`${pt.projectId}:${pt.taskId}`}
                  onClick={() => handlePickTask(pt)}
                  className="w-full text-left px-3 py-2 hover:bg-hover transition-colors flex items-center gap-2"
                >
                  {pt.taskNumber != null && (
                    <span className="text-[10px] text-t-muted flex-shrink-0" style={{ fontFamily: 'monospace', opacity: 0.5 }}>
                      {pt.projectCode ? formatTaskId(pt.taskNumber, pt.projectCode) : formatQuickTaskId(pt.taskNumber)}
                    </span>
                  )}
                  <span className="text-[12px] text-t-primary truncate">{pt.title}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Focus blocker config panel */}
      {showBlockConfig && blockState && (
        <div
          className="absolute top-[54px] left-0 right-0 mx-2 rounded-lg bg-clean-view/95 border border-border/50 shadow-lg overflow-hidden"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
            <span className="text-[11px] text-t-muted">Blokady focusa</span>
            <button
              onClick={() => setShowBlockConfig(false)}
              className="text-[12px] text-t-muted hover:text-t-primary bg-transparent border-none cursor-pointer p-0"
            >
              ✕
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto px-3 py-2.5 flex flex-col gap-3">
            {/* Metas */}
            {blockState.metas.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-t-muted mb-1.5">Zestaw</div>
                <div className="flex flex-wrap gap-1.5">
                  {blockState.metas.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => pickMeta(m)}
                      className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors cursor-pointer ${
                        selectedMeta === m.key
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-surface text-t-secondary border-border hover:bg-hover'
                      }`}
                    >
                      {m.label}
                      {blockState.defaultMeta === m.key ? ' ★' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Groups */}
            <div>
              <div className="text-[10px] uppercase tracking-wide text-t-muted mb-1.5">Grupy</div>
              <div className="flex flex-wrap gap-1.5">
                {blockState.groups.map((g) => {
                  const on = blockSel.groups.includes(g.key)
                  return (
                    <button
                      key={g.key}
                      onClick={() => toggleBlockGroup(g.key)}
                      className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors cursor-pointer ${
                        on
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-surface text-t-secondary border-border hover:bg-hover'
                      }`}
                    >
                      {on ? '✓ ' : ''}
                      {g.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Ad-hoc sites */}
            <div>
              <div className="text-[10px] uppercase tracking-wide text-t-muted mb-1.5">Dodatkowe strony</div>
              {blockSel.sites.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {blockSel.sites.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface/80 text-[11px] text-t-secondary border border-border/40"
                    >
                      {s}
                      <button
                        onClick={() => setBlockSel((cur) => ({ ...cur, sites: cur.sites.filter((x) => x !== s) }))}
                        className="text-t-muted hover:text-red-400 bg-transparent border-none cursor-pointer p-0 leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <input
                  value={newSite}
                  onChange={(e) => setNewSite(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addBlockSite() }}
                  placeholder="np. youtube.com"
                  className="flex-1 px-2 py-1 rounded-md text-[12px] text-t-primary bg-surface/80 border border-border/50 outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={addBlockSite}
                  className="px-2.5 py-1 rounded-md text-[12px] bg-surface/80 hover:bg-hover text-t-secondary border border-border/50 cursor-pointer"
                >
                  Dodaj
                </button>
              </div>
            </div>
            {/* Ad-hoc apps */}
            <div>
              <div className="text-[10px] uppercase tracking-wide text-t-muted mb-1.5">Dodatkowe aplikacje</div>
              {blockSel.apps.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {blockSel.apps.map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface/80 text-[11px] text-t-secondary border border-border/40"
                    >
                      {a}
                      <button
                        onClick={() => setBlockSel((cur) => ({ ...cur, apps: cur.apps.filter((x) => x !== a) }))}
                        className="text-t-muted hover:text-red-400 bg-transparent border-none cursor-pointer p-0 leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <input
                  value={newApp}
                  onChange={(e) => setNewApp(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addBlockApp() }}
                  placeholder="np. Slack"
                  className="flex-1 px-2 py-1 rounded-md text-[12px] text-t-primary bg-surface/80 border border-border/50 outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={addBlockApp}
                  className="px-2.5 py-1 rounded-md text-[12px] bg-surface/80 hover:bg-hover text-t-secondary border border-border/50 cursor-pointer"
                >
                  Dodaj
                </button>
              </div>
            </div>
            {/* Set as default meta */}
            <label
              className={`flex items-center gap-2 text-[11px] cursor-pointer ${
                selectedMeta ? 'text-t-secondary' : 'text-t-muted opacity-50'
              }`}
            >
              <input
                type="checkbox"
                disabled={!selectedMeta}
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
              />
              Ustaw „{selectedMeta ? blockState.metas.find((m) => m.key === selectedMeta)?.label : '—'}" jako domyślny zestaw
            </label>
          </div>
          <div className="px-3 py-2 border-t border-border/30 flex gap-2 justify-end">
            <button
              onClick={() => setShowBlockConfig(false)}
              className="px-3 py-1 rounded-md text-[12px] bg-surface/80 hover:bg-hover text-t-secondary border-none cursor-pointer"
            >
              Zamknij
            </button>
            <button
              onClick={saveBlocks}
              className="px-3 py-1 rounded-md text-[12px] font-medium bg-blue-600/80 hover:bg-blue-500/80 text-white border-none cursor-pointer"
            >
              Zapisz i blokuj
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
