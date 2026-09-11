---
name: savyre-confirm
description: Alias of /savyre-next on Task Input before confirm. Use only when the user types /savyre-confirm. Only valid while the panel is on Stage 01.
---

# savyre-confirm

This is a **developer** action. Do not confirm the task yourself.

Stage 01 only. If the panel is on Stage 02+, do not rewrite `input.md` and do not pretend confirm unlocked the next stage.

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" confirm
```

## What to say

**Talk first, then speak JSON `userMessage` as the last line.** Do not paste JSON. Talk from Assigned task, then speak `userMessage` exactly. After the draft is written, talk from your understanding, then speak `userMessage` (it may name the draft file). Do not recite `composer.report`. Do not quote `message`. Follow `message` yourself. Speak `composer.details` or `composer.status` only if they ask. Do not mention `final.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

- If `ok` is false because Chat bind ≠ panel, or the panel is not on `01-task-input`, speak `userMessage` and **wait**. Do not start `/savyre-start` yourself.
- Confirmation does **not** unlock Stage 02. Next: follow `turn.activeSkill` / `cursorSkill` and write `savyre/stages/01-task-input/ai-output.md` using `artifactTemplate` from the Assigned task. Never leave Generate Output placeholder text. If no Open Questions remain, run `turn`, then speak `userMessage` and **wait** for `/savyre-next`. Do not repeat the product report. Do not lock, validate, or start Stage 02 yourself.
