STATUS: PASS

I ran the tests myself: `npm test` passed 101/101 (node --test, includes dump-merge), `npm run test:api` passed 151/151 in 1.5 s, and `tsc --build` is clean. Mode is tdd. There is no `frozen-diff.md`, so no frozen test changed after red. There is no `plan-diff.md`, so the plan did not change. The status shows no warnings. The diff has no style changes.

| Criterion | Score | Evidence |
| --- | --- | --- |
| Mail `1 zatankować samochód @2d #priv` sent 2026-10-19 → `- zatankować samochód @2026-10-21 #priv` at the end of `## Now` | 10 | src/main/service/mail-inbox.ts:125-135, :214-224; src/shared/dump.ts:71-77; tests "puts a dated task at the end of ## Now", "picks the section from a leading digit and removes it" |
| `2` → end of `## Next`; `3` or no digit → top of `## Inbox` | 10 | src/main/service/mail-inbox.ts:121, :127; src/shared/dump.ts:74; tests "splits one mail between sections…", "Now / Next: end of that section", "Inbox: top of ## Inbox" |
| `1. x`, `1) x`, `12 x` stay plain text → Inbox | 10 | regex `^([123]) ` at mail-inbox.ts:127; test "treats anything but a single digit 1-3 and a space as plain text" (also `4 x`, `1x`, `1`) |
| `@Nd/@Nw/@Nm` resolve with month clamp and year rollover; other `@…` and `#KOD` stay unchanged | 10 | mail-inbox.ts:128-133 (calendar arithmetic, `new Date(y, m+k+1, 0)` for the clamp); tests "resolves relative dates from the sent day" and "leaves other @ tokens and #KOD alone" (`mail@2d.pl`, `@2x`, `@2D`, `@2dni`, `@2026-10-21`, `@jutro`) |
| Missing section → top of Inbox, or end of the open list | 10 | src/shared/dump.ts:74-75; test "missing section falls back to top of Inbox, then to the end of the open list" |
| One mail with several sections → each task in its own section | 10 | mail-inbox.ts:218-225; test "splits one mail between sections…" (checks the append calls, the returned lines and the final dump text) |
| `@0d` = sent day; 01:30 counts as the previous day | 10 | mail-inbox.ts:198 `logicalDateKey(parsed.date)`; tests "counts a mail sent at 01:30 as the previous day", "uses today (logical day) when the mail has no Date header" (fake Date at 03:00) |
| Existing behaviour and tests unchanged | 10 | the test diff only adds tests; `raw()` gained an optional param; `addOpenLines` defaults to 'Inbox' (dump.ts:71); `appendDumpLine` path is unchanged (service/dump.ts:59); all suites green |
| PROMPT tells the model to keep the markers literally | 9 | mail-inbox.ts:58 (digit 1/2/3 not list numbering, @2d/@1w/@3m/@RRRR-MM-DD, #KOD). No test covers it, which is acceptable for prompt text |

Data flow: `section` goes from `parseMailTask` (mail-inbox.ts:135) to `append(g.lines, g.section)` (:225), then to mail-to-dump.ts:18-19, then to `appendDumpLines` (service/dump.ts:63-64), then to `addOpenLines` (shared/dump.ts:71). I found no other callers of `pullMailTasks` or `appendDumpLines`. The sent day is stored per mail id at mail-inbox.ts:198, only for mails that go to the model (the same branch as `mails.push`), so `sentDay.get(mail.id)!` is always set. The D0 `ponytail:` comment is at mail-inbox.ts:224 and the D0b one at shared/dump.ts:91. The HTTP API is unchanged, so leaving docs/API.md and the CLI untouched is correct.

Test quality: assertions check exact final dump texts and exact `append` calls. The only mock is ImapFlow plus the claude CLI, both external boundaries. There are no sleeps; fake timers fake only `Date`.

The coder's report admits no defects. The skipped items (`mergeExternalAppends`, API docs) are covered by D0b or are out of scope.

MUTANTS:
- `src/main/service/mail-inbox.ts:177`: equivalent. The mutant only edits the text of a comment ("not shown" → "shown"), so the behaviour does not change.
