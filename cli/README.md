# top5-cli

Narzędzie CLI do zarządzania projektami i zadaniami w aplikacji [top5](../).
Komunikuje się z aplikacją przez jej HTTP API — wymaga uruchomionej aplikacji top5.

## Wymagania

- macOS
- Node.js 18+
- Uruchomiona aplikacja top5 z włączonym HTTP API (Settings → HTTP API)

## Instalacja

```bash
cd cli
npm install
npm run build
npm link
```

Po `npm link` komenda `top5` jest dostępna globalnie w terminalu.

## Konfiguracja

Przed pierwszym użyciem ustaw klucz API. Znajdziesz go w aplikacji top5: **Settings → HTTP API → API Key**.

```bash
top5 config set apiKey <twój-klucz>
```

Konfiguracja zapisywana jest do `~/.config/top5/cli.json`.

### Wszystkie opcje konfiguracji

| Klucz    | Opis                  | Domyślnie   |
|----------|-----------------------|-------------|
| `apiKey` | Klucz API             | (pusty)     |
| `port`   | Port HTTP API         | `15055`     |
| `host`   | Host HTTP API         | `127.0.0.1` |

```bash
top5 config set port 15055
top5 config set host 127.0.0.1
```

### Zmienne środowiskowe

Można też przekazać konfigurację przez env (wyższy priorytet niż plik):

```bash
TOP5_API_KEY=<klucz> top5 projects
TOP5_API_PORT=15055 top5 health
TOP5_API_HOST=127.0.0.1 top5 health
```

### Priorytet konfiguracji

```
flagi CLI  >  zmienne env  >  ~/.config/top5/cli.json  >  wartości domyślne
```

### Flagi globalne

Każda komenda obsługuje globalne flagi:

```bash
top5 --api-key <klucz> projects     # nadpisuje config
top5 --port 15055 projects          # nadpisuje port
top5 --json projects                # output jako JSON
```

---

## Komendy

### `top5 health`

Sprawdza czy API aplikacji top5 działa.

```bash
top5 health
# top5 API is running (v1.65.0)

top5 health --json
# { "status": "ok", "version": "1.65.0" }
```

---

### `top5 projects`

Wyświetla listę projektów.

```bash
top5 projects
```

```
  CODE  NAME              TASKS  PINNED  STATUS
  PRJ   My Project           12       3  active
  APP   Mobile App             8       1  active
  WEB   Website                5       2  active
```

**Opcje:**

```bash
top5 projects           # aktywne projekty (bez archived i suspended)
top5 projects --all     # wszystkie projekty
top5 projects --archived    # tylko zarchiwizowane
top5 projects --suspended   # tylko zawieszone
top5 projects --json    # output JSON
```

**Kolumny:**
- `CODE` — kod projektu używany w kodach tasków (np. `PRJ`)
- `TASKS` — liczba aktywnych (nieukończonych) tasków
- `PINNED` — liczba tasków oznaczonych jako "up-next"
- `STATUS` — `active` / `archived` / `suspended`

---

### `top5 tasks <project>`

Wyświetla taski w projekcie.

```bash
top5 tasks PRJ
top5 tasks APP --all        # z ukończonymi
top5 tasks <project-id>     # po UUID projektu
```

```
PRJ - My Project
   #  TITLE               STATUS
 PRJ-1  Setup database    [done]
 PRJ-2  Write API         in-progress
 PRJ-3  Frontend          up-next
 PRJ-4  Deploy
```

Argument `<project>` akceptuje:
- kod projektu: `PRJ`, `APP` (case-insensitive)
- UUID projektu

**Opcje:**
- `-a, --all` — pokaż też ukończone taski
- `--json` — output JSON

---

### `top5 add <project> <title>`

Dodaje nowy task do projektu.

```bash
top5 add PRJ "Napisać testy"
# Created: PRJ-5 Napisać testy

top5 add APP "Fix login bug" --json
```

**Opcje:**
- `-n, --note` — od razu tworzy notatkę Obsidian dla nowego tasku

```bash
top5 add PRJ "Design API" --note
# Created: PRJ-6 Design API
# Note: /path/to/vault/top5.storage/My Project/PRJ-6 Design API.md
```

---

### `top5 done <task-code>`

Oznacza task jako ukończony.

```bash
top5 done PRJ-3
# Done: PRJ-3 Frontend

top5 done PRJ-3 --json
```

Akceptuje:
- kod tasku: `PRJ-3`, `APP-12`
- UUID tasku

---

### `top5 undone <task-code>`

Cofa ukończenie tasku (przywraca do aktywnych).

```bash
top5 undone PRJ-3
# Undone: PRJ-3 Frontend
```

---

### `top5 qt`

Zarządzanie quick tasks (szybkie zadania bez projektu).

```bash
top5 qt              # lista aktywnych quick tasks
top5 qt --all        # z ukończonymi
```

```
   #  TITLE              STATUS
QT-1  Buy groceries
QT-2  Call dentist       in-progress
QT-3  Read book          [done]
```

#### `top5 qt add <title>`

```bash
top5 qt add "Kupić kawę"
# Created: QT-4 Kupić kawę
```

**Opcje:**
- `-n, --note` — od razu tworzy notatkę Obsidian

```bash
top5 qt add "Research tool" --note
# Created: QT-5 Research tool
# Note: /path/to/vault/top5.storage/QuickTasks/QT-5 Research tool.md
```

#### `top5 qt done <ref>`

```bash
top5 qt done QT-2
# Done: QT-2 Call dentist
```

#### `top5 qt undone <ref>`

```bash
top5 qt undone QT-2
# Undone: QT-2 Call dentist
```

Argument `<ref>` akceptuje:
- kod: `QT-5`
- UUID tasku

---

### `top5 note <task-ref>`

Tworzy (lub otwiera istniejącą) notatkę Obsidian dla tasku. Zwraca ścieżkę do pliku `.md`.

```bash
top5 note PRJ-3
# /path/to/vault/top5.storage/My Project/PRJ-3 Frontend.md

top5 note QT-5
# /path/to/vault/top5.storage/QuickTasks/QT-5 Buy groceries.md

top5 note PRJ-3 --json
# { "noteRef": "top5.storage/My Project/PRJ-3 Frontend", "filePath": "/path/to/..." }
```

Akceptuje:
- kod tasku: `PRJ-3`, `APP-12`
- kod quick tasku: `QT-5`
- UUID tasku

Wymaga skonfigurowanego `obsidianStoragePath` w ustawieniach aplikacji top5 (Settings → Obsidian).

---

### `top5 config`

Wyświetla aktualną konfigurację CLI.

```bash
top5 config
#   host:    127.0.0.1
#   port:    15055
#   apiKey:  top5...e3f1
```

#### `top5 config set <key> <value>`

Ustawia wartość w pliku konfiguracyjnym.

```bash
top5 config set apiKey top5_abc123...
top5 config set port 15055
top5 config set host 127.0.0.1
```

Plik konfiguracyjny: `~/.config/top5/cli.json`

---

## Kody tasków

CLI używa czytelnych kodów do identyfikacji tasków:

| Format  | Przykład | Opis                       |
|---------|----------|----------------------------|
| `PRJ-N` | `PRJ-3`  | Task nr 3 w projekcie PRJ  |
| `QT-N`  | `QT-5`   | Quick task nr 5            |
| UUID    | `abc-...`| Surowy ID (fallback)       |

Kody projektów widać w kolumnie `CODE` w `top5 projects`.

---

## JSON output

Każda komenda obsługuje flagę `--json` — przydatne do pipowania i skryptów:

```bash
top5 projects --json | jq '.[] | .name'
top5 tasks PRJ --json | jq '.[] | select(.completed == false) | .title'
top5 health --json | jq '.status'
```

---

## Obsługa błędów

| Sytuacja                          | Komunikat                                  |
|-----------------------------------|--------------------------------------------|
| API niedostępne                   | `Connection refused` / `fetch failed`      |
| Zły klucz API                     | `HTTP 401: Unauthorized`                   |
| Projekt / task nie znaleziony     | `Project not found: XYZ`                   |
| Timeout (>5s)                     | `Request timed out`                        |
| Task już ukończony                | `Already completed: <tytuł>`               |

---

## Budowanie i testy

```bash
# Build
npm run build       # kompilacja TypeScript → dist/

# Testy
npm test            # vitest run (69 testów)

# Tryb watch (development)
npm run dev         # tsc --watch
```

---

## Struktura projektu

```
cli/
  src/
    main.ts               # entry point
    commands/
      projects.ts         # top5 projects
      tasks.ts            # top5 tasks, add, done, undone
      quick-tasks.ts      # top5 qt *
      notes.ts            # top5 note
      health.ts           # top5 health
      config.ts           # top5 config
    lib/
      api-client.ts       # HTTP client (fetch, Bearer auth, 5s timeout)
      config.ts           # odczyt/zapis ~/.config/top5/cli.json
      output.ts           # formatowanie tabel i JSON
      resolve.ts          # lookup tasków po kodzie (PRJ-3 → ID)
  tests/
    api-client.test.ts
    config.test.ts
    output.test.ts
    resolve.test.ts
```
