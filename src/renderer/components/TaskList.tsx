import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { Project, Task } from '../types'
import { useProjects } from '../hooks/useProjects'
import { calcTaskTime, formatCheckInTime } from '../utils/checkInTime'

interface Props {
  project: Project
}

export default function TaskList({ project }: Props) {
  const { saveProject, setFocus, focusCheckIns, toggleTaskToDoNext } = useProjects()
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const startEditing = (task: Task) => {
    setEditingId(task.id)
    setEditingTitle(task.title)
  }

  const saveEdit = async () => {
    if (!editingId || !editingTitle.trim()) {
      setEditingId(null)
      return
    }
    // Get fresh project from store to avoid overwriting other fields (isToDoNext, completed, etc.)
    const fresh = useProjects.getState().projects.find((p) => p.id === project.id)
    if (!fresh) { setEditingId(null); return }
    const tasks = fresh.tasks.map((t) =>
      t.id === editingId ? { ...t, title: editingTitle.trim() } : t
    )
    await saveProject({ ...fresh, tasks })
    setEditingId(null)
  }

  const addTask = async () => {
    if (!newTaskTitle.trim()) return
    const task: Task = {
      id: nanoid(),
      title: newTaskTitle.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    }
    await saveProject({ ...project, tasks: [...project.tasks, task] })
    setNewTaskTitle('')
  }

  const toggleTask = async (taskId: string) => {
    const tasks = project.tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    )
    await saveProject({ ...project, tasks })
  }

  const deleteTask = async (taskId: string) => {
    const tasks = project.tasks.filter((t) => t.id !== taskId)
    await saveProject({ ...project, tasks })
  }

  const handleFocus = (task: Task) => {
    setFocus(project.id, task.id)
  }

  return (
    <div className="mt-3 pt-3 border-t border-border-subtle">
      <div className="space-y-1">
        {project.tasks.map((task) => (
          <div key={task.id} className="group flex items-center gap-2 py-1">
            <button
              onClick={() => toggleTask(task.id)}
              className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-[10px] transition-colors ${
                task.completed
                  ? 'bg-hover border-border text-t-secondary'
                  : 'border-border hover:border-t-secondary'
              }`}
            >
              {task.completed && '✓'}
            </button>
            {editingId === task.id ? (
              <input
                autoFocus
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onBlur={saveEdit}
                className="flex-1 text-sm bg-surface border border-border rounded px-1 py-0.5 text-t-primary focus:outline-none focus:border-t-secondary"
              />
            ) : (
              <span
                onDoubleClick={() => startEditing(task)}
                className={`flex-1 text-sm truncate cursor-default ${task.completed ? 'text-t-muted line-through' : 'text-t-primary'}`}
              >
                {task.title}
                {(() => {
                  const mins = calcTaskTime(focusCheckIns, task.id)
                  return mins > 0 ? (
                    <span className="ml-2 text-[10px] font-mono text-t-muted">{formatCheckInTime(mins)}</span>
                  ) : null
                })()}
              </span>
            )}
            <div className="flex gap-1">
              {!task.completed && (
                <button
                  onClick={() => toggleTaskToDoNext(project.id, task.id)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    task.isToDoNext
                      ? 'bg-amber-600/30 text-amber-400 hover:bg-amber-600/50'
                      : 'bg-surface hover:bg-hover text-t-secondary hover:text-amber-400 opacity-0 group-hover:opacity-100'
                  }`}
                  title={task.isToDoNext ? 'Unpin from Quick Tasks' : 'Pin to Quick Tasks'}
                >
                  {task.isToDoNext ? '📌' : '📌'}
                </button>
              )}
              {!task.completed && (
                <button
                  onClick={() => handleFocus(task)}
                  className="text-[10px] px-2 py-0.5 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 transition-colors"
                  title="Focus on this task"
                >
                  Focus
                </button>
              )}
              <button
                onClick={() => deleteTask(task.id)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-surface hover:bg-hover text-t-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-2">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
          placeholder="Add a task..."
          className="flex-1 px-2 py-1 rounded-md bg-surface border border-border text-t-primary text-xs placeholder:text-t-muted focus:outline-none focus:border-t-secondary"
        />
        <button
          onClick={addTask}
          className="px-2 py-1 rounded-md bg-surface hover:bg-hover text-t-secondary text-xs"
        >
          Add
        </button>
      </div>
    </div>
  )
}
