---
description: Uruchom testy smoke (test-smoke.html) w headless Chrome.
---

`test-smoke.html` is the entire test harness for this project — no runner, no
framework. It prints `ALL-PASS` or `FAILURES: <n>` into `<pre id="out">`.

## Run

```bash
# serve (ES modules + fetch() of maps do not work over file://)
python -m http.server 8000 >/dev/null 2>&1 &

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --dump-dom --virtual-time-budget=10000 \
  http://localhost:8000/test-smoke.html \
  | sed -n '/<pre id="out">/,/<\/pre>/p'
```

Kill the server afterwards if you started it (`pkill -f "http.server 8000"`).

## Gotchas

- **This machine has no `msedge`** — only `/Applications/Google Chrome.app`.
- **Always extract the `<pre>` block before grepping.** The dumped DOM includes
  the inline `<script>` source, which contains the literals `ALL-PASS` and
  `FAIL`, so a bare `grep ALL-PASS` on the raw dump matches even when the run
  failed.
- `--virtual-time-budget` must outlast the `fetch()` of `maps/mission_01.json`.

## When tests fail

Report the failing `PASS`/`FAIL` lines verbatim. Don't "fix" a test to make it
green — the assertions encode the brief's contracts (axis conventions, the two
masks, pathfinding, fog ray extension, the door state machine). A red test
usually means the code broke a contract, not that the test is wrong.

## When adding a sprint

Assertions are grouped by sprint:

```js
// --- Sprint 4: drzwi + synchronizacja masek/gridu ---
```

Add a group for the new sprint. Add assertions whenever you touch `MapData`,
an entity, or a system. Keep them headless-friendly — no rendering, no DOM
beyond `<pre id="out">`.
