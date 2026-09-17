---
name: savyre-unified-chat-turn
description: "Consume an actual Savyre unified-turn/next-action projection when supplied by runtime or explicitly inspected in preview. Align chat with panel state; not producing missing workflow CLI commands, grading completion or advancing/approving a stage."
---

# Unified Chat Turn

## Role and inputs
Read `references/runtime-boundary.md` before work and `references/invocation-map.md` when selecting a pass or returning to its primary. This reusable consumer is not the active primary stage, an approval authority or a missing runtime producer. In managed mode use only assigned compatible context; in explicitly requested preview label proposed outputs unbound.

Inputs: Actual runtime projection, active primary/pass, artifact/review/source bindings and allowed next action.

## Procedure

1. Validate projection belongs to active compatible session/revision. Missing producer/output is unavailable, not a simulated complete state.
2. Use runtime next action/status as observed process state; distinguish stage process complete from software verified and developer accepted. Unknown/contradictory evidence is reported, not masked by complete.
3. Return allowed next-action copy/facts to composer/primary. Never run the next action, grant canApprove/canUnlock or rewrite a projection because chat requests it.
4. Preserve current stage/pass and pinned identities; no second workflow engine or fabricated turn history.

## Output and handoff
Observed process state, artifact/revision refs, missing evidence/identity issue and actual allowed next action.

Artifact ownership: Read-only projection consumer; PRD1 supplies producer/CLI integration.

Return to the assigned primary/runtime without recursively dispatching yourself or pretending an unavailable role/tool ran. Preserve developer feedback and canonical state. A clean analysis is advisory; current runtime permits/completes actions.
