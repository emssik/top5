import { useState, useEffect } from 'react'
import { useProjects } from '../hooks/useProjects'

interface Props {
  open: boolean
  onClose: () => void
}

const shortcutLabels: Record<string, string> = {
  'toggle-app': 'Toggle App',
  'project-1': 'Project 1',
  'project-2': 'Project 2',
  'project-3': 'Project 3',
  'project-4': 'Project 4',
  'project-5': 'Project 5',
  'toggle-focus': 'Toggle Focus',
  'quick-notes': 'Quick Notes'
}

const CLEAN_VIEW_FONTS = ['Caveat', 'Patrick Hand', 'Kalam', 'Architects Daughter']

export default function Settings({ open, onClose }: Props) {
  const { config, saveConfig } = useProjects()
  const [shortcuts, setShortcuts] = useState(config.actionShortcuts)
  const [quickTasksLimit, setQuickTasksLimit] = useState(config.quickTasksLimit ?? 5)
  const [cleanViewFont, setCleanViewFont] = useState(config.cleanViewFont || 'Caveat')

  useEffect(() => {
    setShortcuts(config.actionShortcuts)
    setQuickTasksLimit(config.quickTasksLimit ?? 5)
    setCleanViewFont(config.cleanViewFont || 'Caveat')
  }, [config])

  if (!open) return null

  const handleSave = () => {
    saveConfig({
      ...config,
      actionShortcuts: shortcuts,
      globalShortcut: shortcuts['toggle-app'] || config.globalShortcut,
      quickTasksLimit,
      cleanViewFont
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl w-[480px] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-medium text-t-heading">Settings</h2>
          <button
            onClick={handleSave}
            className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs"
          >
            Save
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-auto">
          {/* Quick Tasks limit */}
          <div>
            <h3 className="text-xs font-medium text-t-secondary mb-2">Quick Tasks</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-t-secondary">Tasks on main screen</span>
              <input
                type="number"
                min={1}
                max={20}
                value={quickTasksLimit}
                onChange={(e) => setQuickTasksLimit(Math.max(1, Math.min(20, Number(e.target.value) || 5)))}
                className="w-16 px-2 py-1 rounded-md bg-surface border border-border text-t-primary text-xs text-center font-mono focus:outline-none focus:border-t-secondary"
              />
            </div>
          </div>

          {/* Clean View Font */}
          <div>
            <h3 className="text-xs font-medium text-t-secondary mb-2">Clean View Font</h3>
            <div className="grid grid-cols-2 gap-2">
              {CLEAN_VIEW_FONTS.map((font) => (
                <button
                  key={font}
                  onClick={() => setCleanViewFont(font)}
                  className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    cleanViewFont === font
                      ? 'border-blue-500/50 bg-blue-600/10'
                      : 'border-border-subtle bg-surface hover:bg-hover'
                  }`}
                >
                  <span
                    className="text-lg text-t-primary block"
                    style={{ fontFamily: `'${font}', cursive` }}
                  >
                    {font}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Shortcuts */}
          <div>
            <h3 className="text-xs font-medium text-t-secondary mb-2">Keyboard Shortcuts</h3>
          </div>
          {Object.entries(shortcutLabels).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-t-secondary">{label}</span>
              <input
                value={shortcuts[key] || ''}
                onChange={(e) => setShortcuts((s) => ({ ...s, [key]: e.target.value }))}
                className="w-56 px-2 py-1 rounded-md bg-surface border border-border text-t-primary text-xs font-mono focus:outline-none focus:border-t-secondary"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
