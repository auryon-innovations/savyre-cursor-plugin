---
name: savyre-stage-implementation-plan
description: "Produce and review a technical implementation plan and task backlog in Savyre S03 or an explicitly requested plan preview. Use after requirements/discovery for task sequencing and approval; not creating new product requirements, executing tasks or generating tests."
---

# S03 — Implementation Plan

## Boundary and inputs
Read `references/runtime-boundary.md` before managed or preview work. This package is a primary stage skill; compatible internal reusable roles assist it but do not replace its owner. In managed mode, check the verified active stage matches S03; mismatched/legacy context needs runtime mapping, not silent bypass.

- Validated S01 contract/stories/criteria and S02 grounded impact report
- Current source evidence, existing backlog schema and approved constraints

## Reusable skill invocation
Read `references/invocation-map.md` before selecting a dedicated/shared pass. S01 uses savyre-requirement-challenge after analyzed draft; S02 uses savyre-evidence-grounding after discovery before impact. Cross-stage consumers run only when their runtime records/checkpoint are present. Managed invocation requires registered compatible package and delegated pass; missing assignment/availability is a diagnostic or explicit runtime fallback, not proof a call ran. The primary remains the stage owner; do not call savyre-run-stage recursively.

## Procedure

1. Choose a repository-specific approach within confirmed scope; explain consequential trade-offs with evidence rather than force irrelevant alternatives or effort numbers. Material product decisions return to S01.
2. Create an approved, executable backlog with stable runtime-issued IDs, requirement/story refs or technical justification, file scope, dependencies and done checks. Preserve existing IDs and use the frozen backlog schema: FS-### for FUNCTIONAL_STORY, NFR-### for NON_FUNCTIONAL_STORY, TT-### for TECHNICAL_TASK and the schema-approved test-task prefix for TEST_TASK (do not assert TEST-### if the runtime uses another prefix). A backlog NFR-### and an S01 NFR-### have different identities: always qualify references by artifact/type. Trace FS/NFR items to approved S01 requirements; use TT dependencies or technical justification for implementation work. New product requirements return to S01. Never renumber or recycle IDs during rework.
3. Describe verification approach, relevant risks and rollback where applicable. Detailed case strategy belongs to S05. Do not include source implementation or claim test files were generated.
4. Check narrative/backlog agreement; request explicit approval of the exact plan/backlog revision before implementation. Missing optional docs are labeled; verified authoritative method delivery can replace absent MCP.

## Output contract
Produce a concise response with outcome, material question/blocker if any and the verified next action. Detailed content belongs in the assigned draft `implementation_plan.md` or returned preview content when no writer is delegated.

Draft sections: **Approach and Rationale; Implementation Tasks; Dependencies and Sequence; Requirement Traceability; Done Checks; Verification Approach; Relevant Risks and Rollback; Approval Needed**. Omit irrelevant optional detail rather than fill generic sections with invented facts. Structured supporting artifacts: **implementation_backlog.json**.

Required supporting content: Executable backlog items/sourceRequirementRefs or justification; file scope/dependencies/order/done checks; compatible schema and runtime approval ref. No invented IDs/schema enforcement.

Confirmation boundary: Explicit authoritative backlog approval; editing scope invalidates downstream work.

Final handoff: Runtime final.md must agree with the approved backlog and supplies S04; planning stays read-only to application code.

## Completion check
Before submission check traceability to supplied/observed facts, unresolved questions, current bindings, action permissions and declared writer. Leave missing/unavailable/stale states explicit. Never edit developer_review.md responses, runtime approval metadata or final.md to manufacture completion.
