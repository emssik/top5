Frozen tests changed by the coder after `delegate red` (tdd). The verifier checks every changed assertion against Examples / Contract / Decisions.

```diff
--- frozen/tests/main/mail-inbox.test.ts
+++ tests/main/mail-inbox.test.ts
@@ -30,7 +30,7 @@
 }))
 
 process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token'
-const { pullMailTasks } = await import('../../src/main/service/mail-inbox')
+import { pullMailTasks } from '../../src/main/service/mail-inbox'
 
 const raw = (to: string, cc?: string): Buffer =>
   Buffer.from(`From: me@x.pl\r\nTo: ${to}\r\n${cc ? `Cc: ${cc}\r\n` : ''}Subject: nota\r\n\r\ntresc\r\n`)
```
