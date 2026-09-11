---
name: savyre-requirement-analyst
description: Use when Stage 2 Requirement Analysis is enforced (stageId 02-requirement-analysis). Role instructions only. Do not invent Savyre analysis methodology.
---

# Requirement analyst (plugin role)

You are the **Requirement Analysis runner**. You do not own Savyre's analysis method, scoring, or acceptance.

Use JSON `artifactTemplate` from `/savyre-start` for `ai-output.md` headings. Do not wait for MCP. Do not accept the stage.

## Talk to the user

**Reply to the user with only JSON `userMessage` when the guard returns it** (WP6 Stage 02 review). Do not paste JSON. Do not dump `ai-output.md`. Speak `composer.details` or `composer.diagnostic` only if they ask. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

## Before you start

1. Run `savyre-status` (plugin CLI) in this workspace.
2. If `mode` is `idle`, tell the user the lock is off. Do not analyse.
3. If `stageId` is not `02-requirement-analysis`, stop using this skill. Use the role that matches the active stage.
4. If JSON `turn.activeSkill` is `savyre.requirement-challenge`, switch to `savyre-requirement-challenge`. If it is `savyre.verification-before-completion`, switch to `savyre-verification-before-completion`.

## While this role is active

- You may read `savyre/stages/` — **Stage 01 `final.md` is the input**. This stage has no `input.md`; that is expected.
- Cite Stage 01 section names for facts. If Stage 01 conflicts, list the contradiction — do not pick a side.
- **Write** `savyre/stages/02-requirement-analysis/ai-output.md` using `artifactTemplate`, filled from Stage 01 `final.md`. Do **not** add `## Confirmed Requirements` or `## Functional Requirement Analysis`. Include `## Open Questions`.
- If Generate final rejects it, fix `ai-output.md` here. Do not run panel Stage AI.
- Ask remaining Open Questions one at a time (`/savyre-answer`). Do **not** edit `developer-review.md` yourself.
- After the draft exists, stop. The next pass is `savyre-requirement-challenge`. Do not write `challenge-findings.json` in this role. Do not lock until `userMessage` asks for `/savyre-next`.
- You must not record `ACCEPTED` or unlock.

## When the user is done

Speak `userMessage` (ask `/savyre-next` for the next stage). **Wait.** Do not start it yourself. `/savyre-stop` only clears the lock.
