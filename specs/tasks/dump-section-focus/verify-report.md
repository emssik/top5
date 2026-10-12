STATUS: PASS

Tests run by me: npm test (126 pass), npm run test:api, npm run typecheck: all green.

| Criterion | Score | Evidence |
| --- | --- | --- |
| dumpCurrentSection matches Examples | 9 | src/shared/dump.ts:366-372; all 7 Examples plus the intro+first-header case in tests/dump-tags.test.ts (dumpCurrentSection tests) |
| Only the active section (the one in the sticky bar, D2) is full contrast, the rest is `dump-dim`, legible in both themes | 9 | DumpEditor.tsx:154-176,193-202; styles.css `.dump-writer .dump-dim` (opacity .5); shots/dark-now.png, shots/light-now.png |
| Scrolling so the next header takes the bar moves the highlight | 9 | updateSticky -> rAF dispatch (no dispatch inside the listener); shots/dark-next.png (Next full, Inbox dimmed) |
| No headers -> nothing dimmed | 8 | dump.ts:368 returns null; DumpEditor.tsx:164 returns Decoration.none; test `- a\n- b` |
| Clean view unchanged | 9 | CSS scoped to `.dump-writer`; shots/clean.png has no dimming |
| Sticky bar, hanging indents, tag colours | 9 | shots/dark-next.png (bar, hanging indents, tags dim with the line); those code paths are untouched |
| Tests / typecheck green | 10 | run by me |

Round-1 gap (test for the first header after an intro, `intro\n## Now\n- a`, pos 8 -> {6,16}) is closed. The test is appended and the dump.ts mutant is now killed.

frozen-diff.md: the import of dumpCurrentSection moved to a later line in the test file, and one test was appended. No assertion was changed or weakened. Fine.

Styles: opacity only; the transition names `opacity` and sits inside prefers-reduced-motion: no-preference. Compliant with good-css. The hover and active rules do not apply here.

Data flow: nothing outside the editor. The active start is derived in updateSticky, applied via a rAF effect, and the doc-change path resets `applied` and maps the decorations. I found no concrete bug.

MUTANTS:
- src/shared/dump.ts:371 (`i <= 0`): killed this round.
- src/renderer/components/DumpEditor.tsx:162 (`if (e)`): GAP (missing test), accepted. The repo has no CodeMirror test harness; the effect would be ignored and dimming would never appear, which shots/dark-now.png refutes.
- src/renderer/components/DumpEditor.tsx:163 (`!== null`): GAP (missing test), accepted. Null handling inverted; shots/dark-now.png refutes it.
- src/renderer/components/DumpEditor.tsx:164 (`if (section)`): GAP (missing test), accepted. Inverted null-section handling; shots refute it.
- src/renderer/components/DumpEditor.tsx:166 (`n < lines`): GAP (missing test), accepted. The last line would not be dimmed; shots/dark-next.png shows the last Inbox line dimmed.
- src/renderer/components/DumpEditor.tsx:168 (`> section.to`): GAP (missing test), accepted. The header at `to` would stay undimmed; shots/dark-now.png shows `## Next` dimmed.
- src/renderer/components/DumpEditor.tsx:195 (`want === applied`): GAP (missing test), accepted. Dimming would not update on scroll; shots/dark-next.png refutes it.

The six editor gaps are not blocking: the task's Visual check covers them and the repo has no CodeMirror test setup. The pure range logic is fully covered by tests.
