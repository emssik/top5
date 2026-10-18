Mutants: 10 sampled of 25 candidates on added lines — 1 killed, 9 survived.

Survived — the tests still pass with this change. For each: a missing test (gap, give the scenario) or an equivalent mutant (no behaviour change):

- `src/renderer/components/DumpDatePicker.tsx:38`
  - original: `const rows: { q: string; date: string; parse?: boolean }[] = parsed ? [{ q: `${query.trim()} →`, date: parsed, parse: true }, ...options] : options`
  - mutant:   `const rows: { q: string; date: string; parse?: boolean }[] = parsed ? [{ q: `${query.trim()} →`, date: parsed, parse: false }, ...options] : options`

- `src/renderer/components/DumpDatePicker.tsx:48`
  - original: `if (e.key === 'Tab') {`
  - mutant:   `if (e.key !== 'Tab') {`

- `src/renderer/components/DumpDatePicker.tsx:53`
  - original: `move(e.key === 'ArrowDown' ? 1 : -1)`
  - mutant:   `move(e.key !== 'ArrowDown' ? 1 : -1)`

- `src/renderer/components/DumpDatePicker.tsx:79`
  - original: `{q && !parsed && options.length === 0 && <div className="dump-picker-empty">Nie rozumiem daty</div>}`
  - mutant:   `{q && !parsed && options.length !== 0 && <div className="dump-picker-empty">Nie rozumiem daty</div>}`

- `src/renderer/components/DumpView.tsx:379`
  - original: `else if (key === 't') { if (setDumpItemDate(textRef.current, from, null)) setPicker({ kind: 'date', mode: 'item', pos: from, query: '', base: itemDumpDate(textRef.current, from) }) }`
  - mutant:   `else if (key !== 't') { if (setDumpItemDate(textRef.current, from, null)) setPicker({ kind: 'date', mode: 'item', pos: from, query: '', base: itemDumpDate(textRef.current, from) }) }`

- `src/renderer/components/DumpView.tsx:486`
  - original: `const token = sel && sel.from === sel.to ? dumpDateAt(text, caret) : null`
  - mutant:   `const token = sel && sel.from !== sel.to ? dumpDateAt(text, caret) : null`

- `src/renderer/components/DumpView.tsx:489`
  - original: `if (cur?.mode === 'inline') return triggerOf(cur.kind, text, caret)?.start === cur.start ? cur : null`
  - mutant:   `if (cur?.mode !== 'inline') return triggerOf(cur.kind, text, caret)?.start === cur.start ? cur : null`

- `src/renderer/components/DumpView.tsx:490`
  - original: `if (cur?.mode === 'item') return cur`
  - mutant:   `if (cur?.mode !== 'item') return cur`

- `src/renderer/components/DumpView.tsx:498`
  - original: `setPicker((cur) => (cur?.mode === 'item' ? cur : null))`
  - mutant:   `setPicker((cur) => (cur?.mode !== 'item' ? cur : null))`
