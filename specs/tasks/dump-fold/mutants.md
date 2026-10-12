Mutants: 10 sampled of 15 candidates on added lines — 2 killed, 8 survived.

Survived — the tests still pass with this change. For each: a missing test (gap, give the scenario) or an equivalent mutant (no behaviour change):

- `src/renderer/components/DumpEditor.tsx:66`
  - original: `return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [])`
  - mutant:   `return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x !== 'string') : [])`

- `src/renderer/components/DumpEditor.tsx:81`
  - original: `const line = (n: number) => (n < doc.lines ? doc.line(n + 1).text : null)`
  - mutant:   `const line = (n: number) => (n <= doc.lines ? doc.line(n + 1).text : null)`

- `src/renderer/components/DumpEditor.tsx:82`
  - original: `for (let i = 0; i < doc.lines; i++) {`
  - mutant:   `for (let i = 0; i <= doc.lines; i++) {`

- `src/renderer/components/DumpEditor.tsx:83`
  - original: `if (!stored.has(doc.line(i + 1).text.trim())) continue`
  - mutant:   `if (!stored.has(doc.line(i - 1).text.trim())) continue`

- `src/renderer/components/DumpEditor.tsx:266`
  - original: `return end === null ? null : { from: doc.lineAt(from).to, to: doc.line(end + 1).to }`
  - mutant:   `return end !== null ? null : { from: doc.lineAt(from).to, to: doc.line(end + 1).to }`

- `src/renderer/components/DumpEditor.tsx:292`
  - original: `el.classList.toggle('dump-fold-hover', e.clientY >= r.top && e.clientY < r.bottom)`
  - mutant:   `el.classList.toggle('dump-fold-hover', e.clientY > r.top && e.clientY < r.bottom)`

- `src/renderer/components/DumpEditor.tsx:317`
  - original: `if (u.docChanged || foldedRanges(u.startState) !== foldedRanges(u.state)) {`
  - mutant:   `if (u.docChanged || foldedRanges(u.startState) === foldedRanges(u.state)) {`

- `src/renderer/components/DumpEditor.tsx:321`
  - original: `if (json !== written) writeFolded((written = json))`
  - mutant:   `if (json === written) writeFolded((written = json))`
