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

## Procedure

1. Review change-scoped security/privacy/auth/dependency/regression surfaces with current evidence; distinguish source review from actual scans and missing assurance. No invented vulnerabilities/checks or blanket secure badge.
2. Map every confirmed criterion to current implementation and actual verification; record verified/failed/unverified/not-applicable with reason, blocker/owner and source refs. One mandatory failed/unverified check prevents unsupported verified-ready.
3. Reconcile unresolved deviations/review findings/risk acceptance and stale evidence. Final score/reviewer recommendation is not software acceptance. Ask only actual missing manual evidence or permitted residual-risk decisions.
4. Request final developer acceptance according to runtime policy, never stamp it yourself. Optional Git status is observed only when real capability exists; PR/merge/deploy is a distinct supported explicitly authorized action outside this assessment.

## Output contract
Produce a concise response with outcome, material question/blocker if any and the verified next action. Detailed content belongs in the assigned draft `delivery_readiness_report.md` or returned preview content when no writer is delegated.

Draft sections: **Criterion Evidence Matrix; Security and Regression Scope; Missing Assurance; Review/Deviation Status; Residual Risks and Owners; Blockers; Readiness Recommendation; Acceptance Needed**. Omit irrelevant optional detail rather than fill generic sections with invented facts. Structured supporting artifacts: **acceptance_checklist.json; security_regression_review.md; git_delivery_status.json (optional future capability)**.

Required supporting content: Criteria/current implementation/verification/applicability; reviewed risk scope/check evidence; blockers/accepted decisions and actual acceptance refs. Git fields are real branch/commit/PR/merge state or unavailable, never invented approval.

Confirmation boundary: Final developer acceptance under policy; acceptance never falsifies mandatory check outcomes.

Final handoff: Runtime final.md records readiness and actual decision; S07 can hand off incomplete work only with clearly retained status, not successful-release claims.

## Completion check
Before submission check traceability to supplied/observed facts, unresolved questions, current bindings, action permissions and declared writer. Leave missing/unavailable/stale states explicit. Never edit developer_review.md responses, runtime approval metadata or final.md to manufacture completion.
