# Obsidian Journal — integracja z Obsidianem

## Idea

Automatyczne generowanie notatek dziennych, tygodniowych i miesięcznych w vaulcie Obsidiana. Dane z Top5 (ukończone zadania, focus time, wyniki 5 Wins) trafiają do markdownowych plików gotowych do przeglądania i uzupełniania refleksjami.

## Konfiguracja

W Settings ustaw:
- **Obsidian vault path** — ścieżka do katalogu vaulta (np. `/Users/jan/Documents/Vault`)
- **Obsidian vault name** — nazwa vaulta (opcjonalnie, domyślnie = nazwa katalogu)

## Struktura plików w vaulcie

```
top5.journal/
  index.md                    # spis treści z linkami
  daily/2026-02-22.md         # notatka dzienna
  weekly/2026-W08.md          # notatka tygodniowa
  monthly/2026-02.md          # notatka miesięczna
  .top5-dictionary.md         # słownik projektów do autocomplete
```

## Notatki dzienne

Generowane automatycznie przy rozstrzygnięciu dnia (5 Wins → `resolveDay()`) oraz ręcznie przyciskiem w TodayView lub skrótem `j`.

### Sekcje

1. **Refleksja** — pytania do samodzielnego uzupełnienia (zachowywane przy re-generowaniu)
2. **Zrobione** — lista ukończonych zadań z badgami (`TOP-3`, `QT-7`)
3. **Notatki** — wolne pole (zachowywane przy re-generowaniu)

### Frontmatter

```yaml
date: 2026-02-22
type: daily
tasks_completed: 5
focus_minutes: 120
```

### Re-generowanie

Przy ponownym generowaniu parsowane są sekcje Refleksja i Notatki z istniejącego pliku — wpisana treść nie jest nadpisywana. Sekcja Zrobione jest zawsze odświeżana z aktualnych danych.

### Auto-trigger

- Poniedziałek → automatycznie generuje weekly za poprzedni tydzień
- 1. dzień miesiąca → automatycznie generuje monthly za poprzedni miesiąc

## Notatki tygodniowe

Klucz: ISO week (np. `2026-W08`). Zawierają:
- Refleksję (zachowywaną)
- Podsumowanie: ukończone zadania, focus time, wynik W/L
- Tabelę dzień po dniu z linkami do daily
- Focus wg projektu
- Notatki (zachowywane)

## Notatki miesięczne

Klucz: `YYYY-MM` (np. `2026-02`). Zawierają:
- Refleksję (zachowywaną)
- Podsumowanie: zadania, focus, W/L
- Focus wg projektu
- Linki do tygodni w danym miesiącu
- Notatki (zachowywane)

## Słownik projektów (autocomplete)

Plik `.top5-dictionary.md` zawiera linki do projektów w formacie:

```
[TOP: Top5](top5://project/abc123)
[CCRS: Claude Code Course](top5://project/def456)
```

Używany z pluginem **Various Complements** w Obsidianie:
1. Settings → Custom Dictionary Complements → włącz
2. Dodaj słownik: path = `top5.journal/.top5-dictionary.md`
3. Wpisz kod projektu (np. `TOP`) → fuzzy match → Tab/Enter wstawia link markdown

Słownik odświeżany automatycznie: na starcie apki, przy generowaniu notatek, przy zmianach danych.

## Deep links `top5://`

Linki `top5://project/<id>` w notatkach Obsidiana otwierają projekt w Top5.

- Protokół rejestrowany przez `app.setAsDefaultProtocolClient('top5')`
- Single instance lock — drugie uruchomienie przekazuje URL do pierwszej instancji
- W zbudowanej apce: `protocols` w `electron-builder.yml` (Info.plist)

## Architektura techniczna

### Pliki

```
main/service/journal.ts     — generowanie markdown, gatherDayStats, generateDictionary
main/store.ts               — IPC handlery, startup dictionary refresh
preload/index.ts            — bridge: journalGenerateDaily/Weekly/Monthly, journalOpen
main/index.ts               — rejestracja top5://, handleDeepLink, single instance lock
electron-builder.yml        — deklaracja protokołu w Info.plist
```

### IPC

| Kanał | Opis |
|-------|------|
| `journal-generate-daily` | Generuj notatkę dzienną (opcjonalny dateStr) |
| `journal-generate-weekly` | Generuj notatkę tygodniową (opcjonalny weekKey) |
| `journal-generate-monthly` | Generuj notatkę miesięczną (opcjonalny monthKey) |
| `journal-open` | Otwórz notatkę w Obsidianie (notePath) |

### Nawigacja deep link

```
open-url / second-instance
  → handleDeepLink(url)
    → parse top5://project/<id>
    → mainWindow.webContents.send('navigate-to-project', projectId)
    → mainWindow.show() + focus()
```
