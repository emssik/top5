# Task

## Goal
A task line from a self-sent mail may carry markers: a section digit at the start (`1 ` → Now, `2 ` → Next, `3 ` → Inbox), relative dates `@Nd` / `@Nw` / `@Nm`, and a project tag `#KOD`. Markers are parsed in code after `classify` (not by the model): the digit picks the dump section, relative dates become `@YYYY-MM-DD` counted from the mail's sent logical day (6:00 rollover), `#KOD` stays as text. Lines without markers behave exactly as today (top of `## Inbox`).

## Source
- none
<!-- Ticket: .mycc/ticket.md in the main checkout (not in this worktree). Its content is summarised here. -->

## Files
- `src/main/service/mail-inbox.ts` — PROMPT (keep markers literally), new exported parser, mail sent date, per-section append
- `src/shared/dump.ts` — `addOpenLines` gets a target section
- `src/main/service/dump.ts` — `appendDumpLines` passes the section through
- `src/main/mail-to-dump.ts` — passes the section from `pullMailTasks` to `appendDumpLines`
- `tests/main/mail-inbox.test.ts`
- `tests/api/dump.test.ts`

## Contract
```ts
// src/shared/dump.ts — section defaults to 'Inbox' (current behaviour unchanged)
export function addOpenLines(text: string, entries: string[], section?: DumpSection): string
// src/main/service/dump.ts
export function appendDumpLines(lines: string[], section?: DumpSection): DumpState | DumpError
// src/main/service/mail-inbox.ts
// sentDay = 'YYYY-MM-DD' (logical day of the mail's sent time)
export function parseMailTask(task: string, sentDay: string): { text: string; section: DumpSection }
export async function pullMailTasks(append: (lines: string[], section: DumpSection) => void, dryRun?: boolean): Promise<string[]>
```
- `addOpenLines` placement: `Now` / `Next` → end of that section (same placement as `moveDumpItems`); `Inbox` → top of `## Inbox`. Target section missing → today's fallback: top of `## Inbox`, or end of the open list when there is no Inbox either.
- `parseMailTask` gets the task already cleaned the way the loop does today (whitespace collapsed, trimmed, leading `- ` / `+ ` dropped).
  - Section: only a single digit `1`, `2` or `3` followed by a space at the very start of the line. That digit and the space are removed from the text. Anything else (`1. x`, `1) x`, `12 x`, `4 x`, no digit) → section `Inbox`, text unchanged.
  - Date tokens: `@<N>d`, `@<N>w`, `@<N>m` (N = one or more digits, lowercase unit) standing as a whole word (preceded by start of text or whitespace, followed by whitespace or end) are replaced in place by `@YYYY-MM-DD`. `d` = +N days, `w` = +7·N days, `m` = same day-of-month N months later, clamped to the last day of the target month. Calendar arithmetic (no ms offsets). Anything else starting with `@` (incl. `@2026-10-21`, `@jutro`, `@2x`, `mail@2d.pl`) stays unchanged.
  - `#KOD` and all other text are left as they are.
- `pullMailTasks`: sent day = `logicalDateKey(parsed.date)` from `src/shared/schedule.ts`; no `Date` header → `logicalDateKey()` (now). Per mail, `append` is called once per non-empty section group, in the order `Now`, `Next`, `Inbox`, each group keeping the mail's order. The returned array holds the final lines (digit removed, dates resolved), in the order they were appended.
- PROMPT: tell the model to copy markers literally and keep them in the task line: a leading digit `1`/`2`/`3` (it is not list numbering — do not drop it), `@2d`/`@1w`/`@3m`/`@RRRR-MM-DD`, `#KOD`.

## Examples
- `parseMailTask('1 zatankować samochód @2d #priv', '2026-10-19')` → `{ text: 'zatankować samochód @2026-10-21 #priv', section: 'Now' }`
- `parseMailTask('2 oddzwonić', '2026-10-19')` → `{ text: 'oddzwonić', section: 'Next' }`
- `parseMailTask('3 kupić mleko', …)` → `{ text: 'kupić mleko', section: 'Inbox' }`
- `parseMailTask('kupić mleko', …)` → `{ text: 'kupić mleko', section: 'Inbox' }`
- `parseMailTask('1. kupić mleko', …)` → `{ text: '1. kupić mleko', section: 'Inbox' }`; same for `'1) kupić mleko'`, `'12 jajek'`, `'4 x'`
- `parseMailTask('x @0d', '2026-10-19')` → text `'x @2026-10-19'`
- `parseMailTask('x @1w', '2026-10-19')` → text `'x @2026-10-26'`
- `parseMailTask('x @1m', '2026-01-31')` → text `'x @2026-02-28'`; `'x @1m'` from `'2028-01-31'` → `'x @2028-02-29'`; `'x @2m'` from `'2026-12-15'` → `'x @2027-02-15'`
- `parseMailTask('x @2d', '2026-12-31')` → text `'x @2027-01-02'`
- `parseMailTask('x @2026-10-21', …)` → text unchanged; `'x @jutro'`, `'x @2x'`, `'mail@2d.pl'` → unchanged
- `addOpenLines('## Now\n\n- a\n\n## Next\n\n## Inbox\n', ['b'], 'Now')` → `'## Now\n\n- a\n- b\n\n## Next\n\n## Inbox\n'`
- `addOpenLines('## Inbox\n\n- a\n', ['b'], 'Now')` → `'## Inbox\n\n- b\n- a\n'` (no Now → top of Inbox)
- `addOpenLines('- a\n\n## Zrobione\n', ['b'], 'Next')` → `'- a\n- b\n\n## Zrobione\n'` (no Next, no Inbox → end of open list)
- Mail sent 2026-10-19 12:00 local, model returns `['1 zatankować samochód @2d #priv']`, dump has `## Now` with `- a` → dump `## Now` ends with `- a`, `- zatankować samochód @2026-10-21 #priv`.
- Mail sent 2026-10-19 01:30 local with task `'x @0d'` → `- x @2026-10-18`.
- Mail returning `['3 c', '1 a', 'd', '2 b']` → `append(['a'], 'Now')`, `append(['b'], 'Next')`, `append(['c', 'd'], 'Inbox')`; returns `['a', 'b', 'c', 'd']`.

## Data flow
- `section` — created in `parseMailTask` (`src/main/service/mail-inbox.ts`), passed to the `append` callback in `pullMailTasks`, forwarded in `src/main/mail-to-dump.ts` to `appendDumpLines` (`src/main/service/dump.ts`), read in `addOpenLines` (`src/shared/dump.ts`).
- mail sent day — read from `parsed.date` in `pullMailTasks` (the fetch loop), kept per mail id until the classify loop, used by `parseMailTask`. It is not sent to the model.

## Visual check
- none

## Done criteria
- [ ] Mail `1 zatankować samochód @2d #priv` sent 2026-10-19 → dump line `- zatankować samochód @2026-10-21 #priv` at the end of `## Now`.
- [ ] Digit `2` → end of `## Next`; `3` or no digit → top of `## Inbox`.
- [ ] `1. x`, `1) x`, `12 x` are plain text → top of `## Inbox`, text unchanged.
- [ ] `@Nd`, `@Nw`, `@Nm` resolve as in Examples (month clamp, year rollover); `@YYYY-MM-DD` and other `@…` stay unchanged; `#KOD` stays unchanged.
- [ ] Missing target section → top of `## Inbox`, or end of the open list when there is no Inbox.
- [ ] One mail with tasks for several sections puts each task into its own section.
- [ ] `@0d` = sent day; a mail sent at 01:30 counts as the previous day.
- [ ] Existing behaviour unchanged: existing tests in `tests/main/mail-inbox.test.ts`, `tests/api/dump.test.ts`, `tests/dump-merge.test.ts` pass without changing their assertions.
- [ ] PROMPT tells the model to keep the markers literally.

## Required tests
- `parseMailTask` unit tests covering every Examples line for it.
- `addOpenLines` with `section` (Now end, Next end, Inbox top, each fallback) in `tests/api/dump.test.ts`.
- Through the ImapFlow boundary in `tests/main/mail-inbox.test.ts` (mocked ImapFlow, as the existing tests): mails with a `Date` header; the `append` callback writes into an in-memory dump text through the real `addOpenLines` — assert the final dump text for: the `1 … @2d #priv` example, a mixed-section mail, a 01:30 mail with `@0d`, a mail without a `Date` header (uses today's logical day). Build the `Date` header from a local `Date` so the tests do not depend on the machine's timezone.

## Allowed changes to existing tests
- `tests/api/dump.test.ts` — append only
- `tests/main/mail-inbox.test.ts` — new tests may be added; the `raw()` and `setup()` helpers may gain optional parameters (e.g. a `Date` header, an `append` mock that also records the section); existing tests and their assertions must stay unchanged.

## New dependencies
- none

## Decisions
- D0 (planner): one `append` call per section group means a mail with several sections makes several dump writes. If a later write fails, the mail is not labelled and the earlier group comes back as a duplicate next run — the same "duplicate, never lost" risk the module already accepts. Leave a `ponytail:` comment there.
- D0b (planner): `mergeExternalAppends` (409 save conflict) re-adds external lines to the top of Inbox, so a mail line sent to Now/Next during an unsaved edit ends up in Inbox. Accepted; do not change `mergeExternalAppends`, add a one-line `ponytail:` comment next to it.
- Coding rules (Daniel): smallest working diff, no new abstractions, no new files beyond tests, readable over clever; match the surrounding comment density and style.
