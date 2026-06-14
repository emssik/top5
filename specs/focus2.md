# Focus 2 — blokowanie stron i aplikacji podczas focus

Status: szkic / zrzut intencji. NIE jest częścią refaktoru week/today (etapy 1+2). Osobny, niezależny gadżet — osobny branch, można zrobić wcześniej, ale nie kosztem rozjechania tamtego.

## Cel

Rozszerzyć istniejący focus mode w top5 tak, żeby podczas sesji **blokował rozpraszacze**: wybrane strony WWW i wybrane aplikacje. Bez wtyczek do przeglądarki, bez osobnego natywnego helpera, bez dystrybucji — **single-user, tylko moja maszyna, tylko Arc**.

Inspiracja: Raycast Focus. Zweryfikowane empirycznie, jak Raycast to robi (patrz niżej) — i z tego wynika najprostsza droga dla top5.

## Założenia zakresu (świadomie wąsko)

- **Jeden użytkownik, jedna maszyna** (macOS). Zero notaryzacji, zero system extension, zero entitlementów do dystrybucji.
- **Tylko Arc** dla blokowania stron. Safari/Chrome/Firefox poza zakresem — siedzę w Arc, reszta nieistotna.
- **Soft block, nie więzienie.** Wyłączysz focus → koniec blokady. To friction wymuszający dyscyplinę, nie zabezpieczenie przed determinacją. Świadomy wybór.
- Spięte z **sesją focus**: blokada żyje w rytmie focusa (start → włącz, stop/pauza → wyłącz). Nie osobny włącznik.

## Jak to robi Raycast (mechanizm — zweryfikowane)

Raycast nie publikuje mechanizmu, ale da się go wydedukować z ograniczeń macOS i potwierdzić obserwacją:

- Poprosił o **Accessibility**, a potem — dopiero gdy odpalony był Arc — o **„zarządzanie aplikacją Arc"** (prompt TCC Automation / Apple Events).
- Prompt przyszedł **per-aplikacja, w momencie pierwszej próby kontroli**. To sygnatura Apple Events — zgoda wymagana osobno dla każdej kontrolowanej apki.
- Gdyby to był **Network Extension / filtr sieciowy**, nigdy nie pytałby o konkretną przeglądarkę — działałby pod spodem, browser-agnostycznie.

Wniosek: Raycast działa na warstwie **automatyzacji UI (Accessibility + Apple Events), nie sieci**. Stąd brak problemów z certyfikatami HTTPS i brak system extension.

### Menu mechanizmów na macOS (czemu akurat ten)

1. **`/etc/hosts`** (SelfControl) — domena → `0.0.0.0`. Root, psuje HTTPS brzydkim błędem, nie działa na już-otwartej stronie, per-domena nie per-tab, brak ładnego overlaya. Odrzucone.
2. **Network Extension / Content Filter** (`NEFilterDataProvider`, `NEDNSProxyProvider`) — sankcjonowane przez Apple, warstwa sieci. Wymaga osobnego system extension + entitlement + zatwierdzenie w Ustawieniach. Dla Electrona **praktycznie zamknięte** (osobny natywny helper w Swift, notaryzacja). Odrzucone.
3. **Accessibility API + Apple Events** — to wybieramy. Osiągalne z Electrona przez `osascript`, jeden prompt TCC na kontrolowaną apkę.

## Architektura

Reużywa istniejące wzorce z maina:

- Wzorzec **rekurencyjnego `setTimeout`** jak energy scheduler (NIE `setInterval`).
- Istniejący **tryb focus** (start/stop/pauza) jako trigger.

Pętla:

- **start focus** → uruchom poll loop (co ~1.5 s),
- **stop / pauza focus** → zatrzymaj,
- każdy tick: pobierz frontmost aplikację; rozgałęź na blokowanie stron (Arc) albo apek.

## Blokowanie stron (Arc)

Arc jest skryptowalny przez Apple Events. Odczyt URL aktywnej karty + reakcja.

```bash
# odczyt aktywnej karty
osascript -e 'tell application "Arc" to get URL of active tab of front window'

# A) zamknij kartę — najpewniejsze, Arc na pewno wspiera
osascript -e 'tell application "Arc" to close active tab of front window'

# B) przekieruj na block page — ładniej, ale niepewne czy Arc pozwala pisać URL karty
osascript -e 'tell application "Arc" to set URL of active tab of front window to "file:///.../blocked.html"'
```

**Rekomendacja:** wariant **A (zamknij) + podnieś własny overlay top5** („zablokowane: x.com — wróć do roboty / snooze 5 min"). Pełna kontrola UX, brak zależności od tego, czy Arc pozwala nadpisać URL.

Dopasowanie: parsuj **hostname** z URL i porównaj z blocklistą. NIE `includes` na całym URL — `youtube.com` w query stringu dałoby fałszywe trafienie.

## Blokowanie aplikacji

Prostsze niż strony — wystarczy nazwa frontmost procesu, bez czytania kart.

```bash
# kto na wierzchu
osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'

# ukryj zablokowaną (nie zabija, tylko chowa)
osascript -e 'tell application "System Events" to set visible of process "Slack" to false'
```

**Hide, nie quit** (default):

- `quit` — agresywne, gubi stan, apka się reotwiera. Tylko per-apkę z flagą, dla śmieci bez stanu.
- `hide` — apka żyje dalej, tylko nie da się na nią patrzeć. Przełączysz się → w ~1.5 s odbija. Tak działa Raycast.

Bounce robisz **własnym oknem** (`focusOverlay.show()` w Electronie), bez osascript.

## Zunifikowany tick (szkic)

```js
import { execFile } from 'node:child_process'

const BLOCKED_SITES = ['x.com', 'twitter.com', 'youtube.com', 'reddit.com']
const BLOCKED_APPS  = ['Slack', 'Discord', 'Messages', 'Mail']

function osa(script) {
  return new Promise((res) => {
    execFile('osascript', ['-e', script], (err, out) => res(err ? null : out.trim()))
  })
}

async function tick() {
  if (!isFocusActive()) return
  const front = await osa(
    'tell application "System Events" to get name of first process whose frontmost is true'
  )

  if (front === 'Arc') {
    const url = await osa('tell application "Arc" to get URL of active tab of front window')
    if (url && BLOCKED_SITES.some((d) => hostMatches(url, d))) {
      await osa('tell application "Arc" to close active tab of front window')
      showFocusOverlay({ kind: 'site', what: url })
    }
  } else if (BLOCKED_APPS.includes(front)) {
    await osa(`tell application "System Events" to set visible of process "${front}" to false`)
    showFocusOverlay({ kind: 'app', what: front })
  }

  scheduleNext(1500)
}
```

`hostMatches(url, domain)` = wyciągnij hostname, dopasuj domenę/subdomenę.

## Uprawnienia (TCC)

- **Strony (Arc):** Automation → Arc. Jeden prompt przy pierwszym wywołaniu.
- **Apki (detekcja + hide):** Automation → **System Events**. Jeden dodatkowy prompt.

Oba zatwierdzasz raz. Accessibility prawdopodobnie nie jest konieczne, jeśli idziemy w pełni przez System Events / Apple Events (do potwierdzenia w trakcie).

## Pułapki i trade-offy — bez ściemy

- **Okno 1–2 s** — strona/apka mignie zanim zareagujemy. To cecha (friction wystarcza), nie bug. Twardego blokowania ruchu w tle nie ma (wymagałoby Network Extension).
- **Zamknięcie karty jest destrukcyjne** — jak w blocklistę wpadnie coś z niezapisanym formularzem, stracisz. Dla x/yt/reddit bez znaczenia. Dla „formularzowych" → wariant B/overlay zamiast close.
- **Apka w pełnoekranowym Space** — `set visible … false` nie zadziała tak samo (osobny Space). Edge case; dla zwykłych okien hide działa czysto. Odnotować dziurę, jeśli blokujemy coś odpalanego full-screen.
- **Nie blokuje *uruchomienia*** apki — może wstać, ale jej nie zobaczysz (hide-on-activate ≈ ten sam efekt). Prawdziwe blokowanie launcha = parental controls / MDM, nie warte zachodu.
- **Tylko Arc** dla stron — Safari/Chrome obok przejdą. Nieistotne przy moim użyciu.

## Alternatywa zero-kodu-w-top5

**Hammerspoon** — ~20 linii Lua robi to samo (watcher frontmost + osascript do Arca + alert). Minus: nie spięte z sesją focus, osobny włącznik. Skoro chcę blokadę w rytmie focusa, integracja w top5 jest lepsza. Hammerspoon zostaje jako fallback, gdyby integracja okazała się nieproporcjonalnie droga.

## Otwarte decyzje (przed budową)

- Konfiguracja blocklist: gdzie trzymać (`data.yaml` jak `apiConfig` / `energyTrackerConfig`?), czy UI w Settings czy na start hardcode/YAML.
- Snooze: czas (5/10 min?), per-strona czy globalny na sesję.
- Overlay: nowe okno czy reużycie istniejącego okna focus.
- Czy w ogóle potrzebny frontmost-check przez System Events, czy wystarczy odpytywać samego Arca w try (mniej promptów). Do sprawdzenia w trakcie.

## Werdykt / koszt

Strony + apki = **jedna pętla, jeden mechanizm** (osascript z maina, pod focus). Apki wręcz łatwiejsze. Łącznie ~wieczór roboty, reużywa focus + wzorzec schedulera.

**Osobny branch, niezależnie od week/today.** Można zrobić wcześniej (instant gratification), ale nie mieszać z refaktorem modelu danych.
