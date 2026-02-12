import { useEffect, useRef, useState } from 'react'
import { useProjects } from '../hooks/useProjects'

interface Props {
  open: boolean
  onClose: () => void
}

export default function QuickNotesPanel({ open, onClose }: Props) {
  const { quickNotes, saveQuickNotes } = useProjects()
  const [value, setValue] = useState(quickNotes)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setValue(quickNotes)
  }, [quickNotes])

  useEffect(() => {
    if (!open) return
    textareaRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        saveQuickNotes(value)
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, saveQuickNotes, value])

  const handleClose = () => {
    saveQuickNotes(value)
    onClose()
  }

  return (
    <aside className={`notes-panel ${open ? 'open' : ''}`}>
      <div className="notes-header">
        <h3>Quick Notes</h3>
        <button className="notes-close" onClick={handleClose}>✕</button>
      </div>
      <div className="notes-body">
        <textarea
          ref={textareaRef}
          className="notes-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Szybkie notatki, pomysły, linki..."
        />
      </div>
    </aside>
  )
}
