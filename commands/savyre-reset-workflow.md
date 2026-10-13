---
name: savyre-reset-workflow
description: Clear all seven Savyre stages and return to Task Definition. Use when the user runs /savyre-reset-workflow.
---

# savyre-reset-workflow

Clear all seven stages and return to Task Definition. App code and git history stay. This does not accept the stage.

This lifecycle command is allowed even while the lock is on. Do not delete stage files yourself.

Run from the project workspace root. Pass extra words after the command as arguments (`$ARGUMENTS`).

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" reset-workflow $ARGUMENTS
```

On Windows PowerShell:

```bash
node "$env:USERPROFILE/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" reset-workflow $ARGUMENTS
```

Do not add `yes` yourself. If they did not type `yes`, speak JSON `userMessage` and wait. They confirm by running `/savyre-reset-workflow yes`.

After it succeeds, speak JSON `userMessage`. Do not paste JSON. Then they run `/savyre-start`.
