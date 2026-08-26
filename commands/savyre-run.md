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

2. Report the script's JSON output to the user.
3. Say **Enforced** only if `mode` is `enforced`. Do not claim the stage is accepted.
4. Do not write Savyre methodology. Do not edit application source files.
