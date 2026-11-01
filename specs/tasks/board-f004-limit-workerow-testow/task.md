# Task

## Goal
Test runs in top5 use at most 2 parallel workers instead of the default (CPU cores minus one, i.e. 11 on Daniel's machine), so several concurrent runs (gate, verifier, mutants, board clones) do not saturate all cores. Ticket: `.mycc/ticket.md` in the main checkout (F004).

## Source
- none

## Files
- `vitest.config.ts` — main Vitest config, `test` section
- `cli/vitest.config.ts` — CLI Vitest config, `test` section
- `package.json` — only the `test` script (the `node --test` invocation)

## Contract
- `vitest.config.ts` → `test.maxWorkers` set to `2`, with a one-line comment why (concurrent runs saturated the CPU).
- `cli/vitest.config.ts` → `test.maxWorkers` set to `2`.
- `package.json` script `test` → `node --test` gets the flag `--test-concurrency=2`; the rest of the script (file list, `tsc`, cleanup) unchanged.
- No other keys change; no change to `pool`, `isolate`, `fileParallelism`, the test files or `.mycc.yaml`.

## Examples
- `env -u VITEST_MAX_WORKERS npm run test:api` → 187 tests pass (same count as before), at most 2 test files run at the same time.
- `npm test` → 105 tests pass (same count as before).
- `cd cli && env -u VITEST_MAX_WORKERS npm test` → 98 tests pass.
- With `VITEST_MAX_WORKERS=3` in the environment Vitest uses 3 workers (the env var overrides config in Vitest 4, `node_modules/vitest/dist/chunks/coverage.DM_a_rWm.js:380`) — expected, not a defect; the session running this task has it set, so measure with `env -u VITEST_MAX_WORKERS`.

## Data flow
- none

## Visual check
- none

## Done criteria
- [ ] `vitest.config.ts` has `maxWorkers: 2` in its `test` section.
- [ ] `cli/vitest.config.ts` has `maxWorkers: 2` in its `test` section.
- [ ] The `test` script in `package.json` passes `--test-concurrency=2` to `node --test`.
- [ ] `npm test`, `npm run test:api` and `cd cli && npm test` pass with the same test counts as before (105 / 187 / 98).
- [ ] Without `VITEST_MAX_WORKERS` in the environment, at most 2 Vitest test files run concurrently (e.g. checked with temporary sleeping test files that log start/end timestamps, deleted afterwards).
- [ ] No test files are changed.

## Required tests
- none — configuration only; the existing suites must stay green with unchanged counts. The concurrency check is a one-off measurement reported in the coder's report, not a committed test.

## Allowed changes to existing tests
- `vitest.config.ts` — only add `maxWorkers: 2` (with its comment) to the `test` section; nothing else changes
- `cli/vitest.config.ts` — only add `maxWorkers: 2` to the `test` section; nothing else changes

## New dependencies
- `package.json` — scripts.test only (adds `--test-concurrency=2` to `node --test`), no new package

## Decisions
- D1 (Daniel, 2026-11-01): the limit is 2 workers. The ticket's criterion "CPU below 200% in `time npm run test:api`" is dropped — with 2 workers it measures about 210–230% because of the main Vitest process; do not try to push it lower (no `pool`/`isolate` changes, no 1 worker).
