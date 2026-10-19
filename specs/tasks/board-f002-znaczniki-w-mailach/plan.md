# Plan
## What and where
- src/shared/dump.ts:70 addOpenLines (+section; insertInSection(lines, section, block, Inbox?'top':'end') like moveDumpItems :299); mergeExternalAppends :89 ponytail comment (D0b)
- src/main/service/dump.ts:63 appendDumpLines(lines, section)
- src/main/mail-to-dump.ts:19 pass section
- src/main/service/mail-inbox.ts: PROMPT :46, parseMailTask (new), pullMailTasks :143 (parsed.date at fetch loop :176 -> Map id->sentDay; classify loop :188 groups)
- tests: tests/main/mail-inbox.test.ts, tests/api/dump.test.ts (append only)
## Steps
1. stubs + tests, red (task)
2. addOpenLines section (task, dump.ts:299)
3. parseMailTask (task)
4. pullMailTasks groups Now/Next/Inbox, sentDay via logicalDateKey(parsed.date) (task, D0 ponytail)
5. forward section in service/dump.ts, mail-to-dump.ts (task)
6. PROMPT markers (task)
## Doubts
none
