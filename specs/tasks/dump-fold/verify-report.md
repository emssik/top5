STATUS: PASS

Tests (npm test, npm run test:api: 126 passed) and typecheck green on my own run.

| Criterion | Score | Evidence |
|---|---|---|
| dumpFoldEnd returns Examples results | 10 | src/shared/dump.ts:412-419 (reuses isContinuation); tests `dumpFoldEnd folds an item with sub-points or notes`, `dumpFoldEnd stops at headers and comments`, `dumpFoldEnd is null where nothing can be folded` in tests/dump-tags.test.ts:183+ |
| @codemirror/language in package.json | 10 | package.json:20 `^6.13.1`; only dependency change; package-lock.json is the matching lock update (warning justified) |
| Fold/unfold by marker, keymap, placeholder ` ⋯ N` | 8 | DumpEditor.tsx:262-295 (foldService, foldKeymap, codeFolding placeholderDOM, foldGutter); shots/dark-fold-hover-1040.png shows ` ⋯ 3`, ▸ and ▾; no automated test |
| Non-foldable lines not foldable | 9 | dumpFoldEnd null cases (tested); shots/dark-fold-hover-1040.png shows no marker on single items |
| Folds restored after recreation and load(), by trimmed head text | 7 | DumpEditor.tsx:329 (creation), :168 (load), :317-321 (write); no automated test (no DOM harness) |
| Missing/throwing localStorage safe | 8 | DumpEditor.tsx:62-72 try/catch on read and write; untested |
| Typecheck/tests green; text column no shift | 9 | shots/plain-nohover-1040.png vs shots/dark-fold-hover-1040.png: text at same x (~180 bullet, ~199 text) |
| Visual check dark / light / plain | 9 | shots/dark-fold-hover-1040.png, shots/light-fold-hover-1040.png, shots/plain-nohover-1040.png |

frozen-diff.md: only change is moving the `dumpFoldEnd` import next to the appended tests; no assertion changed. Fine.

Styles checked against good-css: hover inside (hover: hover) media query, :active present, no transition, no outline removal. No violation.

MUTANTS:
- `src/renderer/components/DumpEditor.tsx:66` filter inverted: gap (stored strings dropped on read); not testable without DOM harness, task required tests only for dumpFoldEnd.
- `src/renderer/components/DumpEditor.tsx:81`: equivalent; dumpFoldEnd only reads line i+1 after a continuation, so n == doc.lines is practically never queried.
- `src/renderer/components/DumpEditor.tsx:82`: gap, minor; `<=` makes doc.line(lines+1) throw once per restore when a stored set exists.
- `src/renderer/components/DumpEditor.tsx:83`: gap; line(i-1) restores the wrong lines (restore-by-head-text); covered only by screenshots/manual.
- `src/renderer/components/DumpEditor.tsx:266`: gap; fold service inverted, nothing folds; visible in screenshots, not in a test.
- `src/renderer/components/DumpEditor.tsx:292`: equivalent; `>` vs `>=` differs by one pixel on the row boundary.
- `src/renderer/components/DumpEditor.tsx:317`: equivalent output; only adds extra writes, guarded by `json !== written`.
- `src/renderer/components/DumpEditor.tsx:321`: gap; never writes, persistence breaks; same reason, no editor test harness.

Not failing on these: the task's Required tests explicitly limit automated tests to dumpFoldEnd; editor behaviour is evidenced by screenshots and code reading.

Data flow: `top5.dump.folded` written at DumpEditor.tsx:317-321, read at :329 (creation) and :168 (load). No lost hop. A load() of a doc lacking a stored head drops that entry from storage; consistent with "currently folded items".

TASK DOUBTS: matching by trimmed head text folds duplicate-text items together; deliberate in the task, noted only.

Gaps: none.
