# Plan
## What and where
- src/main/service/mail-inbox.ts:131-135 `\All` lookup -> add `\Trash` lookup, throw if missing && !dryRun (task Contract)
- src/main/service/mail-inbox.ts:179-191 loop: after label, if lines>0 && !dryRun -> messageMove(uid, trash.path, {uid:true}); false/throw -> count, continue; after loop throw Error with count
- header comment 10-15, doc comment 114
- vitest.config.ts:12 include += tests/main/**/*.test.ts
- tests/main/mail-inbox.test.ts new (fake ImapFlow, mocked fs/execFile)
## Steps
1. Test file + config include (task)
2. red
3. Implement (task Contract)
4. gate
## Doubts
none
