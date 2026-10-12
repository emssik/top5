import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Annotation, Compartment, EditorState, Prec, type Range, StateEffect, StateField, type Text, Transaction } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, isolateHistory } from '@codemirror/commands'
import { codeFolding, foldEffect, foldGutter, foldKeymap, foldService, foldedRanges, unfoldEffect } from '@codemirror/language'
import { dumpCurrentSection, dumpFoldEnd, dumpLineHang, findDumpSectionHeaders, findDumpTags, formatDumpPaste } from '../../shared/dump'

export type DumpEditorHandle = {
  selection(): { from: number; to: number }
  hasFocus(): boolean
  focus(): void
  // One undoable edit (minimal changed range), caret → cursor.
  replace(next: string, cursor: number): void
  // External text (file load / merge); not undoable. forgetHistory: ⌘Z must not bring back the text it replaced.
  load(next: string, selection?: { from: number; to: number }, forgetHistory?: boolean): void
}

export type DumpEditorProps = {
  // Initial text only — later external text goes through the handle's load().
  value: string
  readOnly: boolean
  placeholder: string
  codes: string[]
  tagColor: (code: string) => string | undefined
  // User edits only (not replace / load).
  onChange: (value: string, caret: number) => void
  onSelectionChange: (caret: number) => void
  // true = handled (the editor stops the default).
  onKeyDown: (e: KeyboardEvent) => boolean
  onBlur: () => void
}

// Marks transactions that come from the host (replace / load): they must not echo back through onChange.
const fromHost = Annotation.define<boolean>()
const refresh = StateEffect.define<null>()

// Hanging indents (line decorations driven by dumpLineHang) + project tag colours.
// ponytail: rebuilt for the whole doc on every change — fine for a dump (≤1 MB cap); viewport-only plugin if typing lags.
function decorate(doc: Text, codes: string[], tagColor: (code: string) => string | undefined): DecorationSet {
  const ranges: Range<Decoration>[] = []
  // Plain lines right under an item (no blank line between) are its notes: shown under the item's text, not its bullet.
  let itemHang = 0
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    const { kind, hang } = dumpLineHang(line.text)
    const t = line.text.trim()
    // A blank or `#` line (comment, header) ends the item — same rule as itemRange in shared/dump.
    if (kind === 'item') itemHang = hang
    else if (!t || t.startsWith('#')) itemHang = 0
    const shift = kind === 'plain' ? Math.max(0, itemHang - (line.text.length - line.text.trimStart().length)) : 0
    if (kind !== 'plain' || hang || shift) ranges.push(Decoration.line({ class: `dump-hang dump-hang-${kind}`, attributes: { style: `--hang:${hang}ch;--shift:${shift}ch` } }).range(line.from))
  }
  for (const tag of findDumpTags(doc.toString(), codes)) {
    const color = tagColor(tag.code)
    ranges.push(Decoration.mark({ class: 'dump-tag', attributes: color ? { style: `color:${color}` } : undefined }).range(tag.start, tag.end))
  }
  return Decoration.set(ranges, true)
}

// Folded items survive a restart: trimmed head-line texts of all folded items, as a JSON array.
const FOLD_KEY = 'top5.dump.folded'

function readFolded(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FOLD_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

// The fold of the item on 0-based line `i`, or null. The head line stays visible: the fold starts at its end.
function foldAt(doc: Text, i: number): { from: number; to: number } | null {
  const end = dumpFoldEnd((n) => (n < doc.lines ? doc.line(n + 1).text : null), i)
  return end === null ? null : { from: doc.line(i + 1).to, to: doc.line(end + 1).to }
}

// Trimmed first lines of the folded items.
function foldedHeads(state: EditorState): Set<string> {
  const heads = new Set<string>()
  foldedRanges(state).between(0, state.doc.length, (from) => void heads.add(state.doc.lineAt(from).text.trim()))
  return heads
}

// Folds the stored items whose first line isn't folded yet: a fold already there stays as it is (no second,
// overlapping one; an identical first line elsewhere stays open). Never over the caret.
function storedFolds(state: EditorState, stored = readFolded()): StateEffect<unknown>[] {
  if (!stored.size) return []
  const { doc } = state
  const folded = foldedHeads(state)
  const caret = state.selection.main.head
  const effects: StateEffect<unknown>[] = []
  for (let i = 0; i < doc.lines; i++) {
    const head = doc.line(i + 1).text.trim()
    const range = stored.has(head) && !folded.has(head) && foldAt(doc, i)
    if (range && !(range.from < caret && caret < range.to)) effects.push(foldEffect.of(range))
  }
  return effects
}

// Hides the ▾ markers of the hovered row. After a scroll / edit the gutter element under it may stand for another line.
const clearHover = (view: EditorView) => view.dom.querySelectorAll('.dump-fold-hover').forEach((el) => el.classList.remove('dump-fold-hover'))

// Enter at either end of a folded item's first line: the new line goes below the hidden lines. CodeMirror would
// put it between them and the head, so they would end up under whatever gets typed there.
function enterPastFold(view: EditorView): boolean {
  const { head, empty } = view.state.selection.main
  let from = -1
  let to = -1
  if (empty && !view.state.readOnly) {
    foldedRanges(view.state).between(head, head, (a, b) => {
      if (a === head || b === head) { from = a; to = b }
    })
  }
  if (to < 0) return false
  const text = view.state.doc.lineAt(from).text
  const insert = `\n${text.slice(0, text.length - text.trimStart().length)}`
  view.dispatch({ changes: { from: to, insert }, selection: { anchor: to + insert.length }, scrollIntoView: true, userEvent: 'input' })
  return true
}

// The fold ending at `pos` (folds always end at a line end), or null.
function foldEndingAt(state: EditorState, pos: number): { from: number; to: number } | null {
  let fold: { from: number; to: number } | null = null
  foldedRanges(state).between(pos, pos, (from, to) => { if (to === pos) fold = { from, to } })
  return fold
}

// A caret right after ` ⋯ N` sits at the end of the last hidden line, so typing there would edit that line.
// It goes to the end of the first line instead — where it looks like it is.
const caretBeforeFold = EditorState.transactionFilter.of((tr) => {
  const { head, empty } = tr.newSelection.main
  if (!tr.selection || !empty || tr.newSelection.ranges.length > 1) return tr
  const fold = foldEndingAt(tr.state, head)
  return fold ? [tr, { selection: { anchor: fold.from }, sequential: true }] : tr
})

// Backspace at the start of the line below a folded item would join that line to the last hidden line:
// the item unfolds instead, so it's clear what the next Backspace joins.
function unfoldAbove(view: EditorView): boolean {
  const { head, empty } = view.state.selection.main
  const fold = empty && head > 0 && view.state.doc.lineAt(head).from === head ? foldEndingAt(view.state, head - 1) : null
  if (!fold) return false
  view.dispatch({ effects: unfoldEffect.of(fold) })
  return true
}

// Enter in a `* ` sub-point starts the next one; Enter on an empty `* ` ends the list (drops the star).
function continueSubPoint(view: EditorView): boolean {
  const { head, empty } = view.state.selection.main
  const line = view.state.doc.lineAt(head)
  const marker = /^\s*\* /.exec(line.text)
  if (!empty || !marker || head < line.from + marker[0].length) return false
  const ended = !line.text.trim().slice(1).trim()
  view.dispatch(ended
    ? { changes: { from: line.from, to: line.to }, userEvent: 'delete' }
    : { ...view.state.replaceSelection(`\n${marker[0]}`), scrollIntoView: true, userEvent: 'input' })
  return true
}

// ⌘V of several lines: pasted as is first, then reshaped by formatDumpPaste as a separate undo step,
// so ⌘Z right after the paste brings back the raw text.
function pasteAsSubPoints(e: ClipboardEvent, view: EditorView): boolean {
  // The doc keeps LF only, so the raw paste's length must be counted without CR.
  const pasted = (e.clipboardData?.getData('text/plain') ?? '').replace(/\r\n?/g, '\n')
  const { from, to } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  if (view.state.readOnly || to > line.to) return false
  const formatted = formatDumpPaste(line.text.slice(0, from - line.from), line.text.slice(to - line.from), pasted)
  if (formatted === null) return false
  e.preventDefault()
  view.dispatch({ changes: { from, to, insert: pasted }, userEvent: 'input.paste' })
  view.dispatch({
    changes: { from, to: from + pasted.length, insert: formatted },
    selection: { anchor: from + formatted.length },
    scrollIntoView: true,
    userEvent: 'input.paste',
    annotations: isolateHistory.of('before')
  })
  return true
}

const DumpEditor = forwardRef<DumpEditorHandle, DumpEditorProps>(function DumpEditor(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const readOnlyRef = useRef(new Compartment())
  const historyRef = useRef(new Compartment())
  // Latest props for the handlers below (the editor is created once).
  const p = useRef(props)
  p.current = props

  // Replaces the doc with `next`, touching only the differing middle (keeps scroll, caret and history sane).
  const swap = (next: string, tr: { annotations?: Annotation<unknown>[]; selection?: { anchor: number; head: number }; scrollIntoView?: boolean }) => {
    const view = viewRef.current
    if (!view) return
    const old = view.state.doc.toString()
    let a = 0
    while (a < old.length && a < next.length && old[a] === next[a]) a++
    let z = 0
    while (z < old.length - a && z < next.length - a && old[old.length - 1 - z] === next[next.length - 1 - z]) z++
    view.dispatch({ changes: old === next ? undefined : { from: a, to: old.length - z, insert: next.slice(a, next.length - z) }, ...tr })
  }

  // Runs a host edit, then folds again the stored items it unfolded (an item moved by ⌘1–3, external text).
  // The stored set is read first: the edit's update rewrites it from the folds that survived.
  const keepingFolds = (edit: () => void) => {
    const stored = readFolded()
    edit()
    const view = viewRef.current
    if (view) view.dispatch({ effects: storedFolds(view.state, stored) })
  }

  useImperativeHandle(ref, () => ({
    selection: () => {
      const { from, to } = viewRef.current!.state.selection.main
      return { from, to }
    },
    hasFocus: () => !!viewRef.current?.hasFocus,
    focus: () => viewRef.current?.focus(),
    replace: (next, cursor) => {
      // Isolated: CodeMirror would otherwise merge it with typing / another command made within 500 ms.
      keepingFolds(() => swap(next, { annotations: [fromHost.of(true), isolateHistory.of('full')], selection: { anchor: cursor, head: cursor }, scrollIntoView: true }))
      viewRef.current?.focus()
    },
    load: (next, selection, forgetHistory) => {
      const view = viewRef.current
      // Same text (a reload after any data change): nothing replaced, so ⌘Z keeps the user's own edits.
      if (view && forgetHistory && view.state.doc.toString() !== next) {
        view.dispatch({ effects: historyRef.current.reconfigure([]) })
        view.dispatch({ effects: historyRef.current.reconfigure(history()) })
      }
      const clamp = (n: number) => Math.min(n, next.length)
      keepingFolds(() => swap(next, {
        annotations: [fromHost.of(true), Transaction.addToHistory.of(false)],
        selection: selection && { anchor: clamp(selection.from), head: clamp(selection.to) }
      }))
    }
  }), [])

  useEffect(() => {
    const host = hostRef.current!
    const sticky = stickyRef.current!
    const bar = sticky.firstElementChild as HTMLElement
    const label = labelRef.current!
    const tags = StateField.define<DecorationSet>({
      create: (state) => decorate(state.doc, p.current.codes, p.current.tagColor),
      update: (value, tr) => (tr.docChanged || tr.effects.some((e) => e.is(refresh)) ? decorate(tr.newDoc, p.current.codes, p.current.tagColor) : value),
      provide: (f) => EditorView.decorations.from(f)
    })

    // Everything outside the section shown in the sticky bar (before any header reaches it: the first one) gets
    // `dump-dim` (styled in the writer layout only). Set from updateSticky, deferred out of the update listener.
    const setActive = StateEffect.define<number | null>()
    const dim = Decoration.line({ class: 'dump-dim' })
    // On an edit the active header is mapped and the dimming recomputed in the same transaction, so new lines
    // (Enter, paste) are dimmed right away instead of flashing at full contrast for a frame.
    const focus = StateField.define<{ at: number | null; deco: DecorationSet }>({
      create: () => ({ at: null, deco: Decoration.none }),
      update: (value, tr) => {
        const e = tr.effects.find((x) => x.is(setActive))
        if (!e && !tr.docChanged) return value
        const at = e ? e.value : value.at === null ? null : tr.changes.mapPos(value.at)
        const section = at === null ? null : dumpCurrentSection(tr.newDoc.toString(), at)
        if (!section) return { at, deco: Decoration.none }
        const ranges: Range<Decoration>[] = []
        for (let n = 1; n <= tr.newDoc.lines; n++) {
          const { from } = tr.newDoc.line(n)
          if (from < section.from || from >= section.to) ranges.push(dim.range(from))
        }
        return { at, deco: Decoration.set(ranges) }
      },
      provide: (f) => EditorView.decorations.from(f, (v) => v.deco)
    })
    let written = ''
    let applied: number | null | undefined
    let want: number | null = null
    let pending = 0

    // Section bar: draws the current `## X` line exactly where the header itself would sit at the top.
    // As the next header comes up the label fades out before they could overlap; the next header then
    // scrolls into the slot alone and the bar takes it over in place — no stacking, no jump.
    // Geometry from CodeMirror line blocks, written straight to the DOM (no React state per scroll event).
    let headers = findDumpSectionHeaders(p.current.value)
    const updateSticky = (view: EditorView) => {
      const top = view.documentPadding.top - view.scrollDOM.scrollTop
      const labelTop = label.offsetTop
      let current: { start: number; end: number } | null = null
      let nextY: number | null = null
      for (const h of headers) {
        const y = view.lineBlockAt(h.start).top + top
        if (y <= labelTop) current = h
        else { nextY = y; break }
      }
      want = (current ?? headers[0])?.start ?? null
      if (want !== applied && !pending) {
        pending = requestAnimationFrame(() => {
          pending = 0
          applied = want
          view.dispatch({ effects: setActive.of(want) })
        })
      }
      if (!current) { delete sticky.dataset.on; return }
      // Unchanged text is not rewritten: a new text node would force a layout on every scroll event.
      const title = view.state.doc.sliceString(current.start, current.end)
      if (label.textContent !== title) label.textContent = title
      // Fully gone by the time the next header would touch the label's glyphs (no overlapping text).
      const clear = labelTop + label.offsetHeight
      const fade = nextY === null ? 1 : (nextY - clear) / Math.max(1, bar.offsetHeight - clear)
      label.style.opacity = String(Math.min(1, Math.max(0, fade)))
      // The background stays opaque (no dimmed text showing through) but ends just above the next header.
      bar.style.clipPath = nextY !== null && nextY < bar.offsetHeight ? `inset(0 0 ${bar.offsetHeight - Math.max(0, nextY - 4)}px 0)` : ''
      sticky.dataset.on = ''
    }

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: p.current.value,
        extensions: [
          Prec.highest(EditorView.domEventHandlers({
            keydown: (e) => p.current.onKeyDown(e),
            blur: () => void p.current.onBlur(),
            paste: pasteAsSubPoints
          })),
          // Also routes the Edit menu's Undo / Redo roles (native historyUndo / historyRedo) to this history.
          historyRef.current.of(history()),
          keymap.of([{ key: 'Enter', run: enterPastFold }, { key: 'Enter', run: continueSubPoint }, { key: 'Backspace', run: unfoldAbove }, ...defaultKeymap, ...historyKeymap, ...foldKeymap]),
          caretBeforeFold,
          foldService.of((state, from) => foldAt(state.doc, state.doc.lineAt(from).number - 1)),
          codeFolding({
            preparePlaceholder: (state, range) => state.doc.lineAt(range.to).number - state.doc.lineAt(range.from).number,
            placeholderDOM: (_view, onclick, hidden) => {
              const el = document.createElement('span')
              el.className = 'cm-foldPlaceholder'
              el.textContent = ` ⋯ ${hidden}`
              el.title = 'Rozwiń'
              el.onclick = onclick
              return el
            }
          }),
          foldGutter({
            markerDOM: (open) => {
              const el = document.createElement('span')
              el.className = open ? 'dump-fold dump-fold-open' : 'dump-fold'
              el.textContent = open ? '▾' : '▸'
              el.title = open ? 'Zwiń' : 'Rozwiń'
              return el
            }
          }),
          // Unfolded markers show only on the hovered line: the gutter is outside the line, so the row is matched by Y.
          // ponytail: loops over the visible gutter elements per mousemove; fine for a viewport of ~50 rows.
          EditorView.domEventHandlers({
            mousemove: (e, v) => {
              for (const el of v.dom.querySelectorAll<HTMLElement>('.cm-foldGutter .cm-gutterElement')) {
                const r = el.getBoundingClientRect()
                el.classList.toggle('dump-fold-hover', e.clientY >= r.top && e.clientY < r.bottom)
              }
            },
            mouseleave: (_e, v) => clearHover(v)
          }),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'Zrzut — lista rzeczy do zrobienia' }),
          // The textarea's tab width (CodeMirror defaults to 4).
          EditorState.tabSize.of(8),
          placeholderExt(p.current.placeholder),
          readOnlyRef.current.of(EditorState.readOnly.of(p.current.readOnly)),
          tags,
          focus,
          // A caret scrolled into view lands below the section bar, not under it.
          EditorView.scrollMargins.of(() => ({ top: bar.offsetHeight })),
          EditorView.updateListener.of((u) => {
            const echo = u.transactions.some((t) => t.annotation(fromHost))
            const caret = u.state.selection.main.head
            if (u.docChanged) {
              const text = u.state.doc.toString()
              headers = findDumpSectionHeaders(text)
              applied = u.state.field(focus).at
              if (!echo) p.current.onChange(text, caret)
            }
            if ((u.docChanged || u.selectionSet) && !echo) p.current.onSelectionChange(caret)
            if (u.docChanged) clearHover(u.view)
            if (u.docChanged || foldedRanges(u.startState) !== foldedRanges(u.state)) {
              const json = JSON.stringify([...foldedHeads(u.state)])
              if (json !== written) {
                written = json
                try { localStorage.setItem(FOLD_KEY, json) } catch { /* no storage = no persistence */ }
              }
            }
            if (u.docChanged || u.geometryChanged || u.viewportChanged) updateSticky(u.view)
          })
        ]
      })
    })
    viewRef.current = view
    view.dispatch({ effects: storedFolds(view.state) })
    const onScroll = () => {
      clearHover(view)
      updateSticky(view)
    }
    view.scrollDOM.addEventListener('scroll', onScroll, { passive: true })
    updateSticky(view)
    return () => {
      cancelAnimationFrame(pending)
      view.scrollDOM.removeEventListener('scroll', onScroll)
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: readOnlyRef.current.reconfigure(EditorState.readOnly.of(props.readOnly)) })
  }, [props.readOnly])

  // Project codes / colours arrive after the first render.
  useEffect(() => {
    viewRef.current?.dispatch({ effects: refresh.of(null) })
  }, [props.codes, props.tagColor])

  return (
    <>
      <div ref={hostRef} className="dump-cm" />
      <div ref={stickyRef} className="dump-sticky" aria-hidden="true">
        <div className="dump-sticky-bar"><div ref={labelRef} className="dump-hang dump-hang-header">{'\u200b'}</div></div>
      </div>
    </>
  )
})

export default DumpEditor
