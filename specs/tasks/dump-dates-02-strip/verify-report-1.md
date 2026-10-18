STATUS: FAIL

Tests run by me: `npm test` 97/97 pass, `npm run typecheck` clean.

| Criterion | Score | Evidence |
|---|---|---|
| Today/overdue rows with ✓ ✕, `zaległe Nd` | 9 | DumpTodayStrip.tsx:121-135; shots/expanded-dark.png (B `zaległe 2d`, C no badge, order B, C; A/E/F absent) |
| Tomorrow preview with ✕ only | 9 | DumpTodayStrip.tsx:125,131,133; expanded-dark.png (D `jutro`, only ✕) |
| ✓ moves to end of `## Now`, saves | 8 | DumpView.tsx:206-214 `acceptDated` -> `moveDumpItems` -> `applyEdit`; no automated test (task: none), coder's manual check only |
| ✕ popover +1d/+2d/+3d/+1w, date input, `Usuń datę`, closes on choice/outside/Esc | 8 | DumpTodayStrip.tsx:37-46, 136-149; popover-dark.png (not clipped, pushes rows down) |
| Actions re-find by title+date in current text | 9 | DumpView.tsx:206-212 uses `textRef.current` |
| Collapsed header `📅 N` only if N>0; dated count as new | 9 | DumpTodayStrip.tsx:61,93; collapsed-dark.png (`↻ 0 dziś · 📅 2 · 3 nowe`) |
| Missing `## Now` -> error, text unchanged | 8 | DumpView.tsx:211 |
| typecheck + existing tests | 10 | run above |
| Visual: light theme | 4 | shots/expanded-light.png: all three ✕ buttons render dark (near-black), unlike dark theme. By CSS (`.proposal-btn.dismiss` -> `var(--bg-surface)` = #ccd0da in light) they should be light. The coder guessed this is a mid-transition frame and did not retake it. The screenshot does not show a correct light state. |

GAPS
1. Visual check "light theme" is not proven: retake `expanded-light.png` after the theme switch settles (wait >0.15s, or disable the transition) and show the ✕ buttons in the light colours. If they stay dark after settling, it is a real style bug (check what overrides `.proposal-btn.dismiss` in the light theme / writer layout). Fixed when the new screenshot shows light ✕ buttons.

Notes (not gaps): the three harness page errors `reading 'useCallback'` were not investigated, which is plausible for a duplicate-React standalone harness. The wrong error text when `setDumpItemDate` returns null (DumpView.tsx:211) is unreachable for listed rows. Duplicate title+date items would give duplicate React keys (DumpTodayStrip.tsx:126) and the action hits the first one. Both are edge cases.

MUTANTS: (10 sampled, 0 killed. No UI tests exist by design: the task says "Required tests: none")
- src/renderer/components/DumpTodayStrip.tsx:39 `if (!pickerId)`: untested UI effect. Gap by design (no component tests), covered only by manual check.
- src/renderer/components/DumpTodayStrip.tsx:52 `dueTomorrow` filter `!==`: untested. A dump with D dated tomorrow would show every later-dated item instead. Accepted gap (UI, no tests).
- src/renderer/components/DumpTodayStrip.tsx:67 `overdueDays` `-` -> `+`: untested. The badge would show a huge number instead of 2d. Accepted gap.
- src/renderer/components/DumpTodayStrip.tsx:93 `dueNow.length >= 0`: untested. `📅 0` would show with no dated items. Accepted gap.
- src/renderer/components/DumpTodayStrip.tsx:125 `isTomorrow` `!==`: untested. Same class of gap as line 52.
- src/renderer/components/DumpTodayStrip.tsx:131 `isTomorrow ||`: untested. The `jutro` badge would be on the wrong rows.
- src/renderer/components/DumpTodayStrip.tsx:134 `pickerId !== id`: untested. The popover would open on the wrong click.
- src/renderer/components/DumpTodayStrip.tsx:136 `pickerId !== id &&`: untested. Same class of gap.
- src/renderer/components/DumpView.tsx:209 `if (cur) return`: untested. A stale item would be ignored, or the action would run on undefined. Accepted gap.
- src/renderer/components/DumpView.tsx:211 `if (result)`: untested. Same class of gap.
All survivors come from the lack of component tests, which the task explicitly allows (the screenshots are the check). The text logic is covered by tests/dump-dates.test.ts.

TASK DOUBTS: none.
