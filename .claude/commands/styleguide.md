---
description: Audytuj kod względem konwencji z CLAUDE.md i docs/DESIGN.md.
---

Goal: check the code against the **binding conventions** in `CLAUDE.md` and
`docs/DESIGN.md`. This repo has no linter, no bundler and no type checker —
this command is the only static safety net.

Do **not** produce a `STYLEGUIDE.md`. The conventions already live in
`CLAUDE.md`; report violations against them instead.

## Mechanical checks (run these, they're cheap and exact)

```bash
# 1. Entities must never import systems (ES module cycles)
grep -rn "^import" js/entities/ | grep -i systems          # → expect: nothing

# 2. Only DoorSystem may assign door.state
grep -rn "door\.state *=[^=]" js/                          # → expect: only DoorSystem.js

# 3. tile↔px conversion only via MapData helpers
grep -rn "TILE_SIZE" js/ | grep -vE "Config\.js|MapData\.js"   # → expect: nothing

# 4. Render transform belongs to the rendering layer
grep -rln "setTransform" js/ | grep -v "^js/rendering/"    # → expect: nothing

# 5. Nothing may syntax-error (no build step catches this)
for f in js/**/*.js js/*.js; do node --check "$f" || echo "BROKEN $f"; done
```

## Review checks (read the diff / the files, judge)

- **Magic numbers.** Any tunable literal outside `js/core/Config.js` is a
  violation — px distances, speeds, angles, durations, alpha values, tile
  radii. Colours used once in a renderer are the tolerated exception; colours
  that express a *rule* (`FOG_COLOR`, `FOG_DIM_ALPHA`) belong in `CFG`.
- **Comment language.** Comments and JSDoc are **Polish**; identifiers are
  English. Flag any English comment added to `js/`.
- **JSDoc on constructors.** Every class constructor has typed `@param`s, using
  `import('../path.js').Type` for cross-module types. See `FogRenderer` for the
  house pattern.
- **One file = one class or one system.**
- **Two masks, never conflated.** Anything reading `collisionMatrix` for
  vision/bullets, or `losMask` for movement, is a bug — window passes LOS but
  blocks movement.
- **`screenToWorld` symmetry.** If the diff touches the render transform in any
  renderer, `Camera.screenToWorld` must change to stay its exact inverse.
- **No `new` in hot loops** — LOS rays, tracers, per-frame point arrays.

## Output

Report violations grouped by convention, each as `file:line` + one line of why
it matters. Where two files disagree on a convention, **surface the conflict**
rather than silently picking a side — ask which way to go.

Fix only what the user asks you to fix. Don't commit or push.
