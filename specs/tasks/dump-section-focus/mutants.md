Mutants: 9 sampled of 9 candidates on added lines — 3 killed, 6 survived.

Survived — the tests still pass with this change. For each: a missing test (gap, give the scenario) or an equivalent mutant (no behaviour change):

- `src/renderer/components/DumpEditor.tsx:162`
  - original: `if (!e) return tr.docChanged ? value.map(tr.changes) : value`
  - mutant:   `if (e) return tr.docChanged ? value.map(tr.changes) : value`

- `src/renderer/components/DumpEditor.tsx:163`
  - original: `const section = e.value === null ? null : dumpCurrentSection(tr.newDoc.toString(), e.value)`
  - mutant:   `const section = e.value !== null ? null : dumpCurrentSection(tr.newDoc.toString(), e.value)`

- `src/renderer/components/DumpEditor.tsx:164`
  - original: `if (!section) return Decoration.none`
  - mutant:   `if (section) return Decoration.none`

- `src/renderer/components/DumpEditor.tsx:166`
  - original: `for (let n = 1; n <= tr.newDoc.lines; n++) {`
  - mutant:   `for (let n = 1; n < tr.newDoc.lines; n++) {`

- `src/renderer/components/DumpEditor.tsx:168`
  - original: `if (from < section.from || from >= section.to) ranges.push(dim.range(from))`
  - mutant:   `if (from < section.from || from > section.to) ranges.push(dim.range(from))`

- `src/renderer/components/DumpEditor.tsx:195`
  - original: `if (want !== applied && !pending) {`
  - mutant:   `if (want === applied && !pending) {`
