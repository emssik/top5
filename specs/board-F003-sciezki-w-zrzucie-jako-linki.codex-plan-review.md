FINDINGS: 2
1. [high] Finder aliases bypass the file-opening checks — Step 2, `specs/board-F003-sciezki-w-zrzucie-jako-linki.plan.md:130`
   Problem: A Finder alias named `reference.md`, mode 0644, pointing to an application passes the proposed checks: `realpathSync` resolves filesystem symlinks, not Finder aliases; `statSync` sees a regular file and the extension is allowed. LaunchServices follows the alias and launches the application. An alias to a directory similarly bypasses the directory restriction. The planned symlink tests and live run miss both cases.
   Change in the plan: Reject Finder aliases before opening and add real macOS checks using aliases to an application and a directory.

2. [medium] Existing metadata commands corrupt supported quoted paths — Step 4, `src/shared/dump.ts:181`
   Problem: The plan explicitly allows tag/date decorations inside quoted paths, but misses the commands that rewrite those tokens. With project code `ATD`, selecting another project through Cmd+P on `- przeczytaj "/Users/x/My #ATD Notes.md"` removes ` #ATD` from the filename and saves the broken path. Likewise, Cmd+T removes an embedded ` @2026-10-31 ` from a filename through `src/shared/dump-dates.ts:107`. All proposed criteria can pass despite this.
   Change in the plan: Make metadata recognition and replacement respect recognized path spans, and verify that project/date commands preserve filenames while updating metadata outside those spans.
