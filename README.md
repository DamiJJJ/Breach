# 🔫 BREACH

Przeglądarkowa gra taktyczna top-down inspirowana *Door Kickers*.
Real-Time with Pause · Canvas 2D · Vanilla JS (ES modules, bez bundlera) · PHP backend (od Sprintu 8).

Pełna specyfikacja w dokumencie projektowym *BREACH – Game Design & Technical Brief v2* (konwencje, kontrakty, roadmapa).

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
| Rozkaz ruchu | PPM |
| Start / pauza taktyczna | SPACJA |
| Zoom | kółko myszy |

## Struktura

```
js/core       Config, Game (state machine), GameLoop (fixed timestep), InputHandler
js/rendering  Camera (screenToWorld = odwrotność transformu renderu), MapRenderer (offscreen), EntityRenderer
js/entities   Entity, Operator, Enemy (encje nie importują systemów)
js/systems    AISystem (patrol/wartownik/alarm), DetectionSystem (stożek widzenia + LOS)
js/map        MapData — walidacja, maski (collision ≠ LOS), konwersje tile↔px, pathfinding, raycast
js/ui         HUD (HTML overlay)
maps/         mapy w naszym formacie JSON (nie Tiled)
```

Biblioteki z CDN: [PathFinding.js](https://github.com/qiao/PathFinding.js) (A*), [Howler.js](https://howlerjs.com/) (audio, od Sprintu 10).

## Deploy (homeserver)

`git push` na `main` → GitHub Actions buduje obraz → GHCR (`ghcr.io/damijjj/breach`, prywatny) → Watchtower podmienia kontener na miniPC.

- Stack Portainera: `deploy/portainer-stack.yml` (port **8086**)
- Adres: `http://breach.home` (proxy host w NPM → `192.168.1.115:8086`)

## Status sprintów

- [x] **Sprint 1** — mapa + kamera + operator z pathfindingiem
- [x] **Sprint 2** — DetectionSystem + wrogowie + AI
- [ ] Sprint 3 — LOS + Fog of War
- [ ] Sprint 4 — drzwi + synchronizacja masek
- [ ] Sprint 5 — walka (hitscan)
- [ ] Sprint 6 — rozkazy na ścieżce
- [ ] Sprint 7 — gadżety
- [ ] Sprint 8 — PHP API + MySQL
- [ ] Sprint 9 — UI/menu
- [ ] Sprint 10 — dźwięk
- [ ] Sprint 11 — edytor map
