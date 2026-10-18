# Task

## Goal
Changing an existing `@YYYY-MM-DD` date in the dump must be easy and must work from the keyboard. Today, three things go wrong:
(1) In the date picker, Enter ignores the row picked with ↑/↓ whenever the typed query parses: `@2026-10-17` + ↓ to `+2d` + Enter writes 17 again.
(2) `+2d` / `+1w` are counted from today even when the user is shifting an existing date. They should be counted from that date (17 + 2d = 19).
(3) The picker opens only after typing. It should also open by itself when the caret is placed inside an existing date token.

## Source
- none

## Files
- `src/shared/dump-dates.ts` — `parseDumpDate` optional base date; new `dumpDateAt`
- `tests/dump-dates.test.ts` — new tests appended
- `src/renderer/components/DumpDatePicker.tsx` — one selectable list, base-relative options, Tab navigation, token mode
- `src/renderer/components/DumpView.tsx` — auto-open on caret inside a token, pick replaces that token
- `src/renderer/styles.css` — only if the hint line needs a rule

## Contract
```ts
// `base` (YYYY-MM-DD) shifts only the relative forms `+Nd` / `+Nw`; everything else stays relative to `today`.
export function parseDumpDate(input: string, today: string, base?: string): string | null
// The date token (as findDumpDates returns it) containing `pos`: start < pos < end. null otherwise.
export function dumpDateAt(text: string, pos: number): DumpDateToken | null
```

The `DumpDatePicker` props gain:
- `base?: string`: the date being edited.
- `mode: 'inline' | 'item' | 'token'`. This replaces the `onQueryChange`-presence check; `onQueryChange` stays for `item`.

**Picker list.** The rows form one list with a single highlight:
1. The parsed row (`<query> → <label>`), shown only when the query is non-empty and parses.
2. The options below it.

Highlight rules:
- The highlight starts on row 0 and resets to row 0 whenever the query changes.
- Enter picks the highlighted row. A click picks the clicked row.
- If no row exists, Enter does nothing.
- `Nie rozumiem daty` is shown when the query is non-empty, does not parse and no word matches.
- The word-prefix completion (`ju` → `jutro`) stays as it is now.

**Options.**
- With `base`: `jutro`, `+1d`, `+2d`, `+1w`. The `+` options are counted from `base`.
- Without `base`: `jutro`, `+2d`, `+1w`, counted from today, as now.
- Every label shows the resulting date.

**Keys.**
- Tab / Shift+Tab move the highlight in every mode.
- ↑/↓ move the highlight in `inline` and `item` modes.
- In `token` mode ↑/↓ are not captured: the caret moves, leaves the token, and the picker closes.
- Esc closes the picker in every mode.
- In `token` mode the picker shows the hint `Tab — wybór · Enter — zmień · Esc`.

**Token mode (DumpView).**
- Opens when, after a selection change or a click, all of these hold:
  - the selection is empty;
  - `dumpDateAt(text, caret)` returns a token;
  - no picker is open;
  - the token was not dismissed.
- The picker does not take focus; the editor keeps it.
- `base` is the token's date.
- Picking calls `setDumpItemDate(text, caret, date)`. The token is replaced and lands at the end of the first line.
- Esc, or a pick, dismisses that token: it does not reopen until the caret has been outside that token at least once.
- Typing inside the token changes the text, which hands over to the existing inline (` @query`) behaviour.

**⌘T on a dated item.** `base` is the item's current date.

**Inline pick.** The whole `@word` around the caret is replaced: from the space before `@` to the first whitespace or the end of the line. Text after the caret, such as a leftover `7`, does not survive.

## Examples
today = 2026-10-16 (Friday):
- `parseDumpDate('+2d', '2026-10-16', '2026-10-17')` → `'2026-10-19'`
- `parseDumpDate('+1w', '2026-10-16', '2026-10-17')` → `'2026-10-24'`
- `parseDumpDate('jutro', '2026-10-16', '2026-10-17')` → `'2026-10-17'` (`jutro` is always counted from today)
- `parseDumpDate('pt', '2026-10-16', '2026-10-30')` → `'2026-10-23'`
- `parseDumpDate('+2d', '2026-10-16')` → `'2026-10-18'` (unchanged without a base)
- `dumpDateAt('- a @2026-10-17', 8)` → `{ start: 4, end: 15, date: '2026-10-17' }`
- `dumpDateAt('- a @2026-10-17', 4)` → `null` (caret before `@`)
- `dumpDateAt('- a @2026-10-17', 15)` → `null` (caret at the token's end)
- `dumpDateAt('- a @2026-10-1', 8)` → `null` (not a valid token)
- UI: line `- Wpłata @2026-10-17`, user clicks inside `10`. The picker opens with `jutro sob 17.10`, `+1d nd 18.10`, `+2d pon 19.10`, `+1w sob 24.10`. Tab Tab Enter gives `- Wpłata @2026-10-19`.
- UI: same line, caret inside the token, Esc. The picker closes and does not reopen while the caret moves within the token. After the caret leaves and comes back, it opens again.
- UI: line `- Wpłata @2026-10-17`, caret at the end. The user deletes `7`, types `7`, presses ↓ ↓ (to `+2d`), then Enter. The result is a date ≠ 17: `+2d` counted from today, `2026-10-18`, because inline typing has no base. The typed row is not picked.
- UI: line `- Wpłata @2026-10-1|7` (caret before `7`) in inline mode, user picks `jutro` → `- Wpłata @2026-10-17`, with no leftover `7`.
- UI: ⌘T on `- Wpłata @2026-10-17`, `+2d` row → `@2026-10-19`.
- UI: caret at the end of a dated line, Enter → a new line, as before; token mode does not open at the token's end.

## Data flow
- `base` — taken from the token under the caret (`dumpDateAt`) or the item's date (⌘T) in `src/renderer/components/DumpView.tsx`, passed as a prop, used in `src/renderer/components/DumpDatePicker.tsx` with `parseDumpDate` from `src/shared/dump-dates.ts`

## Visual check
- Writer layout (main window, dump view), dark theme, ~1040 wide: token-mode picker open on `- Wpłata @2026-10-17`, caret inside the token. Rows `jutro / +1d / +2d / +1w` with labels from 17.10, the hint line visible, `+2d` highlighted.
- The same in the light theme (`data-theme="light"` on `<html>`).
- Dark theme, inline mode: `@2026-10-17` typed. The parsed row is first and `+2d` is highlighted below it via ↓.

## Done criteria
- [ ] `parseDumpDate` with `base` shifts only `+Nd` / `+Nw`; without `base` it behaves as before (existing tests unchanged and green)
- [ ] `dumpDateAt` matches the Examples
- [ ] Enter always picks the highlighted row; ↓ to an option and Enter writes that option's date even when the query parses
- [ ] With a base, the options are `jutro / +1d / +2d / +1w`, with `+` counted from the base, and the labels show the result
- [ ] The caret placed strictly inside a valid token opens the picker without taking focus; Tab moves the highlight, Enter changes the date, Esc dismisses until the caret leaves the token
- [ ] In token mode ↑/↓ and Enter at the end of a line behave as normal editor keys
- [ ] An inline pick replaces the whole `@word` and leaves no leftover characters
- [ ] `npm run typecheck` and `npm test` green

## Required tests
- `parseDumpDate` with `base`: `+Nd`, `+Nw`, `jutro`, weekday, a `D.M` form, and the month/year rollover from the base (`'+2d'`, base `'2026-12-31'` → `'2027-01-02'`)
- `dumpDateAt`: inside, at start, at end, invalid token, a token on a later line, a token on a `#` line → null

## Allowed changes to existing tests
- `tests/dump-dates.test.ts` — append only

## New dependencies
- none

## Decisions
- D1: Lazy senior: write the shortest diff that works. Keep the existing picker structure and the `.dump-picker*` classes, and add no new colours. Load `good-css` before touching styles.
- D2: Daniel asked for `+2d` while changing a date to mean 17 → 19. The base applies only where a date is being edited (token mode, ⌘T). It does not apply to typed inline queries.
- D3: Token mode opens only when the caret is strictly inside the token, never at its end. Enter at the end of a dated line must keep making a new line.
