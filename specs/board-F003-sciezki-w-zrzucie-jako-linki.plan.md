# Plan: Ścieżki do plików w Zrzucie jako klikalne linki (Cmd+klik) — F003

> Bezwzględna ścieżka (`/Users/…/plik.md`, `~/…/plik.md`) wpisana w Zrzucie dostaje w edytorze styl linku. Cmd+klik
> otwiera plik w domyślnej aplikacji macOS. Renderer tylko wykrywa ścieżkę i przekazuje ją przez IPC; main rozwija `~`,
> sprawdza plik na dysku i otwiera go przez `shell.openPath` — wyłącznie gdy to zwykły, niewykonywalny plik.
> Treść Zrzutu może pochodzić z maili (`src/main/mail-to-dump.ts`), więc ścieżka jest niezaufana.

## Context & Motivation

Daniel trzyma w Zrzucie (zakładka „Zrzut”, edytor CodeMirror 6 w `src/renderer/components/DumpEditor.tsx`) notatki,
w których często wkleja ścieżki do plików (notatki `.md`, obrazki, PDF-y). Dziś trzeba je kopiować do Findera/terminala.
Cel: Cmd+klik jak w edytorach kodu. Zwykły klik zostaje bez zmian (edycja).

Stack (z `.mycc.yaml`): TypeScript, Electron, React, CodeMirror 6 (`@codemirror/view` 6.43.14). IPC: handlery w main,
most w `src/preload/index.ts`, typy mostu w `src/renderer/types/index.ts`. Electron sandbox wyłączony — **nie ruszać**
`webPreferences.sandbox`. Brak zmian w HTTP API → `docs/API.md`, `cli/` i skill `top5-cli` bez zmian.

Zasady kodowania Daniela (obowiązują wykonawcę): tryb leniwego seniora — najmniejsze działające rozwiązanie, bez
nieproszonych abstrakcji, bez nowych zależności, najkrótszy działający diff. Świadome uproszczenia oznaczać komentarzem
`ponytail:` z nazwanym sufitem. **Nie upraszczać** walidacji na granicy zaufania ani bezpieczeństwa (ścieżka z Zrzutu
jest niezaufana). Bez auto-commitów kodu na gałęziach Daniela (gałąź `auto/F003` utworzona przez automat — commity
robocze OK). Styl komentarzy w kodzie: krótkie, po angielsku, jak w istniejących plikach.

## Scope

### In scope
- Czysta funkcja `findDumpPaths(text)` w `src/shared/dump.ts` + testy w `tests/dump-tags.test.ts`.
- Czysta funkcja decydująca w main `openableDumpPath(raw, home)` w nowym pliku `src/main/dump-path.ts` + test vitest
  `tests/main/dump-path.test.ts`.
- Kanał IPC `open-dump-path` (handler w `src/main/launchers.ts`, most `openDumpPath` w preload, typ w `types/index.ts`).
- Dekoracja `dump-path` w `decorate()`, styl w `src/renderer/styles.css`, kursor `pointer` przy wciśniętym Cmd,
  obsługa Cmd+kliku w `DumpEditor.tsx`.

### Out of scope
- Ścieżki względne (`./plik`, `plik.md`), adresy URL (`http://…`, `file://…`).
- Otwieranie katalogów, pakietów `.app`, plików wykonywalnych (ani „pokaż w Finderze”).
- Wyróżnianie zależne od istnienia pliku (renderer nie sprawdza dysku).
- HTTP API, CLI, skill `top5-cli`, quick-add i inne okna.
- Komunikat dla użytkownika, gdy plik nie istnieje / jest zablokowany (cisza — zgodnie z ticketem).

### Constraints
- Renderer niczego nie otwiera sam; cała decyzja i `~` po stronie main.
- Brak logowania błędów w konsoli main dla nieistniejących/zablokowanych ścieżek.
- `npm test` (tsc + node:test, jawna lista plików w `package.json:10`) i `npm run test:api` (vitest, `tests/api/**`,
  `tests/main/**` — automatycznie) oraz `npm run build` muszą przejść.

## Key Decisions

### Decision 1: Format rozpoznawanej ścieżki — tylko bezwzględne, spacje wyłącznie w cudzysłowie/backtickach
- **Choice:** Ścieżka zaczyna się od `/` albo `~/` na początku słowa (początek linii, biały znak albo `(`). Bez cudzysłowu
  kończy się na pierwszym białym znaku, a końcowe `.` `,` `)` `:` (dowolna ich seria) do niej nie należą. W `"…"` lub
  `` `…` `` (otwierający znak na początku słowa, zamykający w tej samej linii) może zawierać spacje; zakres bez znaków
  cudzysłowu, końcowa interpunkcja wewnątrz cudzysłowu zostaje. Linie zaczynające się od `#` (po `trimStart`) są
  pomijane — ta sama reguła co `findDumpTags`. Po `/` (lub `~/`) musi stać co najmniej jeden znak inny niż `/` i biały
  znak, więc samotne `/`, `~/` i `//` nie są ścieżką.
- **Why:** Wariant B wybrany przez Daniela (2026-10-31). Wymóg „początek słowa” sam wyklucza URL-e (`https://x/y` —
  przed `/` stoi `:`), ułamki i `km/h`. Linie `#` to komentarze/nagłówki — spójność z tagami.
- **Alternatives considered:** (A) ścieżka kończy się na spacji bez wyjątków — odrzucone, Daniel ma pliki ze spacjami
  (iCloud, „Mobile Documents”); (C) escapowanie `\ ` jak w shellu — odrzucone, nienaturalne przy pisaniu notatki
  i trudniejsze do wykrycia; (D) ścieżka do pierwszego rozszerzenia (`….md`) — odrzucone, zgadywanie końca psuje się
  na katalogach z kropką i plikach bez rozszerzenia.
- **Trade-offs:** + proste, przewidywalne, testowalne regexem; − niezamknięty cudzysłów = brak linku; ścieżka kończąca się
  legalnie na `)` (np. `plik(1)`) traci `)` bez cudzysłowu — wtedy trzeba ją ująć w cudzysłów.

### Decision 2: Decyzja o otwarciu w main — denylist (nie-plik, bit wykonywania, rozszerzenia) na ścieżce po `realpath`
- **Choice:** `openableDumpPath(raw, home = homedir())` w `src/main/dump-path.ts` zwraca ścieżkę do otwarcia albo `null`:
  odrzuca nie-string, znak `\0`, wszystko co nie zaczyna się od `/` lub `~/`; rozwija `~/` do `home`; robi
  `realpathSync` (rozwiązuje symlinki i `..`; wyjątek → `null`); `statSync` na wyniku; odrzuca gdy `!isFile()`
  (katalogi i pakiety `.app`/`.workflow` to katalogi), gdy `mode & 0o111` (dowolny bit wykonywania) albo gdy
  rozszerzenie **ścieżki rzeczywistej** (lowercase) jest w zbiorze `.app .command .sh .tool .workflow .terminal`
  (z ticketu) `+ .jar .fileloc .webloc .inetloc .pkg .mpkg`. Handler otwiera `shell.openPath(real)` i ignoruje wynik.
- **Why:** Treść Zrzutu może pochodzić z maili; `shell.openPath` na `.command`/`.sh`/`.app` uruchamia program.
  Daniel: „chodzi tylko o klasyczne pliki tekstowe czy obrazki”. `realpath` zamyka obejście przez symlink `a.md → x.command`.
  Dodatkowe rozszerzenia: `.jar` uruchamia Javę, `.fileloc`/`.webloc`/`.inetloc` otwierają wskazany cel (może to być
  aplikacja), `.pkg`/`.mpkg` startują instalator — koszt jednej linii.
- **Alternatives considered:** (A) allowlist rozszerzeń (md, txt, png, jpg, pdf…) — odrzucone: Daniel chce „zwykłe
  pliki” bez listy do utrzymywania, a ticket definiuje blokadę przez denylist; każde nowe rozszerzenie (np. `.heic`,
  `.yaml`, `.drawio`) wymagałoby zmiany kodu. (B) otwieranie w rendererze / bez sprawdzeń jak `open-task-image` —
  odrzucone, ścieżka niezaufana. (C) katalogi przez `shell.showItemInFolder` — odrzucone decyzją Daniela (bez Findera).
  (D) sprawdzanie istnienia pliku w rendererze do stylowania — odrzucone, dysk przy każdej zmianie tekstu.
- **Trade-offs:** + mały kod, testowalny bez Electrona, blokuje znane wektory; − denylist jest z natury niepełny
  (nowy „uruchamialny” typ przejdzie); − pliki na woluminach bez uprawnień POSIX (exFAT/FAT, część SMB) mają zwykle
  wszystkie bity `x`, więc tam nic się nie otworzy — akceptowalne, oznaczyć `ponytail:`.

### Decision 3 (taktyczna, bez ADR): trafienie kliknięcia przez `.closest('.dump-path')` + `posAtDOM`
- **Choice:** W `mousedown` z `e.metaKey && e.button === 0`: `el = (e.target as Element).closest('.dump-path')`;
  brak → nic. Jest → `pos = view.posAtDOM(el)`, linia `view.state.doc.lineAt(pos)`, `findDumpPaths(line.text)`,
  ścieżka z `line.from + start <= pos < line.from + end`.
- **Why:** `posAtCoords` zwraca najbliższą pozycję także dla kliknięcia w puste miejsce za końcem linii, więc samo
  `posAtCoords` otwierałoby plik po kliknięciu obok tekstu. Span marka obejmuje oba wizualne fragmenty zawiniętej linii
  (to jedna linia logiczna), więc zawijanie nie wymaga osobnej logiki. Gdy mark jest pocięty przez zagnieżdżony mark
  (tag/data w ścieżce w cudzysłowie), każdy fragment i tak leży w zakresie ścieżki.

### Decision 4 (taktyczna, bez ADR): kursor `pointer` tylko przy Cmd — klasa na hoście edytora
- **Choice:** Klasa `dump-cmd` na elemencie `.dump-cm` (hostRef) przełączana z `e.metaKey` w nasłuchach `keydown`/`keyup`
  na `window` oraz w istniejącym handlerze `mousemove`; `blur` okna ją zdejmuje. CSS: `.dump-cm.dump-cmd .dump-path { cursor: pointer }`.
- **Why:** CSS nie widzi stanu klawisza modyfikującego; jeden toggle klasy to minimum. Podkreślenie jest zawsze.

## Implementation Steps

> **Convention — progress tracking:** plan.md is both the document and the progress tracker. Acceptance criteria use
> `- [ ]` / `- [x]`. A completed step gets the suffix `[x]` at the end of its heading. /ems-delegate uses these markers
> to detect resumption — steps marked `[x]` are skipped on the next run.

### Step 1: `findDumpPaths` w `src/shared/dump.ts` (shared, tdd) [x]
- **What:** Czysta funkcja `findDumpPaths(text: string): DumpPath[]`, `export type DumpPath = { start: number; end: number; path: string }`
  (offsety w całym `text`, `path === text.slice(start, end)`).
- **How:** Obok `findDumpTags` (`src/shared/dump.ts:133`), ten sam szkielet: `text.split('\n')`, `offset += line.length + 1`,
  pomijanie linii z `line.trimStart().startsWith('#')`, `matchAll` regexu z flagą `g` na każdej linii. Reguły — Decision 1.
  Sugestia regexu (wykonawca może uprościć, rozstrzygają testy):
  `/(?<=^|[\s(])(?:(["`])(~?\/[^\n]*?)\1|(~?\/[^\s"`/][^\s"`]*))/g` — grupa 2 = treść w cudzysłowie (start = index + 1),
  grupa 3 = ścieżka bez cudzysłowu, z której potem obcina się końcową serię `[.,):]+` (`replace(/[.,):]+$/, '')`;
  pusty wynik / samo `/` lub `~/` → pomiń). Uwaga: `~?\/` w grupie 3 dopuszcza `~/`, a lookbehind sprawdza znak przed `~`.
  Komentarz nad regexem: 1–2 linie po angielsku jak przy `TAG_RE`.
- **Why this approach:** Wzór identyczny z `findDumpTags`/`findDumpDates` — `decorate()` i obsługa kliknięcia używają
  tej samej funkcji, więc to, co podkreślone, to dokładnie to, co się otwiera.
- **Confidence: 9/10** — znany wzorzec, ryzyko tylko w szczegółach regexu, które łapią testy.
- **Acceptance criteria** (testy w `tests/dump-tags.test.ts` — plik jest już na liście w `package.json`, nie dopisywać nowego):
  - [x] `findDumpPaths('- zobacz /Users/x/a.md')` → `[{ start: 9, end: 22, path: '/Users/x/a.md' }]`.
  - [x] `findDumpPaths('~/a/b.md')` → `[{ start: 0, end: 8, path: '~/a/b.md' }]`; ścieżka w drugiej linii ma offset liczony od początku całego tekstu.
  - [x] Końcowa interpunkcja odcięta: `'plik /a/b.md.'`, `'/a/b.md,'`, `'(/a/b.md)'`, `'/a/b.md:'` → `path === '/a/b.md'`; `'/a/b.md).'` → `'/a/b.md'`.
  - [x] Brak trafień: `'a/b/c.md'`, `'km/h'`, `'https://x.com/a'`, `'1/2'`, `'samo / tu'`, `'~/ '`, `'// koment'`, `'~'`.
  - [x] Linia `#`: `'# /Users/x/a.md'` i `'  ## nagłówek ~/a.md'` → `[]`; linia `- #ATD /a.md` (nie zaczyna się od `#`) → jedno trafienie.
  - [x] Cudzysłów: `'otwórz "/Users/x/My Doc.md" teraz'` → `path === '/Users/x/My Doc.md'`, `start` wskazuje znak po `"`, `end` znak `"`; to samo dla backticków `` `~/a b/c.md` ``.
  - [x] Bez cudzysłowu ścieżka kończy się na pierwszej spacji: `'/Users/x/My Doc.md'` → `path === '/Users/x/My'`.
  - [x] Niezamknięty cudzysłów `'"/a/b c'` → `[]`.

### Step 2: `openableDumpPath` w `src/main/dump-path.ts` (backend, tdd) [x]
- **What:** Nowy plik bez importów Electrona: `export function openableDumpPath(raw: unknown, home = homedir()): string | null`.
- **How:** Dokładnie wg Decision 2. Importy: `realpathSync`, `statSync` z `fs`, `extname`, `join` z `path`, `homedir` z `os`.
  Stała `BLOCKED_EXT = new Set([...])` z komentarzem, czemu (uruchamiają program / otwierają cel). `try/catch` wokół
  `realpathSync` + `statSync` → `null` bez logowania. Komentarz `ponytail:` przy bicie `x`: woluminy exFAT/SMB mają `x`
  na wszystkim → tam nic się nie otworzy; ścieżka rozbudowy: allowlist rozszerzeń dla takich woluminów.
- **Why this approach:** Osobny plik bez `electron` → testowalny w vitest bez mocka `shell` (mock w
  `tests/api/__mocks__/electron.ts` nie ma `shell`). Vitest bierze `tests/main/**` automatycznie (`vitest.config.ts`).
- **Confidence: 9/10** — Node `fs` API znane; jedyna pułapka: na macOS `os.tmpdir()` to symlink (`/var` → `/private/var`),
  więc w testach oczekiwana wartość = `realpathSync(...)`.
- **Acceptance criteria** (`tests/main/dump-path.test.ts`, vitest, katalog z `mkdtempSync(join(tmpdir(), 'top5-dump-path-'))`,
  sprzątany w `afterAll`; `home` w wywołaniach = ten katalog):
  - [x] Zwykły plik `a.md` (0o644): `openableDumpPath(<tmp>/a.md)` i `openableDumpPath('~/a.md', tmp)` → `realpathSync(<tmp>/a.md)`.
  - [x] Nazwa ze spacją `My Doc.txt` → zwraca ścieżkę.
  - [x] Nieistniejący plik → `null`, bez wyjątku i bez `console.error` (spy na `console.error` nie wywołany).
  - [x] Katalog `sub/` → `null`; katalog `Foo.app/` → `null`.
  - [x] Plik `run` bez rozszerzenia z `chmod 0o755` → `null`; plik `a.md` z `0o744` → `null`.
  - [x] Pliki 0o644: `x.command`, `x.sh`, `X.SH`, `x.tool`, `x.terminal`, `x.jar`, `x.fileloc` → `null`.
  - [x] Symlink `link.md` → `x.command` → `null` (sprawdzane rozszerzenie ścieżki rzeczywistej).
  - [x] Wejście niezaufane: `'a.md'`, `'./a.md'`, `'~a.md'`, `''`, `123`, `null`, `'/x\0.md'` → `null`.

### Step 3: Kanał IPC `open-dump-path` (backend, solo — cienka ścieżka) [x]
- **What:** Handler w main, metoda mostu, typ.
- **How:**
  - `src/main/launchers.ts` w `registerLauncherHandlers` obok `open-external` (`:120`):
    `ipcMain.handle('open-dump-path', (_event, raw: unknown) => { const path = openableDumpPath(raw); if (path) void shell.openPath(path) })`.
    Wynik `openPath` (string z błędem, np. brak aplikacji) ignorowany — bez logowania.
  - `src/preload/index.ts` obok `openTaskImage` (`:102`): `openDumpPath: (path: string) => ipcRenderer.invoke('open-dump-path', path)`.
  - `src/renderer/types/index.ts` obok `openTaskImage` (`:123`): `openDumpPath: (path: string) => Promise<void>`.
- **Why this approach:** Wzór `open-external` (walidacja w main, potem `shell`). `launchers.ts` to moduł „otwórz coś
  na zewnątrz”, nie trzeba ruszać `store.ts`.
- **Confidence: 9/10**
- **Acceptance criteria:**
  - [x] `npm run typecheck` przechodzi; `grep -n "open-dump-path" src/main/launchers.ts src/preload/index.ts` daje po jednym trafieniu.
  - [x] Handler nie wywołuje `shell.openPath`, gdy `openableDumpPath` zwraca `null` (czytelne z kodu: jeden `if`).
  - [x] Nie zmieniono `webPreferences.sandbox` ani `store.ts`.

### Step 4: Dekoracja, styl i Cmd+klik w `DumpEditor.tsx` (frontend, solo)
- **What:** Ścieżki podkreślone; przy wciśniętym Cmd kursor `pointer` nad nimi; Cmd+klik otwiera, zwykły klik bez zmian.
- **How:**
  - Import `findDumpPaths` w linii 6 obok `findDumpTags`.
  - `decorate()` (`:41`): po pętli tagów
    `for (const p of findDumpPaths(text)) ranges.push(Decoration.mark({ class: 'dump-path' }).range(p.start, p.end))`.
    `Decoration.set(ranges, true)` już sortuje, nakładanie się z tagami/datami jest dopuszczalne.
  - Do istniejącego `Prec.highest(EditorView.domEventHandlers({ keydown, blur, paste }))` (`:332`) dopisać `mousedown`
    wg Decision 3: przy trafieniu `e.preventDefault()`, `void window.api.openDumpPath(path)`, `return true`; w każdym
    innym przypadku `return false` (CodeMirror obsługuje klik normalnie). Działa także w `readOnly`.
  - Kursor (Decision 4): w istniejącym `mousemove` (`:363`) dopisać `host.classList.toggle('dump-cmd', e.metaKey)`;
    w efekcie montującym (`:406-418`) dodać `const syncCmd = (e: KeyboardEvent) => host.classList.toggle('dump-cmd', e.metaKey)`
    na `window` `keydown` i `keyup` oraz `const clearCmd = () => host.classList.remove('dump-cmd')` na `window` `blur`;
    zdjąć wszystkie trzy w funkcji sprzątającej. (`host` to element z `hostRef` — sprawdzić nazwę zmiennej w efekcie.)
  - `src/renderer/styles.css` przy `.dump-tag` (`:2097`):
    ```css
    .dump-path {
      text-decoration-line: underline;
      text-decoration-color: color-mix(in oklch, currentColor 45%, transparent);
      text-underline-offset: 2px;
    }

    /* Pointer only while ⌘ is held (DumpEditor toggles .dump-cmd): a plain click keeps placing the caret. */
    .dump-cm.dump-cmd .dump-path {
      cursor: pointer;
    }
    ```
    Styl zgodny ze skillem `good-css` (kolor pochodny przez `color-mix(in oklch, …)`, bez `:hover`, bez animacji).
- **Why this approach:** Ta sama funkcja wykrywania dla dekoracji i kliknięcia; `Prec.highest` + `return true` +
  `preventDefault` zatrzymuje obsługę zaznaczenia CodeMirrora (inaczej Cmd+klik przestawiłby kursor/zaznaczenie).
- **Confidence: 8/10** — semantyka `domEventHandlers` (true = obsłużone) i `posAtDOM` znana; niepewność tylko co do
  tego, czy CodeMirror nie przejmie fokusu przed handlerem — sprawdza to krok 5.
- **Acceptance criteria:**
  - [ ] `npm run typecheck` i `npm run build` przechodzą.
  - [ ] W DOM edytora ścieżka `/Users/x/a.md` jest w elemencie `.dump-path`; w linii `# /a.md` nie ma `.dump-path`.
  - [ ] Handler `mousedown` zwraca `false` dla kliknięcia bez `metaKey`, dla prawego przycisku i dla kliknięcia poza `.dump-path`.
  - [ ] Nasłuchy na `window` są zdejmowane przy odmontowaniu (widać w funkcji sprzątającej).

### Step 5: Uruchomienie na żywo (planista albo Daniel, nie delegowany koder)
- **What:** Sprawdzenie realnej ścieżki renderer → IPC → main → LaunchServices.
- **How:** Przygotować katalog testowy (nie dane produkcyjne), np. `~/tmp/top5-f003/`: `a.md`, `My Doc.txt`, `obraz.png`,
  `sub/`, `x.command` (0o644, treść `echo PWNED`), `run.sh` (0o755), symlink `link.md → x.command`. `npm run dev`,
  w Zrzucie wpisać każdą ścieżkę (`~/tmp/top5-f003/…`, ścieżkę ze spacją w `"…"`, jedną długą ścieżkę zawiniętą na dwie linie).
- **Confidence: 8/10**
- **Acceptance criteria:**
  - [ ] Ścieżki są podkreślone; kursor `pointer` pojawia się tylko przy wciśniętym Cmd.
  - [ ] Cmd+klik na `a.md`, `"…/My Doc.txt"`, `obraz.png` otwiera plik w domyślnej aplikacji; Cmd+klik na drugiej wizualnej linii zawiniętej ścieżki też.
  - [ ] Zwykły klik na ścieżce tylko stawia kursor, nic się nie otwiera.
  - [ ] Cmd+klik na `sub/`, `x.command`, `run.sh`, `link.md`, nieistniejącym `nope.md` — nic się nie otwiera ani nie uruchamia (brak okna Terminala); konsola main bez nowych błędów.
  - [ ] Cmd+klik w pustym miejscu za końcem linii ze ścieżką nic nie otwiera.

## Dependencies & Order

1 i 2 są niezależne. 3 zależy od 2. 4 zależy od 1 i 3 (używa `findDumpPaths` i `window.api.openDumpPath`). 5 na końcu.

## Task split

| Task | Plan steps | Layer | Mode | Depends on |
|------|------------|-------|------|------------|
| board-f003-sciezki-w-zrzucie-jako-linki-01-find-paths | 1 | shared | tdd | — |
| board-f003-sciezki-w-zrzucie-jako-linki-02-open-path | 2, 3 | backend (main + preload, cienka ścieżka) | tdd | — |
| board-f003-sciezki-w-zrzucie-jako-linki-03-editor | 4 | frontend | solo | 01, 02 |

Zmiana przy wykonaniu (planista, 2026-10-31): kroki 2 i 3 połączone w jedno zadanie — krok 3 to kilka linii
w main/preload/typach, osobna runda kosztowałaby więcej niż zmiana.

Przegląd Codex (`specs/board-F003-sciezki-w-zrzucie-jako-linki.codex-plan-review.md`) — obie uwagi odrzucone:
1. Alias Findera omija sprawdzenia — wymaga pliku-aliasu już leżącego na dysku Daniela; mail niczego nie zapisuje
   (ten sam sufit co niepełny denylist w „Risks”).
2. Cmd+P/Cmd+T przepisują `#KOD`/`@data` wewnątrz ścieżki w cudzysłowie — nazwa pliku z ` #KOD ` to skrajny przypadek,
   przepisywanie tagów to dotychczasowe zachowanie, poza zakresem F003.

Step 5 (live run) wykonuje planista/Daniel po zadaniu 04 — nie jest delegowany.
Independent tasks: 01 i 02 (rozłączne pliki, tryb tdd).

### Execute

```
/ems-delegate specs/board-F003-sciezki-w-zrzucie-jako-linki.plan.md
```

## Risks & Mitigations

- **Denylist niepełny** (nowy typ „uruchamialny”) → plik musi już leżeć na dysku Daniela, a mail sam niczego nie zapisuje;
  przy pierwszym znalezionym typie dopisać rozszerzenie do `BLOCKED_EXT` (jedna linia).
- **Woluminy z bitem `x` na wszystkim** (exFAT, SMB) → pliki stamtąd się nie otworzą; oznaczone `ponytail:`.
- **CodeMirror przechwyci Cmd+klik przed handlerem** (np. doda drugi kursor) → handler jest w `Prec.highest` i robi
  `preventDefault`; krok 5 to weryfikuje.
- **Regex za szeroki** (podkreśla `//` lub fragmenty URL) → przypadki negatywne w testach kroku 1.

## Definition of Done

- [ ] `npm test`, `npm run test:api`, `npm run typecheck` i `npm run build` przechodzą.
- [ ] Wszystkie kryteria akceptacji kroków 1–4 spełnione.
- [ ] Live run (krok 5) zaliczony.
- [ ] Brak zmian w `webPreferences.sandbox`, HTTP API, `docs/API.md`, `cli/`; brak nowych zależności w `package.json`.
- [ ] Kod zwalidowany na granicy zaufania tylko w main; renderer nie wywołuje `shell` ani `fs`.

## Verification

**Delegated plan:** `/ems-delegate` weryfikuje każde zadanie i na końcu Definition of Done. Krok 5 wykonuje planista lub Daniel.
**Solo:** po implementacji osobny agent:
> „Przeczytaj plan z specs/board-F003-sciezki-w-zrzucie-jako-linki.plan.md. Sprawdź każde kryterium akceptacji
> z każdego kroku oraz każdy punkt Definition of Done. Wygeneruj raport pass/fail.”

Format raportu: `~/.claude/skills/ems-plan/references/verification-format.md`.
