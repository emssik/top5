import { useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import ProjectTile from './ProjectTile'
import QuickNotes from './QuickNotes'
import Settings from './Settings'

export default function Dashboard() {
  const { projects, addProject } = useProjects()
  const [showNotes, setShowNotes] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Draggable titlebar area */}
      <div className="h-8 flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-200">Projects</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotes(true)}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-sm transition-colors"
              title="Quick Notes"
            >
              Notes
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-sm transition-colors"
              title="Settings"
            >
              ⚙
            </button>
            {projects.length < 5 && (
              <button
                onClick={addProject}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm transition-colors"
              >
                + Add Project
              </button>
            )}
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
            <p className="text-lg mb-2">No projects yet</p>
            <p className="text-sm">Add up to 5 projects to focus on</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {projects
              .sort((a, b) => a.order - b.order)
              .map((project) => (
                <ProjectTile key={project.id} project={project} />
              ))}
          </div>
        )}
      </div>

      <QuickNotes open={showNotes} onClose={() => setShowNotes(false)} />
      <Settings open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
