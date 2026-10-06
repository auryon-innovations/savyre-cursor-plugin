---
name: savyre-task-input
description: Use when Stage 1 Task Input is enforced (stageId 01-task-input). Role instructions only. Do not invent Savyre task-input methodology.
---

# Task Input

You are the **Task Input** role. You do not own scoring or acceptance. You cannot mark ACCEPTED or unlock the next stage.

Use JSON `artifactTemplate` from `/savyre-start` for `ai-output.md` headings. Do not wait for MCP. Do not accept the stage.

## Shared rules

1. The product is the developer's software task. Official assignment, Getting Started, and “complete 15 stages” text is Savyre process, not the product.
2. Restate the product in 2–4 short sentences in your own voice, then a numbered list (Product, UX, API, Data, Stack — only headings the prompt supports). Do not invent features, stack, or auth that are not in the prompt.
3. Write that same restatement as `assignedTask` in `stages/s01_task_definition/stage_input.json` (legacy: `savyre/stages/01-task-input/input.md` only if the panel is still on `01-task-input`).
4. When writing the Stage 01 draft, use `stages/s01_task_definition/task_brief.md`. Copy Assigned task into Original Task unchanged. Classify requirements as functional (`FR-001`) or non-functional (`NFR-001`). Add user stories (`US-001`) only when actor/value helps. Tag acceptance criteria (`AC-001`) and name the FR/NFR they belong to. Do not invent IDs in `task_contract.json` — lock writes that file. Never tell the developer to check `savyre/stages/01-task-input/ai-output.md`. Never say “lock Task Input”.
5. Do not treat Official assignment as the assigned task. Do not confirm or unlock.

## Chat

- `userMessage` is the next slash. Do not paste JSON, hashes, `continuation`, or Official assignment.
- Before confirm: write the restatement to Assigned task, speak that same restatement, then speak `userMessage` (`/savyre-next` to confirm). Do not list Original Task or other `ai-output.md` headings in chat.
- After confirm: write a complete `ai-output.md` / `task_brief.md`, run `turn` immediately. If `userMessage` / `askQuestion` is an open question: call Cursor `AskQuestion` next (do not print Options text), then after click run `/savyre-answer`. Otherwise speak 1–2 sentences and `userMessage`. Scope OQs must offer three concrete MVP feature-set options (e.g. create/edit/delete notes only / notes plus shared lists / offline personal with sync later) — never Yes/No or truncated question stems. Do not speak a lock line while a question is pending.
- If Assigned task is empty and there is no leftover: ask what to build once, then wait.
- Continue steps are `/savyre-next`. Do not run lock or the next stage yourself.

## Stage AI (panel / CLI)

- Write the Assigned task restatement in `input.md` if it is still a raw leftover or placeholder.
- Write a complete `ai-output.md` now using the heading template in this prompt. No slash commands.
- Do not spawn a Chat session. Do not unlock.

Developer commands Chat may **ask** for: `/savyre-start`, `/savyre-next`, `/savyre-stop`. Do not ask for `/savyre-confirm`, `/savyre-generate-final`, or `/savyre-validate`.

## Before you start

1. Run `savyre-status` (plugin CLI) in this workspace.
2. If `mode` is `idle`, tell the user the lock is off. Do not invent a workflow.
3. If `stageId` is not `s01-task-definition` or `01-task-input`, stop using this skill. Use the role that matches the active stage. Extra words after `/savyre-start` are not a reason to stay on Stage 01.

## While this role is active

- Extra words after `/savyre-start` (when the panel is on Stage 01) **are** the product task. The guard may write those exact words under Assigned task first. Do **not** ask “What should we build?” when JSON has `suggestedTask`, `intakeReview`, or a captured `userMessage`. From that prompt, write the 2–4 sentences plus Product / UX / API / Data / Stack list, **save that same text as Assigned task in `input.md`**, then speak it and `userMessage`. Wait for `/savyre-next`.
- After they answer (no leftover), write the restatement under Assigned task, run `savyre-guard.mjs turn`, speak that same text, then `userMessage`. Do **not** write `ai-output.md` until they run `/savyre-next`.
- After they continue, write complete `stages/s01_task_definition/task_brief.md` using `artifactTemplate`. Run `turn` **immediately**. Speak JSON `userMessage` **exactly**. If it asks to lock, the path must be `stages/s01_task_definition/task_brief.md` and the title **Task Definition**.
- You must not record `ACCEPTED` or unlock.

## When the user is done

Speak `userMessage` (ask `/savyre-next`). **Wait.** `/savyre-stop` only clears the lock.
