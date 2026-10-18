# Task

## Goal
Pure text helpers for dates in the dump ("Zrzut", `dump.md`): an item can carry a date as `@YYYY-MM-DD` on its first line. Parse what the user types (`jutro`, `+2d`, `+1w`, `pt`, `20.10`…) into an absolute date, find date tokens, set/remove an item's date, and list open dated items. No UI in this task.

## Source
- none

## Files
- `src/shared/dump-dates.ts` — new module with the functions below
- `src/shared/dump.ts` — may export existing private helpers (`itemRange`, `openItemTitle`, `sectionBounds`, `lineAt`, `cursorAt`, `isOpen`, `isDone`) for reuse; `stripDumpTags` and the internal `matchKey` also drop date tokens (see Examples)
- `tests/dump-dates.test.ts` — new tests
- `package.json` — add `.tmp-tests/tests/dump-dates.test.js` to the `test` script list

## Contract
```ts
// All dates are 'YYYY-MM-DD' strings. `today` = logical today (caller passes logicalDateKey()).
export function parseDumpDate(input: string, today: string): string | null
export type DumpDateToken = { start: number; end: number; date: string }
export function findDumpDates(text: string): DumpDateToken[]
export function dumpDateTrigger(text: string, caret: number): { start: number; query: string } | null
export function setDumpItemDate(text: string, pos: number, date: string | null): { text: string; cursor: number } | null
export type DatedDumpItem = { pos: number; title: string; date: string }
export function datedDumpItems(text: string): DatedDumpItem[]
```

Token format in text: `@YYYY-MM-DD`, preceded by a space or tab (never at line start), followed by whitespace or end of line. Lines whose trimmed text starts with `#` (comments/headers) never carry dates. Only the item's first line counts.

`parseDumpDate` — input is trimmed and case-insensitive; forms:
- `dziś` / `dzis` → today; `jutro` → +1; `pojutrze` → +2
- `+Nd` → +N days, `+Nw` → +N weeks (N ≥ 1 integer)
- weekday `pon wt śr sr czw pt sob nd` → the NEXT such day strictly after today (same weekday → +7)
- `D.M` → that day this year; if it is before today → next year. `D.M.YYYY` → exact. `YYYY-MM-DD` → exact.
- an impossible date (`31.02`, `2026-13-01`) or anything else → `null`

`setDumpItemDate` — `pos` anywhere inside an item (incl. continuation lines, like `setDumpItemTag` in `src/shared/dump.ts`). Removes every date token from the item's first line, then (when `date` is not null) appends ` @date` at the end of that line (trailing spaces trimmed). Returns null when `pos` is on a blank line or a `#` line. Cursor: same rule as `setDumpItemTag` (a caret behind the end of the first line shifts by the length change, otherwise stays, clamped to the new line end).

`datedDumpItems` — open items only (`- x` heads and plain-text heads, as `openItemTitle` in dump.ts sees them), first date token on their first line, skipping items inside `## Now` (section header match as in `sectionBounds`, case-insensitive). `pos` = offset of the item's first line start. `title` = first line without the leading `- ` and without date tokens, whitespace collapsed at the removal, trimmed; project tags stay. Sorted by date, then by text order.

`dumpDateTrigger` — caret right behind ` @query` (space/tab before `@`, query = zero or more of letters, digits, `+`, `.`, `-`) on a line not starting with `#` → `{ start: index of '@', query }`; otherwise null.

## Examples
today = `2026-10-16` (a Friday) in all `parseDumpDate` rows:
- `parseDumpDate('jutro', today)` → `'2026-10-17'`; `'Jutro '` → `'2026-10-17'`; `'dziś'` → `'2026-10-16'`; `'pojutrze'` → `'2026-10-18'`
- `'+2d'` → `'2026-10-18'`; `'+1w'` → `'2026-10-23'`; `'+0d'` → `null`; `'+2x'` → `null`
- `'pon'` → `'2026-10-19'`; `'pt'` → `'2026-10-23'`; `'śr'` and `'sr'` → `'2026-10-21'`; `'nd'` → `'2026-10-18'`
- `'20.10'` → `'2026-10-20'`; `'1.3'` → `'2027-03-01'`; `'16.10'` → `'2026-10-16'`; `'20.10.2027'` → `'2027-10-20'`; `'2026-12-01'` → `'2026-12-01'`
- `'31.02'` → `null`; `'2026-13-01'` → `null`; `'kiedyś'` → `null`; `''` → `null`
- month/year rollover: `parseDumpDate('jutro', '2026-12-31')` → `'2027-01-01'`
- `findDumpDates('- Zadzwoń @2026-10-17')` → `[{ start: 10, end: 21, date: '2026-10-17' }]`
- `findDumpDates('@2026-10-17 x\n# k @2026-10-17\n- a@2026-10-17\n- b @2026-10-17x')` → `[]`
- `findDumpDates('- a\n- b @2026-10-17')` → one token with `start: 8`
- `setDumpItemDate('- Zadzwoń #ATD', 3, '2026-10-17')` → text `'- Zadzwoń #ATD @2026-10-17'`
- `setDumpItemDate('- Zadzwoń @2026-10-17 #ATD', 0, '2026-10-20')` → text `'- Zadzwoń #ATD @2026-10-20'`
- `setDumpItemDate('- Zadzwoń @2026-10-17', 0, null)` → text `'- Zadzwoń'`
- `setDumpItemDate('- Zadzwoń\n  szczegóły', 12, '2026-10-17')` → text `'- Zadzwoń @2026-10-17\n  szczegóły'`
- `setDumpItemDate('\n## Now', 0, '2026-10-17')` → `null`
- `datedDumpItems('## Now\n- a @2026-10-16\n## Inbox\n- b #ATD @2026-10-20\n- c @2026-10-15\n+ 2026-10-10 d @2026-10-01\n- e')` → `[{ pos: <offset of '- c'>, title: 'c', date: '2026-10-15' }, { pos: <offset of '- b'>, title: 'b #ATD', date: '2026-10-20' }]`
- `dumpDateTrigger('- a @ju', 7)` → `{ start: 4, query: 'ju' }`; `dumpDateTrigger('- a @', 5)` → `{ start: 4, query: '' }`; `dumpDateTrigger('- a@ju', 6)` → `null`; `dumpDateTrigger('# a @ju', 7)` → `null`
- `stripDumpTags('Zadzwoń @2026-10-17 #ATD', ['ATD'])` → `'Zadzwoń'`
- `findDumpItem('- Zadzwoń @2026-10-17 #ATD', 'Zadzwoń')` → `0` (⌘F quick task title has no date; the line still matches)

## Data flow
- none

## Visual check
- none

## Done criteria
- [ ] `src/shared/dump-dates.ts` exports the contract and every Examples row holds
- [ ] `stripDumpTags` and `findDumpItem`/`completeDumpItem` ignore `@YYYY-MM-DD` tokens; existing dump tests stay green unchanged
- [ ] `npm test` runs `tests/dump-dates.test.ts`

## Required tests
- every Examples row, incl. year rollover, weekday same-day (+7), past `D.M` → next year, impossible dates
- `datedDumpItems`: `## Now` skipped, done lines skipped, continuation lines carrying a date ignored, sort order
- `completeDumpItem` on a dated line found by its date-less title

## Allowed changes to existing tests
- none

## New dependencies
- none added — only `package.json` `scripts.test` gains the new test file (D1)

## Decisions
- D1: the `package.json` change (one entry in `scripts.test`) is allowed; no new packages.
- D2: `setDumpItemTag` keeping dates (internal tag-only strip) is accepted.
