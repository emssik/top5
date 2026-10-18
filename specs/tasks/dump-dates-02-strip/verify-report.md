STATUS: PASS

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
| Visual: light theme | 9 | shots/expanded-light.png retaken: B/C/D rows, light ✕ buttons, badges `zaległe 2d` and `JUTRO` |

GAPS: none (round 1 gap closed).

Notes (not gaps): the three harness page errors `reading 'useCallback'` were not investigated, which is plausible for a duplicate-React standalone harness. The wrong error text when `setDumpItemDate` returns null (DumpView.tsx:211) is unreachable for listed rows. Duplicate title+date items would give duplicate React keys (DumpTodayStrip.tsx:126) and the action hits the first one. Both are edge cases.

MUTANTS: (re-run this round: 10 sampled, 0 killed. The task says "Required tests: none"; the screenshots are the check. Each survivor is a missing UI test, accepted by the task, and none is an equivalent mutant.)
- src/renderer/components/DumpTodayStrip.tsx:39 `if (!pickerId)` -> `if (pickerId)`: gap by design. The Esc/outside-click listener would be wrong.
- src/renderer/components/DumpTodayStrip.tsx:52 `d.date === tomorrow` -> `!==`: gap by design. The preview would list every later-dated item.
- src/renderer/components/DumpTodayStrip.tsx:67 `-` -> `+` in overdueDays: gap by design. The badge would show a huge number instead of 2d.
- src/renderer/components/DumpTodayStrip.tsx:93 `dueNow.length > 0` -> `>= 0`: gap by design. `📅 0` would show with no dated items.
- src/renderer/components/DumpTodayStrip.tsx:125 `isTomorrow` `===` -> `!==`: gap by design. Rows are classified wrongly.
- src/renderer/components/DumpTodayStrip.tsx:131 `isTomorrow &&` -> `||`: gap by design. The `jutro` badge lands on the wrong rows.
- src/renderer/components/DumpTodayStrip.tsx:134 `pickerId === id` -> `!==` in the toggle: gap by design. The popover state would be wrong.
- src/renderer/components/DumpTodayStrip.tsx:136 `pickerId === id &&` -> `!==`: gap by design. The popover would show on the wrong rows.
- src/renderer/components/DumpView.tsx:209 `if (!cur)` -> `if (cur)`: gap by design. A found item would be ignored.
- src/renderer/components/DumpView.tsx:211 `if (!result)` -> `if (result)`: gap by design. The error would show on success and not on failure.

TASK DOUBTS: none.
