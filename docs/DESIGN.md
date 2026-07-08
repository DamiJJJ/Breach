# 🚔 BREACH — Game Design & Technical Brief (v2)
### Dokument startowy dla sesji Claude Code

> **Changelog v2:** ujednolicono układy współrzędnych i kontrakt kamery, rozstrzygnięto otwarte decyzje projektowe (hitscan, model pauzy, format mapy), dodano sekcje *Konwencje i kontrakty* oraz *Wydajność i stabilność*, poprawiono błędy w przykładach bibliotek, zdomknięto luki w specyfikacji (synchronizacja siatki pathfindingu z drzwiami, konwersja tile↔px, kolizje jednostek, encja VIP). Zmiany merytoryczne oznaczone 🆕.

---

## 🤖 INSTRUKCJA DLA CLAUDE (PRZECZYTAJ JAKO PIERWSZE)

Zanim zaczniesz implementować — **przeczytaj cały brief**, ze szczególnym naciskiem na sekcje **„Decyzje projektowe"**, **„Konwencje i kontrakty"** oraz **„Wydajność i stabilność"**. To one zapobiegają sytuacji „działa, ale nie wiadomo czemu się sypie w Sprincie 5".

Najważniejsze otwarte pytania z v1 zostały już **rozstrzygnięte** (patrz „Decyzje projektowe"). Jeśli mimo to zauważysz nową niespójność albo lukę dotyczącą sprintu, który masz właśnie robić — zgłoś ją w 2–3 zdaniach **przed** kodowaniem, a potem przystąp do pracy.

---

## 📌 Czym jest BREACH?

**BREACH** to przeglądarkowa gra taktyczna top-down inspirowana *Door Kickers*.
Gracz kontroluje oddział operatorów SWAT, planuje i wykonuje operacje wejścia do budynków, neutralizuje wrogów, realizuje cele misji.

Gatunek: **Real-Time with Pause Tactics**
Widok: **Top-down 2D**
Platforma: **Przeglądarka (HTML/CSS/JS + PHP backend + MySQL)**
Renderer: **Canvas 2D API** (warstwowy — patrz „Wydajność i stabilność")
Styl graficzny (prototyp): **Geometryczne placeholder shapes** — koła, trójkąty, prostokąty. Żadnych zewnętrznych assetów na starcie.

---

## ✅ Decyzje projektowe (rozstrzygnięcia z analizy v1) 🆕

Te decyzje są **wiążące** dla całego projektu. Jeśli kiedyś będziesz je zmieniać, zmień je tutaj i sprawdź, co od nich zależy.

1. **Walka = HITSCAN.** Strzał to natychmiastowy promień (ray) od strzelca do celu, sprawdzający kolizję z przeszkodą blokującą pociski. **`Bullet.js` to wyłącznie krótka wizualna smuga (tracer)** istniejąca ~50–80 ms — nie ma własnej fizyki ani wykrywania trafień. To upraszcza friendly fire, eliminuje „tunelowanie" pocisków i upraszcza pooling.
2. **Jeden model pauzy = maszyna stanów gry.** Stany: `PLANNING` / `EXECUTING` / `RESULT`. SPACJA przełącza `PLANNING ⇄ EXECUTING`. **`PauseManager` jest cienkim wrapperem nad stanem gry, nie osobnym systemem pauzy.** W `PLANNING` świat NIE jest aktualizowany (`update()` pomijane), działa tylko `render()` i input planowania.
3. **Format mapy = własny schemat (NIE natywny Tiled).** Pliki w `/maps/*.json` piszemy ręcznie albo eksportujemy z naszego edytora (Sprint 11). Tiled jest **opcjonalny** i wymaga konwertera (patrz sekcja o Tiled). Nie zakładamy kompatybilności „1:1" z eksportem Tiled.
4. **Encje nie importują systemów.** Encje (`Operator`, `Enemy`, `Bullet`, `Door`) zawierają dane + prosty `update(delta)` ruchu/timerów. Cała logika walki/AI/LOS żyje w systemach, które dostają encje z zewnątrz. To zapobiega cyklicznym zależnościom ES modules.
5. **HUD i menu w HTML/CSS, nie w canvasie.** Tekst, przyciski, briefing, ekran wyników renderujemy jako warstwę HTML nad canvasem. W canvasie zostają tylko elementy „świata" (minimapa, znaczniki rozkazów na ścieżce). `UIRenderer` rysuje tylko te canvasowe elementy.

---

## 🛠️ Stack technologiczny

| Warstwa | Technologia |
|--------|-------------|
| Renderer / logika gry | Vanilla JS (ES6+), Canvas 2D API (warstwowy) |
| Frontend UI (menu, HUD) | HTML + CSS (vanilla, bez frameworków) — **overlay nad canvasem** |
| Backend / API | PHP 8+ (REST API) |
| Baza danych | MySQL (przez PDO) |
| Audio | **Howler.js** (CDN) |
| Pathfinding | **PathFinding.js** (CDN) |
| Mapy (edycja) | Własny edytor (Sprint 11) / **Tiled opcjonalnie + konwerter** |
| Auth tokeny | **firebase/php-jwt** (composer, opcjonalne) |
| WebSocket (przyszłość) | PHP Ratchet lub Python asyncio |

> ⚠️ Bez Node.js, bez npm, bez React, bez Webpack, bez Phaser. Czyste pliki, prosto na serwer.
> Howler.js i PathFinding.js ładowane przez CDN — zero instalacji.

---

## 📦 Zewnętrzne biblioteki — uzasadnienie i poprawne użycie

### Howler.js (JS, CDN)
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.4/howler.min.js"></script>
```
Zastępuje niskopoziomowe Web Audio API. Audio sprite (jeden plik = wiele dźwięków), fade, loop, volume, spójność między przeglądarkami.

🆕 **Poprawne użycie audio sprite** — `play(nazwa)` działa tylko, gdy zdefiniujesz mapę `sprite`:
```js
const sfx = new Howl({
  src: ['assets/audio/sfx.webm', 'assets/audio/sfx.mp3'],
  sprite: {
    gunshot:   [0, 350],     // [offset_ms, długość_ms]
    door_kick: [400, 600],
    explosion: [1100, 900]
  }
});
sfx.play('gunshot');
```
> ⚠️ Audio i tak nie zagra zanim użytkownik nie kliknie strony (autoplay policy). Pierwsze `play()` wywołuj po pierwszej interakcji gracza, inaczej dźwięk będzie „głuchy" do pierwszego kliknięcia.

### PathFinding.js (JS, CDN)
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pathfinding/0.4.18/pathfinding-browser.min.js"></script>
```
Gotowy A* na siatce kafelków. Zastępuje ~200 linii własnego kodu.

```js
// matrix[y][x]: 0 = przejście, 1 = blokada
const grid   = new PF.Grid(collisionMatrix);
const finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true });

// PF mutuje grid → KLONUJ przy każdym wyszukiwaniu
const path = finder.findPath(startCol, startRow, endCol, endRow, grid.clone());

// 🆕 wygładź — bez tego operatorzy chodzą zygzakiem po środkach kafelków
const smooth = PF.Util.smoothenPath(grid, path);
// smooth = [[col,row], ...] → potem zamień na world px (środki kafelków)
```

> ⚠️ **Biblioteka jest nierozwijana (0.4.18).** Dla statycznej siatki to bez znaczenia — A* się nie psuje. Ale:
> - 🆕 **Argumenty to `(col, row)` = `(x, y)`**, a nasza tablica `tiles` jest indeksowana `tiles[row][col] = tiles[y][x]`. **Łatwo zamienić osie miejscami — to klasyczny bug.** Trzymaj się konwencji z sekcji „Konwencje i kontrakty".
> - 🆕 **Dynamiczne przeszkody:** PF działa na statycznej siatce. Gdy drzwi zmieniają stan (`closed`→`open`/`breached`), **musisz zaktualizować `collisionMatrix` i mieć świeży `grid`** (patrz „Drzwi" i „Konwencje").
> - 🆕 **Path z `findPath` to kafelki, nie piksele.** Konwersję tile→px (środek kafelka) robi jeden helper — patrz „Konwencje".

### Tiled Map Editor (opcjonalny, wymaga konwertera) 🆕
Darmowy edytor map kafelkowych. **UWAGA: natywny eksport JSON z Tiled NIE jest tym samym co nasz format** — Tiled eksportuje `layers[]` z danymi jako spłaszczoną tablicą 1D, `tilesets[]`, `objectgroups[]`. Nasz format (2D `tiles`, `legend`, własne `doors`/`enemies`/`objectives`) jest inny.

Opcje:
- **(domyślnie)** pisz `/maps/*.json` ręcznie według naszego formatu — na start wystarczą 2–3 mapy.
- **(opcjonalnie)** używaj Tiled + napisz skrypt-konwerter `tiled.json → breach.json`. Sensowne dopiero przy wielu mapach.
- Docelowo: własny edytor (Sprint 11) eksportujący od razu nasz format.

### firebase/php-jwt (PHP, Composer) — opcjonalne
```bash
composer require firebase/php-jwt
```
JWT w nagłówku `Authorization: Bearer <token>` zamiast sesji PHP. Opcjonalne — pomijalne w pierwszych sprintach.

> 🆕 **Świadomość bezpieczeństwa:** przy zapisie wyniku z przeglądarki (`POST /api/progress`) klient może wysłać dowolny czas — leaderboard jest z natury podrabialny niezależnie od auth. Dla projektu hobbystycznego/portfolio to akceptowalne; nie buduj wokół tego mechanik z realną stawką. Minimalna obrona serwerowa: walidacja zakresów (czas ≥ teoretyczne minimum, liczba gwiazdek spójna z czasem).

---

## 🧭 Konwencje i kontrakty (czytaj zanim napiszesz pierwszą linię) 🆕

To jest sekcja, która ratuje przed „czemu klik trafia obok" i „czemu wróg widzi przez ścianę". Wszystkie systemy MUSZĄ trzymać się tych kontraktów.

### Układy współrzędnych
- **World space:** piksele, origin lewy-górny, oś Y w dół. Pozycje encji trzymamy w world px (float).
- **Tile space:** `col = x`, `row = y`. Tablica mapy: `tiles[row][col]` = `tiles[y][x]`.
- **Konwersja (jeden helper, np. w `MapData`):**
  ```js
  tileToWorld(col, row) → { x: col*TS + TS/2, y: row*TS + TS/2 } // środek kafelka
  worldToTile(x, y)     → { col: Math.floor(x/TS), row: Math.floor(y/TS) }
  ```
  `TS` = `tileSize` (32). **Nigdzie indziej nie licz tego ręcznie** — używaj helpera, inaczej rozjazdy są nieuniknione.

### Kontrakt kamery (krytyczny dla trafności kliknięć)
Transformacja renderowania i `screenToWorld()` MUSZĄ być **dokładnymi odwrotnościami**. Ustalamy kolejność:
```js
// RENDER (w każdej klatce, na warstwie świata):
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // skala DPR
ctx.scale(zoom, zoom);
ctx.translate(-camera.x, -camera.y);       // camera.x/.y = lewy-górny róg widoku w world px

// screenToWorld (DOKŁADNA odwrotność, z offsetem canvasa i DPR):
screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left);   // px CSS względem canvasa
  const py = (clientY - rect.top);
  return {
    x: px / zoom + camera.x,
    y: py / zoom + camera.y
  };
}
```
> ⚠️ Uproszczony wzór z v1 (`mouseX/zoom + scrollX`) **pomijał `rect` i DPR** — to był główny kandydat na bug „klik nie trafia przy zoomie / na canvasie nie pełnoekranowym". `InputHandler` ZAWSZE woła `screenToWorld()` zanim zinterpretuje pozycję myszy.

### DPR / Retina
Przy inicjalizacji i resize:
```js
const dpr = window.devicePixelRatio || 1;
canvas.width  = cssWidth  * dpr;
canvas.height = cssHeight * dpr;
canvas.style.width  = cssWidth  + 'px';
canvas.style.height = cssHeight + 'px';
// transform DPR ustawiany przez setTransform jak wyżej
```

### Semantyka kafelków/obiektów — co co blokuje 🆕
Trzy NIEZALEŻNE pojęcia „blokowania". Nie mieszaj ich.

| Element | Blokuje RUCH (pathfinding) | Blokuje LOS (widzenie) | Blokuje POCISK (hitscan) |
|---|:--:|:--:|:--:|
| `floor` | nie | nie | nie |
| `wall` | tak | tak | tak |
| `window` | **tak** | **nie** | **nie** |
| `door` (closed) | tak | tak | tak |
| `door` (open) | nie | nie | nie |
| `door` (breached) | nie | nie | nie |

→ stąd: **collision matrix dla pathfindingu** (ruch) ≠ **maska LOS/pocisków**. Buduj je z tej samej mapy, ale wg różnych reguł. Operator obok okna jest fizycznie zatrzymany, ale strzela i widzi przez nie.

### Kolejność systemów w pętli update (gdy stan = EXECUTING) 🆕
Stała kolejność eliminuje błędy typu „AI reaguje na nieaktualny LOS":
```
1. DetectionSystem  — przelicz „kto kogo widzi/słyszy" (promienie LOS detekcji)
2. AISystem         — wrogowie podejmują decyzje na podstawie świeżej detekcji
3. Movement         — operatorzy i wrogowie idą po ścieżkach (interpolacja px)
4. CommandSystem    — wykonanie węzłów rozkazów osiągniętych w tej klatce
5. CombatSystem     — hitscan, obrażenia, śmierć, friendly fire
6. StatusSystem     — timery: stun, alert→combat, combat→search→patrol
7. ObjectiveSystem  — sprawdzenie warunków zwycięstwa/porażki
8. Camera.update    — follow środka zaznaczonych operatorów
```
Render (osobno, patrz „Wydajność") używa stanu po update tej klatki.

### Centralny config (jedno źródło stałych) 🆕
Wszystkie „magiczne liczby" w jednym module `Config.js`, żeby nie rozjeżdżały się po plikach:
```js
export const CFG = {
  TILE_SIZE: 32,
  OPERATOR_SPEED: 150,        // px/s
  LOS_FOV_DEG: 110,
  LOS_RANGE: 200,             // px
  LOS_RAYS: 60,
  ALERT_RADIUS_TILES: 5,
  KICK_ALERT_TILES: 5,
  FLASH_STUN_S: 3,
  PAR_DEFAULT: 90,
  MAX_DT: 1/30                // klamp delty (patrz Wydajność)
};
```

---

## ⚡ Wydajność i stabilność (żeby śmigało i nie sypało się później) 🆕

### Pętla: fixed timestep + klamp delty (rozwiązuje też bug pauzy)
```js
let acc = 0, last = performance.now();
const STEP = 1000/60; // stała aktualizacja 60 Hz

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, CFG.MAX_DT);   // ⚠️ KLAMP — bez tego po pauzie/zakładce świat „teleportuje się"
  if (game.state === 'EXECUTING') {
    acc += dt * 1000;
    while (acc >= STEP) { game.update(STEP/1000); acc -= STEP; }
  }
  game.render();                    // render zawsze, nawet w PLANNING
  requestAnimationFrame(frame);
}
```
> ⚠️ **Przy wznowieniu z PLANNING lub po powrocie do zakładki ZRESETUJ `last = performance.now()`** (i wyzeruj `acc`), zanim policzysz dt. Inaczej nazbierana delta = teleport. To była luka v1.

### Warstwy canvas (klucz do płynności)
Nie rysuj wszystkiego co klatkę na jednym canvasie. Warstwy (z-index w CSS):
1. **`#map` (offscreen → blit):** mapa kafelkowa renderowana RAZ do offscreen canvas, blitowana co klatkę. **Re-render tylko gdy zmieni się kafelek/drzwi** (otwarcie, breach). Statyczne tło nie kosztuje wtedy nic.
2. **`#entities`:** operatorzy, wrogowie, tracery — rysowane co klatkę (mało obiektów).
3. **`#fog`:** nakładka LOS/fog of war (patrz niżej) — osobny canvas, kompozytowanie `destination-out`.
4. **HTML overlay (`#hud`):** HUD, menu, briefing, wyniki — czysty HTML/CSS, NIE canvas.

### Fog of war / LOS — render bez zacinania
- Mgłę rysuj na **osobnym offscreen canvasie**: wypełnij ciemnym kolorem, potem „wytnij" wielokąty widzenia operatorów przez `ctx.globalCompositeOperation = 'destination-out'`, na końcu zblituj na ekran.
- 🆕 **Rozdziel dwa zastosowania LOS:**
  - **Render mgły** = wielokąt widoczności (drogi, ale tylko dla operatorów, kilka sztuk).
  - **Detekcja „czy widzę punkt"** (wróg w stożku, czysty LOS do strzału) = **pojedynczy promień** od obserwatora do celu + test kąta/zasięgu. Tani. Nie używaj point-in-polygon do detekcji.
- 🆕 **Jakość wielokąta:** „60 promieni równomiernie w stożku" jest OK na prototyp, ale daje poszarpane krawędzie i potrafi przeoczyć wąskie szczeliny. Docelowo rzucaj promienie do **narożników ścian** w stożku (visibility polygon, technika „Red Blob Games"). Zacznij od 60 promieni, podnieś jakość gdy będzie potrzeba.

### Object pooling
- **Tracery (`Bullet`)** i efekty (flash, dym): pula obiektów, nie `new` co strzał. Strzałów na sekundę może być dużo → GC by zacinał.
- Reużywaj tablic w gorących pętlach LOS/combat — nie alokuj nowych tablic punktów co klatkę co promień.

### Pathfinding — nie licz częściej niż trzeba
- Ścieżkę licz **na żądanie** (nowy rozkaz / cel), nie co klatkę.
- W `COMBAT` przeliczaj do „ostatniej znanej pozycji" co ~0.3–0.5 s, nie co klatkę.
- Trzymaj jeden bazowy `grid`; **`grid.clone()` przy każdym `findPath`** (PF mutuje węzły).

### Sieć/IO
- Mapy ładuj `fetch()` raz, cache w pamięci.
- `POST /api/progress` tylko na koniec misji, nie w trakcie.

### Pre-flight checklist na koniec każdego sprintu
- [ ] dt jest klampowane; po pauzie/zakładce nie ma teleportów
- [ ] klik trafia w to miejsce na mapie przy każdym zoomie i przy oknie niepełnoekranowym (test naroża canvasa)
- [ ] żaden system nie importuje encji „w drugą stronę" (brak cyklów ES modules)
- [ ] po zmianie stanu drzwi siatka pathfindingu jest aktualna (operator nie „przechodzi" przez zamknięte / nie omija otwartych)
- [ ] osie col/row vs x/y nie są zamienione (operator idzie tam gdzie klik)
- [ ] brak `new` w gorących pętlach (tracery/promienie z puli)

---

## 📁 Docelowa struktura projektu

```
/breach
├── index.html                  ← wejście do gry (3 canvasy + #hud overlay)
├── mission-select.html         ← wybór misji
├── composer.json               ← (jeśli używasz php-jwt)
│
├── /css
│   ├── game.css                ← canvas layering + layout
│   └── ui.css                  ← menu, HUD, ekrany (HTML overlay)
│
├── /js
│   ├── /core
│   │   ├── Config.js           🆕 ← centralne stałe (CFG)
│   │   ├── Game.js             ← główna klasa, state machine PLANNING/EXECUTING/RESULT
│   │   ├── GameLoop.js         ← rAF, fixed timestep + klamp delty
│   │   ├── InputHandler.js     ← klawiatura + mysz (zawsze przez Camera.screenToWorld)
│   │   └── PauseManager.js     ← cienki wrapper nad stanem gry (nie osobny system)
│   │
│   ├── /rendering
│   │   ├── Camera.js           ← transformacja world→screen, zoom, follow, screenToWorld
│   │   ├── MapRenderer.js      ← rysuje kafelki do offscreen, blit, re-render on change
│   │   ├── EntityRenderer.js   ← operatorzy, wrogowie, tracery
│   │   ├── LOSRenderer.js      ← wielokąty widzenia + fog (destination-out, offscreen)
│   │   └── UIRenderer.js       ← TYLKO canvasowe: minimap, znaczniki rozkazów na ścieżce
│   │
│   ├── /entities
│   │   ├── Entity.js           🆕 ← baza: pozycja, kierunek, hp (Operator/Enemy/VIP dziedziczą)
│   │   ├── Operator.js         ← jednostka gracza
│   │   ├── Enemy.js            ← AI przeciwnik
│   │   ├── Bullet.js           ← TYLKO wizualny tracer (hitscan = brak fizyki)
│   │   ├── Door.js             ← interaktywne drzwi (closed/open/breached)
│   │   └── VIP.js              🆕 ← cel rescue_vip (lekka encja / placeholder)
│   │
│   ├── /systems
│   │   ├── CommandSystem.js    ← rysowanie ścieżek, węzły rozkazów
│   │   ├── DetectionSystem.js  🆕 ← „kto kogo widzi/słyszy" (promienie detekcji)
│   │   ├── LineOfSight.js      ← raycasting 2D, wielokąt widoczności + helper canSee(a,b)
│   │   ├── CombatSystem.js     ← hitscan, obrażenia, śmierć, friendly fire
│   │   ├── AISystem.js         ← maszyna stanów: patrol/alert/combat/search
│   │   ├── ObjectiveSystem.js  🆕 ← warunki zwycięstwa/porażki, liczenie gwiazdek
│   │   └── SoundSystem.js      ← wrapper na Howler.js (audio sprite)
│   │
│   └── /ui                     ← logika HTML overlay (manipuluje DOM, nie canvas)
│       ├── HUD.js
│       ├── Minimap.js
│       └── MissionBriefing.js
│
├── /php
│   ├── /api
│   │   ├── missions.php        ← GET /api/missions, GET /api/missions/:id
│   │   ├── progress.php        ← POST /api/progress, GET /api/progress/:player_id
│   │   └── auth.php            ← POST /api/auth/login, POST /api/auth/register
│   └── /lib
│       └── Database.php        ← singleton PDO connection
│
├── /maps
│   ├── mission_01.json         ← nasz format (NIE natywny Tiled)
│   └── mission_02.json
│
└── /assets
    ├── /audio
    │   └── sfx.webm            ← audio sprite (Kenney.nl Impact Sounds) + .mp3 fallback
    └── /sprites                ← (na przyszłość, na razie puste)
```

> 📝 `Camera.js` w `/rendering/` (kamera = część renderowania). Własny moduł pathfindingu zbędny — zastępuje go PathFinding.js (CDN). 🆕 Dodano `Config.js`, `Entity.js`, `VIP.js`, `DetectionSystem.js`, `ObjectiveSystem.js`.

---

## 🗺️ Format mapy (JSON — nasz schemat)

Każda misja = osobny plik w `/maps/`. **To nasz format, nie natywny eksport Tiled** (patrz decyzja #3).

```json
{
  "id": "mission_01",
  "name": "Warehouse Raid",
  "width": 25,
  "height": 20,
  "tileSize": 32,

  "tiles": [
    [1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1],
    [1,0,0,2,0,0,1],
    [1,1,1,1,1,1,1]
  ],

  "legend": { "0": "floor", "1": "wall", "2": "window" },

  "doors": [
    { "id": "d1", "x": 5, "y": 3, "orientation": "horizontal", "type": "standard" },
    { "id": "d2", "x": 12, "y": 8, "orientation": "vertical", "type": "reinforced" }
  ],

  "player_spawn": [ { "x": 1, "y": 10 }, { "x": 1, "y": 11 } ],

  "enemies": [
    { "id": "e1", "x": 15, "y": 5, "type": "patrol", "patrol": [[15,5],[20,5],[20,8]] },
    { "id": "e2", "x": 22, "y": 12, "type": "stationary", "facing": 180 }
  ],

  "objectives": [
    { "type": "eliminate_all" },
    { "type": "rescue_vip", "x": 23, "y": 15 }
  ],

  "par_time": 90
}
```

> 🆕 **Walidacja przy wczytaniu (zapobiega cichym bugom):** sprawdź, że `tiles.length === height` i każdy wiersz ma długość `width`; że `player_spawn`, `doors`, `enemies` mieszczą się w granicach mapy; że spawny stoją na `floor`. Przy błędzie — rzuć czytelny wyjątek, nie pozwól grze „wczytać się połowicznie".
> 🆕 **`tiles[y][x]`** — pamiętaj o konwencji `row=y, col=x` (sekcja „Konwencje").

---

## 🎮 Mechaniki gry — opis dla Claude Code

### 1. Game Loop
- `requestAnimationFrame` + **fixed timestep z klampem delty** (patrz „Wydajność").
- Trzy stany: `PLANNING` (pauza, rysujesz rozkazy) / `EXECUTING` (akcja) / `RESULT` (koniec).
- SPACJA przełącza `PLANNING ⇄ EXECUTING`.
- W `PLANNING`: `update()` pomijane, działa tylko `render()` i input planowania. Przy wznowieniu reset `last`/`acc`.

### 2. Kamera i współrzędne
- Kamera: `x`, `y` (lewy-górny róg widoku w world px) + `zoom`.
- Śledzi środek grupy zaznaczonych operatorów.
- **Kontrakt `screenToWorld()` = dokładna odwrotność transformacji renderu** (z `rect` + DPR) — patrz „Konwencje". InputHandler zawsze przez nią przechodzi.

### 3. Mapa i kafelki
- Wczytywana z JSON `fetch()`, cache w pamięci, walidacja przy wczytaniu.
- Kafelek = `tileSize × tileSize` (32px).
- 🆕 **Dwie różne maski budowane z mapy:** *collision matrix* (ruch: `wall`, `window`, `door closed` = blokada) i *maska LOS/pocisków* (`wall`, `door closed` = blokada; `window` przepuszcza). Patrz tabela semantyki kafelków.

### 4. Operatorzy (jednostki gracza)
- Operator = kółko z trójkątem kierunku (placeholder).
- **Lewy klik** = zaznaczenie (wielu przez Shift+klik). **Prawy klik na mapie** = cel ruchu. (Spójne w całym projekcie.)
- PathFinding.js liczy ścieżkę (kafelki) → wygładzenie → konwersja na world px (środki kafelków).
- Interpolacja pozycji między waypointami, prędkość `OPERATOR_SPEED` (150 px/s).
- 🆕 **Kolizje jednostka-jednostka:** na start operatorzy **NIE blokują się nawzajem w pathfindingu** (mogą się chwilowo nakładać — jak w Door Kickers). Jeśli kiedyś zechcesz blokowanie, to znaczy dynamiczna siatka per-jednostka — świadoma decyzja na później, nie na Sprint 1.
- Węzły rozkazów (prawym klikiem na ścieżce): `STOP`, `BREACH_DOOR`, `THROW_FLASHBANG`, `WATCH_DIRECTION`.

### 5. Wrogowie (AI)
```
PATROL → (widzi/słyszy gracza) → ALERT → (potwierdza) → COMBAT
COMBAT → (traci gracza z oczu 5s) → SEARCH → (nie znajdzie 10s) → PATROL
```
- **PATROL:** interpoluje między punktami `patrol`, zapętla.
- **ALERT:** zatrzymuje się, obraca w stronę bodźca, 1s przed `COMBAT`.
- **COMBAT:** pathfinding do ostatniej znanej pozycji, strzela gdy `canSee()` zwraca true.
- **SEARCH:** sprawdza ostatnią pozycję, losowo rozgląda się, po 10s → `PATROL`.
- Dźwięk (strzał, wybuch, KICK) wyzwala ALERT u wrogów w promieniu R kafelków.
- 🆕 AI czyta wynik `DetectionSystem` z **tej samej klatki** (kolejność systemów w „Konwencjach").

### 6. Line of Sight (LOS)
- Stożek: kąt `LOS_FOV_DEG` (110°), zasięg `LOS_RANGE` (200px), konfigurowalne per typ.
- 🆕 **Dwa odrębne tryby:**
  - **`LineOfSight.canSee(observer, target)`** — pojedynczy promień + test kąta/zasięgu, blokady wg maski LOS. Używane do detekcji i do „czystego strzału".
  - **Wielokąt widoczności** — do renderu mgły (tylko operatorzy). Prototyp: 60 promieni w stożku; docelowo promienie do narożników.
- Render: ciemna nakładka na osobnym canvasie, wycięcie wielokątów operatorów przez `destination-out`.
- Wróg widoczny dla gracza tylko gdy `canSee()` true z któregokolwiek operatora.

### 7. System walki (HITSCAN)
- 🆕 Strzał = natychmiastowy ray strzelec→cel; kolizja wg **maski pocisków** (`wall`/`door closed` blokują, `window` nie).
- Czysty ray → trafienie. `Bullet` to **tylko tracer** (wizualny, z puli, ~50–80 ms).
- Operator: 100 HP. Wróg: 50–150 HP (`light`/`heavy`/`armored`).
- **Friendly fire: włączone** — operator w linii strzału obrywa. Kadencja: co X ms (zależnie od broni), automatycznie do pierwszego wroga w LOS, bez ręcznego sterowania.
- Śmierć operatora ≠ koniec misji (chyba że wszyscy martwi przed realizacją celów).

### 8. Drzwi
- Jeden kafelek, stan: `closed` / `open` / `breached`.
- `closed`: blokuje ruch, LOS, pociski.
- `open`: przejście; nie blokuje LOS; „skrzydło drzwi" zajmuje sąsiedni kafelek wizualnie.
- `breached`: trwale usunięte (po `BREACH_CHARGE`).
- 🆕 **Każda zmiana stanu drzwi MUSI:** (a) zaktualizować *collision matrix* pathfindingu i odświeżyć `grid`, (b) zaktualizować *maskę LOS/pocisków*, (c) oznaczyć warstwę `#map` jako „dirty" do re-renderu. Bez tego: operatorzy „przechodzą" przez zamknięte drzwi albo omijają otwarte, a wrogowie widzą przez breach. To była luka v1.
- Akcje (węzeł rozkazu): `OPEN_SLOW` (ciche, 0.8s), `KICK` (natychmiast, dźwięk → ALERT w promieniu 5 kafelków), `BREACH` (wymaga `BREACH_CHARGE`, niszczy drzwi, ogłusza w stożku 90° na 3s).

### 9. Ekwipunek (uproszczony na start)
Każdy operator: jeden slot gadżetu (wybierany przed misją):
- `FLASHBANG` — rzut, ogłusza w promieniu 3 kafelków na 3s (`STUNNED` = nie strzela, nie rusza się).
- `BREACH_CHARGE` — wymagany do akcji `BREACH`.
- `FRAG` — obrażenia obszarowe (późniejszy sprint).

### 10. System oceny misji
Po `eliminate_all` LUB śmierci wszystkich operatorów:
- ⭐ cele zrealizowane
- ⭐⭐ cele + czas ≤ par_time
- ⭐⭐⭐ cele + czas + zero ofiar po stronie operatorów

`POST /api/progress` zapisuje tylko jeśli wynik lepszy niż poprzedni dla tej misji.

---

## 🗄️ Baza danych MySQL

```sql
CREATE TABLE missions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(64) UNIQUE NOT NULL,
  title       VARCHAR(128) NOT NULL,
  description TEXT,
  map_file    VARCHAR(128) NOT NULL,
  difficulty  TINYINT DEFAULT 1,
  par_time    INT DEFAULT 90,
  unlocked    TINYINT DEFAULT 1
);

CREATE TABLE players (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(64) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,          -- password_hash() bcrypt
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE player_missions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  player_id    INT NOT NULL,
  mission_id   INT NOT NULL,
  stars        TINYINT DEFAULT 0,
  best_time    INT DEFAULT NULL,
  casualties   TINYINT DEFAULT 0,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_player_mission (player_id, mission_id),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

CREATE TABLE leaderboard (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  player_id    INT NOT NULL,
  mission_id   INT NOT NULL,
  time_seconds INT NOT NULL,
  stars        TINYINT NOT NULL,
  achieved_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);
```

> 🆕 **Walidacja serwerowa** w `progress.php`: odrzuć czasy/gwiazdki poza sensownym zakresem (czas ≥ minimum teoretyczne, gwiazdki spójne z czasem). To nie czyni leaderboardu nieodpornym, ale odsiewa najtańsze nadużycia.

---

## 🚀 Sprint 1 — Co zbudować w pierwszej sesji

> **Cel: działająca mapa z operatorem, którym można sterować — na solidnym fundamencie.**

### Zadania:
1. **`index.html`** — 3 canvasy (`#map`, `#entities`, `#fog`) + `#hud` (HTML overlay); ładuje Howler.js + PathFinding.js z CDN, potem własne JS jako `type="module"`.
2. **`Config.js`** 🆕 — centralne stałe (CFG).
3. **`GameLoop.js`** — fixed timestep, **klamp delty**, reset `last`/`acc` przy resume; `start()/stop()/pause()/resume()`.
4. **`Camera.js`** — `x/y/zoom`, `worldToScreen`, **`screenToWorld` jako dokładna odwrotność (z rect+DPR)**, `follow(entity)`.
5. **`MapRenderer.js`** — `fetch()` + **walidacja** JSON; buduje *collision matrix* (ruch) i *maskę LOS/pocisków*; rysuje kafelki do **offscreen** i blituje (re-render tylko gdy „dirty").
6. **`Entity.js` + `Operator.js`** 🆕 — pozycja (world px), kierunek (radiany), HP, ścieżka (world waypointy), `update(delta)`.
7. **`InputHandler.js`** — lewy klik = zaznacz operatora; prawy klik = cel ruchu (przez `screenToWorld`); pathfinding → wygładzenie → konwersja tile→px.
8. **`Game.js`** — state machine PLANNING/EXECUTING; skleja systemy, wstrzykuje referencje (encje NIE importują systemów).

### Definicja „gotowe":
- ✅ Widać mapę z kafelków (z walidacją — błędny JSON daje czytelny błąd, nie cichą porażkę)
- ✅ Widać operatora (kółko z trójkątem kierunku)
- ✅ Prawy klik → operator idzie tam, **omijając ściany i okna** (PathFinding.js), bez zygzaków (wygładzanie)
- ✅ Kamera śledzi operatora, kółko myszy = zoom
- ✅ SPACJA: PLANNING ⇄ EXECUTING (świat staje/rusza), **bez teleportu po wznowieniu**
- ✅ Kliknięcie trafia we właściwe miejsce **przy każdym zoomie i przy oknie niepełnoekranowym** (test naroża canvasa)
- ✅ Osie col/row vs x/y się nie mylą (operator idzie dokładnie tam, gdzie klik)

---

## 📋 Przykładowe prompty do Claude Code

**Start sesji:**
> „Przeczytaj brief, zwłaszcza sekcje *Decyzje projektowe*, *Konwencje i kontrakty* i *Wydajność*. Zbuduj Sprint 1: zacznij od `index.html` (3 canvasy + #hud) i `Config.js`, potem `GameLoop.js` (fixed timestep + klamp delty), `Camera.js` (screenToWorld jako dokładna odwrotność z rect+DPR), `MapRenderer.js` (walidacja + dwie maski + offscreen). Howler.js i PathFinding.js z CDN."

**Kolejne kroki:**
> „Dodaj `Entity.js`/`Operator.js` i `InputHandler.js` — prawy klik = cel, pathfinding → smoothenPath → konwersja tile→px (środki kafelków), płynna interpolacja 150 px/s."

> „Zaimplementuj `LineOfSight.js`: tryb `canSee(a,b)` (pojedynczy ray, maska LOS) ORAZ wielokąt widoczności (60 promieni w stożku 110°). `LOSRenderer` zaciemnia mapę i wycina wielokąty operatorów przez destination-out na osobnym canvasie."

> „Dodaj `DetectionSystem` + `Enemy.js` z maszyną PATROL/ALERT/COMBAT — wróg czyta detekcję z tej samej klatki (kolejność systemów wg briefu), chodzi po `patrol`, reaguje gdy operator wejdzie w jego stożek."

> „Dodaj `Door.js` + akcje OPEN_SLOW/KICK. KAŻDA zmiana stanu drzwi aktualizuje collision matrix pathfindingu, maskę LOS/pocisków i oznacza warstwę #map jako dirty."

---

## 🔮 Roadmapa sprintów

| Sprint | Zakres |
|--------|--------|
| **1** | Mapa + kamera + operator z pathfindingiem (na fundamencie z konwencji) ← **start** |
| **2** | `DetectionSystem` + wrogowie + AI (patrol/alert/combat/search) |
| **3** | Line of Sight (canSee + wielokąt) + Fog of War (offscreen, destination-out) |
| **4** | Drzwi + synchronizacja siatki pathfindingu/masek + interakcje |
| **5** | System walki (hitscan, tracery z puli, HP, śmierć, friendly fire) |
| **6** | Pauza taktyczna + system rozkazów na ścieżce (kolejkowanie w PLANNING) |
| **7** | Gadżety (flashbang, breach charge) |
| **8** | PHP API + MySQL (misje, zapis wyników z walidacją, leaderboard) |
| **9** | UI: menu, briefing, ekran wyników, gwiazdki (HTML overlay) |
| **10** | Dźwięki (Howler.js audio sprite + Kenney.nl) |
| **11** | Edytor map (HTML tool, eksport w naszym formacie) |

---

## ⚠️ Zasady projektu (dla Claude Code)

- Jeden plik = jedna klasa lub jeden system.
- Brak bundlerów — moduły przez `<script type="module">`.
- Howler.js i PathFinding.js przez CDN — **nie kopiuj ich kodu lokalnie**.
- PHP = czysty REST API zwracający JSON (`Content-Type: application/json`), bez frameworków, czyste PDO.
- Każda klasa JS ma konstruktor z parametrami opisanymi w JSDoc.
- 🆕 **Encje nie importują systemów** (bez cyklów ES modules).
- 🆕 **Wszystkie stałe w `Config.js`** — żadnych magicznych liczb rozsianych po plikach.
- 🆕 **`Camera.screenToWorld()` (z rect+DPR) zawsze przed interpretacją pozycji myszy.**
- 🆕 **Konwersja tile↔px tylko przez helper `MapData`** — nigdy ręcznie.
- 🆕 **dt klampowane; reset czasu przy wznowieniu** — obowiązkowo.
- 🆕 **Zmiana stanu drzwi aktualizuje obie maski + dirty mapy** — obowiązkowo.

---

*Brief v2 — punkt startowy zaktualizowany o analizę techniczną. Modyfikuj w trakcie developmentu; każdą zmianę wiążącej decyzji nanoś w sekcji „Decyzje projektowe" i sprawdzaj jej zależności.*
