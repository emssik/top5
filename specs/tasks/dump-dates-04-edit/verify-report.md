STATUS: PASS

Round 2. I ran `npm test` (99 pass), `npm run test:api` (126 pass) and `npm run typecheck`; all green. Runtime behaviour was verified in round 1 and no code changed since.

| Criterion | Score | Evidence |
|---|---|---|
| `parseDumpDate` with `base` | 9 | `src/shared/dump-dates.ts:19-25`; test `parseDumpDate: base shifts only +Nd / +Nw` |
| `dumpDateAt` matches the Examples | 9 | `dump-dates.ts:56-58`; `dumpDateAt` tests |
| Enter picks the highlighted row | 9 | `DumpDatePicker.tsx:38,55-58`; runtime check in round 1 |
| Options `jutro / +1d / +2d / +1w` counted from the base | 9 | `DumpDatePicker.tsx:33-35`; `shots/token-dark-1040.png` shows 17.10 / 18.10 / 19.10 / 24.10 |
| Token mode: caret inside the token, no focus taken, Tab/Enter/Esc | 9 | `DumpView.tsx:481-494`; `token-dark-1040.png` shows the picker, the hint line and `+2d` highlighted |
| Token mode: ↑/↓ and Enter at end of line are normal keys | 9 | `DumpDatePicker.tsx:52`; runtime check in round 1 |
| Inline pick replaces the whole `@word`, no leftover | 9 | `DumpView.tsx:302` strips the rest of the word after the caret. The coder's inline run with the caret before `7` gave `- Wpłata @2026-10-17` |
| typecheck and tests green | 9 | run by me, see above |
| Visual: dark, light, inline | 9 | `token-dark-1040.png`, `token-light-1040.png` and `inline-dark-1040.png` show the real writer layout (header, `- Wpłata @2026-10-17` with a highlighted token, footer). The theme backgrounds are correct and the text is readable. Dark and light show `+2d` highlighted with the hint line. The inline shot shows the parsed row `2026-10-17 → sob 17.10` first, then `+2d` highlighted |

Frozen tests (`frozen-diff.md`): I reviewed the diff again. The only change is that the `dumpDateAt` import moved from the top import line to a separate import line mid-file. No assertion, case or expected value changed, so it is not a weakening and not a gap.

No gaps.

MUTANTS: 9 survived, the same as round 1. The suite has no UI harness and the task requires tests only for the pure functions. Each survivor is untested UI that I checked at runtime in round 1.
- `src/renderer/components/DumpDatePicker.tsx:38`: equivalent. It only drops the parse style class.
- `src/renderer/components/DumpDatePicker.tsx:48`: missing test. Tab would stop moving the highlight. Runtime was fine.
- `src/renderer/components/DumpDatePicker.tsx:53`: missing test. ↑/↓ direction would be inverted. Runtime was fine.
- `src/renderer/components/DumpDatePicker.tsx:79`: missing test. The "Nie rozumiem daty" message would show for the wrong inputs. Runtime was fine.
- `src/renderer/components/DumpView.tsx:379`: missing test. ⌘T would not open the picker. Runtime was fine.
- `src/renderer/components/DumpView.tsx:486`: missing test. Token mode would not open on a plain caret. Runtime was fine.
- `src/renderer/components/DumpView.tsx:489`: missing test. The inline picker would be dropped when the caret moves. Runtime was fine.
- `src/renderer/components/DumpView.tsx:490`: missing test. The ⌘T picker would close on selection change. Runtime was fine.
- `src/renderer/components/DumpView.tsx:498`: missing test. Blur would close the wrong picker mode. Blur was not run at runtime; this is the residual risk, but not a gap against the task.

TASK DOUBTS: none.
