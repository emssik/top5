# Task

## Goal
In the dump editor, the section the caret is in (from its `## X` header up to the next `## ` header) is shown at full contrast; every other line of the document is dimmed — still readable, but clearly secondary (like iA Writer's focus mode, per section). Dimming applies only in the main-window writer layout (`.dump-writer`); the clean view looks unchanged.

## Source
- none

## Files
- `src/shared/dump.ts` — new pure function next to `findDumpSectionHeaders`
- `src/renderer/components/DumpEditor.tsx` — line decorations marking lines outside the current section, recomputed when the doc or the selection changes
- `src/renderer/styles.css` — dimmed-line style, scoped to `.dump-writer`
- `tests/dump-tags.test.ts` — append tests for the new function

## Contract
- `dumpCurrentSection(text: string, pos: number): { from: number; to: number } | null` in `src/shared/dump.ts`
  - Headers are exactly the lines `findDumpSectionHeaders` returns (reuse it).
  - `from` = start of the last header at or before `pos`'s line; `to` = start of the next header line (exclusive), or `text.length` when there is none.
  - `pos` before the first header → the block from `0` to the first header's start.
  - No headers at all → `null` (nothing is dimmed).
  - `pos` is clamped to `[0, text.length]`.
- Editor: a CodeMirror line decoration with class `dump-dim` on every line whose start lies outside `[from, to)`; no decoration when the function returns `null`. Use the selection's `main.head` as `pos`. Recompute on doc change and on selection change only (not on scroll). Keep it in the existing editor setup (a `StateField` like the `tags` field is fine); no React state.
- CSS: `.dump-writer .dump-dim` lowers the line's contrast (e.g. reduced opacity) so it stays legible in light and dark theme. Tags inside dimmed lines dim along with the line. A short opacity transition is allowed, guarded by `prefers-reduced-motion: no-preference`.

## Examples
- text `## Now\n- a\n\n## Next\n- b\n`, pos 8 (inside `- a`) → `{ from: 0, to: 12 }`
- same text, pos 0 (on the `## Now` line) → `{ from: 0, to: 12 }`
- same text, pos 15 (inside `## Next`) → `{ from: 12, to: 24 }` (to = text.length)
- text `intro\n## Now\n- a`, pos 2 → `{ from: 0, to: 6 }`
- text `- a\n- b`, any pos → `null`
- text `## Now\n- a`, pos 999 → `{ from: 0, to: 10 }` (clamped)
- text `## Now\n- a\n##Next\n- b` (`##Next` is not a header) , pos 16 → `{ from: 0, to: 21 }`

## Data flow
- none (computed inside the editor from its own state; nothing passes through props, IPC or storage)

## Visual check
- Writer layout, dark theme, caret in `## Now` (first section): Now lines full contrast, `## Next` / `## Inbox` and their items dimmed — window ~1040×1100
- Same, light theme (`data-theme="light"` on `<html>`)
- Writer layout, dark theme, caret moved into `## Next`: Next full contrast, Now and Inbox dimmed
- Clean view dump (DumpView without `onToggleSidebar`): no dimming

## Done criteria
- [ ] `dumpCurrentSection` returns exactly the results in Examples
- [ ] In the writer layout only lines of the caret's section are full contrast; all other lines carry `dump-dim` and look dimmed but legible in both themes
- [ ] Moving the caret into another section (click or arrows) moves the highlight immediately
- [ ] No headers in the text → nothing dimmed
- [ ] Clean view unchanged
- [ ] Sticky section bar, hanging indents and tag colours still work
- [ ] `npm test`, `npm run test:api`, `npm run typecheck` green

## Required tests
- `dumpCurrentSection`: every case in Examples (incl. no headers, before first header, clamp, not-a-header `##X`)

## Allowed changes to existing tests
- `tests/dump-tags.test.ts` — append only

## New dependencies
- none

## Decisions
- D0: ~~caret-based~~ — SUPERSEDED by D2.
- D2 (Daniel, overrides D0 and the caret parts of Contract/Done criteria): the current section is the one SHOWN IN THE STICKY SECTION BAR at the top — i.e. the `current` header that `updateSticky` in `DumpEditor.tsx` already computes from scroll position. Scrolling so the next header takes over the bar makes that next section the active one. The caret does NOT matter. When no header has reached the bar yet (top of the document, bar hidden), the FIRST header's section is active. `dumpCurrentSection(text, header.start)` still gives the range — keep the function and its frozen tests. Recompute only when the active header changes (scroll, doc change, geometry change), not on every scroll event and not on selection change. Do not call `view.dispatch` synchronously inside the update listener (CodeMirror throws "Calls to EditorView.update are not allowed while an update is in progress") — defer it (e.g. requestAnimationFrame) or apply the class without a transaction. Visual check items that say "caret moved into ## Next" now mean "scrolled so ## Next is in the sticky bar".
- D1: lazy-senior — shortest working diff, reuse `findDumpSectionHeaders`, no new abstractions. Styles: load `good-css`, use existing CSS variables/opacity, no new colours.
