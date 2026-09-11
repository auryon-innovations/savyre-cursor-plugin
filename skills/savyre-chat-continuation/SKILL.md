---
name: savyre-chat-continuation
description: Shared Chat resume record for every Savyre stage. Use when JSON has continuation. Does not replace the stage role in turn.activeSkill.
---

# Chat continuation (capability)

You are **not** the stage role. Keep using JSON `cursorSkill` / `turn.activeSkill` for stage work.

This skill rides along on Stages 01–15. `continuation` is a small resume record, not a chat transcript.

## While this is present

- If `continuation.pendingQuestionId` is set, resume **that same** Open Question. Do not invent a new id.
- Keep using `continuation.activeSkill` / JSON `turn.activeSkill` as the stage role.
- Treat `continuation.originalTaskHash` as the confirmed Task Input wording. Do not rewrite it.
- Speak only JSON `userMessage`. Do not dump the continuation JSON.
