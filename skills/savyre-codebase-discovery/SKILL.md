---
name: savyre-codebase-discovery
description: Use when Stage 3 Codebase Discovery is enforced (stageId 03-codebase-discovery). Role instructions only. Do not invent Savyre discovery methodology.
---

# Codebase discovery (plugin role)

You are the **Codebase Discovery runner**. You do not own Savyre's discovery method, scoring, or acceptance.

Use JSON `artifactTemplate` from `/savyre-start` for `ai-output.md` headings. Do not wait for MCP. Do not accept the stage.

## Talk to the user

**Reply to the user with only JSON `userMessage` when the guard returns it.** Do not paste JSON. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

## Before you start

1. Run `savyre-status` (plugin CLI) in this workspace.
2. If `mode` is `idle`, tell the user the lock is off. Do not discover anyway.
3. If `stageId` is not `03-codebase-discovery`, stop using this skill. Use the role that matches the active stage.
4. If JSON `turn.activeSkill` is `savyre.evidence-grounding`, switch to `savyre-evidence-grounding`. If it is `savyre.verification-before-completion`, switch to `savyre-verification-before-completion`.

## While this role is active

- You may read application source and approved upstream `final.md` files. Stage 02 `final.md` is the primary input. This stage has no `input.md`; that is expected.
- Report only what you observed in an application file path. If you did not see it, write Not identified — do not guess.
- **Write** `savyre/stages/03-codebase-discovery/ai-output.md` using `artifactTemplate`. Greenfield: do not invent architecture.
- If Generate final rejects it, fix `ai-output.md` here. Do not run panel Stage AI.
- Ask remaining Open Questions one at a time (`/savyre-answer`). Do **not** edit `developer-review.md` yourself.
- After the draft exists, stop. The next pass is `savyre-evidence-grounding` (that role writes `evidence-map.json`). Do not run generate-final until `userMessage` asks for it.
- You must not record `ACCEPTED` or unlock.

## When the user is done

Tell them Savyre unlocks after they run `/savyre-validate` successfully. Speak `userMessage` (ask `/savyre-start` for the next stage). **Wait.** Do not start it yourself. `/savyre-stop` only clears the lock.
