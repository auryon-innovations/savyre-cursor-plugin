---
name: savyre-setup-tests
description: Install the Playwright test runner for Build & Review after the developer approves. Use when the user runs /savyre-setup-tests.
---

# savyre-setup-tests

Install the project's test runner (Playwright by default) so Build & Review can record real RED/GREEN runs. Savyre runs only fixed install commands for the detected stack (for example `npm install --save-dev @playwright/test` and `npx playwright install chromium`). This does not accept the stage.

This lifecycle command is allowed even while the lock is on. Do not install packages yourself and do not run the install commands directly.

Run from the project workspace root. Pass extra words after the command as arguments (`$ARGUMENTS`).

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" setup-tests $ARGUMENTS
```

On Windows PowerShell:

```bash
node "$env:USERPROFILE/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" setup-tests $ARGUMENTS
```

Do not add `yes` yourself. If they did not type `yes`, speak JSON `userMessage` (it lists the exact commands) and wait. They confirm by running `/savyre-setup-tests yes`.

After it finishes, speak JSON `userMessage`. Do not paste JSON. Then they run `/savyre-turn`.
