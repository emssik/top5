Mutants: 3 sampled of 3 candidates on added lines — 0 killed, 3 survived.

Survived — the tests still pass with this change. For each: a missing test (gap, give the scenario) or an equivalent mutant (no behaviour change):

- `src/renderer/components/DumpView.tsx:460`
  - original: `{onToggleSidebar && <DumpFooter />}`
  - mutant:   `{onToggleSidebar || <DumpFooter />}`

- `src/renderer/utils/finishForToday.ts:38`
  - original: `.filter((c) => Date.parse(c.timestamp) >= since)`
  - mutant:   `.filter((c) => Date.parse(c.timestamp) > since)`

- `src/renderer/utils/finishForToday.ts:39`
  - original: `.reduce((sum, c) => sum + checkInMinutes(c), 0)`
  - mutant:   `.reduce((sum, c) => sum - checkInMinutes(c), 0)`
