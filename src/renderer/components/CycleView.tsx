import { Fragment, useEffect, useMemo, useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import type { Task, Project, ProjectLink, CycleRole } from '../types'
import { CYCLE_ROLE_LABELS } from '../../shared/types'
import { calcTaskTime, formatCheckInTime } from '../utils/checkInTime'
import { projectColorValue, normalizeLinks } from '../utils/projects'
import TaskIdBadge from './TaskIdBadge'
import { formatTaskId } from '../../shared/taskId'
import { dateKey } from '../../shared/schedule'
import { compareDue } from '../../shared/sort'
import { collectAnchorCodes } from '../../shared/task-list'
import { ensureCycleStart, setStoredCycleStart } from '../utils/cycleStart'
import CycleClockBanner from './CycleClockBanner'
import { Linkify } from './Linkify'
import TaskLinksPopover from './TaskLinksPopover'
import TaskLinksIndicator from './TaskLinksIndicator'
import { MyccCommentPopover } from './MyccCommentPopover'

interface CycleTask {
  task: Task
  project: Project
}

interface SectionTotals {
  active: number
  done: number
}

const ROLES: CycleRole[] = ['must', 'should', 'could']

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return dateKey(d)
}

function compareCode(a: CycleTask, b: CycleTask): number {
  const codeA = formatTaskId(a.task.taskNumber, a.project.code) || a.project.name || ''
  const codeB = formatTaskId(b.task.taskNumber, b.project.code) || b.project.name || ''
  return codeA.localeCompare(codeB, undefined, { numeric: true })
}

function sortCycleTasks(tasks: CycleTask[]): CycleTask[] {
  return [...tasks].sort((a, b) => {
    const aDone = a.task.completed
    const bDone = b.task.completed
    if (aDone !== bDone) return aDone ? 1 : -1
    const dueCmp = compareDue(a.task.dueDate, b.task.dueDate)
    if (dueCmp !== 0) return dueCmp
    return compareCode(a, b)
  })
}

export default function CycleView() {
  const {
    projects,
    saveProject,
    setFocus,
    toggleTaskInProgress,
    toggleTaskImportant,
    toggleTaskToDoNext,
    setTaskCycleRole,
    resetCycleRoles,
    focusCheckIns,
    config
  } = useProjects()

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [dueDatePickerId, setDueDatePickerId] = useState<string | null>(null)
  const [cycleRolePickerId, setCycleRolePickerId] = useState<string | null>(null)
  const [linksEditId, setLinksEditId] = useState<string | null>(null)
  const [myccCommentId, setMyccCommentId] = useState<string | null>(null)

  const { grouped, totals, subsByAnchor } = useMemo(() => {
    const buckets: Record<CycleRole, CycleTask[]> = { must: [], should: [], could: [] }
    const counts: Record<CycleRole, SectionTotals> = {
      must: { active: 0, done: 0 },
      should: { active: 0, done: 0 },
      could: { active: 0, done: 0 }
    }
    for (const project of projects) {
      if (project.archivedAt) continue
      for (const task of project.tasks) {
        if (!task.cycleRole) continue
        buckets[task.cycleRole].push({ task, project })
        if (task.completed) counts[task.cycleRole].done += 1
        else counts[task.cycleRole].active += 1
      }
    }
    for (const role of ROLES) {
      buckets[role] = sortCycleTasks(buckets[role])
    }

    // Sub-tasks: parentCode → anchor in same project, hidden when completed.
    const subsByAnchor = new Map<string, CycleTask[]>()
    for (const project of projects) {
      if (project.archivedAt) continue
      const anchorCodes = collectAnchorCodes(project)
      if (anchorCodes.size === 0) continue
      for (const task of project.tasks) {
        if (task.cycleRole || task.completed) continue
        if (!task.parentCode || !anchorCodes.has(task.parentCode)) continue
        const arr = subsByAnchor.get(task.parentCode) ?? []
        arr.push({ task, project })
        subsByAnchor.set(task.parentCode, arr)
      }
    }
    for (const arr of subsByAnchor.values()) arr.sort((a, b) => {
      const dueCmp = compareDue(a.task.dueDate, b.task.dueDate)
      if (dueCmp !== 0) return dueCmp
      return compareCode(a, b)
    })

    return { grouped: buckets, totals: counts, subsByAnchor }
  }, [projects])

  const hasCycleTasks = useMemo(
    () => projects.some((p) => !p.archivedAt && p.tasks.some((t) => !!t.cycleRole)),
    [projects]
  )
  const cycleStart = useMemo(() => ensureCycleStart(hasCycleTasks), [hasCycleTasks])

  // Close popovers/menus on outside click + Escape
  useEffect(() => {
    if (!menuOpenId) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.task-overflow-menu')) return
      if (target.closest('.task-overflow-trigger')) return
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

  useEffect(() => {
    if (!cycleRolePickerId) return
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.cycle-role-popover')) return
      setCycleRolePickerId(null)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCycleRolePickerId(null)
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
  }, [cycleRolePickerId])

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

  useEffect(() => {
    if (!linksEditId) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.task-links-popover')) return
      if (target.closest('.task-links-indicator')) return
      setLinksEditId(null)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLinksEditId(null)
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
  }, [linksEditId])

  const updateTask = async (project: Project, taskId: string, mutate: (t: Task) => Task) => {
    const fresh = useProjects.getState().projects.find((p) => p.id === project.id)
    if (!fresh) return
    const tasks = fresh.tasks.map((t) => (t.id === taskId ? mutate(t) : t))
    await saveProject({ ...fresh, tasks })
  }

  const completeTask = (project: Project, task: Task) =>
    updateTask(project, task.id, (t) =>
      t.completed
        ? { ...t, completed: false, completedAt: null }
        : { ...t, completed: true, completedAt: new Date().toISOString(), inProgress: false }
    )

  const handleSetDueDate = (project: Project, taskId: string, dueDate: string | null) =>
    window.api.updateTaskDueDate(project.id, taskId, dueDate)

  const handleSetCycleRole = (project: Project, taskId: string, role: CycleRole | null) =>
    setTaskCycleRole(project.id, taskId, role)

  const handleToggleBeyond = (project: Project, task: Task) =>
    window.api.setBeyondLimit({
      pinnedTasks: [{ projectId: project.id, taskId: task.id }],
      beyondLimit: !task.beyondLimit
    })

  const handleUpdateLinks = (project: Project, taskId: string, links: ProjectLink[]) => {
    const normalized = normalizeLinks(links)
    return updateTask(project, taskId, (t) => ({
      ...t,
      links: normalized.length > 0 ? normalized : undefined
    }))
  }

  const today = dateKey(new Date())

  const renderTask = ({ task, project }: CycleTask, isSubTask = false) => {
    const isPinned = !!task.isToDoNext
    const isDone = task.completed
    const taskMinutes = calcTaskTime(focusCheckIns, task.id)
    const overdue = !isDone && task.dueDate && task.dueDate < today

    return (
      <div
        key={task.id}
        className={`task-card ${isDone ? 'done-card' : ''} ${task.inProgress ? 'in-progress' : ''} ${isSubTask ? 'sub-task' : ''}`}
      >
        <button className={`task-checkbox ${isDone ? 'checked' : ''}`} onClick={() => completeTask(project, task)} />
        <div className="task-content">
          <div className={`task-title ${isDone ? 'completed' : ''}`}>
            <TaskIdBadge taskNumber={task.taskNumber} projectCode={project.code} kind="project" />
            {task.important && !isDone && (
              <button
                type="button"
                className="task-important-star"
                title="Important — click to unmark"
                onClick={(e) => { e.stopPropagation(); toggleTaskImportant(project.id, task.id) }}
              >★</button>
            )}
            {task.cycleRole && !isDone && (
              <span
                className={`cycle-role-badge cr-${task.cycleRole}`}
                title={`Cycle: ${task.cycleRole}`}
                onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); setCycleRolePickerId(task.id) }}
              >{CYCLE_ROLE_LABELS[task.cycleRole]}</span>
            )}
            <Linkify text={task.title} />
            <TaskLinksIndicator links={task.links ?? []} projectName={project.name} />
          </div>
          <div className="task-meta">
            <span className="dot" style={{ background: projectColorValue(project.color) }} />
            <span>{project.name || 'Project'}</span>
            {isPinned && <span title="Pinned to today" style={{ marginLeft: 4 }}>📌</span>}
            {task.beyondLimit && <span title="Beyond limit" style={{ marginLeft: 4, opacity: 0.6 }}>↧</span>}
            {taskMinutes > 0 && <span>· {formatCheckInTime(taskMinutes)}</span>}
            {task.dueDate && (() => {
              const d = new Date(task.dueDate + 'T00:00:00')
              const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              return <span className={`due-date-badge ${overdue ? 'overdue' : ''}`}>📅 {label}</span>
            })()}
          </div>
        </div>

        {!isDone && (
          <>
            <button
              className="task-action-btn btn-focus"
              title="Focus"
              onClick={() => setFocus(project.id, task.id)}
            >▶</button>
            <button className="task-overflow-trigger" onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === task.id ? null : task.id) }}>⋯</button>
          </>
        )}

        {menuOpenId === task.id && (
          <div className="task-overflow-menu" ref={(el) => {
            if (!el) return
            const rect = el.getBoundingClientRect()
            if (rect.bottom > window.innerHeight) {
              el.style.top = 'auto'
              el.style.bottom = 'calc(100% + 4px)'
            }
          }}>
            <button className="task-overflow-item" onClick={() => { setFocus(project.id, task.id); setMenuOpenId(null) }}><span className="toi-icon">▶</span>Focus</button>
            <button className="task-overflow-item" onClick={() => { toggleTaskInProgress(project.id, task.id); setMenuOpenId(null) }}><span className="toi-icon">{task.inProgress ? '⏹' : '⏩'}</span>{task.inProgress ? 'Stop In Progress' : 'In Progress'}</button>
            <button className="task-overflow-item" onClick={() => { toggleTaskImportant(project.id, task.id); setMenuOpenId(null) }}><span className="toi-icon">{task.important ? '☆' : '★'}</span>{task.important ? 'Unmark Important' : 'Mark Important'}</button>
            <button className="task-overflow-item" onClick={() => { toggleTaskToDoNext(project.id, task.id); setMenuOpenId(null) }}><span className="toi-icon">📌</span>{isPinned ? 'Unpin from Today' : 'Pin to Today'}</button>
            <button className="task-overflow-item" onClick={() => { setMenuOpenId(null); setDueDatePickerId(task.id) }}><span className="toi-icon">📅</span>{task.dueDate ? 'Change due date' : 'Set due date'}</button>
            <button className="task-overflow-item" onClick={() => { setMenuOpenId(null); setLinksEditId(task.id) }}><span className="toi-icon">🔗</span>Links{task.links && task.links.length > 0 ? ` (${task.links.length})` : ''}</button>
            <button className="task-overflow-item" onClick={() => { setMenuOpenId(null); setCycleRolePickerId(task.id) }}><span className="toi-icon">12W</span>Cycle role{task.cycleRole ? `: ${task.cycleRole}` : ''}</button>
            <button className="task-overflow-item" onClick={() => { handleToggleBeyond(project, task); setMenuOpenId(null) }}><span className="toi-icon">↧</span>{task.beyondLimit ? 'Bring back to today' : 'Move beyond limit'}</button>
            {config.obsidianStoragePath && (
              <button className="task-overflow-item" onClick={() => { window.api.openTaskNote(task.id, task.title, project.name, formatTaskId(task.taskNumber, project.code), task.noteRef); setMenuOpenId(null) }}><span className="toi-icon">📝</span>Open note</button>
            )}
            <button className="task-overflow-item" onClick={() => { setMenuOpenId(null); setMyccCommentId(task.id) }}><span className="toi-icon">➤</span>Send to MyCC</button>
            <div className="task-overflow-sep" />
            <button className="task-overflow-item danger" onClick={() => { handleSetCycleRole(project, task.id, null); setMenuOpenId(null) }}><span className="toi-icon">×</span>Remove from cycle</button>
          </div>
        )}

        {dueDatePickerId === task.id && (
          <div className="due-date-dismiss-popover">
            <div className="due-date-quick-btns">
              {[{ label: '+1d', days: 1 }, { label: '+2d', days: 2 }, { label: '+3d', days: 3 }, { label: '+1w', days: 7 }].map((opt) => (
                <button key={opt.label} onClick={() => { handleSetDueDate(project, task.id, addDays(opt.days)); setDueDatePickerId(null) }}>{opt.label}</button>
              ))}
            </div>
            <input
              type="date"
              defaultValue={task.dueDate ?? ''}
              autoFocus
              onChange={(e) => { handleSetDueDate(project, task.id, e.target.value || null); setDueDatePickerId(null) }}
            />
            {task.dueDate && <button onClick={() => { handleSetDueDate(project, task.id, null); setDueDatePickerId(null) }}>Remove</button>}
          </div>
        )}

        {linksEditId === task.id && (
          <TaskLinksPopover
            links={task.links ?? []}
            onSave={(links) => { handleUpdateLinks(project, task.id, links); setLinksEditId(null) }}
            onClose={() => setLinksEditId(null)}
            projectName={project.name}
          />
        )}

        {cycleRolePickerId === task.id && (
          <div className="cycle-role-popover" onClick={(e) => e.stopPropagation()}>
            {ROLES.map((r) => (
              <button
                key={r}
                className={`cycle-role-btn cr-${r} ${task.cycleRole === r ? 'active' : ''}`}
                onClick={() => { handleSetCycleRole(project, task.id, r); setCycleRolePickerId(null) }}
                title={r}
              >{CYCLE_ROLE_LABELS[r]}</button>
            ))}
            <button
              className={`cycle-role-btn cr-none ${!task.cycleRole ? 'active' : ''}`}
              onClick={() => { handleSetCycleRole(project, task.id, null); setCycleRolePickerId(null) }}
              title="Clear"
            >—</button>
          </div>
        )}

        {myccCommentId === task.id && (
          <MyccCommentPopover projectId={project.id} taskId={task.id} onClose={() => setMyccCommentId(null)} />
        )}
      </div>
    )
  }

  const totalActive = ROLES.reduce((sum, r) => sum + totals[r].active, 0)
  const totalDone = ROLES.reduce((sum, r) => sum + totals[r].done, 0)
  const totalAny = totalActive + totalDone

  async function handleCloseCycle() {
    const msg = `Close cycle? This clears the M/S/C role on all ${totalAny} task${totalAny === 1 ? '' : 's'} (including completed). The tasks themselves stay. Cannot be undone.`
    if (!window.confirm(msg)) return
    const cleared = await resetCycleRoles(null)
    setStoredCycleStart(null)
    window.alert(`Cycle closed. Cleared cycleRole on ${cleared} task${cleared === 1 ? '' : 's'}.`)
  }

  return (
    <div>
      <div className="section-label" style={{ marginBottom: 4 }}>
        <span style={{ opacity: 0.6 }}>12W</span>
        <span>Cycle</span>
        <span style={{ opacity: 0.5, marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>
          {totalActive} active{totalDone > 0 ? `, ${totalDone} done` : ''}
        </span>
        {totalAny > 0 && (
          <button
            type="button"
            className="cycle-close-btn"
            onClick={handleCloseCycle}
            title="Clear cycleRole on all tasks (end-of-cycle reset)"
          >
            Close cycle
          </button>
        )}
      </div>

      {cycleStart && <CycleClockBanner cycleStart={cycleStart} />}

      {totalActive === 0 && totalDone === 0 ? (
        <div style={{ marginTop: 32, color: 'var(--c-text-muted)', fontSize: 13, textAlign: 'center' }}>
          No tasks have a cycle role yet.<br />
          <span style={{ fontSize: 12, opacity: 0.7 }}>Set Must / Should / Could on a task from Today, project view, or the CLI.</span>
        </div>
      ) : (
        ROLES.map((role) => {
          const items = grouped[role]
          const summary = totals[role]
          if (summary.active === 0 && summary.done === 0) return null
          return (
            <div key={role} className="mt-section">
              <div className="section-label" style={{ marginBottom: 8 }}>
                <span className={`cycle-role-badge cr-${role}`} style={{ cursor: 'default' }}>{CYCLE_ROLE_LABELS[role]}</span>
                <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                <span style={{ opacity: 0.55, fontWeight: 500, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>
                  {summary.active} active{summary.done > 0 ? `, ${summary.done} done` : ''}
                </span>
              </div>
              {items.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--c-text-muted)', padding: '4px 0 8px 4px' }}>
                  No active tasks in this layer right now.
                </div>
              ) : (
                items.map((entry) => {
                  const code = formatTaskId(entry.task.taskNumber, entry.project.code)
                  const subs = code ? subsByAnchor.get(code) ?? [] : []
                  return (
                    <Fragment key={entry.task.id}>
                      {renderTask(entry)}
                      {subs.map((sub) => renderTask(sub, true))}
                    </Fragment>
                  )
                })
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
