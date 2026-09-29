import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { nanoid } from 'nanoid'
import { countDumpLines, dumpItemTitle, mergeExternalAppends, toggleDumpLines } from '../../shared/dump'
import { logicalDateKey } from '../../shared/schedule'
import { STANDALONE_PROJECT_ID } from '../../shared/constants'

const SAVE_DEBOUNCE_MS = 500
const MAIL_CHECKING = 'Sprawdzam maile…'

// Module-level so both survive leaving the tab / toggling clean view:
// - conflictDraft: text the user couldn't save because dump.md changed underneath (409); null = no conflict.
// - saveChain: saves run one after another, and a save flushed on unmount lands before the
//   next instance reads the file (otherwise it would show stale text with a stale mtime).
let conflictDraft: string | null = null
let saveChain: Promise<void> = Promise.resolve()

export default function DumpView() {
  const [text, setText] = useState(conflictDraft ?? '')
  const [conflict, setConflict] = useState(conflictDraft !== null)
  const [error, setError] = useState<string | null>(null)
  // Read-only until the first load — typing into the empty placeholder would later
  // conflict and "Nadpisz moją wersją" would replace the whole file with those few chars.
  const [loaded, setLoaded] = useState(conflictDraft !== null)
  const [mailStatus, setMailStatus] = useState<string | null>(null)

  // Refs, not state: the debounced save must see the latest values, not a closure snapshot.
  const textRef = useRef(text)
  const baseMtimeRef = useRef<number | null>(null)
  // File text as of baseMtime — lets a 409 tell "lines were only appended" from a real conflict.
  const baseTextRef = useRef<string | null>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const dirtyRef = useRef(conflictDraft !== null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const counts = useMemo(() => countDumpLines(text), [text])

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
        // Mail sync appends line by line, so the save after a merge can 409 again — a few retries.
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

  const applyText = (value: string) => {
    textRef.current = value
    dirtyRef.current = true
    if (conflictDraft !== null) conflictDraft = value
    setText(value)
  }

  const handleChange = (value: string) => {
    applyText(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void save(), SAVE_DEBOUNCE_MS)
  }

  // ⌘F: focus on the item under the cursor — reuse the open quick task with the same
  // title, or create one. The line stays; completing the task ticks it off (main process).
  const focusOnItem = async (el: HTMLTextAreaElement) => {
    const title = dumpItemTitle(el.value, el.selectionStart)
    if (!title) return
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
        await window.api.saveQuickTask({ id, title, completed: false, createdAt: new Date().toISOString(), completedAt: null, order: 0 })
      }
      const result = await window.api.focusOnTask(STANDALONE_PROJECT_ID, id)
      if (result?.error) setError(result.error === 'already_in_focus' ? busy : 'Nie udało się uruchomić focusa.')
    } catch (err) {
      setError(`Nie udało się uruchomić focusa: ${err instanceof Error ? err.message : String(err)}`)
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
    if (key !== 'd') return
    e.preventDefault()
    const el = e.currentTarget
    const result = toggleDumpLines(el.value, el.selectionStart, el.selectionEnd, logicalDateKey())
    if (!result) return
    // ponytail: ⌘D jest sam swoim cofnięciem; natywne ⌘Z po ⌘D nie działa — własny undo-stack jeśli zacznie przeszkadzać
    el.value = result.text
    el.setSelectionRange(result.cursor, result.cursor)
    applyText(result.text)
    void save()
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

      <textarea
        ref={areaRef}
        className="dump-textarea"
        aria-label="Zrzut — lista rzeczy do zrobienia"
        value={text}
        readOnly={!loaded}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => void save()}
        placeholder={'- rzecz do zrobienia\n\n⌘D — oznacz jako zrobione / przywróć\n⌘F — focus na zadaniu (tworzy quick task)'}
        spellCheck={false}
      />
    </div>
  )
}
