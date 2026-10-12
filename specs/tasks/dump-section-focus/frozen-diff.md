Frozen tests changed by the coder after `delegate red` (tdd). The verifier checks every changed assertion against Examples / Contract / Decisions.

```diff
--- frozen/tests/dump-tags.test.ts
+++ tests/dump-tags.test.ts
@@ -1,6 +1,6 @@
 import test from 'node:test'
 import assert from 'node:assert/strict'
-import { completeDumpItem, dumpCurrentSection, countSectionOpen, findDumpItem, findDumpTags, projectTagTrigger, setDumpItemTag, stripDumpTags } from '../src/shared/dump'
+import { completeDumpItem, countSectionOpen, findDumpItem, findDumpTags, projectTagTrigger, setDumpItemTag, stripDumpTags } from '../src/shared/dump'
 import { parseRepeatLine } from '../src/shared/dump-repeat'
 
 const CODES = ['ATD', 'BIZ']
@@ -165,6 +165,7 @@
   assert.equal(formatDumpPaste('## Now', '', 'a\nb'), null)
   assert.equal(formatDumpPaste('zwykły tekst', '', 'a\nb'), null)
 })
+import { dumpCurrentSection } from '../src/shared/dump'
 
 test('dumpCurrentSection: section containing pos, up to the next header', () => {
   const t = '## Now\n- a\n\n## Next\n- b\n'
@@ -179,3 +180,7 @@
   assert.deepEqual(dumpCurrentSection('## Now\n- a', 999), { from: 0, to: 10 })
   assert.deepEqual(dumpCurrentSection('## Now\n- a\n##Next\n- b', 16), { from: 0, to: 21 })
 })
+
+test('dumpCurrentSection: pos inside the only header section after an intro', () => {
+  assert.deepEqual(dumpCurrentSection('intro\n## Now\n- a', 8), { from: 6, to: 16 })
+})
```
