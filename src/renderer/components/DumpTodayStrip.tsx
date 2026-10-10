import { useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import { useTaskList } from '../hooks/useTaskList'
import { getScheduledHabits } from '../../shared/habit-schedule'
import { dateKey } from '../../shared/schedule'

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
export default function DumpTodayStrip() {
  const { habits, habitTick, acceptRepeatingProposal, dismissRepeatingProposal, completeQuickTask } = useProjects()
  const { focusTask, proposals, repeatingActive } = useTaskList({ excludeFocus: true })
  const [collapsed, setCollapsed] = useState(() => read(COLLAPSED_KEY) !== '0')
  const [seen, setSeen] = useState<string[]>(() => {
    try { return JSON.parse(read(SEEN_KEY) ?? '[]') as string[] } catch { return [] }
  })

  const now = new Date()
  const todayKey = dateKey(now)
  const habitsLeft = getScheduledHabits(habits, now).filter((h) => !h.log[todayKey]?.done)
  // useTaskList keeps tasks completed in the last hour — a second ✓ would count the completion twice.
  const repeatingOpen = repeatingActive.filter((t) => !t.completed)
  // Day in the id: a habit / repeating task seen yesterday is new again today.
  const ids = [
    ...proposals.map((p) => `r:${todayKey}:${p.id}`),
    ...repeatingOpen.map((t) => `q:${t.id}`),
    ...habitsLeft.map((h) => `h:${todayKey}:${h.id}`)
  ]
  const fresh = ids.filter((id) => !seen.includes(id)).length
  const repeatCount = proposals.length + repeatingOpen.length

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
            ↻ {repeatCount} dziś{fresh > 0 && ` · ${fresh} nowe`}
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
        </div>
      )}
    </div>
  )
}
