## Cel
Aplikacja ma bezpiecznie otwierać plik wskazany ścieżką ze Zrzutu w domyślnym programie systemu. Ścieżka może pochodzić z maila, więc proces główny sam sprawdza, co otwiera.
## Zrobione
- Proces główny rozwija `~`, rozwiązuje dowiązania (symlinki) i otwiera tylko istniejący, zwykły plik.
- Katalogi, pakiety `.app`, pliki z prawem wykonywania i typy, które coś uruchamiają (`.command`, `.sh`, `.jar`, `.pkg`, skróty `.webloc` itd.), są po cichu ignorowane — również przez symlink o niewinnej nazwie.
- Nieistniejący plik też jest ignorowany, bez błędu w konsoli.
- Edytor dostał metodę do wywołania tego otwierania; samo Cmd+kliknięcie podłącza kolejne zadanie.
