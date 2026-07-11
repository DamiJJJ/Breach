<p align="center">
  <img src="assets/logo-text.png" alt="BREACH" width="340">
</p>

Przeglądarkowa gra taktyczna top-down inspirowana *Door Kickers*.
Real-Time with Pause · Canvas 2D · Vanilla JS (ES modules, bez bundlera) · PHP backend (od Sprintu 8).

Pełna specyfikacja: [docs/DESIGN.md](docs/DESIGN.md) — *BREACH – Game Design & Technical Brief v2* (konwencje, kontrakty, roadmapa).

## Uruchomienie lokalne

ES modules + `fetch()` wymagają serwera HTTP (nie zadziała z `file://`):

```bash
# dowolny statyczny serwer w katalogu projektu, np.:
python -m http.server 8000
# → http://localhost:8000
```

## Sterowanie

| Akcja | Klawisz |
|---|---|
| Zaznacz operatora | LPM (Shift = wielu) |
| Rozkaz ruchu (zastępuje plan) | PPM |
| Dołącz rozkaz do kolejki planu | Shift + PPM |
| Ciche otwarcie drzwi | PPM na zamkniętych drzwiach |
| Kopniak w drzwi (hałas → alarm) | Ctrl + PPM na zamkniętych drzwiach |
| Węzeł obserwacji kierunku (WATCH) | Alt + PPM |
| Przystanek w planie (STOP, czeka na GO) | S |
| Sygnał GO (zwalnia wszystkie STOP-y) | G (w akcji) |
| Start / pauza taktyczna | SPACJA |
| Zoom | kółko myszy (pod kursorem) |

## Struktura

```
js/core       Config, Game (state machine), GameLoop (fixed timestep), InputHandler, MathUtils
js/rendering  Camera (screenToWorld = odwrotność transformu renderu), MapRenderer (offscreen), EntityRenderer, FogRenderer (mgła + plany rozkazów ze znacznikami węzłów)
js/entities   Entity, Operator, Enemy, Door, Bullet (tracer z puli; encje nie importują systemów)
js/systems    AISystem (patrol/wartownik/alarm), DetectionSystem (stożek widzenia + LOS), VisionSystem (widzenie drużyny → mgła), DoorSystem (jedyne miejsce zmiany stanu drzwi), CombatSystem (hitscan + friendly fire), CommandSystem (kolejka rozkazów MOVE/DOOR/WATCH/STOP + sygnał GO)
js/map        MapData — walidacja, maski (collision ≠ LOS), konwersje tile↔px, pathfinding, raycast
js/ui         HUD (HTML overlay)
maps/         mapy w naszym formacie JSON (nie Tiled)
assets/       logo i ikony (PNG z kanałem alfa) + źródła 1024² (breach_logo*.png)
```

Biblioteki z CDN: [PathFinding.js](https://github.com/qiao/PathFinding.js) (A*), [Howler.js](https://howlerjs.com/) (audio, od Sprintu 10).

## Deploy (homeserver)

`git push` na `main` → GitHub Actions buduje obraz → GHCR (`ghcr.io/damijjj/breach`, prywatny) → Watchtower podmienia kontener na miniPC.

- Stack Portainera: `deploy/portainer-stack.yml` (port **8086**)
- Adres: `http://breach.home` (proxy host w NPM → `192.168.1.115:8086`)

## Status sprintów

- [x] **Sprint 1** — mapa + kamera + operator z pathfindingiem
- [x] **Sprint 2** — DetectionSystem + wrogowie + AI
- [x] **Sprint 3** — LOS + Fog of War (VisionSystem + FogRenderer, mgła dwustanowa)
- [x] **Sprint 4** — drzwi + synchronizacja masek
- [x] **Sprint 5** — walka (hitscan, tracery z puli, HP, śmierć, friendly fire)
- [x] **Sprint 6** — pauza taktyczna + rozkazy na ścieżce (kolejka MOVE/DOOR/WATCH/STOP, sygnał GO)
- [ ] Sprint 7 — gadżety
- [ ] Sprint 8 — PHP API + MySQL
- [ ] Sprint 9 — UI/menu
- [ ] Sprint 10 — dźwięk
- [ ] Sprint 11 — edytor map
