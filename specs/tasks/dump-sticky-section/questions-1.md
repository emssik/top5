# Questions

## Q1: gate rejects the required test addition
The task says to append tests to `tests/dump-tags.test.ts` ("add tests at the end"), and "Allowed changes to existing tests: none". The gate (`delegate gate`) reports "existing test changed: tests/dump-tags.test.ts" for an append-only change (the file is untracked in git: `?? tests/dump-tags.test.ts`, so the baseline is probably a snapshot hash).
Checked: only appended 2 tests plus a second `import { findDumpSectionHeaders }` line at the end (first import line untouched). Gate still fails (block 2/3).
Options: (a) planner lists `tests/dump-tags.test.ts` under "Allowed changes to existing tests"; (b) I put tests in a new file `tests/dump-sections.test.ts` (needs adding to the `npm test` list in package.json = manifest change, needs permission).
I pick (a).

Implementation is done (src/shared/dump.ts, DumpView.tsx, styles.css); typecheck green. Only the gate on tests is open.
