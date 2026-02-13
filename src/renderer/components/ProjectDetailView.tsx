import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useProjects } from '../hooks/useProjects'
import type { Project, Task } from '../types'
import { calcProjectTime, calcTaskTime, formatCheckInTime } from '../utils/checkInTime'
import { projectColorValue, normalizeProjectLinks, openProjectLink } from '../utils/projects'

interface Props {
  project: Project
  onEdit: () => void
  onDelete: () => void
}

export default function ProjectDetailView({ project, onEdit, onDelete }: Props) {
  const { saveProject, deleteProject, setFocus, toggleTaskToDoNext, focusCheckIns, suspendProject, unsuspendProject } = useProjects()

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const addInputRef = useRef<HTMLInputElement | null>(null)
  const draggedTaskId = useRef<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)

  const activeTasks = useMemo(() => project.tasks.filter((task) => !task.completed), [project.tasks])
  const doneTasks = useMemo(() => project.tasks.filter((task) => task.completed), [project.tasks])
  const pinnedCount = useMemo(() => activeTasks.filter((task) => task.isToDoNext).length, [activeTasks])
  const projectMinutes = useMemo(() => calcProjectTime(focusCheckIns, project.id), [focusCheckIns, project.id])
  const quickLinks = useMemo(() => normalizeProjectLinks(project), [project])

  const updateTasks = async (nextTasks: Task[]) => {
    await saveProject({ ...project, tasks: nextTasks })
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
      if (task.completed) return task
      const reorderedTask = reorderedActive[activeCursor]
      activeCursor += 1
      return reorderedTask ?? task
    })

    await updateTasks(nextTasks)
    clearTaskDragState()
  }

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
        onDragStart={() => {
          if (done) return
          draggedTaskId.current = task.id
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
              {task.title}
            </div>
          )}
          {taskMinutes > 0 && (
            <div className="task-meta">
              <span>{formatCheckInTime(taskMinutes)}</span>
            </div>
          )}
        </div>

        {done ? (
          <div className="task-actions">
            <button className="task-action-btn btn-remove" onClick={() => removeTask(task.id)} title="Delete">×</button>
          </div>
        ) : (
          <>
            {isPinned ? (
              <span className="pin-icon">📌</span>
            ) : (
              <button className="pin-action" onClick={() => toggleTaskToDoNext(project.id, task.id)} title="Pin to Today">📌</button>
            )}
            <div className="task-actions">
              <button className="task-action-btn btn-focus" onClick={() => setFocus(project.id, task.id)} title="Focus">▶</button>
              <button className="task-action-btn btn-remove" onClick={() => removeTask(task.id)} title="Delete">×</button>
            </div>
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
            <button key={`${link.label}-${index}`} className="quick-link" onClick={() => openProjectLink(link)}>
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

      {doneTasks.length > 0 && (
        <div className="mt-section">
          <div className={`done-toggle ${showDone ? 'open' : ''}`} onClick={() => setShowDone((value) => !value)}>
            <span className="done-check">✓</span>
            <span>Done ({doneTasks.length})</span>
            <span className="chevron">▸</span>
          </div>
          <div className={`done-list ${showDone ? 'open' : ''}`}>
            {doneTasks.map((task) => renderTask(task, true))}
          </div>
        </div>
      )}
    </div>
  )
}
