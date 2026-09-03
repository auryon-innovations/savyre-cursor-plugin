---
name: savyre-stop
description: Clear the active Savyre execution manifest and return Cursor to idle. Use when the user asks to stop Savyre enforcement or runs /savyre-stop.
---

# savyre-stop

Turn the Stage 2 lock off. This does not accept the stage; only the Savyre extension records ACCEPTED.

Run from the workspace root:

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" stop
```

This lifecycle command is allowed even while enforced. After it succeeds, speak JSON `userMessage` if present (`The Savyre lock is off…`). Do not paste JSON. This does not accept the stage.
