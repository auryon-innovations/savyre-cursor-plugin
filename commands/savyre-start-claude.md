---
name: savyre-start-claude
description: Claude Code adapter for the Savyre launcher. Use when the user runs /savyre:start.
---

# /savyre:start (Claude Code)

Same protocol as Cursor `/savyre-start`. Do not invent workflow rules.

**Reply to the user with only JSON `userMessage`.** Do not paste JSON. Do not quote `message`. Follow `message` yourself. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

1. Run `savyre-start` / `savyre-guard.mjs start` from the project workspace. Follow JSON `stageId`. Extra text after start is ignored unless the panel is on Stage 01.
2. Then `savyre-guard.mjs turn` and follow `allowedActions`, `turn.activeSkill`, and `cursorSkill`.
3. Stages 01–03 may write the stage artifact. Stages 04–05 stay panel Run Stage AI.
4. You cannot approve or unlock. Confirm is Stage 01 only. Generate final / Validate are Savyre actions.
