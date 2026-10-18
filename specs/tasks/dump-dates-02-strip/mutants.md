Mutants: 10 sampled of 15 candidates on added lines — 0 killed, 10 survived.

Survived — the tests still pass with this change. For each: a missing test (gap, give the scenario) or an equivalent mutant (no behaviour change):

- `src/renderer/components/DumpTodayStrip.tsx:39`
  - original: `if (!pickerId) return`
  - mutant:   `if (pickerId) return`

- `src/renderer/components/DumpTodayStrip.tsx:52`
  - original: `const dueTomorrow = dated.filter((d) => d.date === tomorrow)`
  - mutant:   `const dueTomorrow = dated.filter((d) => d.date !== tomorrow)`

- `src/renderer/components/DumpTodayStrip.tsx:67`
  - original: `const overdueDays = (date: string) => Math.round((Date.parse(today) - Date.parse(date)) / DAY_MS)`
  - mutant:   `const overdueDays = (date: string) => Math.round((Date.parse(today) + Date.parse(date)) / DAY_MS)`

- `src/renderer/components/DumpTodayStrip.tsx:93`
  - original: `↻ {repeatCount} dziś{dueNow.length > 0 && ` · 📅 ${dueNow.length}`}{fresh > 0 && ` · ${fresh} nowe`}`
  - mutant:   `↻ {repeatCount} dziś{dueNow.length >= 0 && ` · 📅 ${dueNow.length}`}{fresh > 0 && ` · ${fresh} nowe`}`

- `src/renderer/components/DumpTodayStrip.tsx:125`
  - original: `const isTomorrow = d.date === tomorrow`
  - mutant:   `const isTomorrow = d.date !== tomorrow`

- `src/renderer/components/DumpTodayStrip.tsx:131`
  - original: `{isTomorrow && <span className="tomorrow-badge">jutro</span>}`
  - mutant:   `{isTomorrow || <span className="tomorrow-badge">jutro</span>}`

- `src/renderer/components/DumpTodayStrip.tsx:134`
  - original: `<button className="proposal-btn dismiss dump-strip-date-btn" onClick={() => setPickerId(pickerId === id ? null : id)} title="Przełóż">✕</button>`
  - mutant:   `<button className="proposal-btn dismiss dump-strip-date-btn" onClick={() => setPickerId(pickerId !== id ? null : id)} title="Przełóż">✕</button>`

- `src/renderer/components/DumpTodayStrip.tsx:136`
  - original: `{pickerId === id && (`
  - mutant:   `{pickerId !== id && (`

- `src/renderer/components/DumpView.tsx:209`
  - original: `if (!cur) return`
  - mutant:   `if (cur) return`

- `src/renderer/components/DumpView.tsx:211`
  - original: `if (!result) return setError('Brak sekcji ## Now w zrzucie.')`
  - mutant:   `if (result) return setError('Brak sekcji ## Now w zrzucie.')`
