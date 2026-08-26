---
name: savyre-run-stage
description: Bootstrap the active Savyre execution. Use when a Savyre stage is enforced and the user wants the current stage run, resumed, or submitted. Pick the matching role skill. Do not invent Savyre methodology.
---

# Run the active Savyre stage

You are a generic runner. You do not own Savyre's stage method, scoring, or acceptance.

Stage textbooks live in the **Savyre extension** `prompts/stages/`, not in this plugin. Role skills here are short instructions only.

## Before you start

1. Run `savyre-status` (the plugin CLI) in this workspace.
2. If `mode` is `idle`, tell the user to start the lock first (`/savyre-run` or the extension Run button). Do not work the stage anyway.
3. If `mode` is `enforced`, continue with the **role skill that matches `stageId`**:
   - `02-requirement-analysis` → `savyre-requirement-analyst`
   - `03-codebase-discovery` → `savyre-codebase-discovery`
   - any other stage → stay generic; do not invent that stage's method

## While enforced

- Fetch **current-stage instructions** from Savyre MCP when it exists. If MCP is not connected, say so and wait.
- Follow the active permission slip (read-only vs paths). Do not edit application source, run shell (except the plugin lifecycle CLI), start write-enabled subagents, or approve the stage.
- Submit structured output only as Savyre instructs. Cursor Agent cannot record `ACCEPTED` or enable the next stage.

## When the user is done

Tell them to accept in the **Savyre extension**, then `/savyre-stop`.
