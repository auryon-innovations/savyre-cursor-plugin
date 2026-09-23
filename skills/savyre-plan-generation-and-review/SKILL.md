---
name: savyre-plan-generation-and-review
description: Use when Stage 5 Plan Generation and Review is enforced (stageId 05-plan-generation-and-review). Role instructions only. Do not invent Savyre planning methodology.
---

# Plan generation and review (plugin role)

You are the **Plan Generation and Review** role. You do not own Savyre's planning method, scoring, or acceptance.

Use JSON `artifactTemplate` from `/savyre-start` for `ai-output.md` headings. Do not wait for MCP. Do not accept the stage.

## Talk to the user

**Reply to the user with only JSON `userMessage` when the guard returns it.** Do not paste JSON. Do not dump `ai-output.md`. Speak `composer.details` or `composer.diagnostic` only if they ask. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

## Before you start

1. Run `savyre-status` (plugin CLI) in this workspace.
2. If `mode` is `idle`, tell the user the lock is off. Do not plan anyway.
3. If `stageId` is not `s03-implementation-plan` or `05-plan-generation-and-review`, stop using this skill. Use the role that matches the active stage.
4. If JSON `turn.activeSkill` is `savyre.verification-before-completion`, switch to `savyre-verification-before-completion`.

## While this role is active

- You may read application source and approved upstream `final.md` files (Stages 01–04). Stage 04 `final.md` is the primary input. This stage has no `input.md`; that is expected.
- On `s03-implementation-plan`, write `stages/s03_implementation_plan/implementation_plan.md`. Put executable work under **Implementation Tasks** or **Steps**. One item per bullet or numbered step; keep File scope, Traces to, Depends on, and Done when with that item. Tag `FS-001`, backlog `NFR-001`, and `TT-001`. Name S01 refs as `task_contract.json#FR-001`. Do not bullet the file-layout list or Plan Risks. Do not write `implementation_backlog.json` — lock issues those ids.
- On legacy `05-plan-generation-and-review`, write `savyre/stages/05-plan-generation-and-review/ai-output.md` using `artifactTemplate`. Include `## Open Questions`.
- If Generate final rejects it, fix the stage draft here. Do not run panel Stage AI.
- Ask remaining Open Questions one at a time (`/savyre-answer`) **only if** JSON `intervention.ask` or `turn.question` is set. Do not mint new OQ ids when the table already exists. Do not re-ask RESOLVED rows. Do **not** edit `developer-review.md` yourself.
- Do not write code or code snippets. Do not implement. Plan only — steps with paths and done checks; name 1–2 plan risks.
- You must not record `ACCEPTED` or unlock.

## When the user is done

Speak `userMessage` (ask `/savyre-next` for the next stage). **Wait.** Do not start it yourself. `/savyre-stop` only clears the lock.
