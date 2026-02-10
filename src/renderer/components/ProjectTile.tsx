import { useState } from 'react'
import type { Project } from '../types'
import { useProjects } from '../hooks/useProjects'
import { useTimer } from '../hooks/useTimer'
import ProjectEditor from './ProjectEditor'
import TaskList from './TaskList'

const launcherIcons: Record<string, { label: string; icon: string }> = {
  vscode: { label: 'VS Code', icon: '⌨' },
  iterm: { label: 'Terminal', icon: '▶' },
  obsidian: { label: 'Obsidian', icon: '◆' },
  browser: { label: 'Browser', icon: '◎' }
}

interface Props {
  project: Project
  expanded: boolean
  onToggleExpand: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  isDragOver: boolean
}

export default function ProjectTile({ project, expanded, onToggleExpand, onDragStart, onDragOver, onDrop, isDragOver }: Props) {
  const [editing, setEditing] = useState(!project.name)
  const { deleteProject, toggleTimer } = useProjects()
  const { formatted: timerFormatted } = useTimer(project.totalTimeMs, project.timerStartedAt)

  const activeLaunchers = Object.entries(project.launchers).filter(([, v]) => v)

  const handleLaunch = (type: string, value: string) => {
    switch (type) {
      case 'vscode': window.api.launchVscode(value); break
      case 'iterm': window.api.launchIterm(value); break
      case 'obsidian': window.api.launchObsidian(value); break
      case 'browser': window.api.launchBrowser(value); break
    }
  }

  if (editing) {
    return <ProjectEditor project={project} onClose={() => setEditing(false)} />
  }

  return (
    <div
      className={`group rounded-xl bg-neutral-900 border p-4 transition-colors ${isDragOver ? 'border-neutral-500' : 'border-neutral-800 hover:border-neutral-700'}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-start justify-between">
        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing px-1 mr-2 text-neutral-600 hover:text-neutral-400 select-none"
          draggable
          onDragStart={onDragStart}
          title="Drag to reorder"
        >
          ⠿
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggleExpand}>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-neutral-100 truncate">
              {project.name || 'Untitled Project'}
            </h3>
            <button
              onClick={(e) => { e.stopPropagation(); toggleTimer(project.id) }}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                project.timerStartedAt
                  ? 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-900'
                  : 'text-neutral-600 hover:text-neutral-400'
              }`}
              title={project.timerStartedAt ? 'Stop timer' : 'Start timer'}
            >
              {project.timerStartedAt ? '⏸' : '▶'} {timerFormatted}
            </button>
          </div>
          {project.description && (
            <p className="text-sm text-neutral-500 mt-0.5 truncate">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 text-xs transition-colors"
            title="Edit"
          >
            ✎
          </button>
          <button
            onClick={() => deleteProject(project.id)}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-red-400 text-xs transition-colors"
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
              onClick={() => handleLaunch(type, value!)}
              className="px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 text-xs transition-colors"
              title={launcherIcons[type]?.label}
            >
              {launcherIcons[type]?.icon} {launcherIcons[type]?.label}
            </button>
          ))}
        </div>
      )}

      {project.deadline && (
        <div className="mt-2 text-xs text-neutral-600">
          Due: {new Date(project.deadline).toLocaleDateString()}
        </div>
      )}

      {expanded && <TaskList project={project} />}
    </div>
  )
}
