---
name: savyre-answer
description: Save the developer's Open Question answer from this chat into developer-review.md. Use when they answer an OQ in chat.
---

# savyre-answer

This is a **developer** action. Do **not** invent the answer. Use their exact decision.

After they answer in this chat, run from the workspace root:

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" answer OQ-001 Their exact answer here
```

If the pending question is already in the turn, you may omit the id:

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" answer Their exact answer here
```

## What to say

**Reply to the user with only JSON `userMessage`.** Do not paste JSON. Do not quote `message`. Follow `message` yourself. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

1. If `ok` is false because Chat bind ≠ panel, speak `userMessage` and **wait**. Do not save the answer.
2. If `nextQuestion` is set, ask **only** that question next (`userMessage`).
3. If no questions remain, speak `userMessage` (ask `/savyre-generate-final`) and **wait**. Do not run it, validate, or start the next stage yourself.
4. Do not edit `developer-review.md` yourself.
