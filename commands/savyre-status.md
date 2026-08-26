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

Report `mode` (`idle` or `enforced`), `stageId`, `executionId`, and `expiresAt` from the JSON. Do not treat idle as a failed run.
