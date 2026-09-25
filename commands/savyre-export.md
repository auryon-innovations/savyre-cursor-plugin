---
name: savyre-export
description: Export the Savyre workflow HTML report and open it in the browser. Use when the user runs /savyre-export.
---

# savyre-export

Export the same HTML assessment/workflow report as **Export report** in the Savyre panel, then open it (Chrome preferred).

This is a **developer** action. Do not run it yourself unless they invoked this slash.

Run from the **project** workspace root:

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" export
```

On Windows PowerShell:

```bash
node "$env:USERPROFILE/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" export
```

On macOS/Linux:

```bash
node "$HOME/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" export
```

Optional flags (pass after `export`): `--no-open` (save only), `--default-browser` (skip Chrome preference).

## What to say

Speak JSON `userMessage` exactly. Do not paste JSON.

- On success: tell them the report path (`savyre/workflow-report.html`) and that it opened in the browser.
- On failure: speak `userMessage` (install CLI or use panel Export report). Do not invent a report.
- This does **not** end the session or unlock stages. Complete workflow stays in the panel if they need that.
