# Task

## Goal
The main process can open a file path coming from the dump ("Zrzut") in the system default app, but only when it is an existing regular, non-executable file. The path is untrusted (dump text can come from e-mail), so main expands `~`, resolves symlinks and refuses directories, `.app` bundles and executables. The renderer gets a bridge method `window.api.openDumpPath(path)`.

## Source
- `specs/board-F003-sciezki-w-zrzucie-jako-linki.plan.md — Step 2` and `— Step 3` (one task)

## Files
- `src/main/dump-path.ts` — new file, no `electron` import: `openableDumpPath`
- `src/main/launchers.ts` — new handler `open-dump-path` in `registerLauncherHandlers`, next to `open-external`
- `src/preload/index.ts` — bridge method `openDumpPath` next to `openTaskImage`
- `src/renderer/types/index.ts` — type of `openDumpPath` next to `openTaskImage`
- `tests/main/dump-path.test.ts` — new vitest tests

## Contract
```ts
// src/main/dump-path.ts
export function openableDumpPath(raw: unknown, home?: string): string | null // home defaults to os.homedir()
// preload / renderer type
openDumpPath: (path: string) => Promise<void>
```
- IPC channel name: `open-dump-path`, one argument (the raw path). The handler calls `openableDumpPath(raw)`; a non-null result goes to `shell.openPath(result)`; `null` → nothing. The `shell.openPath` result (error string) is ignored. Nothing is logged in any refusal case.
- `openableDumpPath` returns the real path (after symlink resolution) or `null`. It returns `null` when: `raw` is not a string; it contains `\0`; it does not start with `/` or `~/`; the file does not exist (any fs error); the target is not a regular file (directory, `.app`/`.workflow` bundle); any execute bit is set (`mode & 0o111`); the extension of the REAL path (case-insensitive) is one of `.app .command .sh .tool .workflow .terminal .jar .fileloc .webloc .inetloc .pkg .mpkg`.
- `~/x` expands to `join(home, 'x')`.
- Add a `ponytail:` comment at the execute-bit check: volumes without POSIX permissions (exFAT, some SMB shares) set `x` on every file, so nothing opens from there; growth path: an extension allowlist for such volumes.
- Do not touch `webPreferences.sandbox` or `src/main/store.ts`. Lazy-senior rule: smallest working code, no new abstractions, no new dependencies; do NOT simplify the checks at the trust boundary.

## Examples
Temp dir `T` from `mkdtempSync(join(tmpdir(), 'top5-dump-path-'))`, `R = realpathSync(T)` (on macOS `tmpdir()` is a symlink); calls pass `home = T`.
- file `T/a.md` mode 0o644: `openableDumpPath(T + '/a.md', T)` → `R + '/a.md'`; `openableDumpPath('~/a.md', T)` → `R + '/a.md'`
- file `T/My Doc.txt` (0o644) → `R + '/My Doc.txt'`
- `T/nope.md` (missing) → `null`, no exception, `console.error` not called
- directory `T/sub` → `null`; directory `T/Foo.app` → `null`
- file `T/run` without extension, mode 0o755 → `null`; file `T/b.md` mode 0o744 → `null`
- files with mode 0o644: `x.command`, `x.sh`, `X.SH`, `x.tool`, `x.terminal`, `x.jar`, `x.fileloc` → each `null`
- symlink `T/link.md` → `T/x.command` (0o644) → `null`
- `'a.md'`, `'./a.md'`, `'~a.md'`, `''`, `123`, `null`, `'/x\0.md'` → `null`
- IPC: handler `open-dump-path` called with `T + '/a.md'` → `shell.openPath` called once with `R + '/a.md'`; called with `T + '/x.command'` or `'~/nope.md'` → `shell.openPath` not called

## Data flow
- raw path — sent by the renderer through `window.api.openDumpPath` (`src/preload/index.ts`, typed in `src/renderer/types/index.ts`), received by the `open-dump-path` handler in `src/main/launchers.ts`, checked by `openableDumpPath` in `src/main/dump-path.ts`, passed to `shell.openPath`. The renderer caller comes in a later task (not here).

## Visual check
- none

## Done criteria
- [ ] Every example above holds and is covered by a test in `tests/main/dump-path.test.ts`.
- [ ] The IPC handler test goes through the real `registerLauncherHandlers` with a fake `ipcMain` that records handlers and a mocked `electron` `shell.openPath` (via `vi.mock('electron', …)` in the test file; the shared electron mock has no `shell`).
- [ ] `window.api.openDumpPath` exists in preload and in the renderer type; `npm run typecheck` passes.
- [ ] Temp files are removed after the tests.

## Required tests
- `openableDumpPath` on real files in a temp dir for every example (allowed, missing, directory, bundle dir, execute bits, blocked extensions incl. upper case, symlink to a blocked file, untrusted input types).
- The `open-dump-path` handler through the real `registerLauncherHandlers` with a fake `ipcMain` and a mocked `shell.openPath`: called for an allowed file with the real path, not called for a blocked or missing one.

## Allowed changes to existing tests
- none

## New dependencies
- none

## Decisions
