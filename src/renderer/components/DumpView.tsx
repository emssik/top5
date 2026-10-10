import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { nanoid } from 'nanoid'
import {
  type DumpSection, countDumpLines, countSectionOpen, dumpItemTitle, findDumpItem, findDumpSectionHeaders, findDumpTags, mergeExternalAppends,
  moveDumpItems, projectTagTrigger, setDumpItemTag, stripDumpTags, toggleDumpLines
} from '../../shared/dump'
import { parseRepeatLine } from '../../shared/dump-repeat'
import { logicalDateKey } from '../../shared/schedule'
import { STANDALONE_PROJECT_ID } from '../../shared/constants'
import { useProjects } from '../hooks/useProjects'
import { projectColorValue } from '../utils/projects'
import type { Project, RepeatingTask } from '../types'
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

// The caret-position state of the project picker: ` #query` typed in the text, or ⌘P on an item.
type Picker = { mode: 'inline'; start: number; query: string } | { mode: 'item'; pos: number; query: string }

export default function DumpView() {
  const [text, setText] = useState(conflictDraft ?? '')
  const [conflict, setConflict] = useState(conflictDraft !== null)
  const [error, setError] = useState<string | null>(null)
  // Read-only until the first load — typing into the empty placeholder would later
  // conflict and "Nadpisz moją wersją" would replace the whole file with those few chars.
  const [loaded, setLoaded] = useState(conflictDraft !== null)
  const [mailStatus, setMailStatus] = useState<string | null>(null)
  const [picker, setPicker] = useState<Picker | null>(null)
  const { projects, config } = useProjects()

  // Refs, not state: the debounced save must see the latest values, not a closure snapshot.
  const textRef = useRef(text)
  const baseMtimeRef = useRef<number | null>(null)
  // File text as of baseMtime — lets a 409 tell "lines were only appended" from a real conflict.
  const baseTextRef = useRef<string | null>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const dirtyRef = useRef(conflictDraft !== null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest ⌘R handler for the IPC listener below (registered once, so no stale closure).
  const repeatRef = useRef<(el: HTMLTextAreaElement) => Promise<void>>(async () => {})
  // One ⌘R at a time: a second press during the await would pass the duplicate check again.
  const repeatBusyRef = useRef(false)

  const counts = useMemo(() => countDumpLines(text), [text])
  const nowOpen = useMemo(() => countSectionOpen(text, 'Now'), [text])
  const nowLimit = config.quickTasksLimit ?? 5
  const codes = useMemo(() => projects.flatMap((p) => (p.code ? [p.code] : [])), [projects])
  // New quick / repeating tasks never get an archived project (old lines may still carry its tag).
  const projectByCode = (code: string) => projects.find((p) => !p.archivedAt && (p.code ?? '').toLowerCase() === code.toLowerCase())
  // Archived projects too: their tags in old lines keep their colour.
  const headers = useMemo(() => findDumpSectionHeaders(text), [text])
  const tagged = useMemo(() => {
    const byCode = new Map(projects.map((p) => [(p.code ?? '').toLowerCase(), p]))
    const tags = findDumpTags(text, codes)
    // text[from,to) with tags highlighted; a tag never crosses a line, so it never straddles a header boundary.
    const render = (from: number, to: number): React.ReactNode[] => {
      const parts: React.ReactNode[] = []
      let at = from
      for (const tag of tags) {
        if (tag.start < from || tag.end > to) continue
        parts.push(text.slice(at, tag.start))
        parts.push(<span key={tag.start} className="dump-tag" style={{ color: projectColorValue(byCode.get(tag.code.toLowerCase())?.color) }}>{text.slice(tag.start, tag.end)}</span>)
        at = tag.end
      }
      parts.push(text.slice(at, to))
      return parts
    }
    // Header lines are their own elements: their offsetTop (wrap-proof) drives the sticky section bar.
    const parts: React.ReactNode[] = []
    let at = 0
    headers.forEach((h, i) => {
      parts.push(...render(at, h.start))
      parts.push(<span key={`h${h.start}`} data-dump-header={i}>{render(h.start, h.end)}</span>)
      at = h.end
    })
    parts.push(...render(at, text.length))
    return parts
  }, [text, projects, codes, headers])

  // Section bar: the last header at/above the visible text top, shown once its line scrolled out.
  const [stickyTitle, setStickyTitle] = useState<string | null>(null)
  const updateSticky = useCallback(() => {
    const area = areaRef.current
    const hl = highlightRef.current
    if (!area || !hl) return
    const padTop = parseFloat(getComputedStyle(hl).paddingTop)
    let title: string | null = null
    hl.querySelectorAll<HTMLElement>('[data-dump-header]').forEach((el) => {
      if (el.offsetTop > area.scrollTop + padTop) return
      title = el.offsetTop < area.scrollTop ? headers[Number(el.dataset.dumpHeader)]?.title ?? null : null
    })
    setStickyTitle(title)
  }, [headers])
  useLayoutEffect(() => {
    updateSticky()
    const editor = areaRef.current?.parentElement
    if (!editor) return
    const ro = new ResizeObserver(updateSticky)
    ro.observe(editor)
    return () => ro.disconnect()
  }, [updateSticky, tagged])

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
      setText(conflictDraft)
      setConflict(true)
      return
    }
    // User typed while we were reading — never clobber local edits.
    if (dirtyRef.current) return
    textRef.current = state.text
    baseMtimeRef.current = state.mtime
    baseTextRef.current = state.text
    setText(state.text)
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
    const el = areaRef.current
    const sel = el && document.activeElement === el ? [shift(el.selectionStart), shift(el.selectionEnd)] : null
    textRef.current = merged
    // Commit now, so the caret is put back after React replaced the value (not before it).
    flushSync(() => setText(merged))
    if (el && sel) el.setSelectionRange(sel[0], sel[1])
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
    const el = areaRef.current
    if (!result || !el) return
    el.value = result.text
    el.setSelectionRange(result.cursor, result.cursor)
    applyText(result.text)
    void save()
  }, [applyText, save])

  // ⌘1–3 are the "project 1–3" shortcuts, caught in main (before-input-event) before the
  // textarea sees them — so they arrive here as select-project. Dashboard skips them while we're focused.
  useEffect(() => {
    return window.api.onShortcutAction((data) => {
      const el = areaRef.current
      if (!el || document.activeElement !== el) return
      // ⌘R also arrives from main (see shortcuts.ts) — a packaged build never delivers it as a keydown.
      if (data.action === 'dump-repeat') return void repeatRef.current(el)
      if (data.action !== 'select-project') return
      const section = SECTIONS[data.index ?? -1]
      if (section) applyEdit(moveDumpItems(el.value, el.selectionStart, el.selectionEnd, section))
    })
  }, [applyEdit])

  const handleChange = (el: HTMLTextAreaElement) => {
    const value = el.value
    applyText(value)
    const trigger = projectTagTrigger(value, el.selectionStart)
    setPicker((cur) => (trigger ? { mode: 'inline', ...trigger } : cur?.mode === 'item' ? cur : null))
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void save(), SAVE_DEBOUNCE_MS)
  }

  // ⌘F: focus on the item under the cursor — reuse the open quick task with the same
  // title, or create one. The line stays; completing the task ticks it off (main process).
  const focusOnItem = async (el: HTMLTextAreaElement) => {
    const raw = dumpItemTitle(el.value, el.selectionStart)
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

  // Replaces the textarea content through the browser's editing stack (native ⌘Z keeps working):
  // only the differing middle is selected and re-inserted.
  const replaceText = (el: HTMLTextAreaElement, next: string, cursor: number) => {
    const old = el.value
    // Nothing to change (⌘P with the tag already there): execCommand('delete') on an empty selection would eat a char.
    if (old === next) {
      el.focus()
      el.setSelectionRange(cursor, cursor)
      return
    }
    let p = 0
    while (p < old.length && p < next.length && old[p] === next[p]) p++
    let s = 0
    while (s < old.length - p && s < next.length - p && old[old.length - 1 - s] === next[next.length - 1 - s]) s++
    el.focus()
    el.setSelectionRange(p, old.length - s)
    const middle = next.slice(p, next.length - s)
    const ok = middle ? document.execCommand('insertText', false, middle) : document.execCommand('delete')
    if (!ok || el.value !== next) {
      applyEdit({ text: next, cursor })
      return
    }
    el.setSelectionRange(cursor, cursor)
    void save()
  }

  const pickProject = (project: Project) => {
    const el = areaRef.current
    if (el && picker?.mode === 'inline') {
      const caret = el.selectionStart
      // Re-read from the caret, not picker.start — the caret may sit behind a different ` #` by now.
      const trigger = projectTagTrigger(el.value, caret)
      const insert = `#${project.code ?? ''} `
      if (trigger) replaceText(el, el.value.slice(0, trigger.start) + insert + el.value.slice(caret), trigger.start + insert.length)
    } else if (el && picker?.mode === 'item') {
      const result = setDumpItemTag(el.value, picker.pos, project.code ?? '', codes)
      if (result) replaceText(el, result.text, result.cursor)
      else el.focus()
    }
    // Last: the edit's input event re-opens the inline picker when the caret ends right behind the new tag.
    setPicker(null)
  }

  const closePicker = () => {
    setPicker(null)
    areaRef.current?.focus()
  }

  // ⌘R: `pon śr pt: Tytuł` → repeating task first, THEN the line becomes `↻ …` and is ticked off.
  const repeatFromItem = async (el: HTMLTextAreaElement) => {
    const line = dumpItemTitle(el.value, el.selectionStart)
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
  repeatRef.current = async (el) => {
    if (repeatBusyRef.current) return
    repeatBusyRef.current = true
    try {
      await repeatFromItem(el)
    } finally {
      repeatBusyRef.current = false
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.metaKey || e.shiftKey || e.altKey || e.ctrlKey) return
    const key = e.key.toLowerCase()
    if (key === 'f') {
      e.preventDefault()
      void focusOnItem(e.currentTarget)
      return
    }
    if (key === 'p') {
      e.preventDefault()
      setPicker({ mode: 'item', pos: e.currentTarget.selectionStart, query: '' })
      return
    }
    const el = e.currentTarget
    const section = SECTIONS[Number(key) - 1]
    if (section) {
      e.preventDefault()
      if (!e.repeat) applyEdit(moveDumpItems(el.value, el.selectionStart, el.selectionEnd, section))
      return
    }
    if (key !== 'd') return
    e.preventDefault()
    // ponytail: ⌘D jest sam swoim cofnięciem; natywne ⌘Z po ⌘D/⌘1–3 nie działa — własny undo-stack jeśli zacznie przeszkadzać
    applyEdit(toggleDumpLines(el.value, el.selectionStart, el.selectionEnd, logicalDateKey()))
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

  return (
    <div className="dump-view">
      <div className="section-label" style={{ marginBottom: 12 }}>
        <span style={{ opacity: 0.5 }}>✎</span>
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

      <DumpTodayStrip />

      <div className="dump-editor">
        <div ref={highlightRef} className="dump-layer dump-highlight" aria-hidden="true">{tagged}{'\u200b'}</div>
        <textarea
          ref={areaRef}
          className="dump-layer dump-textarea"
          aria-label="Zrzut — lista rzeczy do zrobienia"
          value={text}
          readOnly={!loaded}
          onChange={(e) => handleChange(e.target)}
          onKeyDown={handleKeyDown}
          onScroll={(e) => { if (highlightRef.current) highlightRef.current.scrollTop = e.currentTarget.scrollTop; updateSticky() }}
          onSelect={(e) => {
            // Caret moved away from this ` #query` (incl. behind another tag) → the inline picker is stale.
            if (picker?.mode === 'inline' && projectTagTrigger(e.currentTarget.value, e.currentTarget.selectionStart)?.start !== picker.start) setPicker(null)
          }}
          onBlur={() => {
            // The inline picker listens for keys on window — it must not outlive the textarea's focus.
            setPicker((cur) => (cur?.mode === 'inline' ? null : cur))
            void save()
          }}
          placeholder={'- rzecz do zrobienia #KOD\n\n⌘D — oznacz jako zrobione / przywróć\n⌘1 / ⌘2 / ⌘3 — przenieś do ## Now / ## Next / na górę ## Inbox\n⌘F — focus na zadaniu (tworzy quick task, przenosi do ## Now)\n# po spacji / ⌘P — tag projektu\n⌘R — "pon śr pt: Tytuł" → zadanie cykliczne'}
          spellCheck={false}
        />
        {stickyTitle && <div className="dump-sticky" aria-hidden="true"><span>{stickyTitle}</span></div>}
        {picker && (
          <DumpProjectPicker
            projects={projects.filter((p) => !p.archivedAt && p.code)}
            query={picker.query}
            onQueryChange={picker.mode === 'item' ? (query) => setPicker({ ...picker, query }) : undefined}
            onPick={pickProject}
            onClose={closePicker}
          />
        )}
      </div>
    </div>
  )
}
