STATUS: FAIL

I ran `npm test`: 99 pass, 0 fail. I also mounted the real `DumpView` in a Vite harness with a stubbed `window.api` and drove it with playwright, then removed the harness. I did not run `npm run test:api` or `npm run typecheck`.

| Criterion | Score | Evidence |
|---|---|---|
| `parseDumpDate` with `base` shifts only `+Nd`/`+Nw`; without `base` unchanged | 9 | `src/shared/dump-dates.ts:19-25`; test `parseDumpDate: base shifts only +Nd / +Nw` in `tests/dump-dates.test.ts`; existing tests green. |
| `dumpDateAt` matches the Examples | 9 | `src/shared/dump-dates.ts:56-58`; the `dumpDateAt` tests. |
| Enter picks the highlighted row, even when the query parses | 9 | `src/renderer/components/DumpDatePicker.tsx:38,55-58`. Runtime: `@2026-10-1` + `7`, ↓↓, Enter wrote `@2026-10-18`, and the typed row was not picked. No automated test. |
| Options with a base are `jutro / +1d / +2d / +1w`, counted from the base | 9 | `DumpDatePicker.tsx:33-35`. Runtime: the picker showed `sob 17.10 / nd 18.10 / pon 19.10 / sob 24.10`. ⌘T showed the same four rows plus `Usuń datę`. |
| Caret strictly inside a token opens the picker without taking focus; Tab, Enter and Esc work | 9 | `src/renderer/components/DumpView.tsx:481-494,303-308,317-320`. Runtime: caret in `10` showed the picker and the hint line. Tab Tab Enter gave `@2026-10-19`. A mouse click on the token and a click on the `+2d` row both worked. After Esc the picker stayed closed through caret moves inside the token. |
| In token mode ↑/↓ and Enter at the end of a line behave as normal editor keys | 9 | `DumpDatePicker.tsx:52`. Runtime: ↓ closed the picker and moved the caret. Enter at the end of the dated line added a newline and the picker did not open. |
| Inline pick replaces the whole `@word` | 8 | `DumpView.tsx:302`. The `jutro` pick with the caret before `7` was not run. The ↓↓ Enter path worked. No test covers the leftover-character case. |
| `npm run typecheck` and `npm test` green | 8 | `npm test` was green in my run. I did not run typecheck. The coder reports it green and the gate passed. |
| Visual check (dark, light, inline) | 4 | The three shots in `shots/` (`token-dark-1040.png`, `token-light-1040.png`, `inline-dark-1040.png`) show the picker on a white page. They are not the writer layout. In `token-dark-1040.png` and `inline-dark-1040.png` the dark-theme text sits on white and is nearly invisible. The task asks for the main window, dump view. |

Frozen tests (`frozen-diff.md`): only an import moved. The original import line lost `dumpDateAt` and a second import line was added mid-file. No assertion changed, so this is fine.

Gaps:
1. Visual check evidence is not the real window. Re-shoot token-dark, token-light and inline-dark from the real `DumpView` at about 1040 px wide. Use the real body background, the light theme via `data-theme="light"` on `<html>`, and show `- Wpłata @2026-10-17` with the caret inside the token. It is fixed when the screenshots show the dump editor behind the picker, with the hint line visible and `+2d` highlighted.

The coder's admitted gap (token flow not run in `DumpView`) is covered by my runtime run. The white-page screenshots are the same gap as above.

MUTANTS: 9 survived. The suite has no component-level tests, so every survivor in `DumpDatePicker.tsx` and `DumpView.tsx` is untested UI. The task's Required tests list only pure functions. I checked each behaviour at runtime in `DumpView`, but a later regression would not be caught by the suite.
- `src/renderer/components/DumpDatePicker.tsx:38` (`parse: false`): equivalent for behaviour. It only drops the `.dump-picker-parse` style class.
- `src/renderer/components/DumpDatePicker.tsx:48` (Tab inverted): a missing test. Tab no longer moves the highlight, so Tab Tab Enter would not write 19. Runtime check passed.
- `src/renderer/components/DumpDatePicker.tsx:53` (↓/↑ direction inverted): a missing test. ↓ would move the highlight up. Runtime ↓↓ check passed.
- `src/renderer/components/DumpDatePicker.tsx:79` (`Nie rozumiem daty` condition): a missing test. The message would show when options exist and not show for the unparseable `@2026-10-1` case. Runtime showed it correctly.
- `src/renderer/components/DumpView.tsx:379` (⌘T key condition inverted): a missing test. ⌘T would not open the picker. Runtime ⌘T showed the base-relative options.
- `src/renderer/components/DumpView.tsx:486` (selection-empty check inverted): a missing test. Token mode would not open on a plain caret. Runtime it opened.
- `src/renderer/components/DumpView.tsx:489` (inline keep condition inverted): a missing test. An inline picker would be dropped or mishandled when the caret moves. Runtime inline flow was fine.
- `src/renderer/components/DumpView.tsx:490` (item keep condition inverted): a missing test. The ⌘T picker would close on selection change. Runtime ⌘T stayed open.
- `src/renderer/components/DumpView.tsx:498` (blur handler inverted): a missing test. The ⌘T input blur would close the picker and token mode would not close on blur. I did not exercise blur at runtime.

I did not count these as gaps on their own. The task requires tests only for the pure functions, and the repo has no UI test harness.

TASK DOUBTS: none.
