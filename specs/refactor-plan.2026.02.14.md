# Plan Naprawczy Refaktoru (2026-02-14)

## Cel

Usunąć błędy funkcjonalne i niespójności wskazane w `specs/refactor.2026.01.14.md`, ograniczyć ryzyko utraty danych oraz uprościć architekturę logiki repeat/schedule zgodnie z KISS i DRY.

## Założenia wykonawcze

- Brak estymacji w tym planie.
- Wszystkie prace realizuję samodzielnie.
- Kolejność jest ustawiona pod minimalizację ryzyka regresji: najpierw bezpieczeństwo danych i krytyczne bugi, potem unifikacja logiki, na końcu cleanup i hardening.

## Zasady realizacji

- Każda zmiana domenowa w repeat/schedule jest zabezpieczona testami.
- Jedno źródło prawdy dla reguł "due today".
- Brak usuwania danych podczas migracji, jeśli nie ma potwierdzenia kompletnego przeniesienia.
- Walidacja wejścia po IPC jest jawna i kompletna.

## Etap 1: Testy regresyjne dla obszarów krytycznych

Zakres:
- Dodać testy jednostkowe logiki harmonogramów: `weekdays`, `monthly`, `startDate`, `endDate`, mapowanie Sunday.
- Dodać testy integracyjne przepływu Quick Add -> zapis -> "due today" w widokach.

Kryteria odbioru:
- Testy reprodukują obecne błędy z review.
- Po poprawkach testy przechodzą i blokują powrót regresji.

## Etap 2: Krytyczne poprawki funkcjonalne i bezpieczeństwo danych

Zakres:
- Naprawić zapis `weekdays` w `QuickAddWindow` i ujednolicić reprezentację dni tygodnia do zakresu `0..6`.
- Dodać normalizację danych legacy (`7` dla Sunday -> `0`).
- Poprawić migrację katalogu danych: uwzględnić `operations.jsonl` i usuwać stary katalog wyłącznie po potwierdzeniu pełnego przeniesienia.

Kryteria odbioru:
- Tryb `weekdays` zapisuje i odczytuje dokładnie dni pokazane w UI.
- Zadania cykliczne odpalają się zgodnie z konfiguracją.
- Migracja nie powoduje utraty `operations.jsonl`.

## Etap 3: Unifikacja logiki repeat/schedule (DRY/KISS)

Zakres:
- Wydzielić wspólny moduł domenowy `isScheduleDueToday` i reguły filtrowania.
- Podpiąć ten sam moduł w `TodayView`, `useTaskList` i innych miejscach korzystających z podobnej logiki.
- Usunąć duplikaty i wyrównać obsługę miesięcznych harmonogramów oraz `startDate/endDate`.

Kryteria odbioru:
- Istnieje jedna implementacja reguł "due today".
- Wszystkie widoki pokazują spójny wynik dla tych samych danych.

## Etap 4: Poprawki średniego priorytetu (spójność + bezpieczeństwo pragmatyczne)

Zakres:
- Naprawić obsługę `mailto:`: spójny kontrakt renderer/main i poprawna allow-list protokołów.
- Rozszerzyć walidację `save-config` o `actionShortcuts` i format wartości używanych przez rejestrację skrótów.
- Ograniczyć ciężkie synchroniczne odczyty check-inów (`taskTimeMinutes`) przez cache/indeksowanie i aktualizacje przyrostowe.

Kryteria odbioru:
- `mailto:` działa zgodnie z deklaracją API.
- Niepoprawny payload IPC jest odrzucany i nie trafia do rejestracji skrótów.
- Częste ścieżki logowania tasków nie wykonują pełnego odczytu historii za każdym razem.

## Etap 5: Cleanup low-priority i kontrakty API

Zakres:
- Naprawić `setTrafficLightsVisible`, aby respektowało argument `visible`.
- Ujednolicić kontrakt typów `saveFocusCheckIn` między renderer, preload i main.

Kryteria odbioru:
- API działa zgodnie z podpisami typów.
- Brak ukrytych niezgodności między deklaracjami a runtime.

## Etap 6: Tanie hardeningi Electron

Zakres:
- Przejrzeć okna z `sandbox: false` i włączyć `sandbox: true` tam, gdzie nie powoduje regresji funkcji.
- Zachować wyjątki tylko tam, gdzie technicznie konieczne, z krótkim uzasadnieniem w kodzie.

Kryteria odbioru:
- Mniejsza powierzchnia ataku bez utraty funkcjonalności.
- Konfiguracja okien jest spójna i uzasadniona.

## Kolejność commitów

1. `test(schedule): add repeat/date regression coverage`
2. `fix(schedule): weekdays mapping and sunday normalization`
3. `fix(migration): preserve operations journal and safe directory cleanup`
4. `refactor(schedule): shared due engine across views`
5. `fix(ipc): mailto handling and save-config validation hardening`
6. `perf(store): reduce synchronous checkins reads in hot paths`
7. `chore(api): align traffic lights and saveFocusCheckIn contracts`
8. `hardening(electron): enable sandbox where safe`

## Definicja zakończenia

Plan uznaję za wykonany po zamknięciu wszystkich etapów oraz po przejściu:
- `npm run build`
- testów dodanych w Etapie 1
- krótkiej checklisty manualnej dla Quick Add, TodayView, migracji danych i launcherów.
