# CLI Code Review

## Ocena ogolna

Solidna, czytelna implementacja. Kod jest dobrze podzielony na moduly (api-client, config, resolve, output, commands), nazewnictwo jest jasne, a typy uzyte sensownie. Testy pokrywaja biblioteke (lib/) dobrze. Kilka drobnych naruszen DRY, zero problemow bezpieczenstwa.

## Problemy krytyczne (naprawione)

### 1. DRY: Identyczne interfejsy `TaskSummary` i `QuickTaskSummary` w resolve.ts

**Plik**: `cli/src/lib/resolve.ts`

`TaskSummary` i `QuickTaskSummary` mialy identyczna strukture (id, taskNumber, title, completed). Usunieto `QuickTaskSummary` i uzyte `TaskSummary` w `resolveQuickTask`. Jesli w przyszlosci quick tasks dostana dodatkowe pola, mozna wtedy rozdzielic.

### 2. DRY: Zduplikowane helpery testowe `okResponse`/`errorResponse`

**Pliki**: `cli/tests/api-client.test.ts`, `cli/tests/resolve.test.ts`

Te same funkcje `okResponse<T>()` i `errorResponse()` byly zdefiniowane w obu plikach testowych. Wyodrebnione do wspolnego `cli/tests/helpers.ts` i zaimportowane w obu testach.

## Wazne sugestie

### 1. DRY: Powtarzajacy sie boilerplate config+client w kazdym command handler

Kazdy action handler (12 wystapien) powtarza:
```ts
const globalOpts = cmd.optsWithGlobals()
const config = resolveConfig({ apiKey: globalOpts.apiKey, port: globalOpts.port })
const client = new ApiClient(`http://${config.host}:${config.port}`, config.apiKey)
```

**Sugestia**: Wyodrebnic `clientFromCommand(cmd)` ktory zwraca `{ client, globalOpts }`. Nie naprawione bezposrednio, bo w kontekscie solo-projektu 3-liniowy boilerplate jest czytelny i self-contained — to borderline KISS vs DRY.

### 2. DRY: Interfejs `Project` zduplikowany miedzy `projects.ts` i `tasks.ts`

`projects.ts` definiuje:
```ts
interface Project {
  id: string; name: string; code?: string;
  tasks: { completed: boolean; isToDoNext?: boolean }[];
  archivedAt: string | null; suspendedAt: string | null; order: number
}
```
`tasks.ts` definiuje:
```ts
interface Project {
  id: string; name: string; code?: string; tasks: Task[]
}
```

Sa to rozne widoki tego samego zasobu API. Jesli API sie zmieni, trzeba aktualizowac w dwoch miejscach. Mozna wyodrebnic wspolny interfejs do `lib/types.ts`, ale przy obecnym rozmiarze projektu nie jest to krytyczne.

### 3. Brak shebang w dist/main.js po kompilacji

`package.json` ma `"bin": { "top5": "./dist/main.js" }`, a `src/main.ts` zaczyna sie od `#!/usr/bin/env node`. TypeScript z `tsc` zachowuje shebang w kompilacji, wiec jest OK. Ale warto sprawdzic, ze `chmod +x` jest ustawione po `npm link` / `npm install -g`.

### 4. Brak walidacji portu przy resolveConfig z env/flag

`resolveConfig` parsuje port przez `parseInt`, ale nie sprawdza NaN ani zakresu (1-65535) — walidacja jest tylko w `config set`. Jesli uzytkownik przekaze `--port abc`, dostanie `NaN` i dziwny URL. Dodanie clampa/walidacji w `resolveConfig` byloby lepsze, ale mozna tez polegac na tym, ze fetch i tak zglosci blad polaczenia.

### 5. `tasks.ts:add` — klient generuje UUID i timestamp

`add` command generuje `crypto.randomUUID()` i `new Date().toISOString()` po stronie CLI, a potem wysyla PUT z calym projektem. Jesli API serwer sam generuje ID/timestamps, to jest nadmiarowe. Jesli nie — to jest poprawne, ale warto byc swiadomym, ze CLI jest zrodlem tych wartosci.

## Kosmetyczne

1. `(err as Error).message` w catch blokach — powtarza sie. Mozna by uzyc type guard, ale cast jest OK w kontekscie CLI.
2. `health.ts` ma dodatkowy JSON error handling (`console.log(JSON.stringify({ ok: false, ... }))`) ktorego inne komendy nie maja. Jest to wlasciwe tylko dla health (diagnostyczny), ale warto byc swiadomym niesymetrii.
3. `quick-tasks.ts:qtCode` i `tasks.ts:taskCode` — podobne funkcje formatujace task code, ale rozna logika (qt prefix vs project code). Nie warto wyodrebniac bo kontekst jest inny.

## Testy - ocena pokrycia

**Dobrze pokryte:**
- `api-client.ts` — 16 testow: HTTP methods, auth header, timeout, errors, JSON parsing. Solidne.
- `config.ts` — 13 testow: read/write, priority resolution (flag > env > file > default), malformed JSON. Dobry coverage.
- `resolve.ts` — 30 testow: parseTaskCode edge cases, resolveProject (by code/ID/case), resolveProjectTask, resolveQuickTask z fallbackami. Bardzo dobrze.
- `output.ts` — 10 testow: formatTable (empty, padding, alignment, width), printResult (JSON/format), die.

**Czego brakuje:**
- Brak testow integracyjnych dla command handlers (`projects.ts`, `tasks.ts`, `quick-tasks.ts`, `config.ts`, `health.ts`). Logika wewnatrz action callbackow jest nietestowana. Testowanie commandera jest trudniejsze, ale mozliwe z `program.parseAsync(['node', 'top5', 'projects', '--json'])` i mockowanym fetch.
- Brak testu na `config set` z nieprawidlowym kluczem.
- Brak testu na `NaN` port w `resolveConfig`.

**Ocena**: 4/5 — biblioteka dobrze pokryta, brakuje testow command handlers, co jest akceptowalne przy takim rozmiarze projektu.

## Podsumowanie KISS/DRY

**KISS**: Kod jest prosty i czytelny. Kazdy plik ma jasna odpowiedzialnosc. Brak over-engineeringu — nie ma niepotrzebnych abstrakcji, middleware, plugin systemow. `ApiClient` jest minimalistyczny, `formatTable` robi dokladnie to co trzeba. Ocena: 5/5.

**DRY**: Dwa naruszenia naprawione (identyczne interfejsy, zduplikowane test helpery). Boilerplate config+client powtarza sie 12x ale jest prosty i czytelny — borderline case. Interfejs `Project` zduplikowany miedzy dwoma command files — akceptowalne przy obecnym rozmiarze. Ocena: 3.5/5.

**Bezpieczenstwo**: API key jest maskowany w `config` output (`maskKey`). Bledy nie wyciekaja kluczy. `baseUrl` jest widoczny w error messages (host:port), co jest OK bo to 127.0.0.1. Brak interpolacji stringow w shellowych komendach. Ocena: 5/5.
