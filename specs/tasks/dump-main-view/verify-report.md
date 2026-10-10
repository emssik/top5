STATUS: PASS

Testy uruchomione osobiście: `npm test` 71/71, `npm run test:api` 125/125, `npm run typecheck` czyste.

| Kryterium | Ocena | Dowód |
| --- | --- | --- |
| Przykłady shared jako testy | 9 | `tests/dump-tags.test.ts` (findDumpTags, stripDumpTags, setDumpItemTag, projectTagTrigger, countSectionOpen, item matching, parseRepeatLine ważne/nieważne); `package.json` zmieniony tylko o wpis testu |
| Istniejące testy + typecheck | 10 | uruchomione, zielone |
| Kolorowe tagi, warstwa podświetlenia wyrównana | 8 | `src/renderer/styles.css` `.dump-highlight { overflow: hidden }` + `DumpView.tsx` `onScroll` ustawia `highlightRef.scrollTop`.  |
| Picker ` #` (filtr, ↑↓, Enter/Tab, Esc, nigdy na początku linii) | 8 | `DumpProjectPicker.tsx`, `projectTagTrigger` (`src/shared/dump.ts`), test `projectTagTrigger` |
| ⌘P: picker + setDumpItemTag, Esc | 8 | `DumpView.tsx` `handleKeyDown` (klawisz p), `pickProject`, test `setDumpItemTag` |
| Natywny ⌘Z (execCommand) | 8 | `DumpView.tsx` `replaceText`, `pickProject` (execCommand + fallback `applyEdit`) |
| ⌘R (błędy, duplikat, nieznany kod, kolejność) | 8 | `DumpView.tsx` `repeatFromItem`: saveRepeatingTask przed `applyEdit`; testy `parseRepeatLine` |
| ⌘F bez tagu w tytule + projectId; ticking tagowanej linii | 9 | `DumpView.tsx` `focusOnItem`; `findDumpItem`/`completeDumpItem` test "item matching ignores tags" |
| Nagłówek `Now x/limit`, czerwony > limit | 9 | `DumpView.tsx` `nowOpen`/`nowLimit`, `.dump-now-over`; test `countSectionOpen` |
| Pasek „Dziś" | 8 | `DumpTodayStrip.tsx` (useTaskList excludeFocus, getScheduledHabits, ✓/✕, seen/collapsed w try/catch, `↻ N dziś · M nowe`, `.has-new` gruba lewa ramka) |
| Placeholder ze skrótami | 10 | `DumpView.tsx` placeholder (#, ⌘P, ⌘R) |
| Dashboard: top5.lastView + dump w clean view | 8 | `Dashboard.tsx` useState z localStorage (try/catch), efekt zapisu, `activeView === 'dump'` → `<DumpView />` |
| docs/API.md + SKILL.md | 9 | sekcja „Project tags" w `docs/API.md`, rozszerzony akapit w `cli/top5-cli/SKILL.md` |

## Luki
Brak. Luka 1 naprawiona: `src/renderer/styles.css` `.dump-highlight { overflow: hidden }`, a `scrollbar-gutter: stable` z `.dump-layer` obejmuje już obie warstwy.
