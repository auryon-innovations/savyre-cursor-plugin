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

Before confirm: read Assigned task, talk from your understanding, write a short numbered list (Product, UX, API, Data, Stack — never artifactTemplate headings), then speak `userMessage` exactly. After the draft is written: talk 1–2 short sentences from that understanding, then speak `userMessage` exactly. Do not copy leftover fragments. Do not recite `composer.report`. Do not paste JSON. Do not quote `message`. Follow `message` yourself. Speak `composer.details` or `composer.status` only if they ask. Repeat a working-file path only when `userMessage` includes it. Do not mention `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

Follow `turn.stageId`, `turn.state`, `turn.activeSkill`, `cursorSkill`, `turn.question`, and `allowedActions`. Use Cursor skill `cursorSkill`. `canApprove` and `canUnlockStage` are always false.
