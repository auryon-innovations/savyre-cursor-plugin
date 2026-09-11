---
name: savyre-start
description: Bind this Agent chat to the current Savyre stage lock and role. Use when the user runs /savyre-start or wants Chat mode for the panel's current stage.
---

# savyre-start

Before confirm: read Assigned task, understand it, write 2–4 short sentences in your own voice, then a short numbered list (only headings the prompt supports — Product, UX, API, Data, Stack). Never list Original Task / Explicit Requirements in chat. Then speak `userMessage` exactly. After they confirm: write the complete draft (do not speak leftover “draft for …” lines), run `turn`, talk 1–2 short sentences, then speak `userMessage` exactly. Do not copy leftover fragments. Do not recite `composer.report`. Do not invent extra product facts. Do not invent “The task is captured.” Do not paste JSON or the prompt. Do not quote or paraphrase `message`. Follow `message` yourself. After you write Assigned task, run `turn` and talk, then speak that `userMessage`. Speak `composer.details` or `composer.status` only if they ask. Do not mention `final.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

Bind **this** Agent chat to the Savyre session's **current** stage (the panel). Chat performs that stage (1–3) and saves output locally. Then **ask** them to run the slash in `userMessage`. After `/savyre-start`, that slash is always `/savyre-next` (confirm, lock, validate, or the next stage). `/savyre-stop` only clears the lock. Do not run those commands yourself. Savyre unlocks if Validate passes. You cannot unlock the stage yourself.

The JSON `stageId` / `panelStageId` is the **only** stage. This command is the **only** rebind: it copies the panel `currentStageId` into Chat. Do not invent Stage 01 because the user typed a product after `/savyre-start`. If generate-final or validate says Chat is bound to an older stage, run this command again (no extra text).

1. Run this command from the **project** workspace root (not from the plugin folder). Pass extra words after `/savyre-start` as arguments (`$ARGUMENTS`). On Stage 01 the plugin may write those exact words under Assigned task first as leftover. Chat must replace that leftover with the restatement (2–4 sentences plus Product / UX / API / Data / Stack). On Stage 02+ extra words are ignored (`ignoredUserText`).

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" start $ARGUMENTS
```

On Windows PowerShell:

```bash
node "$env:USERPROFILE/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" start $ARGUMENTS
```

On macOS/Linux:

```bash
node "$HOME/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" start $ARGUMENTS
```

If `$ARGUMENTS` is empty but extra words appear after this command in the prompt, append those words to `start`. `/savyre-start create a todo app` is still **start** (not a new Stage 01). Extra words are ignored when the panel is not on Stage 01.

2. Follow `stageId`, `captureTask`, `turn.state`, `turn.activeSkill`, `cursorSkill`, and `allowedActions`. If JSON `unifiedTurn` is present, that is the current outcome and next action (same as the Savyre panel). Do not invent a different next step. `unifiedTurn.status` of `complete` means Savyre already finished the stage on disk — you still cannot unlock. Use Cursor skill `cursorSkill`. `turn.activeSkill` is the registry skill for this turn (it can change after a draft exists). If `ignoredUserText` is set, `userMessage` already explains that. If `turn.question`, `pendingQuestion`, or `continuation.pendingQuestionId` is set, ask **only that question** now. If JSON `verification.ready` is false, do not lock or validate. If JSON `intervention.ask` is false, do **not** invent another question — treat routine naming, layout, and stack choices as assumptions. Do **not** send them to lock while a question is pending. `canApprove` / `canUnlockStage` are always false.
3. If `mode` is `enforced`, work **in this chat**. Read the Cursor skill in `cursorSkill`. Do not invent Savyre methodology. Run `savyre-guard.mjs turn` when you need a fresh question. When they answer an Open Question, run `savyre-guard.mjs answer OQ-00N <their words>`.
4. Use Stage 01 task capture **only** if JSON `stageId` is `01-task-input` **and** `captureTask` is true. If `stageId` is anything else, do **not** write `input.md`, do **not** ask `/savyre-confirm`, and do **not** use skill `savyre-task-input`. If `turn.question` is already set on Stage 01, ask that Open Question and wait. If JSON `suggestedTask`, `intakeReview`, or `userMessage` already captured a product, **do not** ask what to build. Replace leftover or the summarize-placeholder under `## Assigned task (in your own words)` with 2–4 short sentences plus a Product / UX / API / Data / Stack list. Keep Official assignment unchanged. Speak that same Assigned task text, then speak `userMessage`. Wait for `/savyre-next`. Only if there is no leftover and Assigned task is empty: ask what to build, **wait**, then write that restatement (not Official assignment). Then run `savyre-guard.mjs turn`. Do **not** invent “The task is captured.” Do **not** confirm for them. They confirm with `/savyre-next`. Do not mention a Confirm task button. After they continue, **write** `savyre/stages/01-task-input/ai-output.md` using JSON `artifactTemplate`. Fill from the Assigned task only. If there are Open Questions, ask one at a time (`/savyre-answer`). If none, follow `turn.activeSkill` (verification), talk 1–2 short sentences from Assigned task, then speak `userMessage` and wait for `/savyre-next`. Do not lock, validate, or start the next stage yourself.
5. If `stageId` is `02-requirement-analysis` or `03-codebase-discovery`: this stage has **no** `input.md`. That is expected. Source of truth is the **previous stage `final.md`**. **Write** `savyre/stages/<stageId>/ai-output.md` using JSON `artifactTemplate`. Then run `savyre-guard.mjs turn` and follow `turn.activeSkill` / `cursorSkill`. Stage 02: after the draft, stop and run `savyre-requirement-challenge` (write `challenge-findings.json`, ask blocking questions). Stage 03: after the draft, run `savyre-evidence-grounding` (write `evidence-map.json`). After that pass, run `savyre-verification-before-completion`. Ask **one** pending question at a time and **resume the same question** if `turn.question` is set. When they answer, run `savyre-guard.mjs answer OQ-00N <their words>`. Do **not** write answers into `developer-review.md` yourself. Do not lock until `userMessage` asks for `/savyre-next`. Wait.
6. If `stageId` is `04-impact-analysis` or `05-plan-generation-and-review`: Chat artifact generation is stages 1–3 only. Do **not** write `ai-output.md`. Speak `userMessage` (Run Stage AI in the panel, then `/savyre-next` here).
7. If `stageId` is `06-implementation`: this stage has **no** `input.md`. Source of truth is Stage 05 `final.md` and the backlog. Write application files. Do not write `ai-output.md`. Then speak `userMessage` and wait.
8. If `mode` is `idle`, speak `userMessage`. Do not invent a workflow or turn the lock on yourself.
9. Do **not** claim you unlocked the next stage. If Validate succeeded, speak `userMessage` (ask `/savyre-next`). **Wait.** Do not start the next stage yourself.

Keep `/savyre-run`, `/savyre-status`, and `/savyre-stop` available. `/savyre-stop` only clears the lock; it does not accept the stage.
