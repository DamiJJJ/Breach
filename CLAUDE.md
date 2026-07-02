# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

BREACH — a browser-based top-down tactical game (Door Kickers-like), "Real-Time with Pause". Vanilla JS (ES modules, **no bundler / no npm**), Canvas 2D, PHP backend planned for Sprint 8. The authoritative spec is the design document *BREACH – Game Design & Technical Brief v2* (kept in the cloud, supplied as session context — not in the repo). The brief's "Decyzje projektowe", "Konwencje i kontrakty", and "Wydajność i stabilność" sections are binding; read them before nontrivial work.

## Commands

- **Run locally:** `python -m http.server 8000` in the project root, then open `http://localhost:8000`. ES modules + `fetch()` of maps do **not** work over `file://` — a static HTTP server is mandatory.
- **Tests:** open `http://localhost:8000/test-smoke.html` → expect `ALL-PASS`. These are headless-friendly assertions over MapData (axis conventions, the two masks, pathfinding, operator movement). Run them via headless Edge:
  ```
  msedge --headless --disable-gpu --dump-dom --virtual-time-budget=10000 http://localhost:8000/test-smoke.html
  ```
  There is no test runner/framework — `test-smoke.html` is the whole harness. Add assertions there when adding MapData/entity logic.
- **Deploy:** `git push` to `main` → GitHub Actions builds → GHCR (`ghcr.io/damijjj/breach:latest`, private) → Watchtower swaps the container on the homeserver. Container runs on port **8086**, served at `http://breach.home`. Stack in `deploy/portainer-stack.yml`. **The user does their own `git commit` / `git push`** — prepare changes, but don't commit or push unless asked.

## Architecture — the load-bearing conventions

These are the invariants that prevent the classic bugs in this genre. Violating them silently breaks clicks, vision, or movement.

- **Coordinate systems.** World space = pixels, origin top-left, Y down; entity positions are float world px. Tile space: `col = x`, `row = y`, arrays indexed `tiles[row][col]`. **PathFinding.js takes `(col, row) = (x, y)`** — easy to transpose; don't. All tile↔px conversion goes through `MapData.tileToWorld` / `worldToTile` — never compute it inline anywhere else.

- **Camera contract (`js/rendering/Camera.js`).** `screenToWorld()` is the exact inverse of the render transform (`setTransform(dpr) → scale(zoom) → translate(-x,-y)`), computed with `getBoundingClientRect()` + DPR so clicks land correctly at any zoom and on a non-fullscreen canvas. `InputHandler` always routes mouse position through `screenToWorld()` before interpreting it. If you touch the render transform, update `screenToWorld` to match.

- **Two independent masks, built from the same map (`MapData.rebuildMasks`).** `collisionMatrix` (movement — wall, window, closed door block) is **not** the same as `losMask` (vision/bullets — wall + closed door block, window passes). Never conflate them: an operator is stopped by a window but sees and shoots through it. The PathFinding grid is built from `collisionMatrix` via `new PF.Grid(width, height, matrix)` (explicit args — the CDN bundle is older than the npm package and lacks `Grid(matrix)`).

- **Entities never import systems (`js/entities/`).** `Entity`/`Operator` hold data + a simple `update(delta)` (movement/timers only). All combat/AI/LOS logic lives in systems that receive entities from outside. This keeps ES modules acyclic. `Game` wires systems together and injects references.

- **State machine + fixed timestep.** `Game` has states `PLANNING` / `EXECUTING` / `RESULT`; SPACE toggles PLANNING↔EXECUTING. `GameLoop` runs a fixed 60 Hz timestep with **delta clamping** (`CFG.MAX_DT`); the world only updates in `EXECUTING`, render always runs. On every state change and on tab-return, timing is reset (`resetTiming`) so accumulated delta doesn't teleport entities. Update-system order (as systems are added per sprint) is fixed — see the brief's "Kolejność systemów w pętli update".

- **Canvas layering.** Three stacked canvases: `#map` (rendered once to an offscreen canvas, blitted each frame, re-rendered only on `markDirty()` — e.g. door state change), `#entities` (redrawn each frame), `#fog` (LOS overlay, Sprint 3). HUD/menus are **HTML/CSS overlay** (`js/ui/`, `css/ui.css`), never drawn in canvas. Input is bound to the top `#fog` canvas.

- **Config.** All tunable constants live in `js/core/Config.js` (`CFG`). No magic numbers scattered across files.

- **Map format** is our own JSON schema (`maps/*.json`), **not** native Tiled export. `MapData.load` validates on load (dimensions match, spawns/doors/enemies in bounds, spawns on floor) and throws a readable error rather than half-loading.

## External libraries (CDN only — do not vendor)

- **PathFinding.js** (A*): the brief's cdnjs URL 404s. Working URL is jsDelivr: `https://cdn.jsdelivr.net/npm/pathfinding@0.4.18/visual/lib/pathfinding-browser.min.js`. That bundle is older than npm 0.4.18, hence the explicit `PF.Grid(width, height, matrix)` form. PF mutates the grid — `MapData.findPathWorld` clones per `findPath` and passes the un-cloned base grid to `smoothenPath`.
- **Howler.js** (audio): loaded but unused until Sprint 10.

## Roadmap position

Sprints 1–2 are complete: map + camera + operator with pathfinding, plus enemies (`js/entities/Enemy.js`), `js/systems/DetectionSystem.js` (vision cone + LOS raycast over `losMask` via `MapData.castRay`/`hasLineOfSight`) and `js/systems/AISystem.js` (PATROL/IDLE/ALERT state machine with alert propagation). Next is Sprint 3 (LOS + Fog of War) — `MapData.castRay` and `CFG.LOS_RAYS` are the intended building blocks for the fog layer. Sprint order is in README.md.
