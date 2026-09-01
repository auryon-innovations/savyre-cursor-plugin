---
name: savyre-codebase-discovery
description: Use when Stage 3 Codebase Discovery is enforced (stageId 03-codebase-discovery). Role instructions only. Do not invent Savyre discovery methodology.
---

# Codebase discovery (plugin role)

You are the **Codebase Discovery runner**. You do not own Savyre's discovery method, scoring, or acceptance.

The stage textbook lives in the **Savyre extension** (`prompts/stages/03-codebase-discovery.md`), not in this skill. Fetch current-stage instructions from Savyre MCP when it exists. If MCP is not connected, say so and wait. Do **not** invent discovery sections, indexes, or scope rules.

## Before you start

1. Run `savyre-status` (plugin CLI) in this workspace.
2. If `mode` is `idle`, tell the user the lock is off. Do not discover anyway.
3. If `stageId` is not `03-codebase-discovery`, stop using this skill. Use the role that matches the active stage.

## While this role is active

- You may read application source and approved upstream `final.md` files (Stage 01 and Stage 02). Stage 02 `final.md` is the primary input. This stage has no `input.md`; that is expected.
- Report only what you observed in an application file path. If you did not see it, write Not identified — do not guess.
- Write the discovery artifact to `savyre/stages/03-codebase-discovery/ai-output.md` using the stage textbook. If Savyre validation rejects it, fix that file here.
- If the textbook needs Open Questions, put them in the `## Open Questions` table and **ask them in this chat**. Do **not** write answers or Resolutions. Do **not** edit `developer-review.md`. The developer answers in `developer-review.md`.
- If there are no open questions, write `ai-output.md` only. Default review is ACCEPTED / None — point them to Generate final and Validate in the panel.
- You must not edit application source, run shell (except the plugin lifecycle CLI), start write-enabled subagents, or approve the stage.
- Do not implement, plan, or do impact analysis. Discovery only, as Savyre instructs.
- Submit structured output only as Savyre instructs. Cursor Agent cannot record `ACCEPTED`.

## When the user is done

Tell them to review, Generate final, and Validate in the **Savyre extension** (Chat cannot unlock the next stage), then `/savyre-stop`.
