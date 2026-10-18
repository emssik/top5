STATUS: PASS

Tests rerun by me: `npm test && npm run test:api` green (126 tests).

| Criterion | Score | Evidence |
|---|---|---|
| Inline ` @` picker, Enter writes `@YYYY-MM-DD` to first line, replaces older date | 8 | `src/renderer/components/DumpView.tsx:238-243` (trigger), `:294-308` (`pickDate` strips typed query, `setDumpItemDate`). `shots/inline-picker-dark.png`. Coder-driven ` @jutro` + Enter. |
| ⌘T set / change / remove | 8 | `DumpView.tsx:370` (blank and `#` lines do nothing), `:489` remove button. `shots/cmdt-picker-dark.png`. Remove not exercised by coder. |
| Unparseable never writes, `Nie rozumiem daty` | 8 | `src/renderer/components/DumpDatePicker.tsx:41-44` (writes only if parsed), `:67-69` message. `shots/unparseable-dark.png`. |
| Tokens highlighted, overdue colour on open items | 9 | `src/renderer/components/DumpEditor.tsx:55-63`. `shots/editor-dates-dark.png` shows future, overdue (red) and done-line (plain) tokens. |
| Project picker works, one picker at a time | 8 | Single `Picker` state with `kind` (`DumpView.tsx:36`); project trigger has priority in `handleChange`; `triggerOf` per kind. |
| Placeholder help line | 10 | `DumpView.tsx:469`. |
| `SKILL.md` and `docs/API.md` | 9 | Both diffs carry the `@YYYY-MM-DD` paragraph with all required points. |
| Typecheck and tests green | 9 | Gate passed, tests green in my run. |

Visual: `shots/inline-picker-dark.png`, `shots/inline-picker-light.png`, `shots/cmdt-picker-dark.png`, `shots/editor-dates-dark.png` all show the required items.

Notes:
- Task says "Required tests: none", screenshots are the check, so no new tests is not a gap.
- CSS reuses `.dump-picker*` and existing variables; overdue red is hard-coded, matching the existing badge, as D1 allows.
- D2: `src/main/shortcuts.ts` not changed; reasoning plausible but verified from code only, not in a packaged build.
- No concrete bug found. Coder-admitted omissions (no light overdue override, no Tab handling, unexercised remove / e-mail / blank-line cases) are minor or covered by existing helpers.

MUTANTS: all 10 survived because no UI tests exist (allowed by the task). Each is a missing-test case, not a defect.
- `src/renderer/components/DumpDatePicker.tsx:21`: month `m-1` to `m+1` gives wrong weekday label; screenshot-verified.
- `src/renderer/components/DumpDatePicker.tsx:22`: year-suffix condition inverted would show `.2026`; screenshot-verified.
- `src/renderer/components/DumpDatePicker.tsx:39`: arrow direction inverted; coverage gap by task design.
- `src/renderer/components/DumpDatePicker.tsx:45`: Escape check inverted; coverage gap by task design.
- `src/renderer/components/DumpDatePicker.tsx:50`: capture to bubble phase; invisible without the editor handling keys first; coverage gap by task design.
- `src/renderer/components/DumpDatePicker.tsx:56`: `&&` to `||` hides own input in ⌘T mode; screenshot-verified.
- `src/renderer/components/DumpDatePicker.tsx:77`: active class inverted; screenshot-verified.
- `src/renderer/components/DumpView.tsx:38`: `triggerOf` kind inverted breaks the stale-picker check; coder-driven interaction only.
- `src/renderer/components/DumpView.tsx:301`: `+` to `-` yields garbage text in the inline write; coder-driven example only.
- `src/renderer/components/DumpView.tsx:475`: `mode` check inverted breaks stale-picker logic; coder-driven interaction only.

No gaps. No task doubts.
