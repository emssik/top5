# 0001. Brak cache projektów w skillu top5-cli

- **Status:** Accepted
- **Date:** 2026-04-12
- **Deciders:** Daniel Roziecki

## Kontekst

Skill top5-cli odpala `top5 projects --json` aby zmapować nazwy projektów na kody.
Pojawił się pomysł, żeby cache'ować wynik tego wywołania — lokalny plik JSON,
który byłby czytany zamiast odpytywania API przy każdym uruchomieniu skilla.

## Decyzja

Nie budujemy cache projektów. Skill odpytuje `top5 projects --json` bezpośrednio
przy każdym użyciu.

## Odrzucone alternatywy

- **Cache z TTL** — odrzucone, bo ryzyko serwowania stale data jest szczególnie
  irytujące w narzędziu do zarządzania zadaniami. Task dodany, ukończony lub
  przypięty musi być widoczny natychmiast. Każdy TTL > 0 tworzy okno
  desynchronizacji.

- **Write-through cache** — odrzucone, bo każda mutacja (dodanie taska,
  ukończenie, zmiana pinu) musiałaby aktualizować plik cache. To dodaje
  złożoność i ryzyko desynchronizacji, a zysk jest znikomy przy obecnej latency.

- **Cache z invalidacją opartą o mtime pliku data.yaml** — odrzucone, bo dodaje
  zależność od wewnętrznej struktury storage top5 (lokalizacja pliku, iCloud sync).
  Łamie enkapsulację.

## Konsekwencje

**Zyski:**
- Zero złożoności związanej z invalidacją cache
- Zawsze świeże dane — brak ryzyka stale data
- Brak dodatkowego pliku do zarządzania

**Koszty:**
- ~60ms na każde wywołanie — akceptowalne, bo skill odpala to raz na sesję
- Payload ~115 KB za każdym razem — porównywalny z rozmiarem pliku cache,
  więc I/O savings z cache byłyby minimalne

**Kiedy rewizja:** jeśli latency wzrośnie powyżej ~500ms (np. remote API zamiast
lokalnego) lub wywołanie stanie się hot path (setki razy na sesję).
