---
description: Wygeneruj komunikat commita w stylu tego repo (polski, Sprint N).
---

Read the current diff: `git status`, `git diff`, `git diff --staged`.
Check `git log --oneline -10` for tone reference before writing.

## Style of this repo (derived from the actual log — don't invent another)

Commit messages are **Polish**. Sprint work uses one subject line, no body:

```
Sprint <N>: <temat> — <co doszło, oddzielone przecinkami>
```

Real examples:

```
Sprint 4: drzwi — Door + DoorSystem (OPEN_SLOW/KICK, hałas alarmuje wrogów), pełna synchronizacja masek/gridu PF/dirty mapy, 3 drzwi na mission_01
Sprint 3: LOS + Fog of War — VisionSystem (widzenie drużyny) + FogRenderer (mgła dwustanowa), wrogowie ukrywani poza wzrokiem
Sprint 2: wrogowie + DetectionSystem + AISystem (patrol/alarm), raycast LOS w MapData
```

Notes on the real style:

- Subject lines are **long** (100–140 chars) and that's fine — do not truncate to 72.
- Topic, then an **em-dash**, then a comma-separated list of what landed. Class/system names in `PascalCase` as written in code.
- No body, no bullet list, no `Co-Authored-By`, no emoji.
- Not a sprint (bugfix, docs, refactor between sprints)? Use a short Polish
  imperative subject with a topic prefix, e.g. `Fix: klik nie trafia przy zoomie`
  or `Docs: brief v2 do repo`. Keep it one line.

## Rules

- Don't invent changes the diff doesn't show. If the diff only touches docs,
  say so — don't claim a system was added.
- If the diff spans unrelated concerns, propose **two or more** messages plus a
  split plan. Don't merge unrelated work into one commit.
- **Never run `git commit` or `git push`.** The user commits themselves.
  Print the message(s) in a code block and stop.
