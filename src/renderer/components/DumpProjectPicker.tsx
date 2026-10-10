import { useEffect, useMemo, useState } from 'react'
import type { Project } from '../types'
import { projectColorValue } from '../utils/projects'

type Props = {
  projects: Project[]
  query: string
  // Set = ⌘P mode: the picker has its own filter input. Unset = ` #` mode: the query is typed in the text.
  onQueryChange?: (query: string) => void
  onPick: (project: Project) => void
  onClose: () => void
}

export default function DumpProjectPicker({ projects, query, onQueryChange, onPick, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const matches = useMemo(() => {
    const q = query.toLowerCase()
    return projects.filter((p) => (p.code ?? '').toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
  }, [projects, query])
  const current = Math.min(index, matches.length - 1)

  useEffect(() => setIndex(0), [query])

  // Capture phase: the keys are taken before the textarea / input sees them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const stop = () => { e.preventDefault(); e.stopPropagation() }
      const nav = e.key === 'ArrowDown' || e.key === 'ArrowUp'
      // Inline mode with nothing to pick (e.g. `#123`): arrows / Enter / Tab keep their normal meaning in the text.
      if ((nav || e.key === 'Enter' || e.key === 'Tab') && matches.length === 0 && !onQueryChange) return onClose()
      if (nav) {
        stop()
        setIndex((i) => Math.max(0, Math.min(matches.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        stop()
        if (matches[current]) onPick(matches[current])
      } else if (e.key === 'Escape') {
        stop()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [matches, current, onPick, onClose, onQueryChange])

  return (
    <div className="dump-picker" role="listbox" aria-label="Projekt">
      {onQueryChange && (
        <input
          autoFocus
          className="dump-picker-input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          // Focus left the picker (click in the text etc.) → close, or later Enter / Tab would tag a stale item.
          onBlur={onClose}
          placeholder="Szukaj projektu…"
        />
      )}
      {matches.length === 0 && <div className="dump-picker-empty">Brak projektu</div>}
      {matches.map((p, i) => (
        <button
          key={p.id}
          role="option"
          aria-selected={i === current}
          className={`dump-picker-item ${i === current ? 'active' : ''}`}
          // mousedown: keeps the textarea focused (no blur → no stray save, caret stays)
          onMouseDown={(e) => { e.preventDefault(); onPick(p) }}
        >
          <span className="dump-picker-code" style={{ color: projectColorValue(p.color) }}>#{p.code}</span>
          <span className="dump-picker-name">{p.name}</span>
        </button>
      ))}
    </div>
  )
}
