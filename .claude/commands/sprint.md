---
description: Zaimplementuj sprint N zgodnie z briefem (docs/DESIGN.md).
argument-hint: "[numer sprintu, np. 5]"
---

Implement sprint **$ARGUMENTS** of BREACH. If no number was given, take the next
unticked sprint from `README.md` → *Status sprintów*.

## Before writing code

1. Read `docs/DESIGN.md` — the whole *"Roadmapa sprintów"* row for this sprint,
   plus the mechanics section it points at (e.g. Sprint 5 → *"7. System walki
   (HITSCAN)"*). Then re-read *"Decyzje projektowe"*, *"Konwencje i kontrakty"*
   and *"Wydajność i stabilność"* — they are binding.
2. Read `CLAUDE.md`, especially **Update order in `Game.update()` — and a known
   deviation**. The code does *not* follow the brief's system order; Detection
   runs after Movement. Any new system must be slotted with that in mind
   (`CombatSystem` goes **after** `DetectionSystem`, or it fires on stale LOS).
3. If you find a **new** inconsistency or gap in the brief that affects this
   sprint, say so in 2–3 sentences **before** coding, then proceed. That is the
   brief's own instruction to you.

## While writing code

- One file = one class or one system. Constructor gets JSDoc with typed `@param`s.
- **Entities never import systems.** `Game` wires systems and injects references.
- Every tunable number goes in `js/core/Config.js` (`CFG`) — no exceptions.
- tile↔px only via `MapData.tileToWorld` / `worldToTile`.
- Comments and JSDoc in **Polish**; identifiers in English.
- No `new` in hot loops — pool tracers, rays, per-frame arrays.
- CDN libraries only (PathFinding.js, Howler.js) — never vendor their code.

## Before reporting done

1. Add a `// --- Sprint N: ... ---` assertion group to `test-smoke.html` covering
   the new contracts.
2. Run `/preflight`. Report honestly what passed, what failed, and what needs a
   browser.
3. Update `README.md`: tick the sprint, extend the **Struktura** block with the
   new files, extend **Sterowanie** if you added a binding.
4. Update `CLAUDE.md` → *Roadmap position* with what landed and what's next.
5. **Do not commit or push.** Offer `/commit` to produce the message; the user
   commits themselves.
