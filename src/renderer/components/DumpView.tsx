import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import {
  type DumpSection, countDumpLines, countSectionOpen, dumpItemTitle, findDumpItem, findDumpTags, mergeExternalAppends,
  moveDumpItems, projectTagTrigger, setDumpItemTag, stripDumpTags, toggleDumpLines
} from '../../shared/dump'
import { datedDumpItems, dumpDateAt, dumpDateTrigger, itemDumpDate, setDumpItemDate, type DatedDumpItem } from '../../shared/dump-dates'
import { parseRepeatLine } from '../../shared/dump-repeat'
import { logicalDateKey } from '../../shared/schedule'
import { STANDALONE_PROJECT_ID } from '../../shared/constants'
import { useProjects } from '../hooks/useProjects'
import { projectColorValue } from '../utils/projects'
import { formatCheckInTime } from '../utils/checkInTime'
import { minutesFocusedToday } from '../utils/finishForToday'
import type { Project, RepeatingTask } from '../types'
import DumpEditor, { type DumpEditorHandle } from './DumpEditor'
import DumpDatePicker from './DumpDatePicker'
import DumpProjectPicker from './DumpProjectPicker'
import DumpTodayStrip from './DumpTodayStrip'

const SAVE_DEBOUNCE_MS = 500
const MAIL_CHECKING = 'Sprawdzam maile…'
// ⌘1 / ⌘2 / ⌘3 → index 0–2.
const SECTIONS: DumpSection[] = ['Now', 'Next', 'Inbox']

// Module-level so both survive leaving the tab / toggling clean view:
// - conflictDraft: text the user couldn't save because dump.md changed underneath (409); null = no conflict.
// - saveChain: saves run one after another, and a save flushed on unmount lands before the
//   next instance reads the file (otherwise it would show stale text with a stale mtime).
let conflictDraft: string | null = null
let saveChain: Promise<void> = Promise.resolve()

const REPEAT_HELP = 'Nie rozumiem harmonogramu. Formy: "codziennie: X", "pon śr pt: X" (też "dni robocze:"), "co 3 dni: X", "15 dnia: X", "koniec miesiąca: X".'

// The one open picker: project (` #query` typed in the text, or ⌘P on an item) or date (` @query`, or ⌘T).
type Picker = { kind: 'project' | 'date' } & ({ mode: 'inline'; start: number; query: string } | { mode: 'item'; pos: number; query: string; base?: string } | { mode: 'token'; start: number; query: string; base: string })

const triggerOf = (kind: Picker['kind'], text: string, caret: number) => (kind === 'project' ? projectTagTrigger : dumpDateTrigger)(text, caret)

// Own component: the minute tick must not re-render the editor.
function DumpFooter() {
  const [now, setNow] = useState(() => new Date())
  const focusCheckIns = useProjects((s) => s.focusCheckIns)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])
  // "niedziela, 11 października" — Intl gives the genitive month; only the first letter is capitalised.
  const date = now.toLocaleDateString('pl', { weekday: 'long', day: 'numeric', month: 'long' })
  const time = now.toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="dump-footer">
      <span>{date[0].toUpperCase() + date.slice(1)} · {time}</span>
      <span>Focus dziś: {formatCheckInTime(minutesFocusedToday(focusCheckIns))}</span>
    </div>
  )
}

// `onToggleSidebar`: the main window hides its sidebar in the dump; ☰ brings it back (clean view passes nothing).
export default function DumpView({ sidebarHidden, onToggleSidebar }: { sidebarHidden?: boolean; onToggleSidebar?: () => void }) {
  const [text, setText] = useState(conflictDraft ?? '')
  const [conflict, setConflict] = useState(conflictDraft !== null)
  const [error, setError] = useState<string | null>(null)
  // Read-only until the first load — typing into the empty placeholder would later
  // conflict and "Nadpisz moją wersją" would replace the whole file with those few chars.
  const [loaded, setLoaded] = useState(conflictDraft !== null)
  const [mailStatus, setMailStatus] = useState<string | null>(null)
  const [picker, setPicker] = useState<Picker | null>(null)
  // Start of the date token whose picker was dismissed; cleared once the caret leaves it.
  const dismissedRef = useRef<number | null>(null)
  const { projects, config } = useProjects()

  // Refs, not state: the debounced save must see the latest values, not a closure snapshot.
  const textRef = useRef(text)
  const baseMtimeRef = useRef<number | null>(null)
  // File text as of baseMtime — lets a 409 tell "lines were only appended" from a real conflict.
  const baseTextRef = useRef<string | null>(null)
  const editorRef = useRef<DumpEditorHandle>(null)
  const dirtyRef = useRef(conflictDraft !== null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest ⌘R handler for the IPC listener below (registered once, so no stale closure).
  const repeatRef = useRef<() => Promise<void>>(async () => {})
  // One ⌘R at a time: a second press during the await would pass the duplicate check again.
  const repeatBusyRef = useRef(false)

  const dated = useMemo(() => datedDumpItems(text), [text])
  const counts = useMemo(() => countDumpLines(text), [text])
  const nowOpen = useMemo(() => countSectionOpen(text, 'Now'), [text])
  const nowLimit = config.quickTasksLimit ?? 5
  const codes = useMemo(() => projects.flatMap((p) => (p.code ? [p.code] : [])), [projects])
  // New quick / repeating tasks never get an archived project (old lines may still carry its tag).
  const projectByCode = (code: string) => projects.find((p) => !p.archivedAt && (p.code ?? '').toLowerCase() === code.toLowerCase())
  // Archived projects too: their tags in old lines keep their colour.
  const tagColor = useCallback((code: string) => {
    const project = projects.find((p) => (p.code ?? '').toLowerCase() === code.toLowerCase())
    return projectColorValue(project?.color)
  }, [projects])

  const load = useCallback(async () => {
    await saveChain
    const state = await window.api.getDump().catch((err: unknown) => {
      setError(`Nie udało się wczytać zrzutu: ${err instanceof Error ? err.message : String(err)}`)
      return null
    })
    if (!state) return
    setLoaded(true)
    // The previous instance's last save (flushed on unmount) hit a conflict — show its draft.
    if (conflictDraft !== null) {
      textRef.current = conflictDraft
      dirtyRef.current = true
      editorRef.current?.load(conflictDraft)
      setText(conflictDraft)
      setConflict(true)
      return
    }
    // User typed while we were reading — never clobber local edits.
    if (dirtyRef.current) return
    // The editor turns CRLF / CR into LF (as the textarea did): textRef must match its offsets.
    const lf = state.text.replace(/\r\n?/g, '\n')
    textRef.current = lf
    baseMtimeRef.current = state.mtime
    baseTextRef.current = state.text
    editorRef.current?.load(lf, undefined, true)
    setText(lf)
  }, [])

  // 409 caused only by appended lines (mail sync, API/CLI append): takes them into the local
  // text and returns it, to be saved against the fresh mtime. null = a real conflict.
  const mergeExternal = useCallback(async (): Promise<string | null> => {
    if (baseTextRef.current === null) return null
    const fresh = await window.api.getDump()
    const old = textRef.current
    const merged = mergeExternalAppends(baseTextRef.current, fresh.text, old)
    if (merged === null) return null
    // The local text now sits on top of `fresh` — a further 409 merges against it.
    baseTextRef.current = fresh.text
    baseMtimeRef.current = fresh.mtime
    // The lines go in as one block at the first differing line; a caret on or below it moves
    // down with the text — otherwise typing would land inside the added line.
    const oldLines = old.split('\n')
    const newLines = merged.split('\n')
    let at = 0
    while (at < oldLines.length && oldLines[at] === newLines[at]) at++
    const blockStart = oldLines.slice(0, at).reduce((n, line) => n + line.length + 1, 0)
    const shift = (pos: number): number => (pos >= blockStart ? pos + merged.length - old.length : pos)
    const ed = editorRef.current
    // Focused or not, the editor keeps its selection — always move it with its line.
    const sel = ed?.selection()
    textRef.current = merged
    ed?.load(merged, sel && { from: shift(sel.from), to: shift(sel.to) })
    setText(merged)
    return merged
  }, [])

  // Saves are serialized so each one uses the mtime returned by the previous one.
  const save = useCallback((): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    saveChain = saveChain
      .then(async () => {
        if (!dirtyRef.current || conflictDraft !== null) return
        let sent = textRef.current
        // Mail sync appends mail by mail, so the save after a merge can 409 again — a few retries.
        for (let attempt = 0; ; attempt++) {
          const result = await window.api.saveDump(sent, baseMtimeRef.current)
          if (!('error' in result)) {
            baseMtimeRef.current = result.mtime
            baseTextRef.current = sent
            setError(null)
            if (textRef.current === sent) dirtyRef.current = false
            return
          }
          if (result.error !== 'conflict') {
            setError(result.error === 'too_large' ? 'Zrzut przekracza 1 MB — nie zapisano.' : 'Nie udało się zapisać zrzutu.')
            return
          }
          const merged = attempt < 5 ? await mergeExternal() : null
          if (merged === null) {
            conflictDraft = textRef.current
            setConflict(true)
            return
          }
          sent = merged
        }
      })
      .catch((err: unknown) => {
        setError(`Nie udało się zapisać zrzutu: ${err instanceof Error ? err.message : String(err)}`)
      })
    return saveChain
  }, [mergeExternal])

  const applyText = useCallback((value: string) => {
    textRef.current = value
    dirtyRef.current = true
    if (conflictDraft !== null) conflictDraft = value
    setText(value)
  }, [])

  // ⌘D / ⌘1–3 / ⌘F: replace the text, put the caret, save right away.
  const applyEdit = useCallback((result: { text: string; cursor: number } | null) => {
    const ed = editorRef.current
    // Unmounted during an await (⌘F / ⌘R): this instance's text and mtime are stale.
    if (!result || !ed) return
    ed.replace(result.text, result.cursor)
    applyText(result.text)
    // Host edits never reach onSelectionChange: a caret-bound picker (inline / token) would stay over another item.
    setPicker((cur) => (cur?.mode === 'item' ? cur : null))
    void save()
  }, [applyText, save])

  // Strip actions work on the current text: the render that built `item` may be stale.
  const withCurrent = (item: DatedDumpItem, fn: (pos: number) => { text: string; cursor: number } | null) => {
    const same = datedDumpItems(textRef.current).filter((d) => d.title === item.title && d.date === item.date)
    // Same title + date twice: the clicked copy, while the text hasn't moved.
    const cur = same.find((d) => d.pos === item.pos) ?? same[0]
    if (!cur) return
    const result = fn(cur.pos)
    if (!result) return setError('Brak sekcji ## Now w zrzucie.')
    applyEdit(result)
  }
  const acceptDated = (item: DatedDumpItem) => withCurrent(item, (pos) => moveDumpItems(textRef.current, pos, pos, 'Now'))
  const rescheduleDated = (item: DatedDumpItem, date: string | null) =>
    withCurrent(item, (pos) => setDumpItemDate(textRef.current, pos, date))

  // ⌘1–3 are the "project 1–3" shortcuts, caught in main (before-input-event) before the
  // editor sees them — so they arrive here as select-project. Dashboard skips them while we're focused.
  useEffect(() => {
    return window.api.onShortcutAction((data) => {
      const ed = editorRef.current
      if (!ed?.hasFocus()) return
      // ⌘R also arrives from main (see shortcuts.ts) — a packaged build never delivers it as a keydown.
      if (data.action === 'dump-repeat') return void repeatRef.current()
      if (data.action !== 'select-project') return
      const section = SECTIONS[data.index ?? -1]
      if (!section) return
      const { from, to } = ed.selection()
      applyEdit(moveDumpItems(textRef.current, from, to, section))
    })
  }, [applyEdit])

  const handleChange = (value: string, caret: number) => {
    applyText(value)
    const project = projectTagTrigger(value, caret)
    const date = project ? null : dumpDateTrigger(value, caret)
    setPicker((cur) => (project ? { kind: 'project', mode: 'inline', ...project } : date ? { kind: 'date', mode: 'inline', ...date } : cur?.mode === 'item' ? cur : null))
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void save(), SAVE_DEBOUNCE_MS)
  }

  // ⌘F: focus on the item under the cursor — reuse the open quick task with the same
  // title, or create one. The line stays; completing the task ticks it off (main process).
  const focusOnItem = async () => {
    const raw = dumpItemTitle(textRef.current, editorRef.current!.selection().from)
    const title = raw ? stripDumpTags(raw, codes) : ''
    if (!title) return
    // `- ` back in front: a tag right at the title's start (`- #ATD Oferta`) is a tag in the line.
    const tag = findDumpTags(`- ${raw}`, codes)[0]
    const projectId = tag ? projectByCode(tag.code)?.id : undefined
    const busy = 'Trwa już inny focus — zakończ go i spróbuj ponownie.'
    try {
      await save()
      const { quickTasks, config } = await window.api.getAppData()
      // Don't create a quick task we can't focus on anyway.
      if (config.focusTaskId) return setError(busy)
      // Repeating instances are skipped: completing them never ticks the dump line.
      let id = quickTasks.find((t) => !t.completed && !t.repeatingTaskId && t.title.trim() === title)?.id
      if (!id) {
        id = nanoid()
        await window.api.saveQuickTask({ id, title, completed: false, createdAt: new Date().toISOString(), completedAt: null, order: 0, projectId })
      }
      const result = await window.api.focusOnTask(STANDALONE_PROJECT_ID, id)
      if (result?.error) return setError(result.error === 'already_in_focus' ? busy : 'Nie udało się uruchomić focusa.')
      // Focused item → `## Now`. Looked up by title: the text may have changed during the awaits.
      const pos = findDumpItem(textRef.current, title)
      if (pos !== null) applyEdit(moveDumpItems(textRef.current, pos, pos, 'Now'))
    } catch (err) {
      setError(`Nie udało się uruchomić focusa: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const pickProject = (project: Project) => {
    const ed = editorRef.current
    if (ed && picker?.mode === 'inline') {
      const text = textRef.current
      const caret = ed.selection().from
      // Re-read from the caret, not picker.start — the caret may sit behind a different ` #` by now.
      const trigger = projectTagTrigger(text, caret)
      const insert = `#${project.code ?? ''} `
      if (trigger) applyEdit({ text: text.slice(0, trigger.start) + insert + text.slice(caret), cursor: trigger.start + insert.length })
    } else if (ed && picker?.mode === 'item') {
      const result = setDumpItemTag(textRef.current, picker.pos, project.code ?? '', codes)
      if (result) applyEdit(result)
      else ed.focus()
    }
    setPicker(null)
  }

  const pickDate = (date: string | null) => {
    const ed = editorRef.current
    const text = textRef.current
    if (ed && picker?.mode === 'inline') {
      const caret = ed.selection().from
      const trigger = dumpDateTrigger(text, caret)
      // The whole typed ` @word` goes (incl. its rest behind the caret, but not a glued `#KOD`); the date lands at the end of the item's first line.
      if (trigger) applyEdit(setDumpItemDate(text.slice(0, trigger.start - 1) + text.slice(caret).replace(/^[\p{L}\p{N}+.-]*/u, ''), trigger.start - 1, date))
    } else if (ed && picker?.mode === 'token') {
      const result = date && setDumpItemDate(text, ed.selection().from, date)
      // Not reopened until the caret has left the (moved) token.
      if (result) { dismissedRef.current = dumpDateAt(result.text, result.cursor)?.start ?? null; applyEdit(result) }
      else ed.focus()
    } else if (ed && picker?.mode === 'item') {
      const result = setDumpItemDate(text, picker.pos, date)
      if (result) applyEdit(result)
      else ed.focus()
    }
    setPicker(null)
  }

  const closePicker = () => {
    if (picker?.mode === 'token') dismissedRef.current = picker.start
    setPicker(null)
    editorRef.current?.focus()
  }

  // ⌘R: `pon śr pt: Tytuł` → repeating task first, THEN the line becomes `↻ …` and is ticked off.
  const repeatFromItem = async () => {
    const line = dumpItemTitle(textRef.current, editorRef.current!.selection().from)
    const parsed = line ? parseRepeatLine(line, codes) : null
    if (!line || !parsed) return setError(REPEAT_HELP)
    const project = parsed.projectCode ? projectByCode(parsed.projectCode) : undefined
    const { repeatingTasks, saveRepeatingTask } = useProjects.getState()
    if (repeatingTasks.some((t) => t.title.trim().toLowerCase() === parsed.title.toLowerCase())) return setError('Takie zadanie cykliczne już istnieje')
    const task: RepeatingTask = {
      id: nanoid(),
      title: parsed.title,
      schedule: parsed.schedule,
      createdAt: new Date().toISOString(),
      lastCompletedAt: null,
      order: repeatingTasks.length,
      acceptedCount: 0,
      dismissedCount: 0,
      completedCount: 0,
      startDate: null,
      endDate: null,
      link: null,
      projectId: project?.id ?? null
    }
    try {
      await saveRepeatingTask(task)
    } catch (err) {
      return setError(`Nie udało się utworzyć zadania cyklicznego: ${err instanceof Error ? err.message : String(err)}`)
    }
    // Main rejects an invalid task silently (returns the old list) — don't tick the line off then.
    if (!useProjects.getState().repeatingTasks.some((t) => t.id === task.id)) return setError('Nie udało się utworzyć zadania cyklicznego.')
    setError(null)
    // Looked up again: the text may have changed during the await.
    const pos = findDumpItem(textRef.current, line)
    if (pos === null) return
    const marker = /^\s*(?:- )?/.exec(textRef.current.slice(pos))![0].length
    const marked = textRef.current.slice(0, pos + marker) + '↻ ' + textRef.current.slice(pos + marker)
    applyEdit(toggleDumpLines(marked, pos, pos, logicalDateKey()))
  }
  repeatRef.current = async () => {
    if (repeatBusyRef.current) return
    repeatBusyRef.current = true
    try {
      await repeatFromItem()
    } finally {
      repeatBusyRef.current = false
    }
  }

  const handleKeyDown = (e: KeyboardEvent): boolean => {
    const ed = editorRef.current
    // Backspace right behind `@YYYY-MM-DD` removes the whole date (and its leading space) in one go.
    if (ed && e.key === 'Backspace' && !e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey) {
      const { from, to } = ed.selection()
      const text = textRef.current
      const token = from === to ? dumpDateAt(text, from - 1) : null
      if (token?.end !== from) return false
      e.preventDefault()
      applyEdit({ text: text.slice(0, token.start - 1) + text.slice(token.end), cursor: token.start - 1 })
      return true
    }
    if (!ed || !e.metaKey || e.shiftKey || e.altKey || e.ctrlKey) return false
    const key = e.key.toLowerCase()
    const { from, to } = ed.selection()
    const section = SECTIONS[Number(key) - 1]
    if (key === 'f') void focusOnItem()
    else if (key === 'p') setPicker({ kind: 'project', mode: 'item', pos: from, query: '' })
    else if (key === 't') { if (setDumpItemDate(textRef.current, from, null)) setPicker({ kind: 'date', mode: 'item', pos: from, query: '', base: itemDumpDate(textRef.current, from) }) }
    else if (section) { if (!e.repeat) applyEdit(moveDumpItems(textRef.current, from, to, section)) }
    else if (key === 'd') applyEdit(toggleDumpLines(textRef.current, from, to, logicalDateKey()))
    else return false
    return true
  }

  // Pull tasks from self-sent mails now (main also does it every 30 min). Main appends to
  // dump.md and triggers a reload — so flush local edits first to avoid a conflict.
  const checkMail = async () => {
    setMailStatus(MAIL_CHECKING)
    setError(null)
    await save()
    const result = await window.api.mailToDump().catch((err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : String(err) }))
    if (!result.ok) {
      setMailStatus(null)
      return setError(`Maile: ${result.error}`)
    }
    setMailStatus(result.added ? `Dodano z maili: ${result.added}` : 'Brak nowych zadań z maili')
  }

  const reloadFromFile = () => {
    dirtyRef.current = false
    conflictDraft = null
    setConflict(false)
    setError(null)
    void load()
  }

  const overwriteWithMine = async () => {
    const { text: fileText, mtime } = await window.api.getDump()
    baseMtimeRef.current = mtime
    baseTextRef.current = fileText
    dirtyRef.current = true
    conflictDraft = null
    setConflict(false)
    await save()
  }

  useEffect(() => {
    if (conflictDraft === null) void load()
    // Only reload when there are no local changes; with local changes a save will hit 409 instead.
    const cleanupReload = window.api.onReloadData(() => {
      if (!dirtyRef.current && conflictDraft === null) void load()
    })
    // ponytail: zapis przy wyjściu z aplikacji jest best-effort (async IPC) — sendSync jeśli zaczną ginąć ostatnie znaki
    const flush = () => void save()
    window.addEventListener('beforeunload', flush)
    return () => {
      cleanupReload()
      window.removeEventListener('beforeunload', flush)
      flush()
    }
  }, [load, save])

  const sidebarLabel = sidebarHidden ? 'Pokaż projekty' : 'Ukryj projekty'
  return (
    // Main window (has the ☰ toggle) gets the writer layout; clean view keeps its own look.
    <div className={onToggleSidebar ? 'dump-view dump-writer' : 'dump-view'}>
      <div className="section-label" style={{ marginBottom: 12 }}>
        {onToggleSidebar ? (
          <button className="dump-sidebar-btn" onClick={onToggleSidebar} title={sidebarLabel} aria-label={sidebarLabel}>☰</button>
        ) : (
          <span style={{ opacity: 0.5 }}>✎</span>
        )}
        <span>Zrzut</span>
        <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>
          {mailStatus && <span style={{ opacity: 0.6, marginRight: 10 }}>{mailStatus}</span>}
          <span className={nowOpen > nowLimit ? 'dump-now-over' : undefined} style={{ marginRight: 10 }}>Now {nowOpen}/{nowLimit}</span>
          {counts.open} otwartych / {counts.done} zrobionych
        </span>
        <button
          className="form-btn form-btn-secondary dump-bar-btn"
          style={{ textTransform: 'none', letterSpacing: 0 }}
          onClick={() => void checkMail()}
          disabled={mailStatus === MAIL_CHECKING}
          title="Zadania z maili wysłanych do siebie (automatycznie co 30 min)"
        >
          ✉ Sprawdź maile
        </button>
      </div>

      {conflict && (
        <div className="wins-lock-bar" role="alert">
          <span style={{ flex: 1 }}>Plik zmienił się z zewnątrz — Twoje zmiany nie zostały zapisane.</span>
          <button className="form-btn form-btn-secondary dump-bar-btn" onClick={reloadFromFile}>Wczytaj z pliku</button>
          <button className="form-btn form-btn-primary dump-bar-btn" onClick={() => void overwriteWithMine()}>Nadpisz moją wersją</button>
        </div>
      )}
      {error && !conflict && <div className="restore-error" role="alert">{error}</div>}

      <DumpTodayStrip dated={dated} onAcceptDated={acceptDated} onRescheduleDated={rescheduleDated} />

      <div className="dump-editor">
        <DumpEditor
          ref={editorRef}
          value={text}
          readOnly={!loaded}
          placeholder={'- rzecz do zrobienia #KOD\n\n⌘D — oznacz jako zrobione / przywróć\n⌘1 / ⌘2 / ⌘3 — przenieś do ## Now / ## Next / na górę ## Inbox\n⌘F — focus na zadaniu (tworzy quick task, przenosi do ## Now)\n# po spacji / ⌘P — tag projektu\n@jutro / ⌘T — data (pojawi się w „Dziś” dzień wcześniej)\n⌘R — "pon śr pt: Tytuł" → zadanie cykliczne'}
          codes={codes}
          tagColor={tagColor}
          onChange={handleChange}
          onSelectionChange={(caret) => {
            // Caret moved away from this ` #query` / ` @query` (incl. behind another tag) → the inline picker is stale.
            // Caret strictly inside a date token (nothing selected) → the token picker, unless dismissed.
            const text = textRef.current
            const sel = editorRef.current?.selection()
            const token = sel && sel.from === sel.to ? dumpDateAt(text, caret) : null
            if (token?.start !== dismissedRef.current) dismissedRef.current = null
            setPicker((cur) => {
              if (cur?.mode === 'inline') return triggerOf(cur.kind, text, caret)?.start === cur.start ? cur : null
              if (cur?.mode === 'item') return cur
              if (cur?.mode === 'token' && token?.start === cur.start) return cur
              return token && token.start !== dismissedRef.current ? { kind: 'date', mode: 'token', query: '', start: token.start, base: token.date } : null
            })
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // The inline picker listens for keys on window — it must not outlive the editor's focus.
            setPicker((cur) => (cur?.mode === 'item' ? cur : null))
            void save()
          }}
        />
        {picker?.kind === 'date' && (
          <DumpDatePicker
            // A new token = a fresh picker (highlight back on row 0), also when the caret jumps straight from another token.
            key={picker.mode === 'token' ? picker.start : picker.mode}
            query={picker.query}
            mode={picker.mode}
            base={picker.mode === 'inline' ? undefined : picker.base}
            onQueryChange={picker.mode === 'item' ? (query) => setPicker({ ...picker, query }) : undefined}
            onPick={pickDate}
            onClose={closePicker}
            onRemove={picker.mode === 'item' && picker.base ? () => pickDate(null) : undefined}
          />
        )}
        {picker?.kind === 'project' && (
          <DumpProjectPicker
            projects={projects.filter((p) => !p.archivedAt && p.code)}
            query={picker.query}
            onQueryChange={picker.mode === 'item' ? (query) => setPicker({ ...picker, query }) : undefined}
            onPick={pickProject}
            onClose={closePicker}
          />
        )}
      </div>
      {onToggleSidebar && <DumpFooter />}
    </div>
  )
}
