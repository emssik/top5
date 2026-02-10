import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { Project, Task } from '../types'
import { useProjects } from '../hooks/useProjects'
import { calcTaskTime, formatCheckInTime } from '../utils/checkInTime'

interface Props {
  project: Project
}

export default function TaskList({ project }: Props) {
  const { saveProject, setFocus, focusCheckIns } = useProjects()
  const [newTaskTitle, setNewTaskTitle] = useState('')

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
    <div className="mt-3 pt-3 border-t border-neutral-800">
      <div className="space-y-1">
        {project.tasks.map((task) => (
          <div key={task.id} className="group flex items-center gap-2 py-1">
            <button
              onClick={() => toggleTask(task.id)}
              className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-[10px] transition-colors ${
                task.completed
                  ? 'bg-neutral-700 border-neutral-600 text-neutral-400'
                  : 'border-neutral-600 hover:border-neutral-400'
              }`}
            >
              {task.completed && '✓'}
            </button>
            <span className={`flex-1 text-sm truncate ${task.completed ? 'text-neutral-600 line-through' : 'text-neutral-300'}`}>
              {task.title}
              {(() => {
                const mins = calcTaskTime(focusCheckIns, task.id)
                return mins > 0 ? (
                  <span className="ml-2 text-[10px] font-mono text-neutral-600">{formatCheckInTime(mins)}</span>
                ) : null
              })()}
            </span>
            <div className="flex gap-1">
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
                className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
          className="flex-1 px-2 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
        />
        <button
          onClick={addTask}
          className="px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-xs"
        >
          Add
        </button>
      </div>
    </div>
  )
}
