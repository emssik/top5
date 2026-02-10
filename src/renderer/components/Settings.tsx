import { useState } from 'react'
import { useProjects } from '../hooks/useProjects'

interface Props {
  open: boolean
  onClose: () => void
}

const defaultShortcuts: Record<string, { label: string; default: string }> = {
  'toggle-app': { label: 'Toggle App', default: 'CommandOrControl+Shift+Space' },
  'project-1': { label: 'Project 1', default: 'CommandOrControl+1' },
  'project-2': { label: 'Project 2', default: 'CommandOrControl+2' },
  'project-3': { label: 'Project 3', default: 'CommandOrControl+3' },
  'project-4': { label: 'Project 4', default: 'CommandOrControl+4' },
  'project-5': { label: 'Project 5', default: 'CommandOrControl+5' },
  'toggle-focus': { label: 'Toggle Focus', default: 'CommandOrControl+Shift+F' },
  'quick-notes': { label: 'Quick Notes', default: 'CommandOrControl+Shift+N' }
}

export default function Settings({ open, onClose }: Props) {
  const { config, saveConfig } = useProjects()
  const [shortcuts, setShortcuts] = useState(config.actionShortcuts)

  if (!open) return null

  const handleSave = () => {
    saveConfig({ ...config, actionShortcuts: shortcuts, globalShortcut: shortcuts['toggle-app'] || config.globalShortcut })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-xl w-[480px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <h2 className="text-sm font-medium text-neutral-200">Keyboard Shortcuts</h2>
          <button
            onClick={handleSave}
            className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs"
          >
            Save
          </button>
        </div>
        <div className="p-4 space-y-2">
          {Object.entries(defaultShortcuts).map(([key, { label, default: def }]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-neutral-400">{label}</span>
              <input
                value={shortcuts[key] || def}
                onChange={(e) => setShortcuts((s) => ({ ...s, [key]: e.target.value }))}
                className="w-56 px-2 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-mono focus:outline-none focus:border-neutral-500"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
