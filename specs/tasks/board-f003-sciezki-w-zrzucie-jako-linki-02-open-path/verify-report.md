STATUS: PASS

Tests: `delegate quick` PASS (28 tests, 1.1 s). `full_suite_green: true`. `npm run typecheck` (tsc --build) passes.

| Criterion / example | Score | Evidence |
| --- | --- | --- |
| `T/a.md` absolute and `~/a.md` → `R/a.md` | 10 | src/main/dump-path.ts:15-19,26; test "allows a regular file, absolute or ~" (tests/main/dump-path.test.ts:39) |
| `T/My Doc.txt` → real path | 10 | same test, tests/main/dump-path.test.ts:42 |
| missing file → null, no exception, no console.error | 10 | src/main/dump-path.ts:27-28; "refuses missing files without logging" (:49) |
| directory `sub`, `Foo.app` → null | 10 | src/main/dump-path.ts:21; "refuses directories and bundles" (:56) |
| 0o755 `run`, 0o744 `b.md` → null | 10 | src/main/dump-path.ts:24 (ponytail comment :22-23); "refuses any execute bit" (:61) |
| blocked extensions incl. `X.SH` → null | 10 | src/main/dump-path.ts:5-8,25; `it.each(BLOCKED)` (:66) |
| symlink `link.md` → `x.command` → null | 10 | real path's extension is checked (src/main/dump-path.ts:19,25); "checks the extension of the real path behind a symlink" (:70) |
| untrusted inputs (`a.md`, `./a.md`, `~a.md`, `''`, 123, null, `\0`) → null | 10 | src/main/dump-path.ts:13-17; `it.each` (:74) |
| IPC handler: opens the real path once; skips blocked or missing | 10 | src/main/launchers.ts:127-130; "open-dump-path handler" tests (:86, :93) through the real `registerLauncherHandlers`, with `vi.mock('electron')` in the test file (:9) |
| `openDumpPath` in preload and renderer type, typecheck | 10 | src/preload/index.ts:103, src/renderer/types/index.ts:124; tsc --build passes |
| temp files removed | 10 | `afterAll` rmSync (tests/main/dump-path.test.ts:36) |
| no sandbox/store.ts change, no new dependencies | 10 | the diff touches only the 3 listed files plus 2 new ones |

Test quality: the assertions check concrete paths and null results. Only the external `electron` boundary is mocked. The tests use a temporary directory. The `'~/nope.md'` handler case reads the real home directory but writes nothing there, which the contract requires (the handler takes no `home` argument). The tests are fast.

MUTANTS:
- 2 sampled, 2 killed, 0 survived. No survivors.
