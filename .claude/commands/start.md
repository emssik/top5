---
description: Szybki przegląd projektu - wczytaj info, przeanalizuj i wypisz co robi
---

Przeanalizuj ten projekt i wypisz bardzo skrótowe podsumowanie.

Zrób to w następujących krokach (wszystkie równolegle):

1. Wczytaj `package.json`
2. Wczytaj `CLAUDE.md` i `CHANGELOG.md` (jeśli istnieją)
3. Wylistuj strukturę plików projektu (bez node_modules, out, dist) komendą: `ls -la && find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/out/*' -not -path '*/dist/*' | head -80`

Na podstawie zebranych informacji wypisz BARDZO ZWIĘŹLE, jak Ty rozumiesz co projekt robi i jak działa.

Nie proponuj zmian, nie analizuj kodu. Tylko podsumowanie.
