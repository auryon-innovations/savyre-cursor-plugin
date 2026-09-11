---
name: savyre-validate
description: Alias of /savyre-next when the next step is validate. Use only when the user types /savyre-validate.
---

# savyre-validate

Call the same Savyre action the panel uses. Do not mark the stage complete yourself.

Run this **only after the developer types `/savyre-validate`**. Do not run it because generate-final succeeded.

Run from the **project** workspace root:

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" action validate
```

## What to say

**Reply to the user with only JSON `userMessage`.** Do not paste JSON. Do not quote `message`. Follow `message` yourself. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK. After success, **wait**. Do not run `/savyre-next` yourself.

1. Follow `ok`, `data.stageId`, `panelStageId`, `boundStageId`, and `reason`. Do not dump them.
2. If `ok` is false because Chat bind ≠ panel current, do **not** fix files. Speak `userMessage` and **wait**.
3. If it failed for review/artifact errors on the **same** bound stage, fix those errors. Do not claim the stage is unlocked. Speak `userMessage`.
4. If it succeeded, Savyre unlocked the next stage. Chat bind is now stale. Speak `userMessage` (ask `/savyre-next`) and **wait**. Do not bind the next stage yourself.
5. Chat cannot unlock by itself. Do not validate after a failed generate-final.
