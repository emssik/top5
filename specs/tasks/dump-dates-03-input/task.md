# Task

## Goal
Easy date entry in the dump editor: typing ` @` opens a small date picker (like ` #` opens the project picker), and ⌘T opens it for the item under the caret. The user types `jutro`, `+2d`, `+1w`, `pt`, `20.10`, `2026-10-20`… and Enter writes an absolute `@YYYY-MM-DD` into the item's first line. Date tokens are highlighted in the editor; overdue ones look overdue. Docs describe the convention.

## Source
- none

## Files
- `src/renderer/components/DumpDatePicker.tsx` — new, modelled on `DumpProjectPicker.tsx`
- `src/renderer/components/DumpView.tsx` — inline ` @` trigger, ⌘T, picker state, placeholder help line
- `src/renderer/components/DumpEditor.tsx` — highlight date tokens
- `src/renderer/styles.css` — picker + date token styles
- `cli/top5-cli/SKILL.md` — "Zrzut (dump)" section: `@YYYY-MM-DD` convention
- `docs/API.md` — dump convention paragraph: `@YYYY-MM-DD` tokens

## Contract
Uses the existing helpers in `src/shared/dump-dates.ts`: `parseDumpDate(input, today)`, `dumpDateTrigger(text, caret)`, `setDumpItemDate(text, pos, date)`, `findDumpDates(text)`. Today = `logicalDateKey()`.

```ts
type DumpDatePickerProps = {
  query: string
  onQueryChange?: (query: string) => void   // set = ⌘T mode (own input); unset = inline ` @` mode
  onPick: (date: string) => void            // absolute 'YYYY-MM-DD'
  onClose: () => void
  onRemove?: () => void                     // ⌘T mode only: "Usuń datę"
}
```
Picker shows: the live parse of `query` (e.g. `jutro → pt 17.10` / `Nie rozumiem daty`), and quick options `jutro`, `+2d`, `+1w` (clickable, ↑/↓ + Enter like the project picker). Enter with a parseable query → that date; Enter with empty query → highlighted quick option; Esc closes.

Inline mode: the typed ` @query` text is replaced; the date is set on the item via `setDumpItemDate` (so an older date on the same line is replaced, the token lands at the end of the first line). ⌘T mode: `setDumpItemDate(text, caretPos, date)`; `Usuń datę` → `setDumpItemDate(…, null)`. Both go through `applyEdit` (save right away). Only one picker (project or date) open at a time.

## Examples
today = 2026-10-16:
- line `- Zadzwoń do Ani` + typing ` @jutro` + Enter → `- Zadzwoń do Ani @2026-10-17`
- line `- Zadzwoń @2026-10-17 #ATD`, caret on it, ⌘T, type `+1w`, Enter → `- Zadzwoń #ATD @2026-10-23`
- ⌘T on a dated item → `Usuń datę` → token removed
- ` @kiedyś` + Enter → nothing inserted, picker shows `Nie rozumiem daty`; Esc closes, text stays `… @kiedyś`
- ` @` inside an e-mail `ania@x.pl` (no space before `@`) → no picker
- ⌘T on a blank line or a `#` line → nothing happens
- editor: `@2026-10-17` rendered with a date style; `@2026-10-14` (before today) in an open line rendered with the overdue colour; done (`+ `) lines not marked overdue

## Data flow
- none

## Visual check
- Writer layout (main window, dump view), dark theme, ~1040 wide: inline picker open after ` @ju` showing `jutro → …` and quick options
- Same, light theme (`data-theme="light"` on `<html>`)
- Dark theme, ⌘T picker open on a dated item (own input + `Usuń datę`)
- Dark theme, editor with one future date token, one overdue token and one in a done line

## Done criteria
- [ ] ` @` after a space opens the inline date picker; Enter writes `@YYYY-MM-DD` into the item's first line, replacing any older date
- [ ] ⌘T opens the picker for the item under the caret; set / change / remove the date
- [ ] Unparseable input never writes anything; message `Nie rozumiem daty`
- [ ] Date tokens highlighted; overdue open items' tokens use the overdue colour
- [ ] Project picker still works (` #`, ⌘P); only one picker open at a time
- [ ] Placeholder help in DumpView lists `@jutro / ⌘T — data (pojawi się w „Dziś” dzień wcześniej)`
- [ ] `cli/top5-cli/SKILL.md` and `docs/API.md` describe `@YYYY-MM-DD` (first line of an item, absolute date, shown in the app's „Dziś” strip a day before and from that day until it lands in `## Now`, is done or deleted; don't remove or rewrite it when reorganizing)
- [ ] `npm run typecheck` and existing tests green

## Required tests
- none (UI wiring; parsing is covered by `tests/dump-dates.test.ts`) — screenshots are the check

## Allowed changes to existing tests
- none

## New dependencies
- none

## Decisions
- D1: lazy-senior — shortest working diff; reuse the project picker's structure and `.dump-picker*` classes where they fit; existing CSS variables, no new colours (overdue = the colour the app already uses for overdue badges). Load `good-css` before styles.
- D2: ⌘T must reach the editor in a packaged build too; if it does not arrive as a keydown, forward it from `src/main/shortcuts.ts` like ⌘R (`dump-repeat`) — then add that file to the change and say so in the report.
