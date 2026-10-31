STATUS: PASS

Tests: `delegate quick` -> QUICK: PASS (50/50); `full_suite_green: true` (gate ran the full suite on this code).

| Criterion | Score | Evidence |
| --- | --- | --- |
| `findDumpPaths` and `DumpPath` exported with the contract | 10 | `src/shared/dump.ts:151-170` (PATH_RE at :151, type at :152, function at :154); offsets from a running `offset` over `split('\n')`, `start` shifted by 1 for quotes, `end = start + path.length`; all tests in `tests/dump-tags.test.ts:215-237` |
| Example `- zobacz /Users/x/a.md`, `~/a/b.md`, `x\n~/a/b.md`, `/a.md /b.md` (full array with offsets) | 10 | test `findDumpPaths finds paths with offsets` (`tests/dump-tags.test.ts:215`), `deepStrictEqual` |
| Trailing punctuation `. , ) :` cut (5 inputs) and `/Users/x/My Doc.md` -> `/Users/x/My` | 10 | `src/shared/dump.ts:161`; test `findDumpPaths cuts trailing punctuation of unquoted paths` (`:223`); `onePath` checks length 1, `path` and `text.slice(start,end) === path` |
| Non-paths `a/b/c.md`, `km/h`, `https://…`, `1/2`, `samo / tu`, `~/ `, `// koment`, `~` -> `[]` | 10 | lookbehind `(?<![^\s(])` and `[^\s/]` after the slash, `src/shared/dump.ts:151`; test `findDumpPaths ignores non-paths, comments and unclosed quotes` (`:228`), `deepStrictEqual(..., [])` |
| `#` lines skipped, `- #ATD /a.md` still hits | 10 | `src/shared/dump.ts:158`; tests at `:220` and `:229` |
| Quoted paths with spaces, backticks, punctuation kept inside quotes, unclosed quote -> `[]` | 10 | quoted branch `(["`])(…)\1` at `src/shared/dump.ts:151`; test `findDumpPaths handles quoted paths with spaces` (`:233`) with full arrays for `"/Users/x/My Doc.md"` and the backtick case; unclosed quote at `:229` |
| Existing functions unchanged, existing tests green | 10 | diff only adds lines in `dump.ts`; test file is append-only; QUICK and full suite green |

Test quality: assertions are concrete values, no mocks, no real data, all tests run in under 1 ms. The three "one hit" examples use `onePath` (length + path + slice) instead of `deepStrictEqual`; the task defines only `path` for those examples, so this is enough. The tdd red check is recorded for `tests/dump-tags.test.ts`.

Data flow: none (pure function, no callers yet).

MUTANTS:
- 7 sampled, 7 killed, 0 survivors.
