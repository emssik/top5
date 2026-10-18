Mutants: 10 sampled of 26 candidates on added lines — 0 killed, 10 survived.

Survived — the tests still pass with this change. For each: a missing test (gap, give the scenario) or an equivalent mutant (no behaviour change):

- `src/renderer/components/DumpDatePicker.tsx:21`
  - original: `const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]`
  - mutant:   `const weekday = WEEKDAYS[new Date(Date.UTC(y, m + 1, d)).getUTCDay()]`

- `src/renderer/components/DumpDatePicker.tsx:22`
  - original: `return `${weekday} ${d}.${m}${date.slice(0, 4) === today.slice(0, 4) ? '' : `.${y}`}``
  - mutant:   `return `${weekday} ${d}.${m}${date.slice(0, 4) !== today.slice(0, 4) ? '' : `.${y}`}``

- `src/renderer/components/DumpDatePicker.tsx:39`
  - original: `setIndex((i) => Math.max(0, Math.min(QUICK.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))))`
  - mutant:   `setIndex((i) => Math.max(0, Math.min(QUICK.length - 1, i + (e.key !== 'ArrowDown' ? 1 : -1))))`

- `src/renderer/components/DumpDatePicker.tsx:45`
  - original: `} else if (e.key === 'Escape') {`
  - mutant:   `} else if (e.key !== 'Escape') {`

- `src/renderer/components/DumpDatePicker.tsx:50`
  - original: `window.addEventListener('keydown', onKey, true)`
  - mutant:   `window.addEventListener('keydown', onKey, false)`

- `src/renderer/components/DumpDatePicker.tsx:56`
  - original: `{onQueryChange && (`
  - mutant:   `{onQueryChange || (`

- `src/renderer/components/DumpDatePicker.tsx:77`
  - original: `className={`dump-picker-item ${i === index ? 'active' : ''}`}`
  - mutant:   `className={`dump-picker-item ${i !== index ? 'active' : ''}`}`

- `src/renderer/components/DumpView.tsx:38`
  - original: `const triggerOf = (kind: Picker['kind'], text: string, caret: number) => (kind === 'project' ? projectTagTrigger : dumpDateTrigger)(text, caret)`
  - mutant:   `const triggerOf = (kind: Picker['kind'], text: string, caret: number) => (kind !== 'project' ? projectTagTrigger : dumpDateTrigger)(text, caret)`

- `src/renderer/components/DumpView.tsx:301`
  - original: `if (trigger) applyEdit(setDumpItemDate(text.slice(0, trigger.start - 1) + text.slice(caret), trigger.start - 1, date))`
  - mutant:   `if (trigger) applyEdit(setDumpItemDate(text.slice(0, trigger.start - 1) - text.slice(caret), trigger.start - 1, date))`

- `src/renderer/components/DumpView.tsx:475`
  - original: `if (picker?.mode === 'inline' && triggerOf(picker.kind, textRef.current, caret)?.start !== picker.start) setPicker(null)`
  - mutant:   `if (picker?.mode !== 'inline' && triggerOf(picker.kind, textRef.current, caret)?.start !== picker.start) setPicker(null)`
