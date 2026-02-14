# Refactor Review (2026-01-14)

## Zakres

Przegląd całego projektu `top5` (nie tylko bieżących zmian), z naciskiem na:

1. KISS
2. DRY
3. Bezpieczeństwo

Kontekst uwzględniony: projekt jest używany przez jedną osobę (single-user), więc rekomendacje bezpieczeństwa są pragmatyczne, bez enterprise-hardeningu.

## Najważniejsze findings (od najwyższego priorytetu)

### 1) Wysokie: błędna logika `weekdays` w Quick Add (funkcjonalny bug)

- W `QuickAddWindow` tryb `weekdays` wizualnie pokazuje Mon-Fri, ale zapisuje de facto tylko `[1]` (poniedziałek), a Sunday może być zapisane jako `7`, którego potem nie obsługuje logika due (`getDay()` zwraca `0..6`).
- Efekt: powtarzalne zadania nie odpalają się zgodnie z UI.
- Referencje:
`src/renderer/components/QuickAddWindow.tsx:22`
`src/renderer/components/QuickAddWindow.tsx:58`
`src/renderer/components/QuickAddWindow.tsx:591`
`src/renderer/hooks/useTaskList.ts:39`

### 2) Wysokie: niespójna logika repeat między widokami (DRY/KISS + bugi)

- `TodayView` ma własne, uboższe `isScheduleDueToday` i filtr propozycji.
- Nie obsługuje pełnego zakresu harmonogramów miesięcznych oraz nie respektuje `startDate/endDate`.
- `useTaskList` ma inną, bogatszą implementację.
- Efekt: różne części UI mogą pokazywać inne "prawdy" o tym, co jest due dzisiaj.
- Referencje:
`src/renderer/components/TodayView.tsx:39`
`src/renderer/components/TodayView.tsx:183`
`src/renderer/hooks/useTaskList.ts:54`
`src/renderer/hooks/useTaskList.ts:111`

### 3) Wysokie: ryzyko utraty danych przy migracji katalogu

- Migracja przenosi tylko `data.yaml` i `checkins.jsonl`, a potem usuwa stary katalog.
- `operations.jsonl` może zostać utracony.
- Referencje:
`src/main/store.ts:199`
`src/main/store.ts:209`
`src/main/store.ts:229`

### 4) Średnie: `mailto:` deklarowane jako wspierane, ale w praktyce nie działa

- Renderer kieruje `mailto:` do `launchBrowser`.
- `launchBrowser` akceptuje tylko `http/https`.
- Efekt: część linków użytkownika wygląda na wspierane, ale nie otwiera się.
- Referencje:
`src/renderer/utils/projects.ts:134`
`src/main/launchers.ts:5`
`src/main/launchers.ts:44`

### 5) Średnie (security, pragmatycznie): `sandbox: false` we wszystkich oknach

- Dotyczy głównego i pomocniczych okien.
- W projekcie single-user to nie jest blocker, ale obniża defense-in-depth.
- Referencje:
`src/main/index.ts:34`
`src/main/focus-window.ts:121`
`src/main/focus-window.ts:202`
`src/main/focus-window.ts:314`
`src/main/quick-add-window.ts:34`

### 6) Średnie: walidacja `save-config` jest zbyt płytka

- Walidowane są tylko wybrane pola.
- `actionShortcuts` nie są walidowane co do zawartości/formatu.
- Dane z IPC trafiają dalej do rejestracji skrótów.
- Referencje:
`src/main/store.ts:381`
`src/main/store.ts:388`
`src/main/shortcuts.ts:50`
`src/main/shortcuts.ts:63`

### 7) Średnie (DRY/KISS): duplikacja logiki task-list/repeat/reorder

- Podobne reguły istnieją równolegle w:
`TodayView`, `QuickTasksView`, `useTaskList`, częściowo `main` (clean view sizing).
- To już dziś powoduje drift i regresje.
- Referencje:
`src/renderer/components/TodayView.tsx:33`
`src/renderer/hooks/useTaskList.ts:31`
`src/main/index.ts:99`

### 8) Średnie: ciężkie operacje synchroniczne na dysku w ścieżkach logowania

- `taskTimeMinutes()` wczytuje cały plik check-inów przy każdym wywołaniu.
- Wywołania pojawiają się w miejscach częstych (w tym pętle zmian tasków).
- Skaluje się słabo wraz z historią.
- Referencje:
`src/main/store.ts:485`
`src/main/store.ts:486`
`src/main/store.ts:687`
`src/main/store.ts:871`

### 9) Niskie: `setTrafficLightsVisible` ignoruje argument `visible`

- API preload sugeruje przełączanie widoczności.
- Handler w `main` zawsze ustawia to samo.
- Referencje:
`src/preload/index.ts:36`
`src/main/index.ts:151`
`src/main/index.ts:153`

### 10) Niskie: niespójny kontrakt typów dla `saveFocusCheckIn`

- Typ w rendererze deklaruje `Promise<void>`.
- Preload/main faktycznie zwracają listę check-inów.
- Referencje:
`src/renderer/types/index.ts:159`
`src/preload/index.ts:30`
`src/main/store.ts:814`

### 11) Niskie: brak testów automatycznych dla logiki dat i harmonogramów

- Najbardziej ryzykowne obszary (kalendarz/schedule) nie są zabezpieczone testami.
- Referencja:
`package.json:6`

## Dodatkowe obserwacje KISS/DRY

- Duże komponenty UI (`TodayView`, `QuickTasksView`, `QuickAddWindow`) zawierają mieszankę: logika domenowa, DnD, edycja inline, render warunkowy i skróty klawiaturowe. To utrudnia utrzymanie i izolowanie bugów.
- W wielu miejscach jest pobieranie "świeżego stanu" przez `window.api.getAppData()` zamiast jednej, spójnej ścieżki danych (np. store/hook), co zwiększa ryzyko niespójności.
- Logika dotycząca repeat powinna mieć jedno źródło prawdy i być współdzielona między widokami.

## Bezpieczeństwo (pragmatycznie dla single-user)

- Najważniejsze praktycznie:
1. Spójne i kompletne walidacje danych wejściowych po IPC.
2. Ograniczenie powierzchni (tam gdzie to tanie) przez poprawę sandbox/config okien.
3. Utrzymanie allow-list protokołów i poprawa zgodności ścieżek linków (`mailto:`).

- Mniej krytyczne w tym kontekście:
1. Zaawansowane hardeningi procesu build/runtime.
2. Rozbudowane mechanizmy wieloużytkownikowe i rozbudowane uprawnienia.

## Weryfikacja techniczna

- Build i typecheck przechodzą:
`npm run build` -> OK

