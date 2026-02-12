import { useProjects } from '../hooks/useProjects'
import { getActiveLaunchers, launcherMeta, launchByType } from '../utils/launchers'
import { STANDALONE_PROJECT_ID } from '../utils/constants'

export default function CompactBar() {
  const { projects, quickTasks, setCompactMode, setFocus } = useProjects()

  const activeProjects = projects
    .filter((p) => !p.archivedAt && !p.suspendedAt)
    .sort((a, b) => a.order - b.order)

  const activeQuickTasks = quickTasks.filter((t) => !t.completed).sort((a, b) => a.order - b.order)

  return (
    <div className="h-screen bg-base text-t-primary flex flex-col overflow-hidden">
      {/* Draggable titlebar region */}
      <div
        className="h-6 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      <div className="flex-1 flex flex-col gap-1 px-2 overflow-auto">
        {/* Quick Tasks section */}
        {activeQuickTasks.length > 0 && (
          <div className="pb-1.5 mb-1 border-b border-border-subtle">
            <span className="text-[10px] text-t-muted uppercase tracking-wider px-1">Tasks</span>
            {activeQuickTasks.slice(0, 5).map((task) => (
              <button
                key={task.id}
                onClick={() => setFocus(STANDALONE_PROJECT_ID, task.id)}
                className="w-full text-left text-xs text-t-secondary hover:text-t-primary truncate px-1 py-0.5 rounded hover:bg-surface transition-colors"
              >
                {task.title}
              </button>
            ))}
          </div>
        )}

        {activeProjects.map((project) => {
          const activeLaunchers = getActiveLaunchers(project.launchers)
          return (
            <div key={project.id} className="flex flex-col gap-1 py-1.5 border-b border-border-subtle last:border-0">
              <span className="text-xs font-medium text-t-primary truncate px-1">
                {project.name || 'Untitled'}
              </span>
              {activeLaunchers.length > 0 && (
                <div className="flex gap-1 px-1">
                  {activeLaunchers.map(([type, value]) => (
                    <button
                      key={type}
                      onClick={() => launchByType(type, value)}
                      className="p-1 rounded hover:bg-surface text-t-secondary hover:text-t-heading text-[10px] transition-colors"
                      title={launcherMeta[type].label}
                    >
                      {launcherMeta[type].icon}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex-shrink-0 p-2 border-t border-border-subtle">
        <button
          onClick={() => setCompactMode(false)}
          className="w-full p-1.5 rounded hover:bg-surface text-t-secondary hover:text-t-heading text-xs transition-colors"
          title="Expand"
        >
          ⤢ Expand
        </button>
      </div>
    </div>
  )
}
