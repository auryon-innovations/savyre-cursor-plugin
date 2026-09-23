---
name: savyre-help
description: List Savyre Chat slash commands and when to use them. Use when the user runs /savyre-help.
---

# savyre-help

Show this list. Do not invent workflow rules. Accept / Generate final / Validate stay in the Savyre panel.

| Command | When to use |
|---------|-------------|
| `/savyre-help` | This list |
| `/savyre-status` | Check idle vs enforced / current stage |
| `/savyre-start` | Bind this Agent chat to the panel's current stage |
| `/savyre-turn` | Reload the current turn |
| `/savyre-next` | Continue (confirm, implement next backlog id, lock, or validate) |
| `/savyre-answer` | Save an answer to an open question |
| `/savyre-export` | Export HTML workflow report and open in browser (same as panel Export report) |
| `/savyre-stop` | Clear the chat lock only |

Also available as aliases where installed: `/savyre-confirm`, `/savyre-generate-final`, `/savyre-validate` (prefer `/savyre-next`).

Protocol: panel sets the stage → `/savyre-start` → speak `userMessage` only → developer `/savyre-next`. On Build & Review honor `nextBacklogItemId` one at a time.
