---
name: savyre-failure-recovery
description: "Consume a runtime-reported Savyre recovery decision after a stage/tool/format failure, or analyze a supplied recovery-record preview. Follow bounded permitted retry/repair/ask/blocked/fallback; not granting write permissions, bypassing guards or clearing failed tests."
---

# Failure Recovery

## Role and inputs
Read `references/runtime-boundary.md` before work and `references/invocation-map.md` when selecting a pass or returning to its primary. This reusable consumer is not the active primary stage, an approval authority or a missing runtime producer. In managed mode use only assigned compatible context; in explicitly requested preview label proposed outputs unbound.

Inputs: Actual failure record, runtime recovery action/budget, allowed tools/writer scope, active primary/pass and observed outputs.

## Procedure

1. For permitted retry/repair follow the supplied bounded action/budget once per actual attempt; stop when budget exhausted or unclear. Repeated recursion does not create authority.
2. For ask resume only the specified stable question; for blocked report actual reason and stay blocked; for verified fallback route only to available approved runtime path. No fallback exporter/CLI is presumed to exist.
3. Preserve rejected/failed evidence and actual task state; repair formatting only when delegated and never turn failing criteria into passes.
4. Return recovery outcome or unresolved diagnostic to primary/runtime; no source/shell/delegation/Git/external actions beyond separately recorded permission.

## Output and handoff
Recovery action attempted/proposed, actual result if observed, remaining budget/blocker, preserved evidence and actual next action.

Artifact ownership: Runtime owns diagnostics/history/state; no automatic final/approval writer.

Return to the assigned primary/runtime without recursively dispatching yourself or pretending an unavailable role/tool ran. Preserve developer feedback and canonical state. A clean analysis is advisory; current runtime permits/completes actions.
