import { useState, useEffect } from 'react'
import { useProjects } from '../hooks/useProjects'

interface Props {
  open: boolean
  onClose: () => void
}

export default function QuickNotes({ open, onClose }: Props) {
  const { quickNotes, saveQuickNotes } = useProjects()
  const [value, setValue] = useState(quickNotes)

  useEffect(() => {
    setValue(quickNotes)
  }, [quickNotes])

  if (!open) return null

  const handleSave = () => {
    saveQuickNotes(value)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl w-[480px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-medium text-t-heading">Quick Notes</h2>
          <button
            onClick={handleSave}
            className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs"
          >
            Save & Close
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 min-h-[300px] p-4 bg-transparent text-t-primary text-sm resize-none focus:outline-none placeholder:text-t-muted"
          placeholder="Jot down quick thoughts..."
        />
      </div>
    </div>
  )
}
