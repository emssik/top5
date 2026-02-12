# Migracja UI: Taby → Sidebar

Ten dokument opisuje wszystkie zmiany potrzebne do przejścia z obecnego UI (taby + toolbar) na nowy (sidebar + single panel). Prototyp wizualny: `prototype/index.html`. Clean view pozostaje bez zmian.

---

## 1. Architektura nawigacji

### Obecna
- `TabBar` (5 tabów: Tasks, Projects, Repeat, Suspended, Archive) + `DashboardToolbar` (7 ikon: theme, stats, compact, clean, notes, settings, add project)
- Nawigacja: `activeTab` state w `Dashboard.tsx`
- Projekty: osobny tab "Projects" z listą `ProjectTile` (collapse/expand accordion)

### Nowa
- **Stały sidebar (170px)** po lewej + **jeden panel główny** po prawej
- Sidebar zawiera WSZYSTKO: nawigację, listę projektów, akcje
- `TabBar` i `DashboardToolbar` — **usunięte**
- Nawigacja: `activeView` state (string) zamiast `activeTab`

### Nowy komponent: `Sidebar.tsx`

Struktura sidebar (od góry do dołu):

```
Logo: ☀ TOP 5
─────────────────
▶ Today              ← domyślny widok, activeView='today'
👁 Clean view         ← włącza clean view (jak obecny toggleCleanView)
📝 Quick notes        ← otwiera notes panel (slide-in z prawej)
─────────────────
PROJECTS (label)
● CC Course           ← klik → activeView='project-{id}'
● Top5                   kolorowa kropka = kolor projektu
● Lejek
● Sokrates
● AI TD
─────────────────
SUSPENDED (label, collapsible)
  ⏸ Kamila            ← opacity 0.5, klik → unsuspend dialog
ARCHIVED (label, collapsible)
  📦 Materiały         ← opacity 0.5, klik → restore dialog
─────────────────
+ Add project         ← otwiera ProjectEditor modal
─────────────────  (margin-top: auto — pushes to bottom)
↻ Repeat              ← activeView='repeat'
📊 Stats              ← activeView='stats'
⚙ Settings            ← otwiera Settings modal
─────────────────
🌙 Dark mode          ← toggle theme
```

**Kluczowe zachowania sidebar:**
- Aktywny item ma `bg-sidebar-active` + `font-weight: 500`
- Projekty mają kolorowe kropki (8px circle) — kolor z nowego pola `project.color`
- Suspended/Archived sekcje collapsible (domyślnie zwinięte)
- Sidebar nie scrolluje się (max 5 projektów + kilka suspended/archived mieści się)

---

## 2. Kolory projektów — nowe pole danych

### Zmiana w typach (`types/index.ts` + `main/store.ts`)

Dodać do `Project`:
```ts
color?: string  // jeden z: 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'purple' | 'pink' | 'teal'
```

### Paleta kolorów (CSS variables)

```css
--pc-red: #ef4444;
--pc-orange: #f97316;
--pc-amber: #f59e0b;
--pc-green: #22c55e;
--pc-blue: #3b82f6;
--pc-purple: #a855f7;
--pc-pink: #ec4899;
--pc-teal: #14b8a6;
```

### Auto-przypisanie
Przy tworzeniu projektu, jeśli `color` nie podany — przypisać pierwszy nieużywany kolor z palety.

### Gdzie kolor jest widoczny
1. **Sidebar** — kolorowa kropka (8px) przy nazwie projektu
2. **Today view** — kolorowa kropka (6px) w meta linii pinned tasku (pod tytułem)
3. **Project detail** — kolorowy left-border (4px) w headerze projektu
4. **Edit project modal** — color picker (8 kółek do wyboru)

---

## 3. Today view — główny widok

Zastępuje obecny `QuickTasksView` w trybie `showAll`. Struktura sekcji (od góry):

### 3.1. Sekcja FOCUS (0 lub 1 task)

Jeśli `config.focusProjectId` i `config.focusTaskId` są ustawione, pokaż focused task jako **hero card**:

```
┌─ FOCUS ──────────────────────────────────────┐
│ 🔵  ○ Fix auth token refresh      12:34  ■  │
│        ● Top5                                │
└──────────────────────────────────────────────┘
```

**Styl focus card:**
- Większy padding (14px 16px), border-radius 10px
- Border: `1.5px solid rgba(59,130,246,0.35)`
- Box-shadow: `0 0 0 3px rgba(59,130,246,0.08)`
- Left border: 4px solid `#3b82f6` (via `::before` pseudo-element)
- Pulsujący niebieski dot (8px, animacja pulse 2s infinite)
- Timer z `useTimer` — wyświetlany jako `mm:ss`, kolor `#60a5fa`
- Tytuł: `font-size: 15px`, `font-weight: 500`
- Akcja hover: przycisk "■" (stop focus)

**Obecna zmiana**: Focus jest teraz NAJWAŻNIEJSZYM elementem wizualnie — własna sekcja na górze z hero treatment. W obecnym UI to tylko mała kropka na tasku.

### 3.2. Sekcja IN PROGRESS

Taski z `inProgress === true` (nie focused):

```
── IN PROGRESS ─────────────────
│ ○ Design landing page      ■ ▶│  ← amber left border
│   ● CC Course · 25m           │
```

**Styl:**
- Standardowa task card z `border-left: 3px solid #f59e0b`
- Akcje hover: ■ (stop in-progress), ▶ (focus)

### 3.3. Sekcja UP NEXT

Pozostałe taski do limitu (Focus + In Progress + Up Next = limit, domyślnie 5):

```
── UP NEXT ─────────────────────
│ ○ Odpowiedź na maila Kuby  ▶ ▶│
│   [quick task]                 │
│ ○ Przygotuj materiały      ▶ ▶│
│   ● Lejek                     │
```

**Meta linia pod tytułem:**
- Pinned task z projektu: kolorowa kropka + nazwa projektu + opcjonalnie czas
- Standalone quick task (bez projektu): tag `[quick task]` (mały pill, bg-surface, text-muted)

**Akcje hover:** ▶ (in-progress), ▶ (focus), ✕ (remove/unpin)

### 3.4. Sekcja REPEATING (poza limitem)

Propozycje repeating tasks (z obecnej logiki `useTaskList.proposals`):
- Dashed border, opacity 0.6
- Ikona ↻ + tytuł
- Przyciski: ✓ (accept), ✕ (dismiss)
- Aktywne repeating taski (already accepted) — renderowane jak normalne taski z ikoną ↻

### 3.5. Linia limitu + sekcja OVERFLOW (collapsible)

```
─────── limit 5 ───────

⋯ Beyond limit (3)    ▸   ← collapsible, domyślnie zwinięte
```

Taski poza limitem:
- Opacity 0.35 (hover → 0.6)
- Ta sama struktura co Up Next, ale przyciemnione
- Collapsible toggle

### 3.6. Sekcja DONE TODAY (collapsible)

```
✓ Done today (3)       ▸   ← collapsible, domyślnie zwinięte
```

- Zielony checkbox (filled circle z ✓)
- Tytuł: line-through, text-muted
- Background: `rgba(34,197,94,0.08)`
- Border: transparent

### 3.7. Add task

Przycisk `+ Add task` na dole (jak obecny).

### Checkboxy

**Zmiana**: okrągłe zamiast kwadratowych.
- Niezaznaczony: `border-radius: 50%`, `border: 1.5px solid var(--c-border)`
- Zaznaczony: `background: #22c55e`, `border-color: #22c55e`, biały ✓ wewnątrz

---

## 4. Project detail view — nowy widok

Zastępuje obecny `ProjectTile` (accordion). Teraz to pełnoekranowy panel po kliknięciu projektu w sidebarze.

### Header

```
┌──────────────────────────────────────────────┐
│ ▌ CC Course                           ✏  ⏸  │
│ ▌ Focus management course                    │
│ ▌ 59m tracked · 5 tasks · 2 pinned          │
└──────────────────────────────────────────────┘
```

- Kolorowy left bar (4px × 56px) odpowiadający kolorowi projektu
- Nazwa: `18px`, `font-weight: 600`
- Opis: `13px`, `text-secondary`
- Statystyki: tracked time, task count, pinned count — `11px`, `text-muted`
- Akcje: ✏ (otwiera Edit Project modal), ⏸ (suspend)

### Quick links

```
[VS Code] [Terminal] [Figma]
```

- Pillsy: `padding: 4px 10px`, `border-radius: 6px`, `bg-surface`, `border: 1px solid border-subtle`
- Klikalne — otwierają launcher (jak obecne `project.launchers`)

### Lista tasków

Wszystkie taski projektu (nie tylko pinned!):
- Pinned taski: stała ikona 📌 (opacity 0.5)
- Niepinned taski: ikona 📌 pojawia się na hover (opacity 0 → 0.35, hover → 0.8) — klik = pin to Today
- Akcje hover: ▶ (focus)
- Checkbox, inline edit (double-click), drag-to-reorder

### Done (collapsible)

```
✓ Done (2)             ▸
```

Taski completed, collapsible. Jak w Today view.

### Add task

`+ Add task` na dole.

---

## 5. Edit Project modal — nowy/rozszerzony

Obecny `ProjectEditor.tsx` rozszerzony o:

### Pola formularza

1. **Name** — text input
2. **Description** — textarea
3. **Color** — color picker: 8 kolorowych kółek (24px), selected = border + box-shadow
4. **Quick Links** — lista par (label + URL/command):
   - Każdy wiersz: input label + input URL + przycisk ✕ (remove)
   - Na dole: `+ Add link`
   - Zastępuje obecne osobne pola launchers (vscodePath, terminalPath, obsidianNote, browserUrl)

### Akcje

- **Archive** (danger button, po lewej)
- **Cancel** (secondary)
- **Save** (primary, blue)

### Zmiana danych: launchers → links

Obecne:
```ts
launchers?: {
  vscodePath?: string
  terminalPath?: string
  obsidianNote?: string
  browserUrl?: string
}
```

Nowe:
```ts
links?: Array<{ label: string; url: string }>
```

Migracja: konwertuj istniejące launchers na links przy ładowaniu danych.

---

## 6. Repeat view + modal

### Lista (widok w panelu)

Bez zmian koncepcyjnych vs obecny `RepeatingTasksTab`:
- Lista repeating tasks z ikoną ↻, tytułem, badge schedule
- Klik na item → otwiera Edit modal
- `+ Add repeating task` → otwiera Add modal

### Modal repeating task (add/edit)

Pola:
1. **Title** — text input
2. **Schedule** — toggle buttons:
   - `Every day` — brak dodatkowych pól
   - `Every N days` — input number + select (days/weeks)
   - `Weekdays` (Mon-Fri) — brak dodatkowych pól
   - `Custom days` — 7 toggleable day buttons (Mon-Sun)
   - `After done` — input number + select (days/weeks after completion)
3. **After completion** — toggle: Remove / Keep

Akcje:
- **Add mode**: Cancel + Add
- **Edit mode**: Delete (danger) + Cancel + Save

---

## 7. Quick Notes — panel slide-in

### Zmiana vs obecne

Obecne: modal overlay (`QuickNotes.tsx`)
Nowe: **slide-in panel z prawej strony** (320px, fixed)

- Animacja: `transform: translateX(100%)` → `translateX(0)`, transition 0.25s
- Header: "Quick Notes" + przycisk ✕
- Body: pełna textarea, auto-focus
- Box-shadow na lewej krawędzi
- Zamykany: ✕, Escape, lub ponowny klik "Quick notes" w sidebarze

---

## 8. Settings modal

### Usunięte
- **Compact mode** — usunięty (clean view zastępuje compact)

### Zachowane
- Theme (display only — toggle w sidebarze)
- Clean view font (picker)
- Task limit
- iCloud sync
- Data location

### Dodane: Keyboard Shortcuts (collapsible)

Sekcja pod ustawieniami, domyślnie zwinięta:

| Akcja | Skrót |
|-------|-------|
| Clean view | ⌘ Shift C |
| New task | N |
| Focus mode | ⌘ Shift F |
| Project 1–5 | ⌘ 1-5 |
| Quick notes | ⌘ Shift N |
| Toggle theme | ⌘ Shift T |

---

## 9. Stats view

Widok w panelu głównym (klik "Stats" w sidebarze). Trzy sekcje:

1. **Summary cards** (grid 3 kolumny): Tasks Done, Focused time, Day Streak
2. **This week per project** (grid 5 kolumn): task count per projekt z kolorami projektów
3. **Activity** — placeholder na heatmapę

Obecny `StatsView.tsx` otwiera się jako osobne okno Electron. W nowym UI — renderowany inline w panelu głównym. Osobne okno stats może zostać jako opcja.

---

## 10. Zmiany w CSS/theming

### Nowe tokeny kolorów

```css
--bg-sidebar: #111111;        /* dark */
--bg-sidebar: #f5eedf;        /* light */
--bg-sidebar-hover: #1e1e1e;  /* dark */
--bg-sidebar-hover: #ebe3d2;  /* light */
--bg-sidebar-active: #262626; /* dark */
--bg-sidebar-active: #e4dbc8; /* light */
--bg-done: rgba(34,197,94,0.08); /* dark */
--bg-done: rgba(34,197,94,0.06); /* light */
```

### Usunięte klasy/komponenty
- `CompactBar.tsx` — usunięty (compact mode nie istnieje)
- Compact mode toggle i logika w `Dashboard.tsx`
- `TabBar.tsx` — usunięty
- `DashboardToolbar.tsx` — usunięty (funkcje przeniesione do Sidebar)

---

## 11. Layout główny — zmiana w Dashboard.tsx

### Obecny layout
```
┌─────────────────────────────┐
│  titlebar (drag, 32px)      │
│  TabBar + DashboardToolbar  │
│  ┌─────────────────────┐    │
│  │  content (scroll)   │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

### Nowy layout
```
┌──────────┬──────────────────┐
│          │ titlebar (24px)  │
│ Sidebar  │ ┌──────────────┐ │
│ (170px)  │ │ content      │ │
│ (fixed)  │ │ (scroll)     │ │
│          │ └──────────────┘ │
└──────────┴──────────────────┘
```

- `body`/root: `display: flex`
- Sidebar: `width: 170px`, `height: 100vh`, `flex-shrink: 0`, fixed
- Main panel: `flex: 1`, `overflow-y: auto`, `padding: 24px 32px`
- Titlebar drag area: nad main panelem, nie nad sidebar (sidebar ma własne items)

---

## 12. Komponenty — mapowanie stare → nowe

| Obecny | Nowy | Zmiana |
|--------|------|--------|
| `Dashboard.tsx` | `Dashboard.tsx` | Przebudowa: sidebar layout, nowy routing widoków |
| `TabBar.tsx` | **usunięty** | Nawigacja przeniesiona do `Sidebar.tsx` |
| `DashboardToolbar.tsx` | **usunięty** | Akcje przeniesione do `Sidebar.tsx` + Settings |
| `ProjectTile.tsx` | `ProjectDetailView.tsx` | Z accordion → pełnoekranowy widok |
| `TaskList.tsx` | `TaskList.tsx` | Bez zmian (używany w ProjectDetailView) |
| `QuickTasksView.tsx` | `TodayView.tsx` | Przebudowa: sekcje Focus/InProgress/UpNext/Overflow/Done |
| `RepeatingTasksTab.tsx` | `RepeatView.tsx` | Minimalne zmiany, nowy modal add/edit |
| `Settings.tsx` | `Settings.tsx` | Usunięty compact mode, dodane shortcuts (collapsible) |
| `QuickNotes.tsx` | `QuickNotesPanel.tsx` | Z modal → slide-in panel z prawej |
| `ProjectEditor.tsx` | `EditProjectModal.tsx` | Dodany color picker, links zamiast launchers |
| `CompactBar.tsx` | **usunięty** | — |
| `CleanViewHeader.tsx` | `CleanViewHeader.tsx` | Bez zmian |
| `CheckInPopup.tsx` | `CheckInPopup.tsx` | Bez zmian |
| `FocusMode.tsx` | `FocusMode.tsx` | Bez zmian |
| `StatsView.tsx` | `StatsView.tsx` | Dodana wersja inline (w panelu), osobne okno opcjonalne |
| — | `Sidebar.tsx` | **nowy** |

---

## 13. Kolejność implementacji

1. **Typy**: dodać `color` do `Project`, `links` do `Project` (+ migracja launchers → links)
2. **Sidebar.tsx**: nowy komponent, routing widoków
3. **Dashboard.tsx**: przebudowa layoutu (sidebar + main panel), usunięcie TabBar/DashboardToolbar
4. **TodayView.tsx**: przebudowa QuickTasksView z sekcjami Focus/InProgress/UpNext/Overflow/Done
5. **ProjectDetailView.tsx**: nowy widok projektu (z ProjectTile inline → full panel)
6. **EditProjectModal.tsx**: rozszerzony ProjectEditor (color picker, links)
7. **QuickNotesPanel.tsx**: slide-in zamiast modal
8. **Settings.tsx**: usunięcie compact mode, dodanie shortcuts collapsible
9. **RepeatView.tsx**: dodanie modala add/edit
10. **CSS**: nowe tokeny sidebar, project colors, focus card, round checkboxes
11. **Cleanup**: usunięcie CompactBar, TabBar, DashboardToolbar
