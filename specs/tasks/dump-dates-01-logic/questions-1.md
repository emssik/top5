# Questions

1. The gate blocks with "dependency change without permission in the task: package.json". The task's Files list requires adding `.tmp-tests/tests/dump-dates.test.js` to the `test` script in `package.json` (Done criteria: "`npm test` runs `tests/dump-dates.test.ts`"). My diff touches only the `scripts.test` string (no dependencies).
   - Checked: `git diff package.json` shows only that one line.
   - Options: (a) planner permits the `package.json` scripts change in task.md / gate config; (b) I leave package.json unchanged and the new test does not run under `npm test`.
   - I pick (a). Everything else is done and green (`npm test`: 97 pass); red was confirmed and the tests frozen.
