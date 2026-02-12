type Tab = 'tasks' | 'projects' | 'repeat' | 'suspended' | 'archive'

interface Props {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  isDev: boolean
  suspendedCount: number
  archivedCount: number
}

export default function TabBar({ activeTab, setActiveTab, isDev, suspendedCount, archivedCount }: Props) {
  const tabClass = (tab: Tab) =>
    `px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
      activeTab === tab ? 'bg-surface text-t-primary' : 'text-t-secondary hover:text-t-primary'
    }`

  return (
    <div className="flex items-center gap-2">
      {isDev && (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
          DEV
        </span>
      )}
      <div className="flex items-center gap-1">
        <button onClick={() => setActiveTab('tasks')} className={tabClass('tasks')}>
          Tasks
        </button>
        <button onClick={() => setActiveTab('projects')} className={tabClass('projects')}>
          Projects
        </button>
        <button onClick={() => setActiveTab('repeat')} className={tabClass('repeat')}>
          Repeat
        </button>
        {suspendedCount > 0 && (
          <button onClick={() => setActiveTab('suspended')} className={tabClass('suspended')}>
            Suspended ({suspendedCount})
          </button>
        )}
        {archivedCount > 0 && (
          <button onClick={() => setActiveTab('archive')} className={tabClass('archive')}>
            Archive ({archivedCount})
          </button>
        )}
      </div>
    </div>
  )
}

export type { Tab }
