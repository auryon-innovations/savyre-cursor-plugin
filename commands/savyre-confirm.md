---
name: savyre-confirm
description: Record the developer's Stage 01 task confirmation. Use when the user runs /savyre-confirm. Only valid while the panel is on Stage 01.
---

# savyre-confirm

This is a **developer** action. Do not confirm the task yourself.

Stage 01 only. If the panel is on Stage 02+, do not rewrite `input.md` and do not pretend confirm unlocked the next stage.

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" confirm
```

## What to say

**Reply to the user with only JSON `userMessage`.** Do not paste JSON. Do not quote `message`. Follow `message` yourself. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

- If `ok` is false because Chat bind ≠ panel, or the panel is not on `01-task-input`, speak `userMessage` and **wait**. Do not start `/savyre-start` yourself.
- Confirmation does **not** unlock Stage 02. Next: follow `turn.activeSkill` / `cursorSkill` and write `ai-output.md` using `artifactTemplate` from the Assigned task. If no Open Questions remain, speak `userMessage` (ask `/savyre-generate-final`) and **wait**. Do not run generate-final, validate, or `/savyre-start` for Stage 02 yourself.
