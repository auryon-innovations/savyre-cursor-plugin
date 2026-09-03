---
name: savyre-start
description: Bind this Agent chat to the current Savyre stage lock and role. Use when the user runs /savyre-start or wants Chat mode for the panel's current stage.
---

# savyre-start

**Reply to the user with only JSON `userMessage`.** Do not paste JSON. Do not quote `message`. Follow `message` yourself. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

Bind **this** Agent chat to the Savyre session's **current** stage (the panel). Chat performs that stage (1–3) and saves output locally. Then **ask** them to run Generate final and Validate in this chat. Do not run those commands until they do. Savyre unlocks if Validate passes. You cannot unlock the stage yourself.

The JSON `stageId` / `panelStageId` is the **only** stage. This command is the **only** rebind: it copies the panel `currentStageId` into Chat. Do not invent Stage 01 because the user typed a product after `/savyre-start`. If generate-final or validate says Chat is bound to an older stage, run this command again (no extra text).

1. Run this command from the **project** workspace root (not from the plugin folder):

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" start
```

On macOS/Linux use `$HOME/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs`.

Do **not** pass the product task as CLI arguments. `/savyre-start create a todo app` is still **start**, not a new Stage 01. Extra words are ignored when the panel is not on Stage 01 (`ignoredUserText` in JSON).

2. Follow `stageId`, `captureTask`, `turn.state`, `turn.activeSkill`, `cursorSkill`, and `allowedActions`. Use Cursor skill `cursorSkill`. `turn.activeSkill` is the registry skill for this turn (it can change after a draft exists). If `ignoredUserText` is set, `userMessage` already explains that. If `turn.question` or `pendingQuestion` is set, ask **only that question** now. Do **not** send them to Generate final while a question is pending. `canApprove` / `canUnlockStage` are always false.
3. If `mode` is `enforced`, work **in this chat**. Read the Cursor skill in `cursorSkill`. Do not invent Savyre methodology. Run `savyre-guard.mjs turn` when you need a fresh question. When they answer an Open Question, run `savyre-guard.mjs answer OQ-00N <their words>`.
4. Use Stage 01 task capture **only** if JSON `stageId` is `01-task-input` **and** `captureTask` is true. If `stageId` is anything else, do **not** write `input.md`, do **not** ask `/savyre-confirm`, and do **not** use skill `savyre-task-input`. If `turn.question` is already set on Stage 01, ask that Open Question and wait. Otherwise your **first message** is only a question — ask what to build. **Wait.** Do not write files yet. Do not treat the official assignment or “15 stages” as the product task. After they name a product, write only `## Assigned task (in your own words)` in `input.md`. Reflect the wording and ask them to confirm. Do **not** confirm for them. They confirm with `/savyre-confirm` or the panel Confirm task button. After confirm, **write** `savyre/stages/01-task-input/ai-output.md` using JSON `artifactTemplate`. Fill from the Assigned task only. If there are Open Questions, ask one at a time (`/savyre-answer`). If none, follow `turn.activeSkill` (verification) then speak `userMessage` and **wait**. Do not run generate-final, validate, or the next `/savyre-start` yourself.
5. If `stageId` is `02-requirement-analysis` or `03-codebase-discovery`: this stage has **no** `input.md`. That is expected. Source of truth is the **previous stage `final.md`**. **Write** `savyre/stages/<stageId>/ai-output.md` using JSON `artifactTemplate`. Then run `savyre-guard.mjs turn` and follow `turn.activeSkill` / `cursorSkill`. Stage 02: after the draft, stop and run `savyre-requirement-challenge` (write `challenge-findings.json`, ask blocking questions). Stage 03: after the draft, run `savyre-evidence-grounding` (write `evidence-map.json`). After that pass, run `savyre-verification-before-completion`. Ask **one** pending question at a time and **resume the same question** if `turn.question` is set. When they answer, run `savyre-guard.mjs answer OQ-00N <their words>`. Do **not** write answers into `developer-review.md` yourself. Do not run generate-final until `userMessage` asks for `/savyre-generate-final`. Wait.
6. If `stageId` is `04-impact-analysis` or `05-plan-generation-and-review`: Chat artifact generation is stages 1–3 only. Do **not** write `ai-output.md`. Speak `userMessage` (Run Stage AI in the panel, then `/savyre-generate-final` here).
7. If `stageId` is `06-implementation`: this stage has **no** `input.md`. Source of truth is Stage 05 `final.md` and the backlog. Write application files. Do not write `ai-output.md`. Then speak `userMessage` and wait.
8. If `mode` is `idle`, speak `userMessage`. Do not invent a workflow or turn the lock on yourself.
9. Do **not** claim you unlocked the next stage. If Validate succeeded, speak `userMessage` (ask `/savyre-start` with no extra task text). **Wait.** Do not start the next stage yourself.

Keep `/savyre-run`, `/savyre-status`, and `/savyre-stop` available. `/savyre-stop` only clears the lock; it does not accept the stage.
