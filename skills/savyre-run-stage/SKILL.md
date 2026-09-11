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
3. If `mode` is `enforced`, continue with the **Cursor skill in JSON `cursorSkill`** (from `turn.activeSkill`):
   - `savyre.task-input-dialogue` → `savyre-task-input`
   - `savyre.requirement-analysis` → `savyre-requirement-analyst`
   - `savyre.requirement-challenge` → `savyre-requirement-challenge`
   - `savyre.codebase-discovery` → `savyre-codebase-discovery`
   - `savyre.evidence-grounding` → `savyre-evidence-grounding`
   - `savyre.verification-before-completion` → `savyre-verification-before-completion`
   - JSON `capabilitySkills` (`savyre.response-composer`, `savyre.unified-chat-turn`, `savyre.intervention-judge`, `savyre.chat-continuation`, `savyre.failure-recovery`) ride along every stage. Do **not** switch `activeSkill` to them.
   - `04-impact-analysis` → `savyre-impact-analyst`
   - `05-plan-generation-and-review` → `savyre-plan-generation-and-review`
   - any other stage → stay generic; do not invent that stage's method

## While enforced

- Fetch **current-stage instructions** from Savyre MCP when it exists. If MCP is not connected, say so and wait.
- Follow the active permission slip. Stages 02–03 may write that stage's `ai-output.md` plus Stage 02 `challenge-findings.json` or Stage 03 `evidence-map.json`. Stages 04–05 are read-only. Do not edit application source, run shell (except the plugin lifecycle CLI), start write-enabled subagents, or approve the stage.
- Submit structured output only as Savyre instructs. Cursor Agent cannot record `ACCEPTED` or enable the next stage.

## When the user is done

Speak `userMessage` and wait for the slash it names. Continue steps are `/savyre-next`. **Talk first, then speak JSON `userMessage` as the last line.** Do not paste JSON. `/savyre-stop` only clears the lock.
