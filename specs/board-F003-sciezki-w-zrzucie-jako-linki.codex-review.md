FINDINGS: 1
1. [medium] A quoted root path swallows the next quoted file link — `src/shared/dump.ts:151`
   Scenario: `"/" "/Users/daniel/report.pdf"` produces the bogus match `/" `: the required post-slash character consumes the first closing quote. The actual PDF path is consequently not recognized or clickable.
   Fix: Prevent the required post-slash character from consuming the closing delimiter, so quoted root tokens are skipped without swallowing subsequent paths.
