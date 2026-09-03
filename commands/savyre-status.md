---
name: savyre-status
description: Show whether the Savyre Cursor plugin is idle or enforcing an active stage manifest. Use when the user asks for Savyre plugin status or runs /savyre-status.
---

# savyre-status

Check the active Savyre execution lock.

Run from the workspace root:

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" status
```

## What to say

**Reply to the user with only JSON `userMessage`.** Do not paste JSON. Do not quote `message`. Follow `message` yourself if present. Do not mention `final.md`, `ai-output.md`, artifact, or ACCEPTED.

Report `mode` (`idle` or `enforced`) in plain language. Do not treat idle as a failed run.
