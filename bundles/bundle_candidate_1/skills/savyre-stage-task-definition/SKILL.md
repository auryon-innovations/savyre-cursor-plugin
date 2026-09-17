---
name: savyre-stage-task-definition
description: "Define and analyze a software task in Savyre S01 or an explicitly requested task-brief preview, returning requirements, applicable user stories and acceptance criteria for one final confirmation. Use for intake clarification and requirement challenge; not technical planning, code changes or delivery acceptance."
---

# S01 — Task Definition

## Boundary and inputs
Read `references/runtime-boundary.md` before managed or preview work. This package is a primary stage skill; compatible internal reusable roles assist it but do not replace its owner. In managed mode, check the verified active stage matches S01; mismatched/legacy context needs runtime mapping, not silent bypass.

- Original task and supplied references; project metadata and existing decisions
- In managed mode use the runtime draft-analysis path; analysis cannot require an already-approved S01 final

## Reusable skill invocation
Read `references/invocation-map.md` before selecting a dedicated/shared pass. S01 uses savyre-requirement-challenge after analyzed draft; S02 uses savyre-evidence-grounding after discovery before impact. Cross-stage consumers run only when their runtime records/checkpoint are present. Managed invocation requires registered compatible package and delegated pass; missing assignment/availability is a diagnostic or explicit runtime fallback, not proof a call ran. The primary remains the stage owner; do not call savyre-run-stage recursively.

## Procedure

1. Capture exact designated original task separately from a helpful restatement; distinguish product requirements from workflow instructions.
2. Extract supported requirements and observable criteria; include user stories only when actor/value helps feature work. Link story/criterion to requirement/source; technical fixes need no forced story.
3. Challenge for contradictions, inferred features, vague acceptance or unaccepted assumptions. Ask one material blocking question at a time with stable runtime IDs; reuse resolved decisions. Do not ask routine questions unrelated to the task.
4. Revise analyzed brief after answers, then request one final confirmation of the current complete contract. Reopened scope creates a new draft/revision.

## Output contract
Produce a concise response with outcome, material question/blocker if any and the verified next action. Detailed content belongs in the assigned draft `task_brief.md` or returned preview content when no writer is delegated.

Draft sections: **Original Task; Understanding; Requirements; User Stories (if applicable); Acceptance Criteria; Constraints and Exclusions; Proposed/Accepted Assumptions; Decisions and Open Questions; Confirmation Needed**. Omit irrelevant optional detail rather than fill generic sections with invented facts. Structured supporting artifacts: **task_contract.json**.

Required supporting content: Original text; stable requirement/story/criterion/source links; constraints/exclusions; confirmed decisions and explicitly accepted assumptions; runtime confirmation/final revision refs. Preview payload has no fabricated approved state.

Confirmation boundary: Request one final S01 task-contract confirmation after analysis/challenge; no confirmation is implied by the draft.

Final handoff: After required task confirmation/validation, runtime publishes final.md and contract projection for S02/S03. Unanswered material question remains unapproved.

## Completion check
Before submission check traceability to supplied/observed facts, unresolved questions, current bindings, action permissions and declared writer. Leave missing/unavailable/stale states explicit. Never edit developer_review.md responses, runtime approval metadata or final.md to manufacture completion.
