---
name: savyre-start
description: Bind this Agent chat to the current Savyre stage lock and role. Use when the user runs /savyre-start or wants Chat mode for the panel's current stage.
---

# savyre-start

Bind **this** Agent chat to the Savyre session's current stage. Chat performs the active stage (stages 1–3) and saves output locally. Savyre validates and unlocks. You cannot advance the workflow yourself.

1. Run this command from the **project** workspace root (not from the plugin folder):

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" start
```

On macOS/Linux use `$HOME/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs`.

2. Report the script's JSON to the user.
3. If `mode` is `enforced`, tell them the `stageId` and matching `skill`. If the panel is already running Stage AI, that `stageId` is the one to use — do not stay on an older stage. Work **in this chat**. Read the matching Cursor skill. Do not invent Savyre methodology.
4. If `stageId` is `01-task-input`: your **first message** is only a question — ask what to build. **Wait.** Do not write files yet. Do not treat the official assignment or “15 stages” as the product task. After they name a product, write only `## Assigned task (in your own words)` in `input.md`. Do not invent Original Task, Explicit Requirements, or Open Questions.
5. If `stageId` is `02-requirement-analysis` or `03-codebase-discovery`: this stage has **no** `input.md`. That is expected. Source of truth is the **previous stage `final.md`** (Stage 02 → `savyre/stages/01-task-input/final.md`). **Write** `savyre/stages/<stageId>/ai-output.md` from the stage textbook. Put remaining Open Questions in that file and ask them in this chat. Do **not** fill answers or edit `developer-review.md`. The developer writes Resolutions there. For Stage 02, do **not** invent `## Confirmed Requirements` or `## Functional Requirement Analysis` — Savyre injects the Stage 01 contract. If there are no questions, stop after `ai-output.md` and point to Generate final / Validate. If Savyre validation sends corrections, update `ai-output.md` only. Do not set ACCEPTED or unlock the next stage.
6. If `stageId` is `04-impact-analysis` or `05-plan-generation-and-review`: Chat artifact generation is stages 1–3 only. Do **not** write `ai-output.md`. Use the Savyre panel to run the stage, then Validate.
7. If `stageId` is `06-implementation`: this stage has **no** `input.md`. Source of truth is Stage 05 `final.md` and the backlog. Write application files. Do not write `ai-output.md`. Point to the Savyre panel for Accept, Generate final, and Validate.
8. If `mode` is `idle`, tell them why (`reason`). Do not invent a workflow or turn the lock on yourself.
9. Do **not** claim the stage is accepted. Point to the **Savyre panel** for review, Generate final, and Validate.

Keep `/savyre-run`, `/savyre-status`, and `/savyre-stop` available. `/savyre-stop` only clears the lock; it does not accept the stage.
