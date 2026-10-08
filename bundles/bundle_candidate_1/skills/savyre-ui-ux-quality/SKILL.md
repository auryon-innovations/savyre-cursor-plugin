---
name: savyre-ui-ux-quality
description: "Design, build, mock up, or review user-facing web screens and interactions in Savyre. Use for visual changes, navigation, validation, feedback, accessibility, or explicit UI/UX requests; skip backend-only work with no user-facing effect."
metadata:
  version: "1.1.2"
---
# Savyre UI/UX Quality

Apply UI and UX standards to the affected experience, proportional to the task. This reusable skill assists the existing stage owner; it does not replace S04, approve a stage, or authorize deployment. For substantial new screens, default to the **hi-fi design bar** in `references/standards.md`: **Cursor Canvas first**, then Approve, then product code. PNG/`preview.html` only when Canvas is unavailable.

## Boundary
Read `references/runtime-boundary.md` before work and `references/invocation-map.md` before treating this as a stage owner. This reusable role is not a stage owner. S04 (`savyre-stage-build-review`) remains the writer and primary. Managed runs require an explicit runtime assignment; missing registration is a diagnostic, not proof of invocation.

## Inputs and mode
Use the supplied task brief, approved scope, current source revision, existing design references, affected journeys, runtime action permissions, and assigned output destination. Accept `mode: build` or `mode: review`. If absent, infer from the requested action and state the choice. A mockup-only request uses build mode but ends at the preview; do not implement the complete feature without authorization. Write the report to `stages/s04_build_review/tasks/<backlog_item_id>/ui_ux_report.json` (keep JSON) and companion `ui_ux_report.md` — never repo-root `tasks/`. Product UI code stays under `app/` / `src/` (or the project's real source tree).

**Design (Canvas first):** for a **substantial new screen** or unresolved visual decision, **open Cursor Canvas first** (`treatment: canvas`, `designMedium: canvas`) when the session supports it. Persist a **portable design specification** (`designBrief` / `designSpecification`) so work can resume if Canvas is gone. Optional `canvasRef` is never the sole record. Do **not** skip Canvas for PNG/`preview.html` while Canvas works. **Skip Canvas** only for small spacing/label edits (`designScope: small_edit`, `designCheckpoint: not_required`). **Only if Canvas is unavailable** (record fallback): hi-fi `image_set` PNG(s) + optional `preview.html` under `tasks/<id>/design/`, Read PNGs into chat, then AskQuestion. Always write a full `ui_ux_report.json` (`artifactType: ui_ux_report`, `designCheckpoint: awaiting_human`). **Call AskQuestion** for Approve — do not only print the question; do not write product UI (`index.html`, `styles.css`, `app/`, `src/`, tests) in the same turn; the host blocks those paths until Approve. Canvas/MCP cannot approve or unlock a stage. After design OK (or skip), implement with the recorded **component strategy**, then AC TDD and browser `mode=review`. Images/Canvas never replace `CHK-BROWSER-PREVIEW`.

Read [standards.md](references/standards.md) in either mode, then only [build.md](references/build.md) or [review.md](references/review.md). Read [tools.md](references/tools.md) when selecting tools or using external designs. Read [report.md](references/report.md) when recording results.

Explicit user instructions govern scope. Reuse existing approved designs and components. Do not invent product requirements or install optional tools without the runtime's permission. Existing authorization persists; design checkpoint and material scope changes require human alignment before dependent work.

## Managed execution boundary
Use the runtime's verified stage, pass assignment, package version, source binding, permitted actions, and writer destination. Missing registration or assignment is a diagnostic, not evidence of invocation. In standalone use, produce clearly labeled unbound preview artifacts. Never alter approval metadata or final.md to manufacture completion. Do not recursively invoke the stage router.

The orchestrator, not this skill, enforces rules and transitions. Keep automatic discovery available, but managed runs require explicit invocation. Return findings to the primary stage owner. Do not spawn reviewers or claim independent review unless that capability is assigned and authorized; otherwise disclose self-review.

Report only observed checks and evidence tied to the current source. Missing required browser verification is `unable_to_verify`, never `passed`.
