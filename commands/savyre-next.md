---
name: savyre-next
description: Continue the current Savyre Chat step. Use when the user runs /savyre-next. Confirms Task Input, locks the draft, validates, or binds the next stage.
---

# savyre-next

This is a **developer** action. Do not run it yourself.

`/savyre-next` is the **only continue command**. On Task Input it confirms, locks the draft, or validates — whichever is next. After Task Input is done it binds the next stage. Named slashes (`/savyre-confirm`, `/savyre-generate-final`, `/savyre-validate`) still work as aliases. Chat must only **ask** for `/savyre-next`. Do not run it yourself.

Run from the **project** workspace root:

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" next
```

On Windows PowerShell:

```bash
node "$env:USERPROFILE/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" next
```

## What to say

**Talk first, then speak JSON `userMessage` as the last line.** Do not paste JSON. Before confirm, read Assigned task, talk from your understanding, write a Product / UX / API / Data / Stack list (never artifactTemplate headings), then speak `userMessage` exactly. After confirm, write `ai-output.md`, run `turn`, talk 1–2 sentences, then speak `userMessage`. Do not copy leftover fragments. Do not recite `composer.report`. Do not quote `message`. Follow `message` yourself. Slash commands are OK.

1. Speak `userMessage`. Wait. Do not run `/savyre-next` again yourself.
2. After Task Input confirm, **do not speak leftover “I’ll write the Task Input draft for …”**. Write `ai-output.md` if `message` asks you to. Then run `turn`, talk from Assigned task, then speak `userMessage`. Wait. Do not invent “Draft is ready. If it looks right.” Do not send the user to the Savyre panel for `/savyre-next`.
3. If generate-final failed, the guard already tried one Open Questions repair. Do not ask them to lock again unless `userMessage` says so.
4. Chat cannot unlock. Do not claim the next stage is accepted.
