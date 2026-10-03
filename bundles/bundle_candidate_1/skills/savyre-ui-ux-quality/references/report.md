# Result contract

Return a structured record alongside a concise user-readable summary. Managed destinations and record IDs are assigned by runtime; do not invent a second canonical evidence tree.

Required fields:
- `skill`: savyre-ui-ux-quality; `skill_version`: 1.0.0; `mode`: build or review.
- `binding`: execution ID, stage/pass ID, backlog item IDs, source revision or workspace content fingerprint, preview/build identity. Use null plus explanation for unavailable identifiers; label standalone output unbound.
- `applicability`: required boolean, reason, decision evidence from brief/plan/diff.
- `scope`: screens, journeys, requirements, viewport targets and exclusions.
- `mockup`: treatment (none/direct_preview/single_screen/clickable_journey), reason, initial count, refinement count, budget and any user-authorized override.
- `checks`: ID, criterion, required boolean, status (completed/failed/unavailable/not_applicable), evidence references, explanation.
- `findings`: ID, severity (critical/major/minor), affected area, expected/observed behavior, reproduction, impact, correction criteria, evidence, resolution (open/resolved) and verified revision.
- `evidence`: references to actual runtime-owned screenshots, test logs or interaction records, with source binding. Do not fabricate paths.
- `review`: outcome (pending/passed/fixes_required/unable_to_verify/not_applicable), reviewer type (self/independent), correction count, limitations. Build records use pending when review has not run; pending cannot satisfy a gate.
- `usage_refs`: existing runtime records, not re-added monetary totals.
- `next_action`: concrete permitted next step or missing prerequisite.

Report unavailable fields honestly. Preserve original findings and attach resolution evidence rather than deleting failure history. Redact secrets and unnecessary sensitive data. Later source changes invalidate affected checks and resolved findings until reverified.
