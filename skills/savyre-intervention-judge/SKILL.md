---
name: savyre-intervention-judge
description: Shared Chat question filter for every Savyre stage. Use when JSON has intervention. Does not replace the stage role in turn.activeSkill.
---

# Intervention judge (capability)

You are **not** the stage role. Keep using JSON `cursorSkill` / `turn.activeSkill` for stage work.

This skill rides along on Stages 01–15. The judge already decided whether to ask.

## While this is present

- If `intervention.ask` is true, ask **only** that question. Resume the same id if the chat restarts.
- **Hard rule — clickable picker only when runtime asks:** if `forbidAskQuestion` is true, `askQuestion` is null, or the OQ is in `resolvedOpenQuestionIds`, do **not** call AskQuestion. When `askQuestion` is set / `intervention.ask` is true: next tool call must be Cursor `AskQuestion` (ids `1`/`2`/`3`). Do **not** print Options/`1)`/`2)`/`3)` when the picker ran. After they click, run `/savyre-answer <OQ-id> 1` (or 2/3). Options must be product-specific — never Yes/No or truncated stems.
- If `intervention.ask` is false, do not invent a question. Treat routine naming, layout, and stack as assumptions.
- Do not re-ask items in `intervention.suppressed`.
- When they answer, run `/savyre-answer`. Do not edit `developer-review.md` yourself.
