# Task

## Goal
Turn the "Zrzut" (DumpView, plain-text `dump.md`) into the main working view: coloured project tags `#KOD` in the text, a project picker (typing ` #` mid-line or ⌘P), ⌘R turns a line like `pon śr pt: Tytuł` into a repeating task, a collapsible "Dziś" strip above the text (focus, today's repeating tasks, habits), a `Now x/limit` counter, and the dump available in clean view + the app reopening the last view. No main-process, IPC or HTTP API changes.

## Files
- `src/shared/dump.ts` — tag helpers, Now counter, tag-insensitive title matching
- `src/shared/dump-repeat.ts` — NEW: parser of repeat lines for ⌘R
- `src/renderer/components/DumpView.tsx` — highlight layer, ` #` trigger, ⌘P, ⌘R, ⌘F changes, counter, strip
- `src/renderer/components/DumpProjectPicker.tsx` — NEW: project picker popup
- `src/renderer/components/DumpTodayStrip.tsx` — NEW: "Dziś" strip
- `src/renderer/components/Dashboard.tsx` — clean view shows DumpView when last view was the dump; remember last view
- `src/renderer/styles.css` — styles for the above (load the `good-css` skill first)
- `tests/dump-tags.test.ts` — NEW: tests for the shared functions (node:test, like `tests/dump-merge.test.ts`)
- `package.json` — only add `'.tmp-tests/tests/dump-tags.test.js'` to the `test` script list
- `cli/top5-cli/SKILL.md` — dump grammar docs (see next line)
- `docs/API.md` (section `### Dump („Zrzut")`, ~line 474) and `cli/top5-cli/SKILL.md` (dump section) — document the `#KOD` tag grammar, that tags must not be removed by tools/models, that dump↔quick-task title matching ignores tags, and the `↻` done lines

## Contract
New exports (shared, pure, no React/Electron imports):
```ts
// src/shared/dump.ts
export type DumpTag = { start: number; end: number; code: string } // [start,end) of "#CODE" in text
export function findDumpTags(text: string, codes: string[]): DumpTag[]
export function stripDumpTags(title: string): string
export function setDumpItemTag(text: string, pos: number, code: string): { text: string; cursor: number } | null
export function projectTagTrigger(text: string, caret: number): { start: number; query: string } | null
export function countSectionOpen(text: string, section: DumpSection): number
// src/shared/dump-repeat.ts
export type RepeatLine = { title: string; schedule: RepeatScheduleLike; projectCode: string | null }
export function parseRepeatLine(line: string): RepeatLine | null
```
`RepeatScheduleLike` comes from `src/shared/schedule.ts`. Weekday numbers follow the existing convention: 0 = Sunday, 1 = Monday … 6 = Saturday.

Renderer components (props are up to the coder): `DumpProjectPicker`, `DumpTodayStrip`. localStorage keys (every read/write wrapped in try/catch, the UI must work without it): `top5.lastView`, `top5.dumpStrip.collapsed`, `top5.dumpStrip.seen`.

## Examples
Tags — a tag is `#` + code, the `#` preceded by a space or tab and NOT at the start of the line (after trimming leading whitespace), the line not being a `#` header/comment line; code matched case-insensitively against `codes`; tag ends at end of line, whitespace or punctuation:
- `findDumpTags("- Oferta #ATD\n", ["ATD"])` → `[{ start: 9, end: 13, code: "ATD" }]`
- `findDumpTags("- Oferta #atd jutro", ["ATD"])` → one tag, `code: "ATD"`
- `findDumpTags("#ATD notatka", ["ATD"])` → `[]` (line start)
- `findDumpTags("# komentarz #ATD", ["ATD"])` → `[]` (header/comment line)
- `findDumpTags("- issue #123 fix", ["ATD"])` → `[]` (unknown code)
- `findDumpTags("- a#ATD", ["ATD"])` → `[]` (no space before `#`)
- `stripDumpTags("Oferta #ATD dla X")` → `"Oferta dla X"`; `stripDumpTags("Oferta #ATD")` → `"Oferta"`; `stripDumpTags("Oferta")` → `"Oferta"`

Setting a tag (⌘P) on the item under `pos` — the tag goes to the end of the item's FIRST line; an existing tag on that line is replaced; continuation lines untouched; `cursor` = original `pos` shifted by the length change if it was after the edit:
- `setDumpItemTag("- Oferta\n", 3, "ATD")` → text `"- Oferta #ATD\n"`
- `setDumpItemTag("- Oferta #BIZ\n", 3, "ATD")` → text `"- Oferta #ATD\n"`
- `setDumpItemTag("- Oferta\n  detal\n", 12, "ATD")` → text `"- Oferta #ATD\n  detal\n"` (cursor on continuation line → its item)
- `setDumpItemTag("## Now\n", 2, "ATD")` → `null`; on an empty line → `null`

Picker trigger (the popup opens only while this returns non-null; `query` = letters/digits typed after `#` up to the caret):
- `projectTagTrigger("- Oferta #", 10)` → `{ start: 9, query: "" }`
- `projectTagTrigger("- Oferta #at", 12)` → `{ start: 9, query: "at" }`
- `projectTagTrigger("- #", 3)` → `{ start: 2, query: "" }` (space before `#`)
- `projectTagTrigger("#", 1)` → `null` (first char of the line — Daniel types a comment there)
- `projectTagTrigger("##", 2)` → `null`; `projectTagTrigger("## Now", 6)` → `null`
- `projectTagTrigger("  #", 3)` → `null` (only whitespace before `#`)
- `projectTagTrigger("# komentarz #", 13)` → `null` (comment/header line)
- `projectTagTrigger("- Oferta #at x", 14)` → `null` (caret no longer in the tag)

Now counter:
- `countSectionOpen("## Now\n- a\n+ b\n- c\n## Next\n- d\n", "Now")` → `2`; text without `## Now` → `0`

Title matching ignores tags (existing functions, changed behaviour):
- `findDumpItem("- Oferta #ATD\n", "Oferta")` → `0`
- `completeDumpItem("- Oferta #ATD\n", "Oferta", "2026-10-10")` → item marked done (same result as ⌘D on it)

Repeat lines (input = the item's first line, with or without the leading `- `; schedule prefix case-insensitive, separated from the title by the first `:`; a `#CODE` tag in the title → `projectCode`, removed from `title`):
- `"- codziennie: Medytacja"` → `{ title: "Medytacja", schedule: { type: "daily" }, projectCode: null }`
- `"pon śr pt: Wynieść śmieci"` → weekdays `[1, 3, 5]`; `"sr"` = `"śr"`; `"sob nd: X"` → `[6, 0]`; `"dni robocze: X"` → `[1,2,3,4,5]`; day tokens: `pon wt śr czw pt sob nd`, separated by spaces and/or commas
- `"co 3 dni: Podlać kwiaty"` → `{ type: "interval", days: 3 }`
- `"15 dnia: Faktura ZUS #BIZ"` → `{ title: "Faktura ZUS", schedule: { type: "monthlyDay", day: 15 }, projectCode: "BIZ" }`
- `"koniec miesiąca: Raport"` (also `miesiaca`) → `{ type: "monthlyLastDay" }`
- `"32 dnia: X"`, `"co 0 dni: X"`, `"pon: "` (empty title), `"Oferta dla X"` (no prefix), `"jutro: X"` (unknown prefix) → `null`

UI behaviour:
- ⌘R on an item: parse its first line → `null` → show error with the 5 accepted forms, text unchanged. Unknown project code → error, nothing created. A repeating task with the same title (trim, case-insensitive) already exists → error „Takie zadanie cykliczne już istnieje", nothing created. Otherwise create it via `saveRepeatingTask` (full `RepeatingTask` object built like `RepeatView.tsx` does, `projectId` from the code), THEN prefix the line text with `↻ ` and mark it done (as ⌘D) and save through the existing mtime-guarded save path.
- ⌘F: quick-task title = `stripDumpTags(title)`; `projectId` = project of the tag (if any).
- Strip collapsed → one line `↻ N dziś · M nowe` (M part hidden when 0); M > 0 → thick accent border. Expanding marks all current items as seen.

## Done criteria
- [ ] All shared examples above pass as tests in `tests/dump-tags.test.ts`, run by `npm test`
- [ ] Existing tests (`npm test`, `npm run test:api`) and `npm run typecheck` stay green
- [ ] Tags `#KOD` of known projects (all projects, incl. archived) render in the project's colour (`projectColorValue`, `src/renderer/utils/projects.ts`) via a highlight layer under a transparent-text `<textarea>`; caret, selection, scrolling and line wrapping stay aligned; the textarea stays the only source of text (all existing save/merge/conflict logic untouched)
- [ ] Typing ` #` mid-line opens the picker filtered by the typed query (code or name, case-insensitive); ↑/↓ move, Enter/Tab inserts `#CODE ` replacing `#query`, Esc closes leaving the text; it never opens at line start, after `##`, or in a `#` comment line
- [ ] ⌘P opens the same picker; choosing a project applies `setDumpItemTag` to the item under the caret and saves; Esc cancels
- [ ] Inserting via the picker / ⌘P keeps native ⌘Z working (use `document.execCommand('insertText')` or equivalent), and goes through the existing change/save path
- [ ] ⌘R behaves as described in Examples, including duplicate and unknown-code protection; repeating task is created before the dump line changes
- [ ] ⌘F creates the quick task with tag-free title and the tag's project; completing it still ticks the tagged dump line
- [ ] Header shows `Now x/<quickTasksLimit, default 5>`; red when x > limit; never blocks anything
- [ ] "Dziś" strip above the text shows: focus task (title only, no per-second timer), today's repeating proposals (✓ = accept then complete, ✕ = dismiss), accepted not-completed repeating tasks (✓ = complete), today's scheduled habits not yet done (✓ = done), using `useTaskList` / `getScheduledHabits` like `TodayView` / `CleanViewHabitsSection`; collapsible with "new" highlight as in Examples; strip content is never written to `dump.md`
- [ ] Placeholder of the textarea lists the new shortcuts (#, ⌘P, ⌘R)
- [ ] Dashboard remembers the last view (`top5.lastView`) and opens it on start; in clean view, if the last view is `dump`, DumpView is shown instead of the quick-task list
- [ ] `docs/API.md` and `cli/top5-cli/SKILL.md` updated as listed in Files

## Required tests
- Every shared example from "Examples" (findDumpTags, stripDumpTags, setDumpItemTag, projectTagTrigger, countSectionOpen, findDumpItem/completeDumpItem with tags, parseRepeatLine valid + invalid cases)

## Allowed changes to existing tests
- none

## New dependencies
- `package.json` — only the `test` script list may change (adding `dump-tags.test.js`); no new packages

## Decisions
<!-- planner's answers to the coder's questions: D1, D2, … -->
- D1: The `package.json` test-script edit is allowed (see New dependencies); the gate block on it was a task-file omission, not a coder error.
- D0: No main-process / IPC / HTTP endpoint changes. If something seems to need one, ask instead of adding it.
- D0b: No per-second timers in the new UI (performance decision made by Daniel's review).
