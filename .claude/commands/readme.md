---
description: Zaktualizuj README.md tak, żeby zgadzał się z kodem.
---

Goal: keep `README.md` (Polish, user-facing) accurate without rewriting it.
Its job is: what BREACH is, how to run it, controls, structure, deploy,
sprint status.

## Steps

1. Read `README.md` end-to-end.
2. Find what drifted since the last touch:
   - `git log --oneline -10` and the current diff (`git diff`, `git diff --staged`)
   - `ls js/*/` vs the **Struktura** block — every directory line must list the
     files that actually exist
   - `js/core/InputHandler.js` vs the **Sterowanie** table — every binding
     (LPM / PPM / Ctrl+PPM / SPACJA / kółko) must match the real handlers
   - the **Status sprintów** checkboxes vs `git log` — a sprint that has a
     `Sprint N:` commit is done, tick it
3. Propose a **minimal patch** per drift (old block → new block). Don't rewrite
   whole sections unless asked.
4. Apply directly with Edit, then summarize what changed. Don't commit or push.

## Watch for

- **README describes gameplay, `CLAUDE.md` describes invariants.** Don't copy
  architecture rules into README, and don't copy controls into CLAUDE.md.
- Design decisions that changed after a commit was written: the Sprint 3 commit
  says *mgła trzystanowa*, but the fog is **two-state** (`FogRenderer` docblock
  is authoritative — dim + clear, no "unexplored"). When commit and code
  disagree, **the code wins**; fix README to match the code.
- New system/entity → add it to the right `js/<dir>` line in **Struktura**.
- Deploy details (port 8086, `breach.home`, GHCR path) live in one place —
  don't duplicate them into new sections.

## Tone

Polish. Concise bullets, `**Bold**` for feature names, em-dashes, tables for
controls and structure. No marketing fluff, no emoji beyond the existing 🔫.
