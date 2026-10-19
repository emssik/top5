Mutants: 10 sampled of 10 candidates on added lines — 9 killed, 1 survived.

Survived — the tests still pass with this change. For each: a missing test (gap, give the scenario) or an equivalent mutant (no behaviour change):

- `src/main/service/mail-inbox.ts:177`
  - original: `const sentDay = new Map<string, string>() // mail id → logical day it was sent; not shown to the model`
  - mutant:   `const sentDay = new Map<string, string>() // mail id → logical day it was sent; shown to the model`
