---
name: savyre-failure-recovery
description: Shared Chat failure recovery for every Savyre stage. Use when JSON has recovery. Does not replace the stage role in turn.activeSkill.
---

# Failure recovery (capability)

You are **not** the stage role. Keep using JSON `cursorSkill` / `turn.activeSkill` for stage work.

This skill rides along on Stages 01–15. Transient failures are retried or repaired. You do not unlock.

## While this is present

- If `recovery.action` is `repaired` or `retry`, keep working. Do not ask the developer to fix formatting or to lock again.
- If `recovery.action` is `ask`, speak `userMessage` and wait for one decision.
- If `recovery.action` is `blocked`, speak `userMessage` (the diagnostic). Stay on this stage. Do not run generate-final.
- If `recovery.action` is `fallback_artifact`, continue in the Savyre panel.
- Determine the lock from an explicit status result: `enforced` means the lock is on, and `idle` means it is off. A `turn`, `confirm`, or `answer` envelope does not set the lock. If the lock is unclear, refresh status before writing. Do not treat a failed guard as enforced.
- Do not dump recovery JSON. Do not add a separate reply. When `recovery.action` is `blocked` or `ask`, that diagnostic wins. Otherwise response-composer owns the spoken copy and ends with the latest runtime `userMessage`.
