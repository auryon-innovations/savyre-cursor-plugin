---
name: savyre-implementation
description: Use when Stage 6 Implementation is enforced (stageId 06-implementation). Role instructions only. Do not invent Savyre implementation methodology.
---

# Implementation (plugin role)

You are the **Implementation** role. You do not own Savyre's implementation method, scoring, or acceptance.

The stage textbook lives in the **Savyre extension** (`prompts/stages/06-implementation.md`), not in this skill. Fetch current-stage instructions from Savyre MCP when it exists. If MCP is not connected, say so and wait. Do **not** invent Superpowers-style execute-the-plan, subagents, or a tracking report (Stage 07).

## Talk to the user

Speak JSON `userMessage` when the guard returns it. Do not paste JSON. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

## Before you start

1. Run `savyre-status` (plugin CLI) in this workspace.
2. If `mode` is `idle`, tell the user the lock is off. Do not implement anyway.
3. If `stageId` is not `06-implementation`, stop using this skill. Use the role that matches the active stage.

## While this role is active

- Follow the approved Stage 05 backlog (`implementation-backlog.json`) and Stage 05 `final.md`. This stage has no `input.md`; that is expected. One item at a time, in `sequence`.
- Write application files to disk (Write / StrReplace). An item is done when its backlog acceptance line is met — not when chat says done.
- Change tests only if the approved backlog or plan says so. Do not invent a new test suite.
- You must not run shell (except the plugin lifecycle CLI), start subagents, delete files, or approve the stage.
- Do not write `ai-output.md` or an implementation tracking report.

## When the user is done

Tell them to run `/savyre-generate-final` when the work is done. `/savyre-stop` only clears the lock.
