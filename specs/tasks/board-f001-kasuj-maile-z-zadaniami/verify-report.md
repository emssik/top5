STATUS: PASS

Tests run by the verifier: `npm test` 101/101 pass, `npm run test:api` 137/137 pass (10 files, including tests/main/mail-inbox.test.ts, 11 tests, 34 ms).

| Criterion | Score | Evidence |
| --- | --- | --- |
| A mail with tasks is appended, then labelled, then moved to `\Trash` | 9 | src/main/service/mail-inbox.ts:190,193,197; test "moves a mail with tasks to Trash after append and label" checks the exact call order and the arguments `(7, '[Gmail]/Kosz', {uid:true})` |
| A mail with no tasks, an unparseable mail and a mail to someone else get only the label | 9 | mail-inbox.ts:167,177 (these paths have no move), :197 (`lines.length > 0`); tests "only labels a mail without tasks", "only labels a mail to someone else (Cc me)…", "only labels an unparseable mail" check `calls` with toEqual |
| A failed move (false or throw) does not stop the loop, ends with an Error that counts the failed mails, and the label is already in place | 9 | mail-inbox.ts:197 (`.catch(() => false)`), :199; tests "keeps going and rejects when a move resolves false/throws" (full call order, `/\b1\b.*Kosz/`), "counts every failed move in the error" (`2`) |
| `dryRun` makes no mutating call | 8 | mail-inbox.ts:139,167,175,190,193,197; test "dryRun mutates nothing" (also checks `readOnly: true`). The `mailboxCreate` assertion is weak: the label folder exists in BOXES, so that assertion would pass even without the dryRun guard. That guard is old code, so this is not a gap |
| Missing `\Trash` with dryRun=false throws before any append | 9 | mail-inbox.ts:137-138; tests "rejects before appending when Trash is missing" and "dryRun without a Trash folder is fine" |
| The header comment describes the Trash move | 9 | mail-inbox.ts:15-16, doc comment at :116 |
| Both test suites pass and test:api runs the new file | 10 | vitest.config.ts:12 (only the include list changed); verifier runs above |
| Example: messageFlagsAdd for 7 resolves false gives the label error and no move | 9 | mail-inbox.ts:193-195; test "does not move a mail whose label failed" |

Frozen test changes (frozen-diff.md): there is one change, the dynamic `await import` became a static `import`. No assertion was changed. `vi.mock` is hoisted, and `CLAUDE_CODE_OAUTH_TOKEN` is read only when `classify` runs, after line 32 has set it. The behaviour under test is the same, so this change is acceptable.

plan-diff.md: not present. The plan matches what was implemented.

Warnings: the only warning is the frozen-test change covered above. No files outside the list were changed and no dependency manifest was touched. No styles were changed.

Coder's report: it admits no defects. The test for the unparseable mail uses a stream that errors instead of `undefined`, which matches how a real parse failure arrives.

MUTANTS:
- 4 mutants were sampled from 4 candidates. All 4 were killed and none survived. No file was listed as unreached by tests.
