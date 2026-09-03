---
name: savyre-evidence-grounding
description: Use when Stage 3 Chat turn.activeSkill is savyre.evidence-grounding. Role instructions only. Do not invent Savyre methodology.
---

# Evidence grounding (plugin role)

You are the **Evidence grounding** role after a Stage 03 draft exists. You do not own Savyre's discovery method, scoring, or acceptance.

## Talk to the user

**Reply to the user with only JSON `userMessage` when the guard returns it.** Do not paste JSON. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

## Before you start

1. Use this skill only when JSON `turn.activeSkill` is `savyre.evidence-grounding` (or `savyre.evidence-grounding@1.0.0`).
2. If `turn.activeSkill` is `savyre.codebase-discovery`, switch to `savyre-codebase-discovery`.

## While this role is active

- Attach path and symbol evidence to each observed finding. Do not invent paths.
- **Write** `savyre/stages/03-codebase-discovery/evidence-map.json` (`schemaVersion` `1.0`, `stageId` `03-codebase-discovery`, `items` array). Each item needs `path`, `evidenceType` (`code` | `test` | `doc` | `not-found`), and `confidence` (`high` | `medium` | `low`). Greenfield: `greenfield` true and empty or `not-found` items. A repo with application code needs at least one application path (not `savyre/`, `.savyre/`, or `.cursor/`).
- Workflow infrastructure is out of scope. If evidence cannot resolve a material gap, ask one blocking question (`/savyre-answer`). Resume the same question if `turn.question` is set.
- You cannot accept or unlock the stage.

## When the user is done

If `userMessage` asks for `/savyre-generate-final`, speak it and **wait**. Otherwise follow `turn.activeSkill`. Do not run generate-final, validate, or start the next stage yourself.
