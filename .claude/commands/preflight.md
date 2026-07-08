---
description: Checklista końca sprintu z briefu — sprawdź, nie zakładaj.
---

The brief's *"Pre-flight checklist na koniec każdego sprintu"*
(`docs/DESIGN.md`). Run it before telling the user a sprint is done.

**Verify each item — don't assume.** State plainly which items you actually
checked, which you inferred from reading code, and which need the user to click
around in a browser. Never report a box ticked that you didn't test.

## 1. Automated — do these yourself

```bash
# smoke tests (see /smoke for the gotchas)
python -m http.server 8000 >/dev/null 2>&1 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --dump-dom --virtual-time-budget=10000 \
  http://localhost:8000/test-smoke.html | sed -n '/<pre id="out">/,/<\/pre>/p'

# no ES module cycles
grep -rn "^import" js/entities/ | grep -i systems      # → nothing

# only DoorSystem mutates door.state
grep -rn "door\.state *=[^=]" js/                      # → only DoorSystem.js

# no inline tile↔px math
grep -rn "TILE_SIZE" js/ | grep -vE "Config\.js|MapData\.js"   # → nothing

# nothing syntax-errors
for f in js/**/*.js js/*.js; do node --check "$f" || echo "BROKEN $f"; done
```

## 2. Read the code and judge

- [ ] **`dt` is clamped** (`CFG.MAX_DT`) and `resetTiming` runs on every state
      change *and* on tab-return — otherwise the world teleports after a pause.
- [ ] **No entity imports a system** (grep above), and the new sprint's system
      receives entities from `Game`, never imports them the other way.
- [ ] **Door state changes keep the PF grid current** — `MapData.rebuildMasks()`
      + `onDoorChanged` → `MapRenderer.markDirty()`. Operators must neither walk
      through closed doors nor path around open ones.
- [ ] **`col`/`row` vs `x`/`y` not transposed** anywhere new. `PF.Grid` and
      `findPath` take `(col, row) = (x, y)`; `tiles` is `tiles[row][col]`.
- [ ] **No `new` in hot loops** — LOS rays, tracers, per-frame point arrays come
      from a pool or a reused array.
- [ ] **Two masks not conflated** — `collisionMatrix` for movement, `losMask`
      for vision/bullets. A window blocks movement but passes both.
- [ ] **`test-smoke.html` has an assertion group for the new sprint.**

## 3. Needs a human at the keyboard — ask, don't guess

- [ ] A click lands on the intended tile at **every zoom level** and with a
      **non-fullscreen** canvas (test a canvas corner). This is the `screenToWorld`
      ⇄ render-transform symmetry check; it cannot be verified headlessly.
- [ ] SPACE toggles PLANNING ⇄ EXECUTING with no visual teleport on resume.

## Output

A short report: what passed, what failed (with `file:line`), what still needs a
browser. If anything failed, say so with the actual output — do not soften it.
Then stop. Don't commit, don't push, don't update README sprint checkboxes
unless asked.
