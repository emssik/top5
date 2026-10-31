# Task

## Goal
In the dump ("Zrzut") editor, absolute file paths are underlined like links. While Cmd is held the mouse cursor over a path is a pointer, and Cmd+click on a path asks main to open it (`window.api.openDumpPath`). A plain click only places the caret, as before. A path wrapped visually onto two rows works the same on both rows.

## Source
- `specs/board-F003-sciezki-w-zrzucie-jako-linki.plan.md — Step 4` (Decisions 3 and 4 of the plan describe the click hit-test and the Cmd cursor)

## Files
- `src/renderer/components/DumpEditor.tsx` — decoration in `decorate()`, `mousedown` in the existing `Prec.highest(EditorView.domEventHandlers(…))`, Cmd class toggling
- `src/renderer/styles.css` — `.dump-path` underline and the Cmd pointer rule, next to `.dump-tag`

## Contract
- Uses existing `findDumpPaths(text)` from `src/shared/dump.ts` (returns `{ start, end, path }[]`, offsets in the whole text) and existing `window.api.openDumpPath(path: string): Promise<void>`. No new exported names.
- `decorate()`: every path from `findDumpPaths` gets `Decoration.mark({ class: 'dump-path' })` over `start..end` (overlap with tag/date marks is fine).
- `mousedown` handler (in the existing `Prec.highest` handlers): acts only when `e.metaKey` and `e.button === 0` and the target is inside a `.dump-path` element (`closest('.dump-path')`). Then it finds the path whose range contains the DOM position of that element (via `view.posAtDOM`, the logical line, and `findDumpPaths` on the line text), calls `e.preventDefault()`, `void window.api.openDumpPath(path)` and returns `true`. In every other case it returns `false` so CodeMirror handles the click normally. Do NOT use `posAtCoords` alone (it maps a click past the line end to the nearest char). Works in read-only mode too.
- Cmd cursor: the class `dump-cmd` on the host element (`host`, the `.dump-cm` div) mirrors `e.metaKey` — toggled in the existing `mousemove` handler and in `keydown`/`keyup` listeners on `window`; a `window` `blur` removes it. All `window` listeners are removed in the effect's cleanup.
- CSS: `.dump-path` — underline (`text-decoration-line: underline`, a muted colour derived from `currentColor`, small `text-underline-offset`); `.dump-cm.dump-cmd .dump-path { cursor: pointer }`. No `:hover` style, no animation. Follow the `good-css` skill.
- Lazy-senior rule: smallest working diff, no new abstractions, no new dependencies, no new files. Do not change `webPreferences.sandbox`.

## Examples
- text `- zobacz /Users/x/a.md` → the editor DOM has a `.dump-path` element with text `/Users/x/a.md`
- text `# /Users/x/a.md` → no `.dump-path` element
- text `otwórz "/Users/x/My Doc.md"` → `.dump-path` text is `/Users/x/My Doc.md` (quotes not underlined)
- Cmd+left click on the underlined path → `window.api.openDumpPath('/Users/x/a.md')` once, caret/selection unchanged
- plain left click on the path → no `openDumpPath` call, caret moves as before
- Cmd+right click, or Cmd+click on plain text / past the end of the line → no `openDumpPath` call
- holding Cmd over the editor → host has class `dump-cmd`; releasing Cmd or window blur → class gone

## Data flow
- path text — produced by `findDumpPaths` (`src/shared/dump.ts`), rendered as `.dump-path` marks in `decorate()`, read back on click in the `mousedown` handler, sent through `window.api.openDumpPath` (preload) to main `open-dump-path` (already done).

## Visual check
- none

## Done criteria
- [ ] Paths found by `findDumpPaths` are rendered inside `.dump-path` marks; `#` lines get none.
- [ ] The `mousedown` handler matches the contract: it calls `window.api.openDumpPath` only for Cmd + left button inside a `.dump-path` element, and returns `false` otherwise.
- [ ] `dump-cmd` class toggling as in the contract; `window` listeners removed in cleanup.
- [ ] CSS rules for `.dump-path` and `.dump-cm.dump-cmd .dump-path` exist in `src/renderer/styles.css`.
- [ ] `npm run typecheck` and `npm run build` pass; existing tests stay green.

## Required tests
- none — the project has no renderer test setup (vitest covers `tests/api` and `tests/main` only); the click and decoration behaviour is checked by reading the code against the contract and by a live run of the app after this task.

## Allowed changes to existing tests
- none

## New dependencies
- none

## Decisions
