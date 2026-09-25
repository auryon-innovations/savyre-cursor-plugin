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

## Hybrid acceptance criteria (required)

- **AI drafts** observable AC (`AC-###`) linked to `FR-###` / `NFR-###`; **human must approve** the exact contract version before freeze.
- Each AC needs a stable ID, requirement refs, observable action/outcome, and an objectively assessable expected result. Avoid unmeasurable terms without an agreed check.
- Identify assumptions as proposals; challenge vague, missing, or inferred acceptance. Ask one material blocking question at a time.
- **Do not write executable tests** in S01 (no test files, no claiming tests were generated). AC are the product contract; tests come in S04.
- Never recycle AC IDs. Revised wording for the same outcome keeps the ID and gets a new contract version. Removed AC stay as retired history; new outcomes get new IDs.
- Do not silently add product scope. Human confirmation refers to an exact contract version/hash; editing the contract invalidates that approval for the edited version.

## Procedure

1. Capture exact designated original task separately from a helpful restatement; distinguish product requirements from workflow instructions.
2. Extract supported requirements and observable criteria; include user stories only when actor/value helps feature work. Link story/criterion to requirement/source; technical fixes need no forced story.
3. Challenge for contradictions, inferred features, vague acceptance or unaccepted assumptions. Ask one material blocking question at a time with stable runtime IDs; reuse resolved decisions. Do not ask routine questions unrelated to the task.
4. Revise analyzed brief after answers, then request one final confirmation of the current complete contract. **Call out Acceptance Criteria by ID** and ask the developer to approve that exact AC set before lock. Reopened scope creates a new draft/revision.

## Output contract
Produce a concise response with outcome, material question/blocker if any and the verified next action. Detailed content belongs in the assigned draft `task_brief.md` or returned preview content when no writer is delegated.

Draft sections: **Original Task; Understanding; Requirements; User Stories (if applicable); Acceptance Criteria; Constraints and Exclusions; Proposed/Accepted Assumptions; Decisions and Open Questions; Confirmation Needed**. Omit irrelevant optional detail rather than fill generic sections with invented facts. Structured supporting artifacts: **task_contract.json**.

Required supporting content: Original text; stable requirement/story/criterion/source links; constraints/exclusions; confirmed decisions and explicitly accepted assumptions; runtime confirmation/final revision refs. Preview payload has no fabricated approved state.

Confirmation boundary: After the draft lists every active **AC-###**, speak `userMessage` and explicitly ask the developer to **approve those acceptance criteria** (exact wording/IDs), not only the overall brief. One final S01 task-contract confirmation after analysis/challenge; no confirmation is implied by the draft. Chat cannot stamp approval or unlock the stage. In your own 1–2 substance sentences before `userMessage`, name the AC IDs (e.g. AC-001…AC-00N) and ask whether that set is approved.

Final handoff: After required task confirmation/validation, runtime publishes final.md and contract projection for S02/S03. Unanswered material question remains unapproved.

## Completion check
Before submission check traceability to supplied/observed facts, unresolved questions, current bindings, action permissions and declared writer. Leave missing/unavailable/stale states explicit. Never edit developer_review.md responses, runtime approval metadata or final.md to manufacture completion.
