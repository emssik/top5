# Top5 - Plan implementacji

## Kontekst

Aplikacja desktopowa (Electron) do zarządzania uwagą. Wymusza limit 5 projektów, minimalizuje tarcie przy przełączaniu kontekstu. Każdy projekt ma szybkie launczery (VS Code, iTerm, Obsidian, przeglądarka), tracking czasu i deadline. Tryb fokus zmniejsza okno do jednego konkretnego zadania. Integracja z Linear odłożona na później.

## Stack

- **Electron + electron-vite** (scaffolding: `npm create @quick-start/electron`)
- **React 18 + TypeScript**
- **Tailwind CSS v4**
- **Zustand** - state management
- **electron-store** - persystencja danych w JSON
- **nanoid** - generowanie ID

## Struktura projektu

```
src/
  main/
    index.ts              # Entry, BrowserWindow, tray
    shortcuts.ts          # Globalne skróty klawiszowe
    launchers.ts          # Komendy shell: VS Code, iTerm, Obsidian, browser
    store.ts              # electron-store + IPC handlery danych
    focus-window.ts       # Zarządzanie oknem w trybie fokus
  preload/
    index.ts              # contextBridge - IPC bridge do renderera
  renderer/
    main.tsx
    App.tsx
    components/
      Dashboard.tsx       # Grid 5 kafelków
      ProjectTile.tsx     # Karta projektu
      ProjectEditor.tsx   # Edycja projektu (modal/inline)
      FocusMode.tsx       # Minimalne okno z zadaniem
      TaskList.tsx        # Lista zadań w projekcie
      QuickNotes.tsx      # Notatnik (panel/modal)
      Settings.tsx        # Konfiguracja skrótów
    hooks/
      useProjects.ts      # Zustand store
      useTimer.ts         # Tracking czasu
    types/
      index.ts            # Interfejsy TS
```

## Model danych

Plik JSON via electron-store (`~/Library/Application Support/top5/config.json`):

```typescript
interface Project {
  id: string
  name: string
  description: string
  order: number                  // 0-4
  deadline: string | null        // ISO date
  totalTimeMs: number
  timerStartedAt: string | null  // ISO timestamp, null = paused
  launchers: {
    vscode: string | null        // ścieżka folderu
    iterm: string | null         // ścieżka folderu (cd)
    obsidian: string | null      // vault name lub obsidian:// URI
    browser: string | null       // URL
  }
  tasks: Task[]
}

interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: string
}

interface AppConfig {
  globalShortcut: string                   // np. "CommandOrControl+Shift+Space"
  actionShortcuts: Record<string, string>  // akcja -> combo klawiszy
  focusTaskId: string | null
  focusProjectId: string | null
}

interface AppData {
  projects: Project[]   // max 5
  quickNotes: string    // plaintext scratchpad
  config: AppConfig
}
```

## Fazy implementacji

### Faza 1: Skeleton + kafelki projektów

Cel: Aplikacja uruchamia się, widać 5 kafelków, dane persystują.

**UI kafelków**: Start z eleganckim, minimalistycznym designem - czyste karty z nazwą, opisem, subtelnymi ikonkami launcherów. Przełącznik "compact/expanded" na później doda widok z timerem, deadline i listą zadań inline.

1. Scaffold: `npm create @quick-start/electron@latest . -- --template react-ts`
2. Dodać: Tailwind v4, Zustand, electron-store, nanoid
3. Main process: BrowserWindow, electron-store z domyślnymi danymi
4. Preload: IPC bridge (`getAppData`, `saveProject`, `deleteProject`)
5. `Dashboard.tsx` - grid 5x `ProjectTile.tsx` (eleganckie, minimalistyczne karty)
6. Inline edycja projektu (nazwa, opis, deadline, ścieżki launcherów)

### Faza 2: Quick launchers

Cel: Klik na przycisk -> narzędzie otwiera projekt.

`launchers.ts`:
- **VS Code**: `exec('code "path"')`
- **iTerm**: AppleScript via `osascript` - nowy tab + `cd path`
- **Obsidian**: `shell.openExternal('obsidian://open?vault=...')`
- **Browser**: `shell.openExternal(url)`

### Faza 3: Globalny shortcut + tryb fokus

Cel: Skrót klawiszowy przywołuje/ukrywa aplikację. Wybór zadania -> okno kurczy się do mini-widgetu.

**Globalny shortcut**: `globalShortcut.register()` - toggle show/hide.

**Focus mode** (resize głównego okna, nie osobne okno):
- Zapamiętaj `mainWindow.getBounds()`
- `setSize(340, 120)`, `setAlwaysOnTop(true)`, **pozycja: prawy górny róg ekranu**
- Renderer: warunkowe renderowanie `FocusMode` vs `Dashboard` na podstawie `focusTaskId` w Zustand
- FocusMode UI: nazwa zadania, projekt, przycisk wyjścia
- Wyjście: przywróć oryginalne bounds

### Faza 4: Timer + zadania + notatki

- **Timer**: `timerStartedAt` + `totalTimeMs` pattern. `setInterval(1s)` w rendererze. Przeżywa restart apki.
- **Zadania**: prosty CRUD w projekcie. Przycisk "Focus" na zadaniu -> wejście w tryb fokus.
- **Quick Notes**: textarea w modalu/panelu, persystowane jako string.

### Faza 5: Pełne skróty klawiszowe

- Settings UI z tabelą konfiguracji skrótów
- Domyślne skróty:
  - `Cmd+Shift+Space` - toggle aplikacji
  - `Cmd+1..5` - przełącz na projekt
  - `Cmd+Shift+F` - toggle focus mode
  - `Cmd+Shift+N` - notatki

### Faza 6: Polish (odłożone)

- Ikona tray w menu bar
- Drag & drop reordering kafelków
- Wizualne ostrzeżenia o deadline
- Dark/light theme
- Pakowanie `.dmg`

## Weryfikacja

Po każdej fazie:
1. `npm run dev` - aplikacja uruchamia się bez błędów
2. Test manualny każdej dodanej funkcji
3. Restart aplikacji - dane przetrwały (electron-store)
4. Faza 3: test globalnego shortcutu z innej aplikacji
