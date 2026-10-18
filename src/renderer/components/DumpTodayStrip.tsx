import { useEffect, useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import { useTaskList } from '../hooks/useTaskList'
import { getScheduledHabits } from '../../shared/habit-schedule'
import { dateKey, logicalDateKey } from '../../shared/schedule'
import { parseDumpDate, type DatedDumpItem } from '../../shared/dump-dates'

const COLLAPSED_KEY = 'top5.dumpStrip.collapsed'
const SEEN_KEY = 'top5.dumpStrip.seen'

// localStorage may be unavailable — the strip must work without it.
const read = (key: string): string | null => {
  try { return localStorage.getItem(key) } catch { return null }
}
const write = (key: string, value: string) => {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

// "Dziś" above the dump: focus, today's repeating tasks, habits. Display only — never written to dump.md.
type Props = {
  dated: DatedDumpItem[]
  onAcceptDated: (item: DatedDumpItem) => void
  onRescheduleDated: (item: DatedDumpItem, date: string | null) => void
}

const DAY_MS = 86_400_000
const datedId = (d: DatedDumpItem) => `d:${d.date}:${d.title}`

export default function DumpTodayStrip({ dated, onAcceptDated, onRescheduleDated }: Props) {
  const { habits, habitTick, acceptRepeatingProposal, dismissRepeatingProposal, completeQuickTask } = useProjects()
  const { focusTask, proposals, repeatingActive } = useTaskList({ excludeFocus: true })
  const [collapsed, setCollapsed] = useState(() => read(COLLAPSED_KEY) !== '0')
  const [seen, setSeen] = useState<string[]>(() => {
    try { return JSON.parse(read(SEEN_KEY) ?? '[]') as string[] } catch { return [] }
  })

  const [pickerId, setPickerId] = useState<string | null>(null)
  useEffect(() => {
    if (!pickerId) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as HTMLElement).closest('.due-date-dismiss-popover, .dump-strip-date-btn')) setPickerId(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [pickerId])

  const now = new Date()
  const today = logicalDateKey()
  const tomorrow = parseDumpDate('jutro', today)
  const dueNow = dated.filter((d) => d.date <= today)
  const dueTomorrow = dated.filter((d) => d.date === tomorrow)
  const shownDated = [...dueNow, ...dueTomorrow]
  const todayKey = dateKey(now)
  const habitsLeft = getScheduledHabits(habits, now).filter((h) => !h.log[todayKey]?.done)
  // useTaskList keeps tasks completed in the last hour — a second ✓ would count the completion twice.
  const repeatingOpen = repeatingActive.filter((t) => !t.completed)
  // Day in the id: a habit / repeating task seen yesterday is new again today.
  const ids = [
    ...proposals.map((p) => `r:${todayKey}:${p.id}`),
    ...repeatingOpen.map((t) => `q:${t.id}`),
    ...habitsLeft.map((h) => `h:${todayKey}:${h.id}`),
    ...shownDated.map(datedId)
  ]
  const fresh = ids.filter((id) => !seen.includes(id)).length
  const repeatCount = proposals.length + repeatingOpen.length

  const overdueDays = (date: string) => Math.round((Date.parse(today) - Date.parse(date)) / DAY_MS)

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    write(COLLAPSED_KEY, next ? '1' : '0')
    // Expanding = "I've seen what's there".
    if (!next) {
      setSeen(ids)
      write(SEEN_KEY, JSON.stringify(ids))
    }
  }

  const acceptAndComplete = async (id: string) => {
    await acceptRepeatingProposal(id)
    const created = useProjects.getState().quickTasks.find((t) => t.repeatingTaskId === id && !t.completed)
    if (created) await completeQuickTask(created.id)
  }

  const empty = !focusTask && ids.length === 0
  return (
    <div className={`dump-strip ${fresh > 0 ? 'has-new' : ''}`}>
      <button className="dump-strip-head" onClick={toggle} aria-expanded={!collapsed}>
        <span>{collapsed ? '▸' : '▾'} Dziś</span>
        {collapsed && (
          <span>
            ↻ {repeatCount} dziś{dueNow.length > 0 && ` · 📅 ${dueNow.length}`}{fresh > 0 && ` · ${fresh} nowe`}
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="dump-strip-body">
          {empty && <div className="dump-strip-empty">Nic na dziś.</div>}
          {focusTask && <div className="dump-strip-row">🎯 <span className="dump-strip-title">{focusTask.title}</span></div>}
          {proposals.map((p) => (
            <div key={p.id} className="dump-strip-row">
              <span>↻</span>
              <span className="dump-strip-title">{p.title}</span>
              <button className="proposal-btn accept" onClick={() => void acceptAndComplete(p.id)} title="Zrobione">✓</button>
              <button className="proposal-btn dismiss" onClick={() => void dismissRepeatingProposal(p.id)} title="Odrzuć na dziś">✕</button>
            </div>
          ))}
          {repeatingOpen.map((t) => (
            <div key={t.id} className="dump-strip-row">
              <span>↻</span>
              <span className="dump-strip-title">{t.title}</span>
              <button className="proposal-btn accept" onClick={() => void completeQuickTask(t.id)} title="Zrobione">✓</button>
            </div>
          ))}
          {habitsLeft.map((h) => (
            <div key={h.id} className="dump-strip-row">
              <span>○</span>
              <span className="dump-strip-title">{h.name}</span>
              <button className="proposal-btn accept" onClick={() => void habitTick(h.id, 'done')} title="Zrobione">✓</button>
            </div>
          ))}
          {shownDated.map((d, i) => {
            // Row key + popover id: `seen` id plus index, so two items with the same title + date stay apart.
            const id = `${datedId(d)}#${i}`
            const isTomorrow = d.date === tomorrow
            return (
              <div key={id} className="dump-strip-group">
                <div className="dump-strip-row">
                  <span>📅</span>
                  <span className="dump-strip-title">{d.title}</span>
                  {isTomorrow && <span className="tomorrow-badge">jutro</span>}
                  {d.date < today && <span className="due-date-badge overdue">zaległe {overdueDays(d.date)}d</span>}
                  {!isTomorrow && <button className="proposal-btn accept" onClick={() => onAcceptDated(d)} title="Do Now">✓</button>}
                  <button className="proposal-btn dismiss dump-strip-date-btn" onClick={() => setPickerId(pickerId === id ? null : id)} title="Przełóż">✕</button>
                </div>
                {pickerId === id && (
                  <div className="due-date-dismiss-popover">
                    <div className="due-date-quick-btns">
                      {['+1d', '+2d', '+3d', '+1w'].map((o) => (
                        <button key={o} onClick={() => { onRescheduleDated(d, parseDumpDate(o, today)); setPickerId(null) }}>{o}</button>
                      ))}
                    </div>
                    {/* `>= today`: typing the year fires onChange with 0002-…, 0020-… before the 4th digit. */}
                    <input type="date" onChange={(e) => { if (e.target.value >= today) { onRescheduleDated(d, e.target.value); setPickerId(null) } }} />
                    <button onClick={() => { onRescheduleDated(d, null); setPickerId(null) }}>Usuń datę</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
