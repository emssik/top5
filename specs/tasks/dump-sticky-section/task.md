# Task

## Goal
In the dump editor (DumpView), a bar pinned to the top of the editor shows the name of the `## ` section the user is currently scrolled into (Now / Next / Inbox / Done / any other `## X`). While the section's own header line is visible, no bar; once it scrolls above the top edge, the bar shows that section's name; scrolling into the next section switches the name.

## Files
- `src/shared/dump.ts` — new pure helper listing section header lines
- `src/renderer/components/DumpView.tsx` — mark header lines in the existing highlight layer, track scroll, render the bar
- `src/renderer/styles.css` — styles of the bar (and the header-line marker if needed)
- `tests/dump-tags.test.ts` — tests of the new helper (already in the `npm test` list; add tests at the end, do not change existing ones)

## Contract
```ts
// src/shared/dump.ts
export type DumpSectionHeader = { start: number; end: number; title: string } // [start,end) of the whole header line, without the "\n"
export function findDumpSectionHeaders(text: string): DumpSectionHeader[]
```
A section header line starts with exactly `## ` at column 0 (not `### `, not indented). `title` = text after `## `, trimmed. Lines with an empty title (`## ` alone) are not headers. Order = order in the text.

## Examples
- `findDumpSectionHeaders("## Now\n- a\n## Next\n")` → `[{ start: 0, end: 6, title: "Now" }, { start: 11, end: 18, title: "Next" }]`
- `findDumpSectionHeaders("- a\n### Pod\n  ## x\n# komentarz\n")` → `[]`
- `findDumpSectionHeaders("## Inbox  ")` → `[{ start: 0, end: 10, title: "Inbox" }]` (no trailing newline, title trimmed)
- `findDumpSectionHeaders("## \n##Now\n")` → `[]`
- `findDumpSectionHeaders("")` → `[]`

UI behaviour (editor scrolled so that its scrollTop is S):
- The "current section" = the last header line whose top is at or above the top of the visible text area (scrollTop + top padding). Measure positions on the highlight layer (it wraps lines exactly like the textarea): render each header line as its own inline element in the highlight layer and read its `offsetTop`. Wrapped long lines must not break the result — that is why measuring the highlight layer is required, not line counting.
- The bar is shown only when the current section's header line is at least partly above the visible top (i.e. scrolled out). At scrollTop 0, or while the visible top is above the first header, there is no bar.
- Bar text = the section title (e.g. `Next`), styled like a header of the dump (same monospace font as the editor), opaque background equal to the editor background, a subtle bottom border; it sits at the top inside `.dump-editor`, above both layers, full width minus the scrollbar gutter, and has `pointer-events: none` so clicks still reach the textarea.
- Recompute on: textarea scroll, text change, editor resize (ResizeObserver on the editor). No timers, no polling. Set React state only when the shown title actually changes (scroll fires often).

## Data flow
- none

## Done criteria
- [ ] `findDumpSectionHeaders` passes every example above as tests in `tests/dump-tags.test.ts`, run by `npm test`
- [ ] Existing tests (`npm test`, `npm run test:api`) and `npm run typecheck` stay green
- [ ] Header lines in the highlight layer are separate elements; the highlight layer text is still identical character-for-character to the textarea value (tags and caret alignment unchanged)
- [ ] Scrolling past `## Now` shows a bar `Now`; past `## Next` → `Next`; scrolling back to the top hides the bar; works with long wrapped lines
- [ ] Bar does not block clicks or text selection in the textarea (`pointer-events: none`), works in light and dark theme (uses existing CSS variables), and does not cover the scrollbar
- [ ] No timers / intervals added; state update only on title change

## Required tests
- Every `findDumpSectionHeaders` example from "Examples"

## Allowed changes to existing tests
- `tests/dump-tags.test.ts` — only appending new tests (and an import of the new helper) at the end; existing tests unchanged

## New dependencies
- none

## Decisions
<!-- planner's answers to the coder's questions: D1, D2, … -->
- D0: No main-process / IPC / HTTP changes. Do not touch save/merge/conflict logic.
- D1: Appending tests to `tests/dump-tags.test.ts` is allowed (option a); the gate block was a task-file omission.
