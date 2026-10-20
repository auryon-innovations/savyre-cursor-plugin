---
name: savyre-stage-delivery-readiness
description: "Assess security/regression and final criterion evidence in Savyre S06 or a readiness preview. Use for acceptance blockers/residual risks and final delivery review; not code review fixes, security certification, Git merge or deployment authorization."
---

# S06 — Delivery Readiness

## Boundary and inputs
Read `references/runtime-boundary.md` before managed or preview work. This package is a primary stage skill; compatible internal reusable roles assist it but do not replace its owner. In managed mode, check the verified active stage matches S06; mismatched/legacy context needs runtime mapping, not silent bypass.

- Approved task/plan, current source/change/review and fresh S05 verification
- Observed security/regression checks, residual-risk decisions and required completion policy

## Reusable skill invocation
Read `references/invocation-map.md` before selecting a dedicated/shared pass. S01 uses savyre-requirement-challenge after analyzed draft; S02 uses savyre-evidence-grounding after discovery before impact. Cross-stage consumers run only when their runtime records/checkpoint are present. Managed invocation requires registered compatible package and delegated pass; missing assignment/availability is a diagnostic or explicit runtime fallback, not proof a call ran. The primary remains the stage owner; do not call savyre-run-stage recursively.

## Mermaid preview

When this stage writes a fenced mermaid diagram, the markdown preview must be able to draw it. Use camelCase node ids. Put every label in double quotes. Do not use underscores, parentheses, or colons anywhere in the diagram. Write `env file` instead of an env filename, and `MONGO URI` instead of a name that contains an underscore. Edge labels are short words with no colon, such as `-->|connected|`.

## Procedure

1. Review change-scoped security/privacy/auth/dependency/regression surfaces with current evidence; distinguish source review from actual scans and missing assurance. No invented vulnerabilities/checks or blanket secure badge.
2. Map every confirmed criterion to current implementation and actual verification; record verified/failed/unverified/not-applicable with reason, blocker/owner and source refs. One mandatory failed/unverified check prevents unsupported verified-ready.
3. Reconcile unresolved deviations/review findings/risk acceptance and stale evidence. Final score/reviewer recommendation is not software acceptance. Ask only actual missing manual evidence or permitted residual-risk decisions. Never mark a finding resolved or edit an earlier stage's report to clear it: an open major finding is fixed through its stage, or the developer accepts it with the editor command **Savyre: Accept Risk**; critical findings must be fixed. Stale or unverified criterion checks are re-run by the developer's `/savyre-next`, not by you.
4. Request final developer acceptance according to runtime policy, never stamp it yourself. Optional Git status is observed only when real capability exists; PR/merge/deploy is a distinct supported explicitly authorized action outside this assessment.

## Production-level quality (app only — no deploy/ops)
Assess security (authz, secrets, input), accessibility basics, basic perf of primary flows, privacy of data handling, and **known gaps**. For user-facing UI, compare the built screen to the approved design artifact when one exists (preview.html, images, or Canvas, whichever S04 used; otherwise repository conventions) and to that item’s UI `AC-###` (type, color, spacing, photos, words, layout, motion, empty, loading, and error states, including the narrow one-column layout and a first view that shows the main action). A green functional test alone does not pass the UI. Do not require deployment, monitoring, backups, or incident runbooks. One mandatory failed/unverified critical check prevents “ready.” Current `savyre-ui-ux-quality` outcome must be `passed` or justified `not_applicable`; `pending`, `fixes_required`, `unable_to_verify`, unknown, or stale evidence do not satisfy readiness.

## Output contract
Produce a concise response with outcome, material question/blocker if any and the verified next action. Detailed content belongs in the assigned draft `delivery_readiness_report.md` or returned preview content when no writer is delegated.

Draft sections: **Criterion Evidence Matrix; Security and Regression Scope; Missing Assurance; Review/Deviation Status; Residual Risks and Owners; Blockers; Readiness Recommendation; Acceptance Needed**. Validate requires Criterion Evidence Matrix, Security and Regression Scope, Missing Assurance, Blockers, Readiness Recommendation and Acceptance Needed; name every open major review finding by id under Blockers or Residual Risks. Omit irrelevant optional detail rather than fill generic sections with invented facts. Write security/regression analysis inside the report, not a separate file. The runtime derives `acceptance_checklist.json` from current evidence on Validate; do not write it. `git_delivery_status.json` is an optional future capability.

Required supporting content: Criteria/current implementation/verification/applicability; reviewed risk scope/check evidence; blockers/accepted decisions and actual acceptance refs. Git fields are real branch/commit/PR/merge state or unavailable, never invented approval.

Confirmation boundary: Final developer acceptance under policy; acceptance never falsifies mandatory check outcomes.

Final handoff: Runtime final.md records readiness and actual decision; S07 can hand off incomplete work only with clearly retained status, not successful-release claims.

## Completion check
Before submission check traceability to supplied/observed facts, unresolved questions, current bindings, action permissions and declared writer. Leave missing/unavailable/stale states explicit. Never edit developer_review.md responses, runtime approval metadata or final.md to manufacture completion.
