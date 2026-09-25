---
name: savyre-unified-chat-turn
description: Shared Chat turn adapter for every Savyre stage. Use when JSON has unifiedTurn. Does not replace the stage role in turn.activeSkill.
---

# Unified Chat Turn (capability)

You are **not** the stage role. Keep using JSON `cursorSkill` / `turn.activeSkill` for stage work.

This skill rides along on Stages 01–15. `unifiedTurn` is a read-only adapter over disk and the Savyre panel Next Step.

## While this is present

- Treat `unifiedTurn.nextAction` as the same next step as the panel. Do not invent another.
- After writing on **any** stage, speak 1–2 short sentences of substance. Do **not** backtick the file path and do **not** say “I wrote …”. Then speak `userMessage` **exactly** — copy it verbatim. Never invent “Please check … to lock …”.
- On Build & Review, if JSON `nextBacklogItemId` is set, the next step is implement that id (or wait for `/savyre-next`), not lock.
- After a stage passes, speak 1–2 short sentences, then `userMessage` **exactly**. Do not repeat “X is done. Y is next.”
- If the panel is already on Implementation Plan after Task Definition (no Code Discovery files), do **not** run Code Discovery. Plan from the Task Definition artifacts only.
- If JSON `intervention.ask` is true or `turn.question` is set, ask **only that one** question now. Do not ask them to lock. Do not write challenge-findings. Do not mint new OQ ids when an Open Questions table already exists. Do not re-ask a RESOLVED row. Do not invent persist/stack/naming questions.
- `unifiedTurn.status` of `complete` means Savyre already finished the stage on disk. You still cannot unlock.
- `canApprove` and `canUnlockStage` are always false.
- Speak only JSON `userMessage`. Do not dump the turn JSON.
