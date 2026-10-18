Frozen tests changed by the coder after `delegate red` (tdd). The verifier checks every changed assertion against Examples / Contract / Decisions.

```diff
--- frozen/tests/dump-dates.test.ts
+++ tests/dump-dates.test.ts
@@ -1,7 +1,7 @@
 import test from 'node:test'
 import assert from 'node:assert/strict'
 import { completeDumpItem, findDumpItem, stripDumpTags } from '../src/shared/dump'
-import { datedDumpItems, dumpDateAt, dumpDateTrigger, findDumpDates, parseDumpDate, setDumpItemDate } from '../src/shared/dump-dates'
+import { datedDumpItems, dumpDateTrigger, findDumpDates, parseDumpDate, setDumpItemDate } from '../src/shared/dump-dates'
 
 const today = '2026-10-16' // a Friday
 
@@ -85,6 +85,8 @@
   assert.equal(completeDumpItem('- Zadzwoń @2026-10-17', 'Zadzwoń', '2026-10-16'), '## Done\n+ 2026-10-16 Zadzwoń @2026-10-17')
 })
 
+import { dumpDateAt } from '../src/shared/dump-dates'
+
 test('parseDumpDate: base shifts only +Nd / +Nw', () => {
   const rows: [string, string, string | null][] = [
     ['+2d', '2026-10-17', '2026-10-19'], ['+1w', '2026-10-17', '2026-10-24'], ['+2d', '2026-12-31', '2027-01-02'],
```
