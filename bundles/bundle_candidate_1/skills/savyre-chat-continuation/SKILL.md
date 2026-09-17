---
name: savyre-chat-continuation
description: "Consume a supplied Savyre continuation/resume record before resumed work, restoring the active stage/pass and pending question/action. Use for session resume previews too; not reconstructing missing task text from hashes, assigning new stages or creating approvals."
---

# Chat Continuation

## Role and inputs
Read `references/runtime-boundary.md` before work and `references/invocation-map.md` when selecting a pass or returning to its primary. This reusable consumer is not the active primary stage, an approval authority or a missing runtime producer. In managed mode use only assigned compatible context; in explicitly requested preview label proposed outputs unbound.

Inputs: Runtime resume record, pinned session/workflow/bundle/schema identities, actual referenced task/final artifacts, pending stable question/action and current source bindings.

## Procedure

1. Check record matches current session/stage/internal step and compatible bundle. Missing/conflicting record needs a diagnostic or explicit runtime rehydration, not invented chronology.
2. Treat originalTaskHash as fingerprint; retrieve exact wording from referenced approved artifact when available. If absent say wording unavailable rather than substitute hash or remembered paraphrase.
3. Resume the same pending question/action; reuse resolved decisions and suppressed questions. Do not mint an official ID or automatically answer it.
4. Return a resume summary/limitations and assigned primary/pass to runtime. Preserve pinned legacy behavior; neither continuation nor preview silently remaps old stage numbers.

## Output and handoff
Resumed references, pending-question/action state, actual task text availability, staleness/identity issues and verified next action.

Artifact ownership: No transcript/task/state writer; runtime performs rehydration and checkpoint transitions.

Return to the assigned primary/runtime without recursively dispatching yourself or pretending an unavailable role/tool ran. Preserve developer feedback and canonical state. A clean analysis is advisory; current runtime permits/completes actions.
