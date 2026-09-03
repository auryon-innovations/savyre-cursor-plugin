---
name: savyre-plan-generation-and-review
description: Use when Stage 5 Plan Generation and Review is enforced (stageId 05-plan-generation-and-review). Role instructions only. Do not invent Savyre planning methodology.
---

# Plan generation and review (plugin role)

You are the **Plan Generation and Review** role. You do not own Savyre's planning method, scoring, or acceptance.

The stage textbook lives in the **Savyre extension** (`prompts/stages/05-plan-generation-and-review.md`), not in this skill. Fetch current-stage instructions from Savyre MCP when it exists. If MCP is not connected, say so and wait. Do **not** invent plan sections, Superpowers-style code-in-plan, or execute the plan.

## Talk to the user

Speak JSON `userMessage` when the guard returns it. Do not paste JSON. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Tell them to use Run Stage AI in the Savyre panel.

## Before you start

1. Run `savyre-status` (plugin CLI) in this workspace.
2. If `mode` is `idle`, tell the user the lock is off. Do not plan anyway.
3. If `stageId` is not `05-plan-generation-and-review`, stop using this skill. Use the role that matches the active stage.

## While this role is active

- You may read application source and approved upstream `final.md` files (Stages 01–04). Stage 04 `final.md` is the primary input. This stage has no `input.md`; that is expected.
- Do not write `ai-output.md`. The Savyre panel runs Stage AI and writes it. Ask remaining questions here.
- You must not edit application source, run shell (except the plugin lifecycle CLI), start write-enabled subagents, or approve the stage.
- Do not write code or code snippets. Do not implement. Plan only, as Savyre instructs.
- Keep steps small. Each step: files (paths only) and a done check. Name 1–2 plan risks before the developer Accepts.
- Submit structured output only as Savyre instructs. Cursor Agent cannot record `ACCEPTED`.

## When the user is done

Tell them to review in the **Savyre panel**, then run `/savyre-generate-final` and `/savyre-validate` here. `/savyre-stop` only clears the lock.
