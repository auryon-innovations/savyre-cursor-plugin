---
name: savyre-run
description: Activate a Savyre Requirement Analysis execution from the local fixture permission slip. Use when the user asks to start Savyre analysis enforcement or runs /savyre-run.
---

# savyre-run

Activate the Stage 2 (Requirement Analysis) permission slip in this workspace.

1. Run this command from the workspace root (not from the plugin folder):

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" run
```

On macOS/Linux use `$HOME/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs`.

If this repo is checked out, you may run `hooks/savyre-guard.mjs` from `savyre-cursor-plugin` instead.

## What to say

**Reply to the user with only JSON `userMessage` if present.** Otherwise say the lock is on only if `mode` is `enforced`. If JSON `unifiedTurn` is present, that next action matches the Savyre panel — do not invent another. Do not paste JSON. Do not mention `final.md`, `ai-output.md`, artifact, or ACCEPTED.

2. Do not claim the stage is accepted.
3. Do not write Savyre methodology. Do not edit application source files.
