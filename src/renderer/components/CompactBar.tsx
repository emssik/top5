import { useProjects } from '../hooks/useProjects'

const launcherIcons: Record<string, string> = {
  vscode: '</>',
  iterm: '>_',
  obsidian: '📓',
  browser: '🌐'
}

function handleLaunch(type: string, value: string) {
  switch (type) {
    case 'vscode': window.api.launchVscode(value); break
    case 'iterm': window.api.launchIterm(value); break
    case 'obsidian': window.api.launchObsidian(value); break
    case 'browser': window.api.launchBrowser(value); break
  }
}

export default function CompactBar() {
  const { projects, setCompactMode } = useProjects()

  const activeProjects = projects
    .filter((p) => !p.archivedAt)
    .sort((a, b) => a.order - b.order)

  return (
    <div className="h-screen bg-base text-t-primary flex flex-col overflow-hidden">
      {/* Draggable titlebar region */}
      <div
        className="h-6 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      <div className="flex-1 flex flex-col gap-1 px-2 overflow-auto">
        {activeProjects.map((project) => {
          const activeLaunchers = Object.entries(project.launchers).filter(([, v]) => v)
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
                      onClick={() => handleLaunch(type, value!)}
                      className="p-1 rounded hover:bg-surface text-t-secondary hover:text-t-heading text-[10px] transition-colors"
                      title={type}
                    >
                      {launcherIcons[type]}
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
