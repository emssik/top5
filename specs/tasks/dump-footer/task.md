# Task

## Goal
In the main-window dump ("Zrzut", writer layout) the editor runs right to the bottom edge of the window, while the top has breathing room. Add a quiet footer bar at the bottom of the writer layout that gives the same visual margin as the top, and shows: Polish weekday + date, current time, and today's total focus time.

## Source
- none

## Files
- `src/renderer/components/DumpView.tsx` — render the footer only in the writer layout (when `onToggleSidebar` is passed); clean view (no `onToggleSidebar`) stays unchanged
- `src/renderer/styles.css` — footer styles (`.dump-footer…`), adjust `.dump-writer` bottom spacing if needed
- `src/renderer/utils/finishForToday.ts` — new helper next to `minutesWorkedToday`

## Contract
- `minutesFocusedToday(checkIns: FocusCheckIn[]): number` in `src/renderer/utils/finishForToday.ts` — sum of `checkInMinutes(c)` over ALL check-ins (any task) since the last logical-day boundary (`lastRolloverMs()`, 06:00 local). Same boundary as `minutesWorkedToday`.
- Footer reads check-ins from the zustand store: `useProjects().focusCheckIns` (already reloaded on `reload-data`, no new IPC).
- Footer text (left side): `<Dzień tygodnia>, <d> <miesiąc w dopełniaczu> · <HH:MM>` — e.g. `Niedziela, 11 października · 16:42`. Lowercase month in genitive (stycznia … grudnia). Time 24h, 2-digit.
- Footer text (right side): `Focus dziś: <formatCheckInTime(minutes)>` using the existing `formatCheckInTime` from `src/renderer/utils/checkInTime.ts`. Hidden when minutes = 0? No — show `Focus dziś: 0m` so the bar layout is stable.
- Clock updates at least once per minute (interval in the footer component only, so the editor does not re-render every tick — put the footer in its own small component in `DumpView.tsx` or a sibling file listed above; prefer same file).

## Examples
- Sunday 2026-10-11 16:42, check-ins today 07:10 (minutes 25) and 15:00 (response `yes`, no minutes) → `Niedziela, 11 października · 16:42` … `Focus dziś: 40m`
- Check-in yesterday 23:00 (60 min) and today 05:30 before 06:00 (30 min), now 05:45 → logical day started yesterday 06:00 → `Focus dziś: 1h 30m`
- Same data, now 07:00 → both before 06:00 today → `Focus dziś: 0m`
- 125 minutes → `Focus dziś: 2h 5m`
- Clean view (Dashboard without `onToggleSidebar`) → no footer rendered

## Data flow
- `focusCheckIns` — written by main to `checkins.jsonl`, loaded into the `useProjects` store by `loadData()` (App.tsx, on start and on `reload-data`), read by the dump footer via `minutesFocusedToday`. No other hops.

## Visual check
- Writer layout (main window, dump view, sidebar hidden), dark theme, window ~1040×1100 — footer visible at bottom with the same visual spacing as the header at the top; editor text scrolls above it, not under it
- Same, light theme (`data-theme="light"` on `<html>`)
- Narrow window ~700px wide — footer text does not wrap into two lines or overflow horizontally (truncate/hide the right part if needed)

## Done criteria
- [ ] Footer bar rendered at the bottom of the writer-layout dump; bottom spacing visually matches the top header spacing (header has the `.dashboard-titlebar` 24px + `.main` 24px padding above it)
- [ ] Footer aligned to the same centered text column as the header (`.dump-writer > :not(.dump-editor)` rule — width `min(100% - 48px, var(--dump-col))`)
- [ ] Footer style matches the header `section-label` look: muted colour, small type, no border box; does not compete with the text
- [ ] Left: Polish weekday + day + genitive month + 24h time; right: `Focus dziś: Xh Ym` from `minutesFocusedToday`
- [ ] Clock refreshes at least every minute; the interval lives in the footer component only
- [ ] Editor content still scrolls fully (last line reachable above the footer); `40vh` bottom padding in `.cm-content` stays
- [ ] Clean view dump unchanged
- [ ] `npm run typecheck` and existing tests green

## Required tests
- none (renderer utils are not in the node test build; UI verified by screenshots)

## Allowed changes to existing tests
- none

## New dependencies
- none

## Decisions
- D0: styles — load the `good-css` skill. Use existing CSS variables (`--c-text-muted`, `--bg-base`, etc.), no new colours. Keep it minimal (lazy-senior: no new abstractions, shortest working diff).
