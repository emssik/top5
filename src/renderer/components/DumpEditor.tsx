import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Annotation, Compartment, EditorState, Prec, type Range, StateEffect, StateField, type Text, Transaction } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, isolateHistory } from '@codemirror/commands'
import { dumpLineHang, findDumpSectionHeaders, findDumpTags } from '../../shared/dump'

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
    const shift = kind === 'plain' ? Math.max(0, itemHang - hang) : 0
    if (kind !== 'plain' || hang || shift) ranges.push(Decoration.line({ class: `dump-hang dump-hang-${kind}`, attributes: { style: `--hang:${hang}ch;--shift:${shift}ch` } }).range(line.from))
  }
  for (const tag of findDumpTags(doc.toString(), codes)) {
    const color = tagColor(tag.code)
    ranges.push(Decoration.mark({ class: 'dump-tag', attributes: color ? { style: `color:${color}` } : undefined }).range(tag.start, tag.end))
  }
  return Decoration.set(ranges, true)
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

  useImperativeHandle(ref, () => ({
    selection: () => {
      const { from, to } = viewRef.current!.state.selection.main
      return { from, to }
    },
    hasFocus: () => !!viewRef.current?.hasFocus,
    focus: () => viewRef.current?.focus(),
    replace: (next, cursor) => {
      // Isolated: CodeMirror would otherwise merge it with typing / another command made within 500 ms.
      swap(next, { annotations: [fromHost.of(true), isolateHistory.of('full')], selection: { anchor: cursor, head: cursor }, scrollIntoView: true })
      viewRef.current?.focus()
    },
    load: (next, selection, forgetHistory) => {
      const view = viewRef.current
      if (view && forgetHistory) {
        view.dispatch({ effects: historyRef.current.reconfigure([]) })
        view.dispatch({ effects: historyRef.current.reconfigure(history()) })
      }
      const clamp = (n: number) => Math.min(n, next.length)
      swap(next, {
        annotations: [fromHost.of(true), Transaction.addToHistory.of(false)],
        selection: selection && { anchor: clamp(selection.from), head: clamp(selection.to) }
      })
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
            blur: () => void p.current.onBlur()
          })),
          // Also routes the Edit menu's Undo / Redo roles (native historyUndo / historyRedo) to this history.
          historyRef.current.of(history()),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'Zrzut — lista rzeczy do zrobienia' }),
          // The textarea's tab width (CodeMirror defaults to 4).
          EditorState.tabSize.of(8),
          placeholderExt(p.current.placeholder),
          readOnlyRef.current.of(EditorState.readOnly.of(p.current.readOnly)),
          tags,
          // A caret scrolled into view lands below the section bar, not under it.
          EditorView.scrollMargins.of(() => ({ top: bar.offsetHeight })),
          EditorView.updateListener.of((u) => {
            const echo = u.transactions.some((t) => t.annotation(fromHost))
            const caret = u.state.selection.main.head
            if (u.docChanged) {
              const text = u.state.doc.toString()
              headers = findDumpSectionHeaders(text)
              if (!echo) p.current.onChange(text, caret)
            }
            if ((u.docChanged || u.selectionSet) && !echo) p.current.onSelectionChange(caret)
            if (u.docChanged || u.geometryChanged || u.viewportChanged) updateSticky(u.view)
          })
        ]
      })
    })
    viewRef.current = view
    const onScroll = () => updateSticky(view)
    view.scrollDOM.addEventListener('scroll', onScroll, { passive: true })
    updateSticky(view)
    return () => {
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
