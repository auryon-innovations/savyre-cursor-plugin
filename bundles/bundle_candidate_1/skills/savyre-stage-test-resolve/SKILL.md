---
name: savyre-stage-test-resolve
description: "Discover tests, plan checks and analyze authorized execution/diagnosis in Savyre S05 or a verification-report preview. Use for real criterion-linked validation, failures and rerun coordination; not source writes, fabricating test outcomes or assuming browser/framework-specific tools."
---

# S05 — Test & Resolve

## Boundary and inputs
Read `references/runtime-boundary.md` before managed or preview work. This package is a primary stage skill; compatible internal reusable roles assist it but do not replace its owner. In managed mode, check the verified active stage matches S05; mismatched/legacy context needs runtime mapping, not silent bypass.

- Approved criteria/backlog; current source/review; real test/config/fixture assets
- Actual authorized run records or labeled manual evidence; recorded strategy approval/delegation

## Reusable skill invocation
Read `references/invocation-map.md` before selecting a dedicated/shared pass. S01 uses savyre-requirement-challenge after analyzed draft; S02 uses savyre-evidence-grounding after discovery before impact. Cross-stage consumers run only when their runtime records/checkpoint are present. Managed invocation requires registered compatible package and delegated pass; missing assignment/availability is a diagnostic or explicit runtime fallback, not proof a call ran. The primary remains the stage owner; do not call savyre-run-stage recursively.

## AC verification matrix (required)

- Include **every active approved AC** from the S01 contract version, even if no check exists yet. Missing checks are `unverified`, not pass.
- Build a criterion-to-check matrix with expected results, current run/manual-evidence refs, and status (`passed` | `failed` | `blocked` | `unverified`).
- Aggregate precedence when mixed: failed → blocked → unverified → passed.
- Failed, blocked, skipped, stale, or unexecuted required checks prevent claiming S05 complete. Narrative-only claims are not evidence.
- Historical failures remain visible after successful reruns; current applicable results determine readiness.
- **S05 does not create or edit executable tests, test config, or app source.** Propose missing/updated checks; execute approved edits only through an authorized **S04** rework item, then rerun here.

## Procedure

1. Inventory observed tests/helpers/commands and setup/scan limitations. Test existence is not pass/coverage; do not prescribe a new framework.
2. Plan reuse/update/new/manual cases with criterion refs, setup/input/expected assertion/priority and gaps. Request strategy approval unless an explicit existing delegation covers the exact strategy; no repeated consent for already-authorized reruns.
3. New/updated tests are proposals routed to an authorized S04 task; do not create test files from strategy/diagnosis. Execute project-defined commands only through permitted runtime action, working scope/limits and available tool; otherwise consume existing evidence or report not-run.
4. Analyze actual run results with source/config/time/command/exit/assertion/criteria bindings. Distinguish unavailable/manual/stale/failure; no exit0-without-assertions acceptance.
5. Diagnose real failure with supporting/falsifying evidence and bounded hypotheses; keep probable versus confirmed cause. Propose smallest scope correction and rerun targets. Route authorized correction to S04, refresh affected reviews/runs; do not delete tests for a pass.

## Output contract
Produce a concise response with outcome, material question/blocker if any and the verified next action. Detailed content belongs in the assigned draft `verification_report.md` or returned preview content when no writer is delegated.

Draft sections: **Observed Test Assets; Approved/Proposed Strategy; Criterion-to-Check Matrix; Actual Run Ledger; Failures and Diagnosis; Authorized Correction References; Rerun Evidence; Missing/Stale/Manual Checks**. Omit irrelevant optional detail rather than fill generic sections with invented facts. Structured supporting artifacts: **test_inventory.json; test_plan.json; diagnosis_report.md (conditional); correction_log.json (conditional)**.

Required supporting content: Observed real assets/commands; cases stable IDs/action/criteria/setup/assertion/approval; diagnosis hypotheses/evidence; correction proposal/action/source/rerun refs. Runtime evidence/runs/<run_id> holds canonical run_metadata.json/execution.log; stages reference it rather than duplicate passes.

Confirmation boundary: Approve strategy or use explicit recorded delegation; required new execution/write authority is distinct from analysis.

Final handoff: Runtime final.md preserves actual verification including unresolved failures; failed evidence cannot be cleared by a report. S06 consumes fresh run/review/criterion mapping.

## Completion check
Before submission check traceability to supplied/observed facts, unresolved questions, current bindings, action permissions and declared writer. Leave missing/unavailable/stale states explicit. Never edit developer_review.md responses, runtime approval metadata or final.md to manufacture completion.
