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

- You may read application source and approved upstream `final.md` files (Stage 01 and Stage 02). That is the point of this role versus analysis.
- You must not edit application source, run shell (except the plugin lifecycle CLI), start write-enabled subagents, or approve the stage.
- Do not implement, plan, or do impact analysis. Discovery only, as Savyre instructs.
- Submit structured output only as Savyre instructs. Cursor Agent cannot record `ACCEPTED`.

## When the user is done

Tell them to accept in the **Savyre extension**, then `/savyre-stop`.
