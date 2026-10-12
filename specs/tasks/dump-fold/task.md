# Task

## Goal
In the "Zrzut" editor (CodeMirror) an item with notes / sub-points under it can be folded, so only its first line shows; unfolding brings the rest back. Folds survive an app restart.

## Source
- none

## Files
- `src/shared/dump.ts` — new pure function `dumpFoldEnd`
- `src/renderer/components/DumpEditor.tsx` — fold extension (fold service, gutter marker, keymap, placeholder), persistence of folded items
- `src/renderer/styles.css` — fold marker + placeholder styles
- `package.json`, `package-lock.json` — `@codemirror/language` as a direct dependency
- `tests/dump-tags.test.ts` — append tests for `dumpFoldEnd`

## Contract
```ts
// src/shared/dump.ts
// i = 0-based line index; line(n) returns line n's text, or null past the end of the doc.
// Returns the index of the last line folded under item head i, or null when line i can't be folded.
export function dumpFoldEnd(line: (n: number) => string | null, i: number): number | null
```
Foldable = line i is an item head (`- ` or `+ ` after optional leading whitespace) and at least one continuation line follows it directly. Continuation = the same rule as the existing private `isContinuation` in `src/shared/dump.ts` (non-blank, not starting with `#`, not an item `- ` / `+ `) — reuse it, don't duplicate it. The fold covers all consecutive continuation lines (plain notes and `* ` sub-points).

Editor (DumpEditor.tsx), built on `@codemirror/language` (`foldService`, `foldGutter`, `foldKeymap`, `codeFolding`, `foldEffect` / `unfoldEffect` / `foldedRanges`):
- Folded range in the doc = from the end of the head line to the end of the last continuation line (the head line stays fully visible, including its text after the bullet).
- Placeholder after the head line's text: ` ⋯ N` where N = number of hidden lines; clicking it unfolds (CodeMirror default behaviour of the placeholder).
- Mouse: a fold marker (▸ folded / ▾ unfolded) left of foldable lines; unfolded markers appear only on line hover, folded ones are always visible. Non-foldable lines show no marker. The text column must not shift compared to now (the gutter fits into the existing left padding).
- Keyboard: CodeMirror's `foldKeymap` (on macOS ⌘⌥[ fold, ⌘⌥] unfold, ⌃⌥[ fold all, ⌃⌥] unfold all). DumpView's onKeyDown ignores ⌘ with ⌥, so no conflict.
- Persistence: `localStorage` key `top5.dump.folded` = JSON array of the trimmed texts of the head lines of all currently folded items. Rewritten (only when the set changed) after every update where folds or the doc changed. Read when the editor is created and after `load()` (external text): every foldable head line whose trimmed text is in the set gets folded. Every localStorage access wrapped in try/catch (no storage = no persistence, editor works).

## Examples
Lines (index: text):
- `0:"- Ogarnąć chrzciny"`, `1:"  * zaświadczenie"`, `2:"  * spotkanie 5.11"`, `3:""` → `dumpFoldEnd(line, 0)` = `2`
- `0:"- aplikacja do serwerów"`, `1:"  potencjalne problemy"`, `2:"  face"`, `3:"- Zadzwonić"` → `dumpFoldEnd(line, 0)` = `2`
- `0:"- Zadzwonić"`, `1:"- UODO"` → `dumpFoldEnd(line, 0)` = `null` (no continuation)
- `0:"- Zadzwonić"` (last line of doc) → `null`
- `0:"+ 2026-10-01 zrobione"`, `1:"  * notatka"` → `0` is foldable, result `1`
- `0:"    - wcięty"`, `1:"      * pod"` → `1`
- `0:"- x"`, `1:"  * a"`, `2:"## Next"` → `1` (header ends the item)
- `0:"- x"`, `1:"  * a"`, `2:"# komentarz"` → `1`
- `0:"## Now"`, `1:"- x"` → `dumpFoldEnd(line, 0)` = `null` (header isn't an item)
- `0:"- x"`, `1:"  * a"` → `dumpFoldEnd(line, 1)` = `null` (a continuation line isn't a head)
- `0:"luźny tekst"`, `1:"dalszy"` → `dumpFoldEnd(line, 0)` = `null`
- i past the end → `null`

## Data flow
- `top5.dump.folded` (localStorage) — written in `DumpEditor.tsx` (update listener, from `foldedRanges` + head lines), read in `DumpEditor.tsx` on editor creation and in the handle's `load()`.

## Visual check
- Writer layout (dump view), dark theme, window ~1040 wide: one item with 3 `* ` sub-points folded (head line + ` ⋯ 3` placeholder visible, sub-points hidden, ▸ marker visible), another foldable item unfolded with the mouse hovering its line (▾ marker visible)
- Same, light theme (`data-theme="light"` on `<html>`)
- Same doc fully unfolded, no hover: text column at the same x position as before the change (no markers visible, no layout shift)

## Done criteria
- [ ] `dumpFoldEnd` returns the results from Examples
- [ ] `@codemirror/language` is listed in `package.json` dependencies (same major as the installed 6.x, no other new packages)
- [ ] An item with continuation lines can be folded and unfolded with the marker and with ⌘⌥[ / ⌘⌥]; a folded item shows ` ⋯ N`, clicking it unfolds
- [ ] Lines without continuation (single items, headers, notes themselves) are not foldable
- [ ] Folded items are folded again after the editor is recreated (app restart) and after an external `load()`, matched by trimmed head-line text
- [ ] Missing / throwing localStorage does not break the editor
- [ ] Typecheck and existing tests green; text column does not shift (screenshot)

## Required tests
- `dumpFoldEnd`: every case from Examples (behaviour through the public function, with a `line` getter built from a string array)

## Allowed changes to existing tests
- `tests/dump-tags.test.ts` — append only

## New dependencies
- `@codemirror/language` — already installed (6.13.1, transitive dependency of `@codemirror/commands`); add it to `package.json` dependencies only

## Decisions
<!-- planner's answers to the coder's questions: D1, D2, … -->
