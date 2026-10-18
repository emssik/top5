import { useEffect, useState } from 'react'
import { parseDumpDate } from '../../shared/dump-dates'
import { logicalDateKey } from '../../shared/schedule'

type Props = {
  query: string
  // item = ⌘T: the picker has its own input. inline = ` @` typed in the text. token = caret inside an existing date: no input, editor keeps focus.
  mode: 'inline' | 'item' | 'token'
  // The date being edited: `+Nd` / `+Nw` count from it.
  base?: string
  onQueryChange?: (query: string) => void
  onPick: (date: string) => void
  onClose: () => void
  // ⌘T mode only: removes the date.
  onRemove?: () => void
}

// Words a partial query completes to (`ju` → jutro, `p` → pojutrze / pon / pt).
const WORDS = ['jutro', 'pojutrze', 'dziś', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd']
const WEEKDAYS = ['nd', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob']

// "pt 17.10" (with the year when it isn't this one).
function label(date: string, today: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${weekday} ${d}.${m}${date.slice(0, 4) === today.slice(0, 4) ? '' : `.${y}`}`
}

export default function DumpDatePicker({ query, mode, base, onQueryChange, onPick, onClose, onRemove }: Props) {
  const [index, setIndex] = useState(0)
  const today = logicalDateKey()
  const parsed = query.trim() ? parseDumpDate(query, today, base) : null
  const q = query.trim().toLowerCase()
  // Unparseable query → the words it starts; empty or parseable → the quick options.
  const words = q && !parsed ? WORDS.filter((w) => w.startsWith(q)) : base ? ['jutro', '+1d', '+2d', '+1w'] : ['jutro', '+2d', '+1w']
  const options = words.map((w) => ({ q: w, date: parseDumpDate(w, today, base)! }))
  // One list, one highlight: the parsed row (if any) first, then the options.
  const rows: { q: string; date: string; parse?: boolean }[] = parsed ? [{ q: `${query.trim()} →`, date: parsed, parse: true }, ...options] : options

  useEffect(() => setIndex(0), [query])

  // Capture phase: the keys are taken before the editor / input sees them.
  useEffect(() => {
    const move = (d: number) => setIndex((i) => Math.max(0, Math.min(rows.length - 1, i + d)))
    const onKey = (e: KeyboardEvent) => {
      const stop = () => { e.preventDefault(); e.stopPropagation() }
      // Inline mode with nothing to pick (` @marek`): Enter / Tab / arrows keep their normal meaning in the text.
      if (mode === 'inline' && rows.length === 0 && ['Enter', 'Tab', 'ArrowDown', 'ArrowUp'].includes(e.key)) return onClose()
      // Token mode leaves ↑/↓ to the editor: the caret moves out of the token and the picker closes.
      if (e.key === 'Tab') {
        stop()
        move(e.shiftKey ? -1 : 1)
      } else if (mode !== 'token' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        stop()
        move(e.key === 'ArrowDown' ? 1 : -1)
      } else if (e.key === 'Enter') {
        stop()
        if (rows[index]) onPick(rows[index].date)
      } else if (e.key === 'Escape') {
        stop()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  return (
    <div className="dump-picker" role="listbox" aria-label="Data">
      {onQueryChange && (
        <input
          autoFocus
          className="dump-picker-input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          // Focus left the picker (click in the text etc.) → close, or a later Enter would date a stale item.
          onBlur={onClose}
          placeholder="jutro, +2d, pt, 20.10…"
        />
      )}
      {q && !parsed && options.length === 0 && <div className="dump-picker-empty">Nie rozumiem daty</div>}
      {rows.map(({ q, date, parse }, i) => (
        <button
          key={q}
          role="option"
          aria-selected={i === index}
          className={`dump-picker-item ${parse ? 'dump-picker-parse' : ''} ${i === index ? 'active' : ''}`}
          // mousedown: keeps the editor focused (no blur → no stray save, caret stays)
          onMouseDown={(e) => { e.preventDefault(); onPick(date) }}
        >
          <span className="dump-picker-code">{q}</span>
          <span className="dump-picker-name">{label(date, today)}</span>
        </button>
      ))}
      {onRemove && (
        <button className="dump-picker-item" onMouseDown={(e) => { e.preventDefault(); onRemove() }}>
          <span className="dump-picker-name">Usuń datę</span>
        </button>
      )}
      {mode === 'token' && <div className="dump-picker-empty">Tab — wybór · Enter — zmień · Esc</div>}
    </div>
  )
}
