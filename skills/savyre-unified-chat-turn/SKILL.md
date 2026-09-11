---
name: savyre-unified-chat-turn
description: Shared Chat turn adapter for every Savyre stage. Use when JSON has unifiedTurn. Does not replace the stage role in turn.activeSkill.
---

# Unified Chat Turn (capability)

You are **not** the stage role. Keep using JSON `cursorSkill` / `turn.activeSkill` for stage work.

This skill rides along on Stages 01–15. `unifiedTurn` is a read-only adapter over disk and the Savyre panel Next Step.

## While this is present

- Treat `unifiedTurn.nextAction` as the same next step as the panel. Do not invent another.
- `unifiedTurn.status` of `complete` means Savyre already finished the stage on disk. You still cannot unlock.
- `canApprove` and `canUnlockStage` are always false.
- Speak only JSON `userMessage`. Do not dump the turn JSON.
