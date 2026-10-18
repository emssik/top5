# Task

## Goal
Dump items dated with `@YYYY-MM-DD` (helpers in `src/shared/dump-dates.ts`, already done) show up in the "Dziś" strip above the dump (`DumpTodayStrip`), the same way dated project tasks work in TodayView ("Due Tomorrow" preview the day before, proposal with accept on the day): due today or overdue → row with ✓ (move the item to `## Now`) and ✕ (reschedule popover); due tomorrow → preview row with ✕ (reschedule popover) only.

## Source
- none

## Files
- `src/renderer/components/DumpTodayStrip.tsx` — new rows, counts in the collapsed header, "seen" ids
- `src/renderer/components/DumpView.tsx` — passes the dated items and the two actions to the strip
- `src/renderer/styles.css` — only if a few rules are needed (prefer existing `.dump-strip-*`, `.proposal-btn`, `.due-date-dismiss-popover`, `.due-date-quick-btns`, `.tomorrow-badge` classes)

## Contract
New props of `DumpTodayStrip` (DumpView in clean view and main window both pass them):
```ts
type DumpTodayStripProps = {
  dated: DatedDumpItem[]                                     // datedDumpItems(text), memoised on the dump text
  onAcceptDated: (item: DatedDumpItem) => void               // → item moves to the end of `## Now`
  onRescheduleDated: (item: DatedDumpItem, date: string | null) => void  // null = remove the date
}
```
In DumpView both actions work on the CURRENT text (`textRef.current`), never on `item.pos` from an older render: find the item again in `datedDumpItems(textRef.current)` by `title` + `date`, then `applyEdit(moveDumpItems(…, pos, pos, 'Now'))` / `applyEdit(setDumpItemDate(…, pos, date))`. Not found → do nothing. `moveDumpItems` returns null when there is no `## Now` section → `setError('Brak sekcji ## Now w zrzucie.')`.

"Today" = `logicalDateKey()` from `src/shared/schedule.ts` (day rolls over at 06:00); tomorrow = `parseDumpDate('jutro', today)`.

## Examples
today = 2026-10-16, strip expanded, dump text:
`## Now\n- A @2026-10-16\n## Inbox\n- B @2026-10-14 #ATD\n- C @2026-10-16\n- D @2026-10-17\n- E @2026-10-20\n## Done\n+ 2026-10-15 F @2026-10-16`
- rows due today/overdue, in this order: `B` with badge `zaległe 2d` and ✓ ✕; `C` with ✓ ✕ (no badge). `A` (already in Now), `F` (done) and `E` (later) are not shown.
- tomorrow row: `D` with badge `jutro` and ✕ only.
- ✓ on `C` → line `- C @2026-10-16` moves to the end of `## Now` (date stays in the line), saved; `C` disappears from the strip.
- ✕ on `B` → popover with `+1d +2d +3d +1w`, a date input and `Usuń datę`; `+2d` → line becomes `- B #ATD @2026-10-18` (counted from today, like TodayView's addDays), `Usuń datę` → `- B #ATD`. Popover closes on choice, outside click and Esc.
- collapsed header: `↻ 2 dziś · 📅 2` (📅 = due today + overdue count; the `📅 N` part is hidden when N = 0); dated rows count toward `N nowe` with ids `d:<date>:<title>`.
- no dated items at all → strip looks exactly as before.

## Data flow
- `dated` — computed in `src/renderer/components/DumpView.tsx` (`datedDumpItems` on the dump text), passed as a prop, read in `src/renderer/components/DumpTodayStrip.tsx`
- `onAcceptDated` / `onRescheduleDated` — defined in `src/renderer/components/DumpView.tsx`, called from `src/renderer/components/DumpTodayStrip.tsx`, write via `applyEdit` (text + save) in `src/renderer/components/DumpView.tsx`

## Visual check
- Writer layout (main window, dump view), dark theme, window ~1040 wide: strip expanded with the Examples dump — overdue row with `zaległe 2d`, today row, tomorrow row with `jutro`
- Same, light theme (`data-theme="light"` on `<html>`)
- Dark theme, the ✕ reschedule popover open on the overdue row (not clipped by the strip or editor)
- Dark theme, strip collapsed: header with `↻ … dziś · 📅 2`

## Done criteria
- [ ] Today/overdue dated items (outside `## Now`, not done) show with ✓ and ✕; overdue ones with `zaległe Nd`
- [ ] Items dated tomorrow show as a `jutro` preview with ✕ only
- [ ] ✓ moves the item to the end of `## Now` and saves; the row disappears
- [ ] ✕ popover: +1d/+2d/+3d/+1w (from today), date input, `Usuń datę`; each rewrites the item's `@date` and saves
- [ ] Actions use the current text (re-find by title + date), never a stale `pos`
- [ ] Collapsed header shows `📅 N` only when N > 0; dated rows count as new until the strip is expanded
- [ ] Missing `## Now` → error message, text unchanged
- [ ] `npm run typecheck` and existing tests green

## Required tests
- none (UI wiring; the text logic is covered by `tests/dump-dates.test.ts`) — the screenshots above are the check

## Allowed changes to existing tests
- none

## New dependencies
- none

## Decisions
- D1: lazy-senior — shortest working diff, no new components unless the popover clearly needs one; reuse existing classes and CSS variables, no new colours. Load `good-css` before touching styles.
- D2: Daniel's rule: a dated item leaves the strip only when it lands in `## Now`, is done (⌘D) or deleted, or its date changes. Moving it to another section (Next/Inbox) keeps it in the strip.
