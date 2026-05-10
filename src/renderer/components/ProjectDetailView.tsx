import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useProjects } from '../hooks/useProjects'
import type { Project, Task, ProjectLink, CycleRole } from '../types'
import { CYCLE_ROLE_LABELS, CYCLE_BADGE_LABEL } from '../../shared/types'
import { calcProjectTime, calcTaskTime, formatCheckInTime } from '../utils/checkInTime'
import { projectColorValue, normalizeProjectLinks, normalizeLinks, openProjectLink } from '../utils/projects'
import TaskIdBadge from './TaskIdBadge'
import { formatTaskId } from '../../shared/taskId'
import { collectAnchorCodes } from '../../shared/task-list'
import { dateKey } from '../../shared/schedule'
import { Linkify } from './Linkify'
import { isRecentlyCompleted } from '../utils/recentlyCompleted'
import TaskLinksPopover from './TaskLinksPopover'
import { MyccCommentPopover } from './MyccCommentPopover'
import { useMinuteTick } from '../hooks/useMinuteTick'
import TaskLinksIndicator from './TaskLinksIndicator'

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return dateKey(d)
}

interface Props {
  project: Project
  onEdit: () => void
  onDelete: () => void
}

export default function ProjectDetailView({ project, onEdit, onDelete }: Props) {
  const { saveProject, deleteProject, setFocus, toggleTaskToDoNext, setTaskCycleRole, focusCheckIns, config, suspendProject, unsuspendProject } = useProjects()

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [showSomeday, setShowSomeday] = useState(false)
  const [donePage, setDonePage] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [dueDatePickerId, setDueDatePickerId] = useState<string | null>(null)
  const [cycleRolePickerId, setCycleRolePickerId] = useState<string | null>(null)
  const [parentPickerId, setParentPickerId] = useState<string | null>(null)
  const [newTaskParent, setNewTaskParent] = useState<string>('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [linksEditId, setLinksEditId] = useState<string | null>(null)
  const [myccCommentId, setMyccCommentId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const addInputRef = useRef<HTMLInputElement | null>(null)
  const draggedTaskId = useRef<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)

  // Re-render every minute so recently-completed tasks expire after 1h
  const tick = useMinuteTick()

  const activeTaskGroups = useMemo(() => {
    const active = project.tasks.filter((task) =>
      (!task.completed && !task.someday) || (task.completed && isRecentlyCompleted(task.completedAt))
    )

    const layerOrder: Record<CycleRole, number> = { must: 0, should: 1, could: 2 }
    const anchors = active.filter((t) => !!t.cycleRole)
    anchors.sort((a, b) => {
      const ar = a.cycleRole ? layerOrder[a.cycleRole] : 99
      const br = b.cycleRole ? layerOrder[b.cycleRole] : 99
      if (ar !== br) return ar - br
      return (a.toDoNextOrder ?? 999) - (b.toDoNextOrder ?? 999)
    })

    const anchorCodeSet = collectAnchorCodes(project)

    const subsByAnchor = new Map<string, Task[]>()
    const subIds = new Set<string>()
    for (const t of active) {
      if (t.cycleRole) continue
      if (!t.parentCode || !anchorCodeSet.has(t.parentCode)) continue
      const arr = subsByAnchor.get(t.parentCode) ?? []
      arr.push(t)
      subsByAnchor.set(t.parentCode, arr)
      subIds.add(t.id)
    }
    for (const arr of subsByAnchor.values()) {
      arr.sort((a, b) => {
        const ap = a.isToDoNext ? 0 : 1
        const bp = b.isToDoNext ? 0 : 1
        if (ap !== bp) return ap - bp
        return (a.toDoNextOrder ?? 999) - (b.toDoNextOrder ?? 999)
      })
    }

    const anchorIds = new Set(anchors.map((a) => a.id))
    const rest = active.filter((t) => !anchorIds.has(t.id) && !subIds.has(t.id))
    const pinned = rest.filter((t) => t.isToDoNext).sort((a, b) => (a.toDoNextOrder ?? 999) - (b.toDoNextOrder ?? 999))
    const unpinned = rest.filter((t) => !t.isToDoNext)

    return { anchors, subsByAnchor, rest: [...pinned, ...unpinned] }
  }, [project.tasks, project.code, tick])

  const activeTasks = useMemo(() => {
    const flat: Task[] = []
    for (const a of activeTaskGroups.anchors) {
      flat.push(a)
      const code = formatTaskId(a.taskNumber, project.code)
      const children = code ? activeTaskGroups.subsByAnchor.get(code) ?? [] : []
      for (const c of children) flat.push(c)
    }
    flat.push(...activeTaskGroups.rest)
    return flat
  }, [activeTaskGroups, project.code])
  const somedayTasks = useMemo(() => project.tasks.filter((task) => !task.completed && task.someday), [project.tasks])
  const doneTasks = useMemo(() =>
    project.tasks
      .filter((task) => task.completed && !isRecentlyCompleted(task.completedAt))
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    [project.tasks, tick]
  )
  const pinnedCount = useMemo(() => activeTasks.filter((task) => task.isToDoNext).length, [activeTasks])
  const projectMinutes = useMemo(() => calcProjectTime(focusCheckIns, project.id), [focusCheckIns, project.id])
  const quickLinks = useMemo(() => normalizeProjectLinks(project), [project])

  // 12WY anchors in this project (active tasks with cycleRole) + lookup helpers
  const anchorTasks = useMemo(
    () => project.tasks.filter((t) => !t.completed && !!t.cycleRole),
    [project.tasks]
  )
  const anchorCodes = useMemo(() => collectAnchorCodes(project), [project])

  const updateTasks = async (nextTasks: Task[]) => {
    const fresh = useProjects.getState().projects.find((p) => p.id === project.id)
    if (!fresh) return
    await saveProject({ ...fresh, tasks: nextTasks })
  }

  const toggleTask = async (taskId: string) => {
    const nextTasks = project.tasks.map((task) => {
      if (task.id !== taskId) return task
      if (!task.completed) {
        return { ...task, completed: true, completedAt: new Date().toISOString(), inProgress: false }
      }
      return { ...task, completed: false, completedAt: null }
    })
    await updateTasks(nextTasks)
  }

  const addTask = async () => {
    const title = newTaskTitle.trim()
    if (!title) return

    const parentCode = newTaskParent && anchorCodes.has(newTaskParent) ? newTaskParent : null
    const task: Task = {
      id: nanoid(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
      ...(parentCode ? { parentCode } : {})
    }

    await updateTasks([...project.tasks, task])
    setNewTaskTitle('')
    setNewTaskParent('')
    setShowAddInput(false)
  }

  const toggleSomeday = async (taskId: string) => {
    const nextTasks = project.tasks.map((task) =>
      task.id === taskId ? { ...task, someday: !task.someday, isToDoNext: false, ...(task.someday ? {} : { dueDate: null }) } : task
    )
    await updateTasks(nextTasks)
  }

  const removeTask = async (taskId: string) => {
    const nextTasks = project.tasks.filter((task) => task.id !== taskId)
    await updateTasks(nextTasks)
  }

  const setTaskParent = async (taskId: string, parentCode: string | null) => {
    const nextTasks = project.tasks.map((task) =>
      task.id === taskId ? { ...task, parentCode: parentCode ?? null } : task
    )
    await updateTasks(nextTasks)
  }

  const handleDeleteProject = async () => {
    if (project.tasks.length > 0) return
    if (!confirm(`Delete project "${project.name || 'Untitled'}"?`)) return
    await deleteProject(project.id)
    onDelete()
  }

  const saveEdit = async () => {
    const title = editingTitle.trim()
    const taskId = editingId
    setEditingId(null)
    if (!taskId || !title) return

    const nextTasks = project.tasks.map((task) => (task.id === taskId ? { ...task, title } : task))
    await updateTasks(nextTasks)
  }

  const startEditing = (task: Task) => {
    setEditingId(task.id)
    setEditingTitle(task.title)
  }

  const updateTaskLinks = async (taskId: string, links: ProjectLink[]) => {
    const normalized = normalizeLinks(links)
    const nextTasks = project.tasks.map((task) =>
      task.id === taskId ? { ...task, links: normalized.length > 0 ? normalized : undefined } : task
    )
    await updateTasks(nextTasks)
  }

  const clearTaskDragState = () => {
    draggedTaskId.current = null
    setDragOverTaskId(null)
  }

  const reorderActiveTasks = async (targetTaskId: string) => {
    const sourceTaskId = draggedTaskId.current
    if (!sourceTaskId || sourceTaskId === targetTaskId) {
      clearTaskDragState()
      return
    }

    const activeIds = activeTasks.map((task) => task.id)
    const fromIndex = activeIds.indexOf(sourceTaskId)
    const toIndex = activeIds.indexOf(targetTaskId)
    if (fromIndex === -1 || toIndex === -1) {
      clearTaskDragState()
      return
    }

    activeIds.splice(fromIndex, 1)
    activeIds.splice(toIndex, 0, sourceTaskId)

    const tasksById = new Map(project.tasks.map((task) => [task.id, task]))
    const reorderedActive = activeIds
      .map((id) => tasksById.get(id))
      .filter((task): task is Task => Boolean(task))

    let activeCursor = 0
    const nextTasks = project.tasks.map((task) => {
      if (task.completed || task.someday) return task
      const reorderedTask = reorderedActive[activeCursor]
      activeCursor += 1
      return reorderedTask ?? task
    })

    await updateTasks(nextTasks)
    clearTaskDragState()
  }

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
    if (!parentPickerId) return
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.parent-picker-popover')) return
      setParentPickerId(null)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setParentPickerId(null)
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
  }, [parentPickerId])

  useEffect(() => {
    if (!menuOpenId) return
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.task-overflow-menu')) return
      if ((e.target as HTMLElement).closest('.task-overflow-trigger')) return
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
    if (!linksEditId) return
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.task-links-popover')) return
      if ((e.target as HTMLElement).closest('.task-links-indicator')) return
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedTaskId) {
        setSelectedTaskId(null)
        return
      }
      if (event.key !== 'n' && event.key !== 'N') return
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      event.preventDefault()
      setShowAddInput(true)
      setTimeout(() => addInputRef.current?.focus(), 0)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTaskId])

  useEffect(() => {
    if (!selectedTaskId) return
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      const hasImage = Array.from(event.clipboardData?.items || []).some((item) => item.type.startsWith('image/'))
      if (!hasImage) return
      event.preventDefault()
      window.api.pasteImageToTask(project.id, selectedTaskId)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [selectedTaskId, project.id])

  const handlePasteImageToTask = async (taskId: string) => {
    setMenuOpenId(null)
    await window.api.pasteImageToTask(project.id, taskId)
  }

  const handleRemoveImage = async (taskId: string, filename: string) => {
    await window.api.removeTaskImage(project.id, taskId, filename)
  }

  const renderTask = (task: Task, done = false, isSubTask = false) => {
    const isRecentDone = task.completed && isRecentlyCompleted(task.completedAt)
    const isPinned = !done && !!task.isToDoNext
    const taskMinutes = calcTaskTime(focusCheckIns, task.id)
    const isDragOver = !done && dragOverTaskId === task.id && draggedTaskId.current !== task.id
    const isSelected = !done && selectedTaskId === task.id

    return (
      <div
        key={task.id}
        className={`task-card ${done || isRecentDone ? 'done-card' : ''} ${done || isRecentDone ? '' : 'draggable-task'} ${isDragOver ? 'drag-over' : ''} ${isSelected ? 'task-selected' : ''} ${isSubTask ? 'sub-task' : ''}`}
        draggable={!done && !isRecentDone}
        onClick={(event) => {
          if (done || isRecentDone) return
          const target = event.target as HTMLElement
          if (target.closest('button') || target.closest('input') || target.closest('.task-overflow-menu') || target.closest('.task-image-thumb')) return
          setSelectedTaskId(selectedTaskId === task.id ? null : task.id)
        }}
        onDragStart={(event) => {
          if (done || isRecentDone) return
          draggedTaskId.current = task.id
          event.dataTransfer.setData('application/top5-task', JSON.stringify({
            kind: 'project',
            projectId: project.id,
            taskId: task.id
          }))
        }}
        onDragOver={(event) => {
          if (done) return
          if (!draggedTaskId.current || draggedTaskId.current === task.id) return
          event.preventDefault()
          setDragOverTaskId(task.id)
        }}
        onDragLeave={() => {
          if (done) return
          if (dragOverTaskId === task.id) {
            setDragOverTaskId(null)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          if (done) return
          void reorderActiveTasks(task.id)
        }}
        onDragEnd={clearTaskDragState}
      >
        <button className={`task-checkbox ${done || isRecentDone ? 'checked' : ''}`} onClick={() => toggleTask(task.id)} />
        <div className="task-content">
          {editingId === task.id ? (
            <input
              autoFocus
              className="form-input"
              value={editingTitle}
              onChange={(event) => setEditingTitle(event.target.value)}
              onBlur={saveEdit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveEdit()
                if (event.key === 'Escape') setEditingId(null)
              }}
            />
          ) : (
            <div className={`task-title ${done || isRecentDone ? 'completed' : ''}`} onDoubleClick={() => !done && !isRecentDone && startEditing(task)}>
              <TaskIdBadge taskNumber={task.taskNumber} projectCode={project.code} kind="project" />
              {task.cycleRole && !done && !isRecentDone && (
                <span
                  className={`cycle-role-badge cr-${task.cycleRole}`}
                  title={`Cycle: ${task.cycleRole}`}
                  onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); setCycleRolePickerId(task.id) }}
                >{CYCLE_ROLE_LABELS[task.cycleRole]}</span>
              )}
              {!task.cycleRole && task.parentCode && anchorCodes.has(task.parentCode) && !done && !isRecentDone && (
                <span
                  className="task-cycle-badge"
                  data-clickable="true"
                  title={`Sub-task of ${task.parentCode} — click to change`}
                  onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); setParentPickerId(task.id) }}
                >{CYCLE_BADGE_LABEL}</span>
              )}
              <Linkify text={task.title} />
              <TaskLinksIndicator links={task.links ?? []} projectName={project.name} />
            </div>
          )}
          <div className="task-meta">
            {taskMinutes > 0 && <span>{formatCheckInTime(taskMinutes)}</span>}
            {task.dueDate && (() => {
              const today = dateKey(new Date())
              const overdue = !done && task.dueDate < today
              const d = new Date(task.dueDate + 'T00:00:00')
              const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              return <span className={`due-date-badge ${overdue ? 'overdue' : ''}`}>📅 {label}</span>
            })()}
          </div>
          {task.images && task.images.length > 0 && (
            <div className="task-images">
              {task.images.map((filename) => (
                <div key={filename} className="task-image-thumb" onClick={() => window.api.openTaskImage(filename)}>
                  <img src={`top5-img://${filename}`} />
                  {!done && !isRecentDone && (
                    <button
                      className="remove-image"
                      onClick={(e) => { e.stopPropagation(); handleRemoveImage(task.id, filename) }}
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!done && isPinned && <div className="pin-corner" />}

        {isRecentDone ? (
          <button
            className="task-action-btn btn-focus"
            style={{ display: 'inline-block', fontSize: 11 }}
            onClick={() => toggleTask(task.id)}
            title="Restore task"
          >
            Restore
          </button>
        ) : done ? (
          <div className="task-actions">
            <button className="task-action-btn btn-remove" onClick={() => removeTask(task.id)} title="Delete">×</button>
          </div>
        ) : (
          <>
            <button className="task-overflow-trigger" onClick={() => setMenuOpenId(menuOpenId === task.id ? null : task.id)}>⋯</button>
            {menuOpenId === task.id && (
              <div className="task-overflow-menu" ref={(el) => {
                if (!el) return
                const rect = el.getBoundingClientRect()
                if (rect.bottom > window.innerHeight) {
                  el.style.top = 'auto'
                  el.style.bottom = 'calc(100% + 4px)'
                }
              }}>
                <button className="task-overflow-item" onClick={() => { toggleTaskToDoNext(project.id, task.id); setMenuOpenId(null) }}><span className="toi-icon">📌</span>{isPinned ? 'Unpin' : 'Pin to Today'}</button>
                <button className="task-overflow-item" onClick={() => { setFocus(project.id, task.id); setMenuOpenId(null) }}><span className="toi-icon">▶</span>Focus</button>
                <button className="task-overflow-item" onClick={() => { setMenuOpenId(null); setDueDatePickerId(task.id) }}><span className="toi-icon">📅</span>{task.dueDate ? 'Change due date' : 'Set due date'}</button>
                <button className="task-overflow-item" onClick={() => { setMenuOpenId(null); setLinksEditId(task.id) }}><span className="toi-icon">🔗</span>Links{task.links && task.links.length > 0 ? ` (${task.links.length})` : ''}</button>
                <button className="task-overflow-item" onClick={() => { setMenuOpenId(null); setCycleRolePickerId(task.id) }}><span className="toi-icon">12W</span>Cycle role{task.cycleRole ? `: ${task.cycleRole}` : ''}</button>
                {!task.cycleRole && anchorTasks.length > 0 && (
                  <button className="task-overflow-item" onClick={() => { setMenuOpenId(null); setParentPickerId(task.id) }}><span className="toi-icon">└</span>Sub-task of{task.parentCode ? `: ${task.parentCode}` : '...'}</button>
                )}
                <button className="task-overflow-item" onClick={() => handlePasteImageToTask(task.id)}><span className="toi-icon">📎</span>Paste image</button>
                {config.obsidianStoragePath && (
                  <button className="task-overflow-item" onClick={() => { window.api.openTaskNote(task.id, task.title, project.name, formatTaskId(task.taskNumber, project.code), task.noteRef); setMenuOpenId(null) }}><span className="toi-icon">📝</span>Open note</button>
                )}
                <button className="task-overflow-item" onClick={() => { setMenuOpenId(null); setMyccCommentId(task.id) }}><span className="toi-icon">➤</span>Send to MyCC</button>
                <div className="task-overflow-sep" />
                <button className="task-overflow-item" onClick={() => { toggleSomeday(task.id); setMenuOpenId(null) }}><span className="toi-icon">⏳</span>{task.someday ? 'Move to active' : 'Move to Someday'}</button>
                <button className="task-overflow-item danger" onClick={() => { removeTask(task.id); setMenuOpenId(null) }}><span className="toi-icon">×</span>Delete</button>
              </div>
            )}
            {dueDatePickerId === task.id && (
              <div className="due-date-dismiss-popover">
                <div className="due-date-quick-btns">
                  {[{ label: '+1d', days: 1 }, { label: '+2d', days: 2 }, { label: '+3d', days: 3 }, { label: '+1w', days: 7 }].map((opt) => (
                    <button key={opt.label} onClick={() => { window.api.updateTaskDueDate(project.id, task.id, addDays(opt.days)); setDueDatePickerId(null) }}>{opt.label}</button>
                  ))}
                </div>
                <input type="date" defaultValue={task.dueDate ?? ''} autoFocus onChange={(e) => { window.api.updateTaskDueDate(project.id, task.id, e.target.value || null); setDueDatePickerId(null) }} />
                {task.dueDate && <button onClick={() => { window.api.updateTaskDueDate(project.id, task.id, null); setDueDatePickerId(null) }}>Remove</button>}
              </div>
            )}
            {linksEditId === task.id && (
              <TaskLinksPopover
                links={task.links ?? []}
                onSave={(links) => { updateTaskLinks(task.id, links); setLinksEditId(null) }}
                onClose={() => setLinksEditId(null)}
                projectName={project.name}
              />
            )}
            {cycleRolePickerId === task.id && (
              <div className="cycle-role-popover" onClick={(e) => e.stopPropagation()}>
                {(['must', 'should', 'could'] as CycleRole[]).map((r) => (
                  <button
                    key={r}
                    className={`cycle-role-btn cr-${r} ${task.cycleRole === r ? 'active' : ''}`}
                    onClick={() => { setTaskCycleRole(project.id, task.id, r); setCycleRolePickerId(null) }}
                    title={r}
                  >{CYCLE_ROLE_LABELS[r]}</button>
                ))}
                <button
                  className={`cycle-role-btn cr-none ${!task.cycleRole ? 'active' : ''}`}
                  onClick={() => { setTaskCycleRole(project.id, task.id, null); setCycleRolePickerId(null) }}
                  title="Clear"
                >—</button>
              </div>
            )}
            {parentPickerId === task.id && (
              <div className="parent-picker-popover" onClick={(e) => e.stopPropagation()}>
                <div className="parent-picker-title">Sub-task of</div>
                <button
                  className={`parent-picker-item ${!task.parentCode ? 'active' : ''}`}
                  onClick={() => { setTaskParent(task.id, null); setParentPickerId(null) }}
                >— None</button>
                {anchorTasks.map((anchor) => {
                  const code = formatTaskId(anchor.taskNumber, project.code)
                  return (
                    <button
                      key={anchor.id}
                      className={`parent-picker-item ${task.parentCode === code ? 'active' : ''}`}
                      onClick={() => { setTaskParent(task.id, code); setParentPickerId(null) }}
                      title={anchor.title}
                    >
                      <span className={`cycle-role-badge cr-${anchor.cycleRole}`}>{CYCLE_ROLE_LABELS[anchor.cycleRole as CycleRole]}</span>
                      <span className="ppi-code">{code}</span>
                      <span className="ppi-title">{anchor.title}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {myccCommentId === task.id && (
              <MyccCommentPopover projectId={project.id} taskId={task.id} onClose={() => setMyccCommentId(null)} />
            )}
          </>
        )}
      </div>
    )
  }

  const handleUnsuspend = async () => {
    const error = await unsuspendProject(project.id)
    if (error) {
      alert(error)
    }
  }

  return (
    <div>
      <div className="project-header">
        <div className="project-color-bar" style={{ background: projectColorValue(project.color) }} />
        <div className="project-header-content">
          <h2>{project.name || 'Untitled Project'}</h2>
          {project.description && <div className="desc">{project.description}</div>}
          <div className="project-stats">
            <span>{formatCheckInTime(projectMinutes)} tracked</span>
            <span>·</span>
            <span>{project.tasks.length} tasks</span>
            <span>·</span>
            <span>{pinnedCount} pinned</span>
            <span>·</span>
            <span
              className="cursor-pointer hover:text-t-primary transition-colors"
              onClick={() => window.api.openOperationLogWindow(project.name)}
            >activity</span>
          </div>
        </div>

        <div className="project-actions-bar">
          <span className="project-action-icon" onClick={onEdit} title="Edit">✏</span>
          {project.suspendedAt ? (
            <span className="project-action-icon" title="Unsuspend" onClick={handleUnsuspend}>▲</span>
          ) : (
            <span className="project-action-icon" title="Suspend" onClick={() => suspendProject(project.id)}>⏸</span>
          )}
          {project.tasks.length === 0 && (
            <span className="project-action-icon" title="Delete project" onClick={handleDeleteProject}>🗑</span>
          )}
        </div>
      </div>

      {quickLinks.length > 0 && (
        <div className="quick-links">
          {quickLinks.map((link, index) => (
            <button key={`${link.label}-${index}`} className="quick-link" onClick={() => openProjectLink(link, project.name)}>
              {link.label}
            </button>
          ))}
        </div>
      )}

      <div>
        {activeTaskGroups.anchors.map((anchor) => {
          const code = formatTaskId(anchor.taskNumber, project.code)
          const children = code ? activeTaskGroups.subsByAnchor.get(code) ?? [] : []
          return (
            <Fragment key={anchor.id}>
              {renderTask(anchor)}
              {children.map((child) => renderTask(child, false, true))}
            </Fragment>
          )
        })}
        {activeTaskGroups.rest.map((task) => renderTask(task))}
      </div>

      <div className="today-add-task-wrap">
        {showAddInput ? (
          <div className="today-add-input-row">
            <input
              ref={addInputRef}
              className="form-input"
              value={newTaskTitle}
              placeholder="Add task"
              onChange={(event) => setNewTaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addTask()
                if (event.key === 'Escape') {
                  setShowAddInput(false)
                  setNewTaskTitle('')
                  setNewTaskParent('')
                }
              }}
            />
            {anchorTasks.length > 0 && (
              <select
                className="form-input"
                style={{ maxWidth: 180 }}
                value={newTaskParent}
                onChange={(e) => setNewTaskParent(e.target.value)}
                title="Optionally attach as 12WY sub-task"
              >
                <option value="">— No parent</option>
                {anchorTasks.map((anchor) => {
                  const code = formatTaskId(anchor.taskNumber, project.code)
                  return <option key={anchor.id} value={code}>{code} — {anchor.title.slice(0, 30)}</option>
                })}
              </select>
            )}
            <button className="task-action-btn btn-focus" onClick={addTask}>Add</button>
          </div>
        ) : (
          <button className="add-task-btn" onClick={() => {
            setShowAddInput(true)
            setTimeout(() => addInputRef.current?.focus(), 0)
          }}>
            <span className="plus">+</span> Add task
          </button>
        )}
      </div>

      {somedayTasks.length > 0 && (
        <div className="mt-section">
          <div
            className={`done-toggle ${showSomeday ? 'open' : ''}`}
            onClick={() => setShowSomeday((value) => !value)}
            onDragOver={(e) => { e.preventDefault() }}
            onDrop={(e) => {
              e.preventDefault()
              const raw = e.dataTransfer.getData('application/top5-task')
              if (!raw) return
              try {
                const data = JSON.parse(raw)
                if (data.kind === 'project' && data.projectId === project.id && data.taskId) {
                  toggleSomeday(data.taskId)
                }
              } catch { /* ignore */ }
            }}
          >
            <span style={{ opacity: 0.5 }}>⏳</span>
            <span>Someday ({somedayTasks.length})</span>
            <span className="chevron">▸</span>
          </div>
          <div className={`done-list ${showSomeday ? 'open' : ''}`}>
            {somedayTasks.map((task) => renderTask(task))}
          </div>
        </div>
      )}

      {doneTasks.length > 0 && (
        <div className="mt-section">
          <div className={`done-toggle ${showDone ? 'open' : ''}`} onClick={() => { setShowDone((value) => { if (value) setDonePage(0); return !value }) }}>
            <span className="done-check">✓</span>
            <span>Done ({doneTasks.length})</span>
            <span className="chevron">▸</span>
          </div>
          <div className={`done-list ${showDone ? 'open' : ''}`}>
            {doneTasks.slice(donePage * 10, (donePage + 1) * 10).map((task) => renderTask(task, true))}
            {doneTasks.length > 10 && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  className="task-action-btn"
                  style={{ opacity: donePage > 0 ? 1 : 0.3, fontSize: 12, padding: '2px 8px' }}
                  disabled={donePage === 0}
                  onClick={() => setDonePage((p) => p - 1)}
                >
                  ‹ Prev
                </button>
                <span className="text-xs text-t-muted">
                  {donePage + 1}/{Math.ceil(doneTasks.length / 10)}
                </span>
                <button
                  className="task-action-btn"
                  style={{ opacity: (donePage + 1) * 10 < doneTasks.length ? 1 : 0.3, fontSize: 12, padding: '2px 8px' }}
                  disabled={(donePage + 1) * 10 >= doneTasks.length}
                  onClick={() => setDonePage((p) => p + 1)}
                >
                  Next ›
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
