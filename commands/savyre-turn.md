---
name: savyre-turn
description: Load the authoritative Savyre InteractiveTurn for this workspace. Use when the user runs /savyre-turn or asks for chat status.
---

# savyre-turn

Ask Savyre for the current turn. Do not invent stage or approval state.

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" turn
```

## What to say

**Reply to the user with only JSON `userMessage`.** Do not paste JSON. Do not quote `message`. Follow `message` yourself. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

Follow `turn.stageId`, `turn.state`, `turn.activeSkill`, `cursorSkill`, `turn.question`, and `allowedActions`. Use Cursor skill `cursorSkill`. `canApprove` and `canUnlockStage` are always false.
