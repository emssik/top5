# Task

## Goal
A self-sent mail from which the model extracted at least one task is moved to Gmail Trash
(special-use `\Trash` folder) after its tasks were appended to the dump and the `top5-zrzucone`
label was added. Mails without tasks, unparseable mails and mails to other people keep only the
label. `dryRun` moves and labels nothing. A unit test with a mocked `ImapFlow` covers it.

## Source
- `.mycc/ticket.md` in the parent checkout (ticket F001) — summarized here; task.md wins.

## Files
- `src/main/service/mail-inbox.ts` — the only production file. Change is in `pullMailTasks`: the `\Trash` lookup next to the existing `\All` lookup (~line 131-134), the move in the loop over classified mails (~line 178-191), the file header comment (lines 10-15) and the `pullMailTasks` doc comment (~line 114).
- `tests/main/mail-inbox.test.ts` — new vitest test file.
- `vitest.config.ts` — extend `test.include` so `tests/main/**/*.test.ts` also runs (keep `tests/api/**/*.test.ts`). Do NOT use a glob that picks up `tests/*.test.ts` — those are `node:test` files run by `npm test`.

## Contract
No signature change: `pullMailTasks(append: (lines: string[]) => void, dryRun = false): Promise<string[]>` stays exported as is, still constructs `new ImapFlow(...)` internally (no injection refactor).
- Trash folder: the mailbox from `client.list()` whose `specialUse` is `\Trash` (name is localized, e.g. `[Gmail]/Kosz`). Move with imapflow `client.messageMove(uid, trashPath, { uid: true })`, which resolves to `false` on failure instead of throwing.
- Order per mail with ≥1 task line: `append(lines)` → label → move to Trash. The label must be in place before the move, so a failed move never makes the mail come back next run (no duplicate append).
- A failed move (resolves `false` OR throws) does NOT stop the loop: remaining mails are still appended/labelled/moved. After the loop, if any move failed, `pullMailTasks` throws an `Error` whose message (Polish, like the other errors in the file) says how many mails could not be moved to Trash. The caller `runMailToDump` already turns a throw into `{ ok: false, error }` (✉ result) and logs it — no change in `src/main/mail-to-dump.ts`.
- Missing `\Trash` folder and `dryRun = false` → throw `Error` before anything is appended (same style as the `\All` check). In `dryRun` a missing `\Trash` is not an error.
- No `EXPUNGE`, no `messageDelete`. The label-failure path (throw when `addLabel` resolves false) stays as it is.
- Header comment (lines 10-15) updated to describe: task mails go to Trash after append + label; other mails keep only the label.

Test harness (vitest): `vi.mock('imapflow')` with a fake client class; mock `node:fs` `readFileSync` to return a `[mailtodump]` TOML (user, app_password, since); mock `node:child_process` `execFile` to fake `claude -p` (callback gets JSON stdout with `structured_output.mails`; returned child needs `stdin.on` and `stdin.end`); set `process.env.CLAUDE_CODE_OAUTH_TOKEN` so the zsh token lookup is skipped. `mailparser` stays real — fetched messages carry a raw RFC822 `source` Buffer.

## Examples
Fake mailbox: `list()` → `[{path:'[Gmail]/Wszystkie', specialUse:'\\All'}, {path:'[Gmail]/Kosz', specialUse:'\\Trash'}, {path:'top5-zrzucone'}]`, user `me@x.pl`.
- mail uid 7 to `me@x.pl`, model returns `["kup mleko"]` → `append(["kup mleko"])` called once, then `messageFlagsAdd(7, ['top5-zrzucone'], {uid:true, useLabels:true})`, then `messageMove(7, '[Gmail]/Kosz', {uid:true})`; result `["kup mleko"]`.
- mail uid 8 to `me@x.pl`, model returns `[]` → label added to 8, `messageMove` never called for 8, `append` not called.
- mail uid 9 to `other@y.pl` with Cc `me@x.pl` → label added to 9, not sent to the model, no move.
- uids 7 and 10 both with tasks, `messageMove` for 7 resolves `false` → 7 and 10 both appended and labelled, 10 is moved, then `pullMailTasks` rejects with an Error mentioning `1` mail not moved to Trash.
- same as above but `messageMove` for 7 throws → same outcome as resolving `false`.
- `messageFlagsAdd` for 7 resolves `false` → rejects with the existing label error, `messageMove` not called for 7.
- `dryRun = true`, mails 7 (tasks) and 8 (no tasks) → result `["kup mleko"]`, `append` not called, `messageFlagsAdd`, `messageMove` and `mailboxCreate` never called, mailbox lock opened with `readOnly: true`.
- `list()` without a `\Trash` entry, `dryRun = false` → rejects with an Error naming `\Trash`, `append` never called.

## Data flow
- none

## Visual check
- none

## Done criteria
- [ ] A mail with ≥1 task line is appended, labelled and then moved to the `\Trash` folder's path, in that order.
- [ ] A mail with an empty task list, an unparseable mail and a mail to someone else only get the label, never `messageMove`.
- [ ] A failed move (false or throw) does not stop processing of the other mails and ends with a thrown Error counting the mails not moved; the label for the failed mail is already in place.
- [ ] `dryRun = true` calls no `append`, `messageFlagsAdd`, `messageMove` or `mailboxCreate`.
- [ ] Missing `\Trash` with `dryRun = false` throws before any append.
- [ ] Header comment of `mail-inbox.ts` describes the Trash move.
- [ ] `npm test` and `npm run test:api` pass, and the new test file is run by `npm run test:api`.

## Required tests
- Through the real `pullMailTasks` with the fake `ImapFlow` at the SDK boundary (and faked `claude -p` process): mail with a task → Trash (assert call order append → messageFlagsAdd → messageMove); mail with no tasks → label only; `dryRun` → no mutating call at all.
- Move failure: `messageMove` resolving `false` and throwing — other mails still processed, the run rejects, the failed mail was labelled.
- Mail to another person (Cc me) → label only.
- Missing `\Trash` (non-dryRun) → rejects, no append.

## Allowed changes to existing tests
- `vitest.config.ts` — only the include list gains the tests/main glob; aliases, globals and timeout unchanged.

## New dependencies
- none

## Decisions
<!-- planner's answers to the coder's questions: D1, D2, … -->
