# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

BREACH — a browser-based top-down tactical game (Door Kickers-like), "Real-Time with Pause". Vanilla JS (ES modules, **no bundler / no npm**), Canvas 2D, PHP backend planned for Sprint 8.

The authoritative spec is **[docs/DESIGN.md](docs/DESIGN.md)** (*BREACH – Game Design & Technical Brief v2*, in Polish, in the repo). Its sections **"Decyzje projektowe"**, **"Konwencje i kontrakty"** and **"Wydajność i stabilność"** are binding — read them before nontrivial work. Where the code deliberately departs from the brief, this file records it (see *Known deviations*).

## Language conventions

- **Code comments, JSDoc, `README.md`, `docs/DESIGN.md`, and commit messages are Polish.** Match that — don't write English comments into `js/`.
- Identifiers (class, method, variable names) are **English**. `CFG` keys are English SCREAMING_SNAKE.
- This file (`CLAUDE.md`) is the only English prose in the repo. Keep it that way.

## Commands

- **Run locally:** `python -m http.server 8000` in the project root, then open `http://localhost:8000`. ES modules + `fetch()` of maps do **not** work over `file://` — a static HTTP server is mandatory.

- **Tests:** `test-smoke.html` is the whole harness (60 assertions, no test runner, no framework). It renders `ALL-PASS` or `FAILURES: <n>` into `<pre id="out">`. Serve, then run headless Chrome (this machine has **no** `msedge` — only `/Applications/Google Chrome.app`):
  ```bash
  python -m http.server 8000 &
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless --disable-gpu --dump-dom --virtual-time-budget=10000 \
    http://localhost:8000/test-smoke.html \
    | sed -n '/<pre id="out">/,/<\/pre>/p'
  ```
  Grep the raw DOM dump at your peril — the inline `<script>` source contains the literals `ALL-PASS` and `FAIL`, so a naive `grep ALL-PASS` matches even on failure. Always extract the `<pre>` block first.

  Assertions are grouped by sprint (`// --- Sprint N: ... ---`). **Add a group when you add a sprint**; add assertions there when you touch `MapData`, entities, or a system.

- **Syntax check** (no build step, so nothing else catches typos): `node --check js/<file>.js`.

- **Deploy:** `git push` to `main` → GitHub Actions builds → GHCR (`ghcr.io/damijjj/breach:latest`, private) → Watchtower swaps the container on the homeserver. Container runs on port **8086**, served at `http://breach.home`. Stack in `deploy/portainer-stack.yml`.

- **The user does their own `git commit` / `git push`.** Prepare changes; don't commit or push unless asked.

## Architecture — the load-bearing conventions

These are the invariants that prevent the classic bugs in this genre. Violating them silently breaks clicks, vision, or movement.

- **Coordinate systems.** World space = pixels, origin top-left, Y down; entity positions are float world px. Tile space: `col = x`, `row = y`, arrays indexed `tiles[row][col]`. **PathFinding.js takes `(col, row) = (x, y)`** — easy to transpose; don't. All tile↔px conversion goes through `MapData.tileToWorld` / `worldToTile` — never compute it inline anywhere else.

- **Camera contract ([js/rendering/Camera.js](js/rendering/Camera.js)).** `screenToWorld()` is the exact inverse of the render transform (`setTransform(dpr) → scale(zoom) → translate(-x,-y)`), computed with `getBoundingClientRect()` + DPR so clicks land correctly at any zoom and on a non-fullscreen canvas. `InputHandler` always routes mouse position through `screenToWorld()` before interpreting it. If you touch the render transform, update `screenToWorld` to match.

- **Two independent masks, built from the same map (`MapData.rebuildMasks`).** `collisionMatrix` (movement — wall, window, closed door block) is **not** the same as `losMask` (vision/bullets — wall + closed door block, window passes). Never conflate them: an operator is stopped by a window but sees and shoots through it. The PathFinding grid is built from `collisionMatrix` via `new PF.Grid(width, height, matrix)` (explicit args — the CDN bundle is older than the npm package and lacks `Grid(matrix)`).

- **Entities never import systems ([js/entities/](js/entities/)).** `Entity`/`Operator` hold data + a simple `update(delta)` (movement/timers only). All combat/AI/LOS logic lives in systems that receive entities from outside. This keeps ES modules acyclic. `Game` wires systems together and injects references.

- **State machine + fixed timestep.** `Game` has states `PLANNING` / `EXECUTING` / `RESULT`; SPACE toggles PLANNING↔EXECUTING. `GameLoop` runs a fixed 60 Hz timestep (`CFG.STEP_MS`) with **delta clamping** (`CFG.MAX_DT`); the world only updates in `EXECUTING`, render always runs. On every state change and on tab-return, timing is reset (`resetTiming`) so accumulated delta doesn't teleport entities.

- **Canvas layering.** Three stacked canvases: `#map` (rendered once to an offscreen canvas, blitted each frame, re-rendered only on `markDirty()` — e.g. door state change), `#entities` (redrawn each frame), `#fog` (LOS overlay). HUD/menus are **HTML/CSS overlay** ([js/ui/](js/ui/), [css/ui.css](css/ui.css)), never drawn in canvas. Input is bound to the top `#fog` canvas.

- **Config.** All tunable constants live in [js/core/Config.js](js/core/Config.js) (`CFG`). No magic numbers scattered across files.

- **Map format** is our own JSON schema (`maps/*.json`), **not** native Tiled export. `MapData.load` validates on load (dimensions match, spawns/doors/enemies in bounds, spawns on floor, doors on floor tiles) and throws a readable error rather than half-loading.

- **One file = one class or one system.** Every class constructor gets a JSDoc block with typed `@param`s (use `import('../path.js').Type` for cross-module types).

## Update order in `Game.update()` — and a known deviation

The brief ([docs/DESIGN.md](docs/DESIGN.md), "Kolejność systemów w pętli update") specifies:

```
1. Detection → 2. AI → 3. Movement → 4. Command → 5. Combat
→ 6. Status → 7. Objective → 8. Camera
```

**The code does not run Detection first.** [js/core/Game.js](js/core/Game.js) runs:

```
AI (2) → Movement (3) → DoorSystem (4, = CommandSystem placeholder) → Detection (5) → Camera (8)
```

This is deliberate: Detection runs **after** movement so perception uses this frame's positions, which means **AI consumes the detection result computed at the end of the previous frame** (a one-frame lag, contrary to the brief's "AI czyta wynik DetectionSystem z tej samej klatki"). DoorSystem sits before Detection so a door opened this frame is immediately visible to perception.

**Consequence for Sprint 5:** `CombatSystem` must run **after** `DetectionSystem`, not at the brief's slot 5, or it will fire on stale LOS. Don't "fix" the order by moving Detection to the top without re-checking the door/movement interaction above.

## External libraries (CDN only — do not vendor)

- **PathFinding.js** (A*): the brief's cdnjs URL 404s. Working URL is jsDelivr: `https://cdn.jsdelivr.net/npm/pathfinding@0.4.18/visual/lib/pathfinding-browser.min.js`. That bundle is older than npm 0.4.18, hence the explicit `PF.Grid(width, height, matrix)` form. PF mutates the grid — `MapData.findPathWorld` clones per `findPath` and passes the un-cloned base grid to `smoothenPath`.
- **Howler.js** (audio): loaded but unused until Sprint 10.

## Roadmap position

Sprints 1–4 are complete. Next is **Sprint 5** (combat: hitscan, pooled tracers, HP, death, friendly fire). Sprint order lives in [README.md](README.md) and [docs/DESIGN.md](docs/DESIGN.md).

**Sprint 1–2 — map, camera, operator, enemies.** Pathfinding via `MapData.findPathWorld`. [js/entities/Enemy.js](js/entities/Enemy.js), [js/systems/DetectionSystem.js](js/systems/DetectionSystem.js) (vision cone + LOS raycast over `losMask` via `MapData.castRay` / `hasLineOfSight`), [js/systems/AISystem.js](js/systems/AISystem.js) (PATROL / IDLE / ALERT with alert propagation).

**Sprint 3 — LOS + fog of war.** [js/systems/VisionSystem.js](js/systems/VisionSystem.js) computes player-team visibility polygons (FOV cone + `PROXIMITY_VISION_TILES` close ring) plus the visible-enemies set, in the **render** phase so fog works in PLANNING too. [js/rendering/FogRenderer.js](js/rendering/FogRenderer.js) draws **two-state** fog on `#fog`:

- the **whole map is always readable, just dimmed** by `FOG_DIM_ALPHA` — the squad has the building's floor plan (deliberate design decision from playtesting);
- current vision polygons are cut clear via `destination-out`.

There is **no** "unexplored" state and **no** explored-memory canvas. Order paths are drawn **above** the fog (in `FogRenderer`, not `EntityRenderer`) so plans into dimmed rooms stay readable. Fog rays that hit a blocker are extended `FOG_REVEAL_PX` into the blocking tile so a wall/door you're looking at reads as seen, not dimmed (`VisionSystem._revealPoint`; the smoke tests assert the extended endpoints). Fog dims **terrain only** — hiding enemies is `EntityRenderer`'s job via the visible-enemies set.

**Sprint 4 — doors.** [js/entities/Door.js](js/entities/Door.js) is data only (`closed` / `open` / `breached`). [js/systems/DoorSystem.js](js/systems/DoorSystem.js) is the **only** place allowed to change `door.state`: `setState` runs the brief's full door contract — `MapData.rebuildMasks()` (both masks + PF grid), then the `onDoorChanged` callback that `Game` wires to `MapRenderer.markDirty()`. Door orders live on the operator as data (`op.doorAction`); the operator paths to an approach tile, then DoorSystem executes `OPEN_SLOW` (quiet, `DOOR_OPEN_SLOW_S`) or `KICK` (instant + `DetectionSystem.raiseNoise`, alerting enemies within `KICK_ALERT_TILES` — pure radius, sound ignores walls). Input: right-click a closed door = quiet open, Ctrl+right-click = kick (nearest selected operator); a plain move order cancels a pending `doorAction`. `BREACH` waits for Sprint 7 (breach charge), but the `breached` state is already handled by masks and renderer.

## Pre-flight checklist (run at the end of every sprint)

From the brief's "Pre-flight checklist". Verify, don't assume:

- [ ] `dt` is clamped; no teleport after pause or tab-return
- [ ] a click lands on the right tile at **every** zoom and on a non-fullscreen canvas (test a canvas corner)
- [ ] no entity imports a system (no ES module cycles)
- [ ] after any door state change the PF grid is current (operators neither walk through closed doors nor path around open ones)
- [ ] `col`/`row` vs `x`/`y` are not transposed (the operator walks exactly where you clicked)
- [ ] no `new` in hot loops (tracers / rays come from a pool)
- [ ] `test-smoke.html` reports `ALL-PASS`, and the new sprint has its own assertion group
