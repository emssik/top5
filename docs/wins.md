# 5 Wins — System gamifikacji

## Idea

Codzienny challenge: zablokuj zestaw zadań, wykonaj je wszystkie przed deadline'em — wygraj dzień. Buduj serie zwycięstw.

## Zasady gry

### Lock (blokada)

- Gracz blokuje bieżące zadania w limicie (przycisk kłódki przy separatorze limitu)
- Blokowane są tylko zadania non-repeating w limicie + focus task
- Repeating tasks nie wchodzą do blokady
- Po zablokowaniu: nowe zadania (pinned/quick) trafiają do "Beyond limit", nie mogą wypychać zablokowanych

### Deadline

- Lock przed 12:00 — deadline = koniec tego dnia (23:59:59)
- Lock o 12:00 lub później — deadline = koniec następnego dnia (23:59:59)
- Sprawdzany co 60 sekund w main process

### Rozstrzygnięcie

- **Wygrana (win)**: wszystkie zablokowane zadania completed — automatycznie po oznaczeniu ostatniego
- **Przegrana (loss)**: deadline minął, nie wszystkie completed
- Po rozstrzygnięciu: lock się czyści, wpis trafia do historii, overlay w UI

### Unlock

- Gracz może ręcznie odblokować (przycisk ✕ na lock bar) — żaden wynik nie jest zapisywany

### Zablokowane akcje

- Drag & drop wyłączony podczas locka
- Przycisk usuwania/odpinania ukryty na locked tasks
- Dodawanie nowych zadań ukryte
- Complete, focus, edit, in-progress — działają normalnie

## Hierarchia wygranych

### Dzień

Wygrany = wszystkie zablokowane zadania completed przed deadline'em. `entry.date` = data blokady (`lockedAt.slice(0,10)`), nie data rozwiązania.

### Tydzień

Tydzień (ISO, pon–nd) jest wygrany gdy **wszystkie dni** w tygodniu są wygrane.

- **2+ strat w tygodniu** → tydzień od razu przegrany (nie trzeba czekać na koniec tygodnia)
- **0 strat** → wygrany (po rozegraniu tygodnia, min 5 wpisów)
- **1 strata** → wygrany, ale tylko jeśli to max 2. taki tydzień w danym miesiącu

Odstępstwo: w ciągu miesiąca **max 2 tygodnie** mogą mieć po 1 przegranym dniu i wciąż liczyć się jako wygrane. 3. taki tydzień (i kolejne) to już przegrana.

### Miesiąc

Miesiąc wygrany = **wszystkie tygodnie** w miesiącu wygrane (z uwzględnieniem powyższego odstępstwa).

### Rok

Rok wygrany = **minimum 11 miesięcy** wygranych (dopuszczalny 1 przegrany miesiąc).

## Serie (streaks)

### Seria dzienna

Kolejne dni z wynikiem "win", liczone wstecz od dziś. Dni bez locka (brak wpisu) nie liczą się ani jako win, ani loss — ale przerywają serię jeśli ta już się zaczęła. Wyjątek: dzisiejszy dzień może być pusty (jeszcze nie grał).

### Seria tygodniowa

Kolejne wygrane tygodnie liczone wstecz od bieżącego. Bieżący tydzień bez rozstrzygnięcia jest pomijany. Tydzień z 2+ stratami natychmiast przerywa serię.

### Seria miesięczna

Kolejne wygrane miesiące liczone wstecz od bieżącego. Bieżący miesiąc bez wpisów jest pomijany.

### Seria roczna

Kolejne wygrane lata liczone wstecz od bieżącego. Bieżący rok bez wpisów jest pomijany.

## UI

### 30-day strip (TodayView, góra)

Rząd 30 kropek (ostatnie 30 dni): zielona = win, czerwona = loss, szara = brak. Obok: `🏆 N` (bieżąca seria).

### Lock bar (TodayView, podczas locka)

`🔒 3/5 · 4h 23m · ✕` — ikona, progress, countdown do deadline, przycisk unlock.

### Victory overlay

Po wygranej: fullscreen overlay z `🏆 Victory!`, informacja o serii, auto-dismiss po 5s. Działa w TodayView i clean window (QuickTasksView).

### Loss overlay

Po przegranej: overlay z `💪 Nie tym razem / Nie przejmuj się, jutro będzie lepiej!`. Auto-dismiss po 6s.

### Post-win/loss banner

Persistentny banner na górze TodayView po rozstrzygnięciu dnia:
- Win: `🏆 Wygrana! / Dodaj nowe zadania i zablokuj je, by utrzymać serię`
- Loss: `💪 Nie tym razem / Nie przejmuj się — jutro na pewno będzie lepiej!`

### Stats (InlineStatsView)

Karta "Win Streak" w siatce statystyk. Sekcja "5 Wins": tydzień W/L, miesiąc W/L, serie tygodniowe/miesięczne, kalendarz miesiąca z kropkami.

---

## Architektura techniczna

### Typy (`src/shared/types.ts`)

```
LockedTaskRef     — referencja do zablokowanego taska (kind + id)
WinsLockState     — stan blokady (locked, lockedAt, deadline, lockedTasks)
WinEntry          — wpis historii (date, result, taskCount, completedCount)
StreakStats        — obliczone serie i statystyki W/L
AppData.winsLock  — stan blokady persystowany w data.yaml
```

### Storage

| Plik | Format | Cel |
|------|--------|-----|
| `data.yaml` → `winsLock` | YAML (w AppData) | Bieżący stan blokady, przetrwa restart |
| `wins.jsonl` | JSONL (append-only) | Historia win/loss, backup w dailyBackup |

### Warstwy

```
shared/wins.ts          — calcStreaks() — pure function, shared między main i renderer
main/service/wins.ts    — lockTasks, unlockTasks, checkWinCondition, checkDeadline,
                          resolveDay, loadWinHistory, getStreaks
main/store.ts           — IPC handlery + periodic deadline check (setInterval 60s)
preload/index.ts        — bridge: winsLock, winsUnlock, winsGetLockState,
                          winsGetHistory, winsGetStreaks
renderer/hooks/
  useTaskList.ts        — lock-aware split (locked tasks stay in limit)
  useProjects.ts        — Zustand: winsLock state + lockWinsTasks/unlockWinsTasks
renderer/components/
  TodayView.tsx         — lock UI, 30d strip, overlays, post-win banner
  QuickTasksView.tsx    — lock detection, overlays (clean window)
  InlineStatsView.tsx   — streak stats, wins calendar
```

### IPC

| Kanał | Kierunek | Opis |
|-------|----------|------|
| `wins-lock` | renderer → main | Zablokuj zadania |
| `wins-unlock` | renderer → main | Odblokuj (bez wyniku) |
| `wins-get-lock-state` | renderer → main | Pobierz bieżący stan locka |
| `wins-get-history` | renderer → main | Pobierz pełną historię win/loss |
| `wins-get-streaks` | renderer → main | Oblicz i zwróć serie |

### Win condition check

Po `complete-quick-task` i `save-project` (gdy task staje się completed):
1. `winsService.checkWinCondition()` sprawdza czy ALL locked tasks completed
2. Jeśli tak → `resolveDay('win')` → append do `wins.jsonl` → clear lock
3. `notifyAllWindows()` → wszystkie okna przeładowują dane
4. Renderer wykrywa przejście `isLocked: true → false` → pokazuje overlay

### Deadline check

- Na starcie aplikacji: jednorazowy `checkDeadline()`
- Co 60 sekund: `setInterval` w `registerHandlers()`
- Jeśli deadline minął: resolve jako loss (lub win jeśli wszystko done)

### useTaskList — lock-aware split

Hook `useTaskList` jest single source of truth dla podziału tasków na within-limit / overflow:
- Gdy `isLocked`: locked tasks **zawsze** zostają w limicie, nowe trafiają do overflow
- Gdy nie locked: standardowy split po `activeSlots`
- Opcja `excludeFocus: true` (TodayView): focus task wyciągnięty osobno, slot consumption
- Bez `excludeFocus` (clean window): focus task w liście jak zwykły task
