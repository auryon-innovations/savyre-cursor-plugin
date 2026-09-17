---
name: savyre-intervention-judge
description: "Consume a supplied Savyre intervention/question-filter decision before speaking a clarification question, or review a provided decision preview. Preserve chosen/suppressed question identities; not an LLM policy engine that invents answers, approves assumptions or replaces the stage role."
---

# Intervention Judge

## Role and inputs
Read `references/runtime-boundary.md` before work and `references/invocation-map.md` when selecting a pass or returning to its primary. This reusable consumer is not the active primary stage, an approval authority or a missing runtime producer. In managed mode use only assigned compatible context; in explicitly requested preview label proposed outputs unbound.

Inputs: Runtime intervention decision, stable pending/suppressed question IDs, current stage facts and resolved decisions.

## Procedure

1. If runtime ask=true present only the assigned material question, using its stable ID; combine explanation only if it clarifies the question without adding scope.
2. If ask=false do not invent a new question, but do not convert unasked stack/layout/behavior choices into confirmed requirements or accepted assumptions. An actual material conflict is reported to runtime for reconsideration, not silently suppressed.
3. Preserve suppressed/resolved question records; a missing question ID/content or inconsistent decision produces a diagnostic/question proposal to runtime.
4. Return human clarification/limitation, not an accepted decision. Runtime records developer answer and impact on artifacts.

## Output and handoff
Assigned question or no-question result with unresolved limitation and verified next action; no hidden assumption acceptance.

Artifact ownership: No developer_review/decision-log/state writer; runtime question/answer controls own those records.

Return to the assigned primary/runtime without recursively dispatching yourself or pretending an unavailable role/tool ran. Preserve developer feedback and canonical state. A clean analysis is advisory; current runtime permits/completes actions.
