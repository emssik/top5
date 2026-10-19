[test] `npm test && npm run test:api` fails:
> top5@1.121.0 test
> rm -rf .tmp-tests && tsc -p tsconfig.tests.json && node --test '.tmp-tests/tests/schedule.test.js' '.tmp-tests/tests/filename.test.js' '.tmp-tests/tests/habit-schedule.test.js' '.tmp-tests/tests/dump-merge.test.js' '.tmp-tests/tests/dump-tags.test.js' '.tmp-tests/tests/dump-dates.test.js' && rm -rf .tmp-tests

tests/main/mail-inbox.test.ts(33,27): error TS1378: Top-level 'await' expressions are only allowed when the 'module' option is set to 'es2022', 'esnext', 'system', 'node16', 'node18', 'node20', 'nodenext', or 'preserve', and the 'target' option is set to 'es2017' or higher.