# Task

## Goal
Trial (branch `feat/dump-codemirror`): replace the dump editor in `DumpView` — today a transparent `<textarea>` over a highlight `<div>` — with a CodeMirror 6 editor, keeping every existing behaviour, and add iA-Writer-style hanging indents: wrapped lines of a list item continue under the text after `- ` / `+ `, and the `## ` of a section header hangs in the left margin so the header text lines up with the item bullets.

## Files
- `package.json`, `package-lock.json` — add the three `@codemirror/*` packages (see New dependencies)
- `src/shared/dump.ts` — new pure helper `dumpLineHang`
- `src/renderer/components/DumpEditor.tsx` — NEW: the CodeMirror wrapper (all CodeMirror code lives here)
- `src/renderer/components/DumpView.tsx` — use `DumpEditor` instead of the textarea, highlight layer and the DOM-measured sticky bar; all logic (load / save chain / merge / conflict / ⌘ commands / picker / mail) stays here and keeps its behaviour
- `src/renderer/styles.css` — editor styles (replace `.dump-layer`, `.dump-highlight`, `.dump-textarea` rules that become dead; keep the writer and clean-view looks)
- `tests/dump-tags.test.ts` — tests of `dumpLineHang` appended at the end

## Contract
```ts
// src/shared/dump.ts — wrap alignment of one line, in characters
export type DumpLineHang = { kind: 'header' | 'item' | 'plain'; hang: number }
export function dumpLineHang(line: string): DumpLineHang

// src/renderer/components/DumpEditor.tsx
export type DumpEditorHandle = {
  selection(): { from: number; to: number }          // like selectionStart / selectionEnd
  hasFocus(): boolean
  focus(): void
  replace(next: string, cursor: number): void       // one undoable edit (minimal changed range), caret → cursor
  load(next: string, selection?: { from: number; to: number }): void // external text (file load / merge); not undoable
}
export type DumpEditorProps = {
  value: string; readOnly: boolean; placeholder: string
  codes: string[]; tagColor: (code: string) => string | undefined
  onChange: (value: string, caret: number) => void  // user edits only (not replace/load)
  onSelectionChange: (caret: number) => void
  onKeyDown: (e: KeyboardEvent) => boolean          // true = handled (editor stops default)
  onBlur: () => void
}
```

Default export of `DumpEditor.tsx`: `forwardRef<DumpEditorHandle, DumpEditorProps>`.

## Examples
`dumpLineHang` — `hang` = number of characters a wrapped continuation line is indented by (item), or how many characters hang into the left margin (header):
- `"## Now"` → `{ kind: "header", hang: 3 }`
- `"## "` → `{ kind: "plain", hang: 0 }` (same header rule as `findDumpSectionHeaders`: non-empty title)
- `"### Pod"` → `{ kind: "plain", hang: 0 }`
- `"- dokumenty dla Ani"` → `{ kind: "item", hang: 2 }`
- `"+ ↻ zrobione"` → `{ kind: "item", hang: 2 }`
- `"  - podpunkt"` → `{ kind: "item", hang: 4 }`
- `"  detal pod punktem"` → `{ kind: "plain", hang: 2 }` (continuation text keeps its own indent when wrapped)
- `"# komentarz"` → `{ kind: "plain", hang: 0 }`
- `"zwykły tekst"` → `{ kind: "plain", hang: 0 }`; `""` → `{ kind: "plain", hang: 0 }`
- `"-bez spacji"` → `{ kind: "plain", hang: 0 }`

Editor behaviour (each must keep working exactly as today, unless stated):
- Typing → `onChange` → debounced save (500 ms) through the existing mtime-guarded save chain; blur → save; readOnly until the file is loaded; placeholder text unchanged.
- ⌘D, ⌘1/⌘2/⌘3 (arrive via IPC `select-project` while the editor has focus), ⌘F, ⌘P, ⌘R (arrives via IPC `dump-repeat`): same results as today. NEW: they go through `replace`, so ⌘Z undoes them (today it does not).
- ` #` mid-line opens the inline project picker (same `projectTagTrigger` rules); moving the caret away closes it; Enter/Tab inserts `#CODE `; Esc closes; ⌘Z undoes the insertion.
- `#KOD` tags of known projects are coloured with `tagColor` (same look as today: project colour + 15% tinted background).
- External reload / 409 merge (`load`): text replaced, caret kept as today's `mergeExternal` computes it; this must not create an undo step and must not trigger `onChange`.
- Section header lines (`kind: header`) are bold in the writer layout, as today.
- Sticky section bar: same behaviour the user approved today — shows the full `## X` line exactly over the header's position at the top, fades out (label only, background opaque and clipped just above the next header) as the next header comes up, so two headers never stack; the caret never hides under the bar (scroll margin); long headers wrap in the bar as in the text. Implement it with CodeMirror's geometry (line blocks / coordinates), no React state per scroll event.
- Hanging indent: item lines — first line starts at the line's start, wrapped lines start `hang` characters in; header lines — the `## ` sits in the left margin and the header text starts at the text column (where item bullets start). Plain lines with leading spaces wrap at their indent.
- Clean view (no `onToggleSidebar`) keeps today's look (13px mono on the card); the writer layout (main window) keeps today's look (centered 680px column, 16px mono, line-height 1.85, transparent background, scrollbar at the window edge, 40vh bottom space).
- Electron's app menu has Edit → Undo/Redo roles (`src/main/index.ts:219`): ⌘Z / ⇧⌘Z in the editor must undo/redo the editor's own history (not a no-op, not the browser's native undo of the hidden DOM).

## Data flow
- `value` — React state `text` in `DumpView` → `DumpEditor` prop; user edits come back via `onChange` → `applyText` (sets `textRef`, `dirtyRef`, schedules save). Programmatic edits (`applyEdit`, picker, ⌘R, ⌘F move) go through `handle.replace` and then `applyText` + `save()` directly, NOT through `onChange`. External text (`load`, `mergeExternal`, `reloadFromFile`) goes through `handle.load`. `DumpEditor` must not re-dispatch a `value` prop it already holds (no feedback loop, no caret jump while typing).
- caret/selection — read via `handle.selection()` wherever `el.selectionStart/End` is read today (⌘ commands, picker trigger, merge caret shift).

## Done criteria
- [ ] `dumpLineHang` passes every example as tests appended to `tests/dump-tags.test.ts`, run by `npm test`
- [ ] Existing tests (`npm test`, `npm run test:api`), `npm run typecheck` and `npm run build` stay green
- [ ] No `<textarea>`, `.dump-highlight` layer or `document.execCommand` left in the dump; all CodeMirror imports only in `DumpEditor.tsx`
- [ ] All behaviours listed in Examples implemented; ⌘Z/⇧⌘Z undo/redo typing, ⌘D, ⌘1–3, picker insert, ⌘P, ⌘R line change
- [ ] Hanging indent for items and headers as described, via CodeMirror line decorations driven by `dumpLineHang`
- [ ] Save/merge/conflict code paths in `DumpView` unchanged in behaviour (only `el.*` reads/writes swapped for the handle)
- [ ] No per-second timers; no React state update per scroll event
- [ ] A short report of anything that could not be kept identical, with the reason

## Required tests
- Every `dumpLineHang` example
- The editor is UI-only — no automated UI test required, but describe in the report how you checked the hanging indent and the sticky bar (e.g. a headless Chromium screenshot of the built renderer CSS)

## Allowed changes to existing tests
- `tests/dump-tags.test.ts` — only appending new tests (and an import of the new helper) at the end; existing tests unchanged

## New dependencies
- `@codemirror/state`, `@codemirror/view`, `@codemirror/commands` (current 6.x versions) — editor core, decorations, history/undo keymap; nothing else (no language packages, no `codemirror` meta package, no React wrapper library)

## Decisions
<!-- planner's answers to the coder's questions: D1, D2, … -->
- D0: Renderer only. No main-process, IPC or HTTP API changes. Do not change save/merge/conflict semantics.
- D0b: Work stays on branch `feat/dump-codemirror`; do not commit.
- D0c: Lazy-senior rule: shortest working diff, no abstractions beyond `DumpEditor`; CSS through the `good-css` skill.
