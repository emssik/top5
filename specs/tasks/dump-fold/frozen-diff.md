Frozen tests changed by the coder after `delegate red` (tdd). The verifier checks every changed assertion against Examples / Contract / Decisions.

```diff
--- frozen/tests/dump-tags.test.ts
+++ tests/dump-tags.test.ts
@@ -1,6 +1,6 @@
 import test from 'node:test'
 import assert from 'node:assert/strict'
-import { completeDumpItem, countSectionOpen, dumpCurrentSection, dumpFoldEnd, findDumpItem, findDumpTags, projectTagTrigger, setDumpItemTag, stripDumpTags } from '../src/shared/dump'
+import { completeDumpItem, countSectionOpen, dumpCurrentSection, findDumpItem, findDumpTags, projectTagTrigger, setDumpItemTag, stripDumpTags } from '../src/shared/dump'
 import { parseRepeatLine } from '../src/shared/dump-repeat'
 
 const CODES = ['ATD', 'BIZ']
@@ -180,6 +180,7 @@
   assert.deepEqual(dumpCurrentSection('intro\n## Now\n- a', 8), { from: 6, to: 16 })
 })
 
+import { dumpFoldEnd } from '../src/shared/dump'
 const foldEnd = (lines: string[], i: number) => dumpFoldEnd((n) => lines[n] ?? null, i)
 
 test('dumpFoldEnd folds an item with sub-points or notes', () => {
```
