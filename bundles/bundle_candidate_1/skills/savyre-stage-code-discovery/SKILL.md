---
name: savyre-stage-code-discovery
description: "Discover relevant application code and assess change impact in Savyre S02 or an explicitly requested discovery/impact preview. Use for evidence-linked file/component mapping and bounded risks; not requirement confirmation, solution planning or implementation."
---

# S02 — Code Discovery

## Boundary and inputs
Read `references/runtime-boundary.md` before managed or preview work. This package is a primary stage skill; compatible internal reusable roles assist it but do not replace its owner. In managed mode, check the verified active stage matches S02; mismatched/legacy context needs runtime mapping, not silent bypass.

- Validated S01 contract; current bounded application source/index and allowed repository scope
- Known docs/references if needed; prior source bindings and scan limits

## Reusable skill invocation
Read `references/invocation-map.md` before selecting a dedicated/shared pass. S01 uses savyre-requirement-challenge after analyzed draft; S02 uses savyre-evidence-grounding after discovery before impact. Cross-stage consumers run only when their runtime records/checkpoint are present. Managed invocation requires registered compatible package and delegated pass; missing assignment/availability is a diagnostic or explicit runtime fallback, not proof a call ran. The primary remains the stage owner; do not call savyre-run-stage recursively.

## Procedure

1. Read task-relevant existing index/source, refresh changed references through permitted retrieval and explain relevance. Optional structural search only for tested supported languages; text/file fallback remains useful.
2. Ground observed files/symbols/relationships with current evidence. Explicitly record scan boundaries/truncation; no application code means greenfield, not fictional stack. Separate docs, observation and inference.
3. Assess grounded affected surfaces, consequence, confidence and required checks; no database/auth impacts merely to fill a template. Do not turn impact into code or implementation plan.
4. Use optional existing Mermaid only for evidenced useful structure; diagrams/relationship tables share evidence and inference labels. Ask only material missing scope/access/contradictions; scope changes reopen S01 through runtime.

## Output contract
Produce a concise response with outcome, material question/blocker if any and the verified next action. Detailed content belongs in the assigned draft `codebase_impact_report.md` or returned preview content when no writer is delegated.

Draft sections: **Scope and Limitations; Relevant Files and Components; Observed Execution Relationships; Reuse; Affected Surfaces; Ranked Risks and Required Checks; Evidence; Material Questions**. Omit irrelevant optional detail rather than fill generic sections with invented facts. Structured supporting artifacts: **discovery_evidence.json; diagrams/<diagram_id>.mmd (optional)**.

Required supporting content: Current paths/symbols and evidence refs; relevant reasons; observed/inferred relationships; scan bounds/truncation/source freshness. Diagram contains valid Mermaid and no executable arbitrary links.

Confirmation boundary: No routine extra approval proposed; runtime completion policy applies.

Final handoff: Publish only after grounding/defined validation; final.md supplies S03 with bounded evidence, not repository-wide absence claims.

## Completion check
Before submission check traceability to supplied/observed facts, unresolved questions, current bindings, action permissions and declared writer. Leave missing/unavailable/stale states explicit. Never edit developer_review.md responses, runtime approval metadata or final.md to manufacture completion.
