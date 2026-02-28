# top5-cli — Plan implementacji

## 1. Kontekst

Aplikacja top5 posiada HTTP API (Fastify, port 15055, Bearer auth, localhost-only).
CLI komunikuje sie z aplikacja wylacznie przez to API — zero bezposredniego dostepu do `data.yaml`.

## 2. Biblioteka CLI

**Wybor: `commander.js`**

Uzasadnienie:
- Najpopularniejsza i najlepiej udokumentowana biblioteka CLI w Node.js
- Minimalistyczna — brak magii, deklaratywna definicja komend
- Zero konfiguracji — nie wymaga generatorow ani boilerplate'u (jak oclif)
- Jedna zaleznosc, ~50kB, stabilne API
- Pasuje do zasady KISS z CODING_GUIDE.md

Odrzucone alternatywy:
- `oclif` — za ciezki na taki projekt (generatory, pluginy, osobny build)
- `ink` (React CLI) — interaktywne TUI niepotrzebne, chcemy pipe-friendly output
- `yargs` — zbedna zlonosc parsowania; commander wystarczy

## 3. Lista komend

### Projekty

| Komenda | Opis |
|---------|------|
| `top5 projects` | Lista aktywnych projektow (nie-archived, nie-suspended) |
| `top5 projects --all` | Wszystkie projekty (z archiwum i suspended) |
| `top5 projects --archived` | Tylko zarchiwizowane |
| `top5 projects --suspended` | Tylko zawieszone |

### Taski projektowe

| Komenda | Opis |
|---------|------|
| `top5 tasks <project>` | Lista aktywnych taskow w projekcie (po ID lub kodzie) |
| `top5 tasks <project> --all` | Wszystkie taski (z completed) |
| `top5 add <project> <title>` | Dodaj task do projektu |
| `top5 done <task-code>` | Oznacz task jako completed (np. `PRJ-3`) |
| `top5 undone <task-code>` | Cofnij completed |

### Quick tasks

| Komenda | Opis |
|---------|------|
| `top5 qt` | Lista aktywnych quick taskow |
| `top5 qt --all` | Wszystkie (z completed) |
| `top5 qt add <title>` | Dodaj quick task |
| `top5 qt done <id-or-code>` | Oznacz jako completed (np. `QT-5` lub ID) |
| `top5 qt undone <id-or-code>` | Cofnij completed |

### Utility

| Komenda | Opis |
|---------|------|
| `top5 health` | Sprawdz czy API dziala |
| `top5 config` | Pokaz aktualna konfiguracje CLI (port, key masked) |
| `top5 config set <key> <value>` | Ustaw wartosc konfiguracji |

### Przyszle rozszerzenia (nie w MVP)

- `top5 move <task-code> <to-project>` — przenies task miedzy projektami
- `top5 focus <task-code>` — ustaw focus
- `top5 repeating` — zarzadzanie powtarzajacymi sie taskami

## 4. Identyfikacja taskow

CLI akceptuje dwa formaty identyfikacji taskow:

- **Task code**: `PRJ-3`, `QT-5` — czytelny format z UI. CLI parsuje kod, wyszukuje projekt po `code`, potem task po `taskNumber`.
- **Raw ID**: UUID tasku — fallback, wspierany ale nie promowany.

Lookup flow dla project tasks:
1. Jesli argument pasuje do wzorca `XXX-NNN` — szukaj projektu po `code=XXX`, tasku po `taskNumber=NNN`
2. Jesli nie — traktuj jako project ID, task ID (oba pozycyjne)

Lookup flow dla quick tasks:
1. `QT-NNN` — szukaj po `taskNumber=NNN`
2. Inaczej — szukaj po `id`

## 5. Struktura plikow

```
cli/
  package.json          # osobna paczka, bin: { "top5": "./dist/main.js" }
  tsconfig.json
  src/
    main.ts             # entry point, commander setup
    commands/
      projects.ts       # top5 projects
      tasks.ts          # top5 tasks, add, done, undone
      quick-tasks.ts    # top5 qt *
      health.ts         # top5 health
      config.ts         # top5 config
    lib/
      api-client.ts     # wrapper na fetch() do HTTP API
      config.ts         # odczyt/zapis ~/.config/top5/cli.json
      output.ts         # formatowanie tabelek i tekstu
      resolve.ts        # lookup taskow po kodzie (PRJ-3 -> projectId + taskId)
```

CLI jest **osobna paczka** w katalogu `cli/` (monorepo-style), ze wzgledu na:
- Osobny `package.json` (commander.js, zero Electron deps)
- Osobny build (tsc, bez electron-vite/Vite)
- Mozliwosc `npm link` lub instalacji globalnej
- Brak zasmiecania glownego `package.json` zaleznosciami CLI

## 6. Konfiguracja

Plik: `~/.config/top5/cli.json`

```json
{
  "apiKey": "top5_abc123...",
  "port": 15055,
  "host": "127.0.0.1"
}
```

Hierarchia:
1. Flagi CLI (`--port`, `--api-key`) — najwyzszy priorytet
2. Zmienne srodowiskowe (`TOP5_API_KEY`, `TOP5_API_PORT`)
3. Plik konfiguracyjny `~/.config/top5/cli.json`
4. Wartosci domyslne (`127.0.0.1:15055`)

Komendy `top5 config` i `top5 config set`:
```
top5 config                     # pokaz aktualna konfiguracje
top5 config set apiKey sk-...   # ustaw klucz
top5 config set port 15055      # ustaw port
```

## 7. API Client

Prosty wrapper na `fetch()` (Node 18+ built-in):

```ts
// cli/src/lib/api-client.ts
class ApiClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  async get<T>(path: string): Promise<T>
  async post<T>(path: string, body?: unknown): Promise<T>
  async put<T>(path: string, body?: unknown): Promise<T>
  async delete<T>(path: string): Promise<T>
}
```

- Kazda metoda zwraca `{ ok: true, data: T }` lub rzuca blad z `{ ok: false, error: string }`
- Timeout: 5s
- Zero zewnetrznych zaleznisci (native fetch)

## 8. Output

Domyslnie: czytelne tabele tekstowe z wyrownaniem (bez kolorow ANSI w MVP, mozna dodac pozniej).

```
$ top5 projects
  CODE  NAME              TASKS  PINNED
  PRJ   My Project        12     3
  APP   Mobile App         8     1
  WEB   Website            5     2

$ top5 tasks PRJ
  #   TITLE              STATUS
  1   Setup database     [done]
  2   Write API          in-progress
  3   Frontend           up-next

$ top5 qt
  #   TITLE              STATUS
  1   Buy groceries
  2   Call dentist       in-progress
```

Flaga `--json`: surowy JSON output (dla pipe/scripting).

## 9. Build i instalacja

```json
// cli/package.json
{
  "name": "top5-cli",
  "version": "0.1.0",
  "bin": { "top5": "./dist/main.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "commander": "^13.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

Instalacja lokalna (development):
```bash
cd cli && npm install && npm run build && npm link
```

## 10. Testy

- Framework: vitest (spojny z reszta projektu)
- Testy unit: mockowanie `fetch()` w `api-client.ts`
- Testy integracyjne: odpalenie komendy CLI jako subprocess, weryfikacja stdout
- Plik konfiguracyjny: testy uzywaja temp dir zamiast `~/.config/top5`

## 11. Zakres MVP

Faza 1 (ten branch):
1. Struktura projektu (`cli/`)
2. `api-client.ts` + `config.ts`
3. `top5 health`
4. `top5 projects` (z flagami)
5. `top5 tasks <project>` + `top5 add`
6. `top5 done` / `top5 undone` (project tasks)
7. `top5 qt` + `top5 qt add` + `top5 qt done` / `top5 qt undone`
8. `top5 config` / `top5 config set`
9. `--json` flag na kazdej komendzie
10. Testy podstawowe

Poza MVP:
- Kolorowy output (chalk/picocolors)
- `top5 move`
- Tab completion
- `top5 focus`
- Interaktywny tryb (select z listy)
