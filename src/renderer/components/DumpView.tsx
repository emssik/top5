import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { countDumpLines, toggleDumpLines } from '../../shared/dump'
import { logicalDateKey } from '../../shared/schedule'

const SAVE_DEBOUNCE_MS = 500

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

  // Refs, not state: the debounced save must see the latest values, not a closure snapshot.
  const textRef = useRef(text)
  const baseMtimeRef = useRef<number | null>(null)
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
    setText(state.text)
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
        const sent = textRef.current
        const result = await window.api.saveDump(sent, baseMtimeRef.current)
        if ('error' in result) {
          if (result.error === 'conflict') {
            conflictDraft = textRef.current
            setConflict(true)
          } else {
            setError(result.error === 'too_large' ? 'Zrzut przekracza 1 MB — nie zapisano.' : 'Nie udało się zapisać zrzutu.')
          }
          return
        }
        baseMtimeRef.current = result.mtime
        setError(null)
        if (textRef.current === sent) dirtyRef.current = false
      })
      .catch((err: unknown) => {
        setError(`Nie udało się zapisać zrzutu: ${err instanceof Error ? err.message : String(err)}`)
      })
    return saveChain
  }, [])

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.metaKey || e.shiftKey || e.altKey || e.ctrlKey || e.key.toLowerCase() !== 'd') return
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

  const reloadFromFile = () => {
    dirtyRef.current = false
    conflictDraft = null
    setConflict(false)
    setError(null)
    void load()
  }

  const overwriteWithMine = async () => {
    const { mtime } = await window.api.getDump()
    baseMtimeRef.current = mtime
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
          {counts.open} otwartych / {counts.done} zrobionych
        </span>
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
        className="dump-textarea"
        aria-label="Zrzut — lista rzeczy do zrobienia"
        value={text}
        readOnly={!loaded}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => void save()}
        placeholder={'- rzecz do zrobienia\n\n⌘D — oznacz linię jako zrobioną / przywróć'}
        spellCheck={false}
      />
    </div>
  )
}
