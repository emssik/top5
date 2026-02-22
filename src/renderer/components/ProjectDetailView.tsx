import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useProjects } from '../hooks/useProjects'
import type { Project, Task } from '../types'
import { calcProjectTime, calcTaskTime, formatCheckInTime } from '../utils/checkInTime'
import { projectColorValue, normalizeProjectLinks, openProjectLink } from '../utils/projects'
import TaskIdBadge from './TaskIdBadge'
import { formatTaskId } from '../../shared/taskId'
import { dateKey } from '../../shared/schedule'
import { Linkify } from './Linkify'

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
  const { saveProject, deleteProject, setFocus, toggleTaskToDoNext, focusCheckIns, config, suspendProject, unsuspendProject } = useProjects()

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [showSomeday, setShowSomeday] = useState(false)
  const [donePage, setDonePage] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [dueDatePickerId, setDueDatePickerId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const addInputRef = useRef<HTMLInputElement | null>(null)
  const draggedTaskId = useRef<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)

  const activeTasks = useMemo(() => {
    const active = project.tasks.filter((task) => !task.completed && !task.someday)
    const pinned = active.filter((task) => task.isToDoNext).sort((a, b) => (a.toDoNextOrder ?? 999) - (b.toDoNextOrder ?? 999))
    const unpinned = active.filter((task) => !task.isToDoNext)
    return [...pinned, ...unpinned]
  }, [project.tasks])
  const somedayTasks = useMemo(() => project.tasks.filter((task) => !task.completed && task.someday), [project.tasks])
  const doneTasks = useMemo(() => project.tasks.filter((task) => task.completed), [project.tasks])
  const pinnedCount = useMemo(() => activeTasks.filter((task) => task.isToDoNext).length, [activeTasks])
  const projectMinutes = useMemo(() => calcProjectTime(focusCheckIns, project.id), [focusCheckIns, project.id])
  const quickLinks = useMemo(() => normalizeProjectLinks(project), [project])

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

    const task: Task = {
      id: nanoid(),
      title,
      completed: false,
      createdAt: new Date().toISOString()
    }

    await updateTasks([...project.tasks, task])
    setNewTaskTitle('')
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'n' && event.key !== 'N') return
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      event.preventDefault()
      setShowAddInput(true)
      setTimeout(() => addInputRef.current?.focus(), 0)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const renderTask = (task: Task, done = false) => {
    const isPinned = !done && !!task.isToDoNext
    const taskMinutes = calcTaskTime(focusCheckIns, task.id)
    const isDragOver = !done && dragOverTaskId === task.id && draggedTaskId.current !== task.id

    return (
      <div
        key={task.id}
        className={`task-card ${done ? 'done-card' : ''} ${done ? '' : 'draggable-task'} ${isDragOver ? 'drag-over' : ''}`}
        draggable={!done}
        onDragStart={(event) => {
          if (done) return
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
        <button className={`task-checkbox ${done ? 'checked' : ''}`} onClick={() => toggleTask(task.id)} />
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
            <div className={`task-title ${done ? 'completed' : ''}`} onDoubleClick={() => !done && startEditing(task)}>
              <TaskIdBadge taskNumber={task.taskNumber} projectCode={project.code} kind="project" />
              <Linkify text={task.title} />
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
        </div>

        {!done && isPinned && <div className="pin-corner" />}

        {done ? (
          <div className="task-actions">
            <button className="task-action-btn btn-remove" onClick={() => removeTask(task.id)} title="Delete">×</button>
          </div>
        ) : (
          <>
            <button className="task-overflow-trigger" onClick={() => setMenuOpenId(menuOpenId === task.id ? null : task.id)}>⋯</button>
            {menuOpenId === task.id && (
              <div className="task-overflow-menu">
                <button className="task-overflow-item" onClick={() => { toggleTaskToDoNext(project.id, task.id); setMenuOpenId(null) }}><span className="toi-icon">📌</span>{isPinned ? 'Unpin' : 'Pin to Today'}</button>
                <button className="task-overflow-item" onClick={() => { setFocus(project.id, task.id); setMenuOpenId(null) }}><span className="toi-icon">▶</span>Focus</button>
                <button className="task-overflow-item" onClick={() => { setMenuOpenId(null); setDueDatePickerId(task.id) }}><span className="toi-icon">📅</span>{task.dueDate ? 'Change due date' : 'Set due date'}</button>
                {config.obsidianStoragePath && (
                  <button className="task-overflow-item" onClick={() => { window.api.openTaskNote(task.id, task.title, project.name, formatTaskId(task.taskNumber, project.code), task.noteRef); setMenuOpenId(null) }}><span className="toi-icon">📝</span>Open note</button>
                )}
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
        {activeTasks.map((task) => renderTask(task))}
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
                }
              }}
            />
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
