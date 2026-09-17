---
name: savyre-stage-handoff
description: "Summarize current delivery and prepare selected portable artifacts in Savyre S07 or an explicitly requested handoff draft. Use for teammate-facing outcome/export selection; not reopening requirements, claiming unmeasured ROI or sending/publishing/deploying content."
---

# S07 — Handoff

## Boundary and inputs
Read `references/runtime-boundary.md` before managed or preview work. This package is a primary stage skill; compatible internal reusable roles assist it but do not replace its owner. In managed mode, check the verified active stage matches S07; mismatched/legacy context needs runtime mapping, not silent bypass.

- Current S06 readiness/acceptance and selected approved stage/source/run refs
- Existing permitted-share policy and available export capability

## Reusable skill invocation
Read `references/invocation-map.md` before selecting a dedicated/shared pass. S01 uses savyre-requirement-challenge after analyzed draft; S02 uses savyre-evidence-grounding after discovery before impact. Cross-stage consumers run only when their runtime records/checkpoint are present. Managed invocation requires registered compatible package and delegated pass; missing assignment/availability is a diagnostic or explicit runtime fallback, not proof a call ran. The primary remains the stage owner; do not call savyre-run-stage recursively.

## Procedure

1. Summarize actual changes/verification/remaining work and next steps; use real evidence and observed Git references only. Separate optional evaluator/process detail from software outcome. Incomplete remains incomplete.
2. Offer permitted selection/default exclusions; raw prompts/source/telemetry/secrets/diagnostics are excluded by default. Prose/reviews/logs/diagrams can contain sensitive text too. Do not invent a new privacy policy.
3. Draft delivery_summary.md and proposed handoff_manifest.json referencing selected artifact/revisions/relative package paths, omissions and limitations. Runtime finalizes summary before ZIP export; no final/ZIP circular dependency.
4. Use existing authorized exporter only when available; relative paths/assets work offline, no author-machine URLs. If exporter absent return manifest/content plan and unavailable status, not a fictional ZIP. Local package creation is not authority to email/upload/publish/deploy/merge.

## Output contract
Produce a concise response with outcome, material question/blocker if any and the verified next action. Detailed content belongs in the assigned draft `delivery_summary.md` or returned preview content when no writer is delegated.

Draft sections: **Outcome; Actual Changes; Verification and Readiness; Limitations and Remaining Work; Next Steps; Selected Handoff Contents; Optional Process Detail**. Omit irrelevant optional detail rather than fill generic sections with invented facts. Structured supporting artifacts: **handoff_manifest.json; exports/<export_id>/ package (runtime/exporter)**.

Required supporting content: Actual selected IDs/revisions/hashes when supplied; package-relative paths/assets; omissions/policy/version and truthful status. Unknown identities stay unbound in preview.

Confirmation boundary: Content selection/export per existing policy; external delivery requires explicit applicable authorization.

Final handoff: Runtime final.md is finalized summary; authorized export produces index.html/reports/assets/ZIP with selection manifest and status preserved.

## Completion check
Before submission check traceability to supplied/observed facts, unresolved questions, current bindings, action permissions and declared writer. Leave missing/unavailable/stale states explicit. Never edit developer_review.md responses, runtime approval metadata or final.md to manufacture completion.
