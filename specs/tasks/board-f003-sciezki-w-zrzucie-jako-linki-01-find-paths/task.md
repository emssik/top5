# Task

## Goal
A pure function finds absolute file paths (`/…` or `~/…`) in the dump ("Zrzut") text, so the editor can underline them and open them on Cmd+click. Paths in `"…"` or `` `…` `` may contain spaces.

## Source
- `specs/board-F003-sciezki-w-zrzucie-jako-linki.plan.md — Step 1`

## Files
- `src/shared/dump.ts` — new `findDumpPaths` next to `findDumpTags`
- `tests/dump-tags.test.ts` — new tests (this file already runs in `npm test`; do not add a new test file)

## Contract
```ts
export type DumpPath = { start: number; end: number; path: string }
export function findDumpPaths(text: string): DumpPath[]
```
- `start`/`end` are offsets in the whole `text` (multi-line), `path === text.slice(start, end)`.
- Results in text order.
- A path starts at the beginning of a word: at line start, after a whitespace char, or after `(`. It begins with `/` or `~/`, and the char right after that `/` must not be `/` or whitespace (so `/`, `~/`, `//` alone are not paths).
- Unquoted: ends at the first whitespace char (or `"` / backtick); a trailing run of `.` `,` `)` `:` is cut off.
- Quoted: an opening `"` or backtick at the beginning of a word, immediately followed by `/` or `~/`, closed by the same char on the same line. The path may contain spaces; the range excludes the quote chars; trailing punctuation inside the quotes stays.
- Lines whose `trimStart()` starts with `#` are skipped (same rule as `findDumpTags`).
- Implement in the same style as `findDumpTags` (split lines, running offset, one regex with a short English comment). Lazy-senior rule: smallest working code, no new abstractions, no new dependencies.

## Examples
- `'- zobacz /Users/x/a.md'` → `[{ start: 9, end: 22, path: '/Users/x/a.md' }]`
- `'~/a/b.md'` → `[{ start: 0, end: 8, path: '~/a/b.md' }]`
- `'x\n~/a/b.md'` → `[{ start: 2, end: 10, path: '~/a/b.md' }]` (offset counted from the start of the whole text)
- `'plik /a/b.md.'`, `'/a/b.md,'`, `'(/a/b.md)'`, `'/a/b.md:'`, `'/a/b.md).'` → one hit, `path === '/a/b.md'`
- `'a/b/c.md'`, `'km/h'`, `'https://x.com/a'`, `'1/2'`, `'samo / tu'`, `'~/ '`, `'// koment'`, `'~'` → `[]`
- `'# /Users/x/a.md'` → `[]`; `'  ## nagłówek ~/a.md'` → `[]`
- `'- #ATD /a.md'` → one hit, `path === '/a.md'`
- `'otwórz "/Users/x/My Doc.md" teraz'` → `[{ start: 8, end: 26, path: '/Users/x/My Doc.md' }]`
- ``'`~/a b/c.md`'`` → `[{ start: 1, end: 11, path: '~/a b/c.md' }]`
- `'"/a/b c.md."'` → one hit, `path === '/a/b c.md.'` (punctuation inside quotes stays)
- `'/Users/x/My Doc.md'` → one hit, `path === '/Users/x/My'`
- `'"/a/b c'` (unclosed quote) → `[]`
- `'/a.md /b.md'` → two hits, `/a.md` then `/b.md`

## Data flow
- none

## Visual check
- none

## Done criteria
- [ ] `findDumpPaths` and `DumpPath` are exported from `src/shared/dump.ts` with the contract above.
- [ ] Every example above holds and is covered by a test in `tests/dump-tags.test.ts`.
- [ ] `findDumpTags` and the other existing functions behave as before (existing tests green).

## Required tests
- Each example from the Examples section as an assertion on the full result array (`deepStrictEqual`), including `start`/`end`.

## Allowed changes to existing tests
- `tests/dump-tags.test.ts` — append only

## New dependencies
- none

## Decisions
