# Result contract

Return a structured record alongside a concise user-readable summary. Managed destinations and record IDs are assigned by runtime; do not invent a second canonical evidence tree.

**Canonical write path (S04):** `stages/s04_build_review/tasks/<backlog_item_id>/ui_ux_report.json` (source of truth — keep it). Also write a human companion `stages/s04_build_review/tasks/<backlog_item_id>/ui_ux_report.md` derived from that JSON (do not drop the JSON). Also update `stages/s04_build_review/ui_ux_status.json` when the stage status projection is required. Never write the report to repo-root `tasks/<id>/`.

Required fields:
- `skill`: savyre-ui-ux-quality; `skill_version`: 1.1.2; `mode`: build or review.
- `binding`: execution ID, stage/pass ID, backlog item IDs, source revision or workspace content fingerprint, preview/build identity. Use null plus explanation for unavailable identifiers; label standalone output unbound.
- `applicability`: required boolean, reason, decision evidence from brief/plan/diff.
- `scope`: screens, journeys, requirements, viewport targets and exclusions.
- `mockup`: treatment (`canvas` **first** for substantial screens; `none` for small edits; `image_set` only when Canvas unavailable; legacy preview types), `designMedium` (`canvas` / `images` / `code_preview` / `none`), optional `canvasRef`, optional `designImageRels` (image fallback: PNG + optional `preview.html`), portable `designBrief`, and `designCheckpoint` (`not_required` for trivial edits). Product UI must not proceed while `awaiting_human` or `changes_requested`. Canvas OK is not stage acceptance.
- Optional `componentStrategy`, `uiImplementationProfile`, `designSpecification`, `feedbackDecisions` — required for substantial UI so work can resume without Canvas/MCP.
- `checks`: ID, criterion, required boolean, status (completed/failed/unavailable/not_applicable), evidence references, explanation. Review mode must include `CHK-BROWSER-PREVIEW` (required). Complete it only with Playwright MCP / live preview evidence — never with AC RED/GREEN alone.
- `findings`: ID, severity (critical/major/minor), affected area, expected/observed behavior, reproduction, impact, correction criteria, evidence, resolution (open/resolved) and verified revision.
- `evidence`: references to actual runtime-owned screenshots, test logs or interaction records, with source binding. Do not fabricate paths.
- `review`: outcome (pending/passed/fixes_required/unable_to_verify/not_applicable), reviewer type (self/independent), correction count, limitations. Build records use pending when review has not run; pending cannot satisfy a gate.
- `usage_refs`: existing runtime records, not re-added monetary totals.
- `next_action`: concrete permitted next step or missing prerequisite.

Report unavailable fields honestly. Preserve original findings and attach resolution evidence rather than deleting failure history. Redact secrets and unnecessary sensitive data. Later source changes invalidate affected checks and resolved findings until reverified.
