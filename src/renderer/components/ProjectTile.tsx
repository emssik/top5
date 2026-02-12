import { useState, type RefObject } from 'react'
import type { Project } from '../types'
import { useProjects } from '../hooks/useProjects'
import { calcProjectTime, formatCheckInTime } from '../utils/checkInTime'
import { getActiveLaunchers, launcherMeta, launchByType } from '../utils/launchers'
import ProjectEditor from './ProjectEditor'
import TaskList, { type TaskListHandle } from './TaskList'

interface Props {
  project: Project
  expanded: boolean
  onToggleExpand: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  isDragOver: boolean
  taskListRef?: RefObject<TaskListHandle | null>
}

export default function ProjectTile({ project, expanded, onToggleExpand, onDragStart, onDragOver, onDrop, isDragOver, taskListRef }: Props) {
  const [editing, setEditing] = useState(false)
  const { deleteProject, archiveProject, focusCheckIns } = useProjects()
  const projectMinutes = calcProjectTime(focusCheckIns, project.id)
  const timeFormatted = formatCheckInTime(projectMinutes)

  const pinnedCount = project.tasks.filter((t) => t.isToDoNext && !t.completed).length
  const activeLaunchers = getActiveLaunchers(project.launchers)

  if (editing) {
    return <ProjectEditor project={project} onClose={() => setEditing(false)} />
  }

  return (
    <div
      className={`group rounded-xl bg-card border p-4 transition-colors ${isDragOver ? 'border-border' : 'border-border-subtle hover:border-border'}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-start justify-between">
        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing px-1 mr-2 text-t-muted hover:text-t-secondary select-none"
          draggable
          onDragStart={onDragStart}
          title="Drag to reorder"
        >
          ⠿
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggleExpand}>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-t-primary truncate">
              {project.name || 'Untitled Project'}
            </h3>
            {projectMinutes > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-t-secondary">
                {timeFormatted}
              </span>
            )}
            {pinnedCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded text-amber-400/80" title={`${pinnedCount} pinned to Quick Tasks`}>
                📌{pinnedCount > 1 && ` (${pinnedCount})`}
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-sm text-t-secondary mt-0.5 truncate">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg hover:bg-surface text-t-secondary hover:text-t-primary text-xs transition-colors"
            title="Edit"
          >
            ✎
          </button>
          <button
            onClick={() => archiveProject(project.id)}
            className="p-1.5 rounded-lg hover:bg-surface text-t-secondary hover:text-amber-400 text-xs transition-colors"
            title="Archive"
          >
            ▼
          </button>
          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete "${project.name || 'Untitled Project'}"? This action cannot be undone.`)) {
                deleteProject(project.id)
              }
            }}
            className="p-1.5 rounded-lg hover:bg-surface text-t-secondary hover:text-red-400 text-xs transition-colors"
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>

      {activeLaunchers.length > 0 && (
        <div className="flex gap-1.5 mt-3">
          {activeLaunchers.map(([type, value]) => (
            <button
              key={type}
              onClick={() => launchByType(type, value)}
              className="px-2 py-1 rounded-md bg-surface hover:bg-hover text-t-secondary hover:text-t-heading text-xs transition-colors"
              title={launcherMeta[type].label}
            >
              {launcherMeta[type].icon} {launcherMeta[type].label}
            </button>
          ))}
        </div>
      )}

      {project.deadline && (
        <div className="mt-2 text-xs text-t-muted">
          Due: {new Date(project.deadline).toLocaleDateString()}
        </div>
      )}

      {expanded && <TaskList ref={taskListRef} project={project} />}
    </div>
  )
}
