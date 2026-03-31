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
   #  TITLE               DUE                 STATUS
 PRJ-1  Setup database                        [done]
 PRJ-2  Write API         today               in-progress
 PRJ-3  Frontend          2026-04-05           up-next
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

top5 add PRJ "Review PR" --due tomorrow
# Created: PRJ-6 Review PR (due: tomorrow)

top5 add APP "Fix login bug" --due 2026-04-15
# Created: APP-8 Fix login bug (due: 2026-04-15)
```

**Opcje:**
- `-n, --note` — od razu tworzy notatkę Obsidian dla nowego tasku
- `-d, --due <date>` — ustawia datę realizacji (patrz [Formaty daty](#formaty-daty))
- `-p, --pin` — przypina task do widoku "today" (up-next)

```bash
top5 add PRJ "Design API" --note --due friday
# Created: PRJ-7 Design API (due: 2026-04-03)
# Note: /path/to/vault/top5.storage/My Project/PRJ-7 Design API.md
```

---

### `top5 due <task-code> [date]`

Ustawia, wyświetla lub czyści datę realizacji tasku projektowego.

```bash
# Sprawdź aktualną datę
top5 due PRJ-3
# PRJ-3 Frontend — due: 2026-04-05

# Ustaw datę
top5 due PRJ-3 tomorrow
# PRJ-3 Frontend — due: tomorrow

top5 due PRJ-3 +5d
# PRJ-3 Frontend — due: 2026-04-04

# Wyczyść datę
top5 due PRJ-3 clear
# PRJ-3 Frontend — due date cleared
```

Akceptuje:
- kod tasku: `PRJ-3`, `APP-12`
- UUID tasku

Formaty daty — patrz [Formaty daty](#formaty-daty).

---

### `top5 pin <task-code>`

Przypina / odpina task do widoku "today" (toggle). Przypięte taski pojawiają się jako "up-next" w widoku dzisiejszych zadań.

```bash
top5 pin PRJ-3
# Pinned: PRJ-3 Frontend

top5 pin PRJ-3          # ponowne wywołanie odpina
# Unpinned: PRJ-3 Frontend
```

Akceptuje:
- kod tasku: `PRJ-3`, `APP-12`
- UUID tasku

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
   #  TITLE              DUE                 STATUS
QT-1  Buy groceries      today
QT-2  Call dentist                           in-progress
QT-3  Read book                              [done]
```

#### `top5 qt add <title>`

```bash
top5 qt add "Kupić kawę"
# Created: QT-4 Kupić kawę

top5 qt add "Wysłać fakturę" --due friday
# Created: QT-5 Wysłać fakturę (due: 2026-04-03)
```

**Opcje:**
- `-n, --note` — od razu tworzy notatkę Obsidian
- `-d, --due <date>` — ustawia datę realizacji (patrz [Formaty daty](#formaty-daty))

```bash
top5 qt add "Research tool" --note --due +3d
# Created: QT-6 Research tool (due: 2026-04-02)
# Note: /path/to/vault/top5.storage/QuickTasks/QT-6 Research tool.md
```

#### `top5 qt due <ref> [date]`

Ustawia, wyświetla lub czyści datę realizacji quick tasku.

```bash
top5 qt due QT-2
# QT-2 Call dentist — due: (none)

top5 qt due QT-2 monday
# QT-2 Call dentist — due: 2026-04-06

top5 qt due QT-2 clear
# QT-2 Call dentist — due date cleared
```

Formaty daty — patrz [Formaty daty](#formaty-daty).

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

### `top5 rt`

Zarządzanie zadaniami powtarzalnymi (repeating tasks).

```bash
top5 rt              # lista wszystkich definicji
top5 rt --json
```

```
  #  TITLE              SCHEDULE
  1  Morning standup     Weekdays
  2  Weekly review       Mon
  3  Pay rent            1. of month
```

#### `top5 rt proposals`

Wyświetla dzisiejsze oczekujące propozycje — taski, które są "due today" i jeszcze nie zaakceptowane/odrzucone.

```bash
top5 rt proposals
top5 rt proposals --json
```

#### `top5 rt add <title>`

Tworzy nowy repeating task z harmonogramem.

```bash
top5 rt add "Standup" --daily             # codziennie (domyślne)
top5 rt add "Review" --weekdays           # pon-pt
top5 rt add "Gym" --weekly 1,3,5          # pon, śr, pt (0=nd..6=sob)
top5 rt add "Gym" --weekly mon,wed,fri    # to samo, nazwy dni
top5 rt add "Check" --interval 3          # co 3 dni
top5 rt add "Review" --after-done 7       # 7 dni po ukończeniu
top5 rt add "Rent" --monthly-day 1        # 1. dnia miesiąca
top5 rt add "EOM report" --monthly-last-day  # ostatni dzień miesiąca
# Created: Standup (Every day)
```

Można podać tylko jedną flagę harmonogramu. Bez flagi — domyślnie `--daily`.

#### `top5 rt edit <ref>`

Zmienia tytuł i/lub harmonogram istniejącego tasku.

```bash
top5 rt edit 1 --title "Nowa nazwa"
top5 rt edit 1 --interval 5
top5 rt edit 1 --title "X" --weekly 1,3
# Updated: X (Mon, Wed)
```

#### `top5 rt rm <ref>`

Usuwa definicję repeating tasku.

```bash
top5 rt rm 1
# Deleted: Morning standup
```

#### `top5 rt accept <ref>`

Akceptuje dzisiejszą propozycję — tworzy quick task.

```bash
top5 rt accept 1
# Accepted: Morning standup
```

Numer `<ref>` odnosi się do pozycji na liście `top5 rt proposals` (nie pełnej listy).

#### `top5 rt dismiss <ref>`

Odrzuca propozycję na dzisiaj (nie pojawi się ponownie do jutra).

```bash
top5 rt dismiss 1
# Dismissed: Morning standup
```

Numer `<ref>` odnosi się do pozycji na liście `top5 rt proposals`.

Argument `<ref>` akceptuje:
- numer pozycji (1-based) z odpowiedniej listy (`rt` lub `rt proposals`)
- UUID tasku

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

| Format  | Przykład | Opis                       | Dotyczy                  |
|---------|----------|----------------------------|--------------------------|
| `PRJ-N` | `PRJ-3`  | Task nr 3 w projekcie PRJ  | tasks, done, due, pin    |
| `QT-N`  | `QT-5`   | Quick task nr 5            | qt done, qt due, note    |
| `N`     | `1`      | Pozycja na liście (1-based)| rt, rt accept, rt dismiss|
| UUID    | `abc-...`| Surowy ID (fallback)       | wszędzie                 |

Kody projektów widać w kolumnie `CODE` w `top5 projects`.

---

## Formaty daty

Wszędzie gdzie CLI przyjmuje datę (`--due`, komenda `due`) obsługiwane są następujące formaty:

| Format          | Przykład     | Opis                                |
|-----------------|--------------|-------------------------------------|
| `YYYY-MM-DD`    | `2026-04-15` | Konkretna data                      |
| `today`         |              | Dzisiejsza data                     |
| `tomorrow`      |              | Jutrzejsza data                     |
| `+Nd`           | `+3d`        | Za N dni od dziś                    |
| Dzień tygodnia  | `monday`     | Najbliższe wystąpienie (skróty: `mon`–`sun`) |
| `clear` / `none`|             | Usuwa datę realizacji               |

Formaty są case-insensitive (`TODAY`, `Monday`, `FRI` — wszystko działa).

Kolumna `DUE` w listingach wyświetla:
- `today` — data = dziś
- `tomorrow` — data = jutro
- `2026-03-28 (overdue)` — data w przeszłości
- `2026-04-15` — data w przyszłości

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
      tasks.ts            # top5 tasks, add, pin, due, done, undone
      quick-tasks.ts      # top5 qt, qt add, qt due, qt done, qt undone
      repeating-tasks.ts  # top5 rt, rt add, rt edit, rt rm, rt accept, rt dismiss
      notes.ts            # top5 note
      focus.ts            # top5 focus, focus stop, focus ping
      today.ts            # top5 today
      health.ts           # top5 health
      config.ts           # top5 config
    lib/
      api-client.ts       # HTTP client (fetch, Bearer auth, 5s timeout)
      config.ts           # odczyt/zapis ~/.config/top5/cli.json
      date.ts             # parsowanie i formatowanie dat (due date)
      output.ts           # formatowanie tabel i JSON
      resolve.ts          # lookup tasków po kodzie (PRJ-3 → ID)
  tests/
    api-client.test.ts
    config.test.ts
    date.test.ts
    output.test.ts
    resolve.test.ts
```
