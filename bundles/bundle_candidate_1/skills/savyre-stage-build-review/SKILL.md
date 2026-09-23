---
name: savyre-stage-build-review
description: "Implement an approved task backlog and reconcile/review actual changes in Savyre S04, or inspect a changes-only preview. Use for authorized source/test corrections and independent code review; not bypassing plan approval, inventing run passes or performing merge/deployment."
---

# S04 — Build & Review

## Boundary and inputs
Read `references/runtime-boundary.md` before managed or preview work. This package is a primary stage skill; compatible internal reusable roles assist it but do not replace its owner. In managed mode, check the verified active stage matches S04; mismatched/legacy context needs runtime mapping, not silent bypass.

- Approved S03 backlog/final, current source and action-level permission context
- Actual task/status/diff records and authorized project validation tools

## Reusable skill invocation
Read `references/invocation-map.md` before selecting a dedicated/shared pass. S01 uses savyre-requirement-challenge after analyzed draft; S02 uses savyre-evidence-grounding after discovery before impact. Cross-stage consumers run only when their runtime records/checkpoint are present. Managed invocation requires registered compatible package and delegated pass; missing assignment/availability is a diagnostic or explicit runtime fallback, not proof a call ran. The primary remains the stage owner; do not call savyre-run-stage recursively.

## Procedure

1. Require approved task scope and an allowed write action before edits. Work **one** independently executable approved S03 backlog item this turn — the id in JSON `nextBacklogItemId` / `userMessage` when present. Do not implement later backlog ids in the same turn. Respect dependencies and action scope; test creation/corrections from S05 are linked authorized implementation items. Do not expand suite/features without approval. After that item's source + `change_report.md` for **that id only**, run `turn`, then speak `userMessage` exactly. If `userMessage` / JSON still has a `nextBacklogItemId`, the next action is implement that id — **never** say lock Build & Review while backlog items remain. Only when `userMessage` asks to check the report and lock (no next id) may you direct `/savyre-next` to lock.
2. Apply actual source changes only through permitted tools; preserve existing work. If mode denies source writes/shell, return the limitation or route to supported runtime instead of bypassing restrictions. Code in chat is not applied implementation.
3. For each independently executed backlog item, use one runtime-owned `tasks/<backlog_item_id>/` record folder; preserve existing item IDs (including FS/NFR/TT/test-item IDs) and explicitly migrate legacy slugged folders. Record item metadata, source/action binding, actual changes, status and evidence there. Link each item to its S01 requirement/user-story/criterion refs with artifact-qualified IDs; do not create a second `stories/` or `requirements/` evidence tree, copy application source into the item folder or create folders for unexecuted S01 stories alone. Reconcile planned items with actual changed/untracked/added/deleted paths, done-check evidence and deviations. Separate applied/partial/blocked/verified. Run project checks only through an allowed runtime action; no optional tool installations.
4. Review current changes in a distinct read-only pass, optionally using a compatible assigned reviewer. Produce precise trigger/consequence/evidence/location findings, merge duplicates and allow zero findings. Declare self-review limits when no independent reviewer; never present it as independent.
5. Proposed fixes need permitted implementation/rework action; material deviation reopens S03/S01. Invalidate impacted source/review/run bindings through runtime.

## Output contract
Produce a concise response with outcome, material question/blocker if any and the verified next action. Detailed content belongs in the assigned draft `change_report.md` or returned preview content when no writer is delegated.

Draft sections: **Actual Changes and Task Status; Plan Reconciliation; Validation Observed; Independent/Self Review Scope; Findings; Deviations and Blockers; Evidence and Next Action**. Omit irrelevant optional detail rather than fill generic sections with invented facts. Structured supporting artifacts: **implementation_status.json/md; code_review.md; code_review_findings.json; tasks/<backlog_item_id>/task_summary.md/task_metadata.json**. Command logs and detailed run evidence stay in runtime-owned run records; item metadata references them. Stage-level files aggregate item states from the same revisions.

Required supporting content: Actual task state/source/action evidence; readable status derived from same JSON revision; findings ID/severity/current location/trigger/consequence/check/resolution refs. Source files remain deliverable; change report is derived, not a new ai-output.md implementation authority.

Confirmation boundary: No approval per edit; existing authorization applies. Reapprove material deviations; reviewer cannot self-accept or authorize its proposed fixes.

Final handoff: Runtime final.md records reviewed implementation outcome/source/evidence; applied changes are not verified completion. S05 receives current source/review/task records.

## Completion check
Before submission check traceability to supplied/observed facts, unresolved questions, current bindings, action permissions and declared writer. Leave missing/unavailable/stale states explicit. Never edit developer_review.md responses, runtime approval metadata or final.md to manufacture completion.
