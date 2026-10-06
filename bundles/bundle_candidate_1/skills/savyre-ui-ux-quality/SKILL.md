---
name: savyre-ui-ux-quality
description: "Design, build, mock up, or review user-facing web screens and interactions in Savyre. Use for visual changes, navigation, validation, feedback, accessibility, or explicit UI/UX requests; skip backend-only work with no user-facing effect."
metadata:
  version: "1.1.0"
---
# Savyre UI/UX Quality

Apply UI and UX standards to the affected experience, proportional to the task. This reusable skill assists the existing stage owner; it does not replace S04, approve a stage, or authorize deployment.

## Boundary
Read `references/runtime-boundary.md` before work and `references/invocation-map.md` before treating this as a stage owner. This reusable role is not a stage owner. S04 (`savyre-stage-build-review`) remains the writer and primary. Managed runs require an explicit runtime assignment; missing registration is a diagnostic, not proof of invocation.

## Inputs and mode
Use the supplied task brief, approved scope, current source revision, existing design references, affected journeys, runtime action permissions, and assigned output destination. Accept `mode: build` or `mode: review`. If absent, infer from the requested action and state the choice. A mockup-only request uses build mode but ends at the preview; do not implement the complete feature without authorization. Write the report to `stages/s04_build_review/tasks/<backlog_item_id>/ui_ux_report.json` (keep JSON) and companion `ui_ux_report.md` — never repo-root `tasks/`. Product UI code stays under `app/` / `src/` (or the project's real source tree).

**Preview-first:** for applicable user-facing UI, build a lightweight static preview first, then **stop for human design approval** before backend, real APIs, or full feature wiring. Record `mockup.designCheckpoint` (`awaiting_human` → `approved` or `changes_requested`). Do not treat AC TDD as a substitute for that design gate.

Read [standards.md](references/standards.md) in either mode, then only [build.md](references/build.md) or [review.md](references/review.md). Read [tools.md](references/tools.md) when selecting tools or using external designs. Read [report.md](references/report.md) when recording results.

Explicit user instructions govern scope. Reuse existing approved designs and components. Do not invent product requirements or install optional tools without the runtime's permission. Existing authorization persists; design checkpoint and material scope changes require human alignment before dependent work.

## Managed execution boundary
Use the runtime's verified stage, pass assignment, package version, source binding, permitted actions, and writer destination. Missing registration or assignment is a diagnostic, not evidence of invocation. In standalone use, produce clearly labeled unbound preview artifacts. Never alter approval metadata or final.md to manufacture completion. Do not recursively invoke the stage router.

The orchestrator, not this skill, enforces rules and transitions. Keep automatic discovery available, but managed runs require explicit invocation. Return findings to the primary stage owner. Do not spawn reviewers or claim independent review unless that capability is assigned and authorized; otherwise disclose self-review.

Report only observed checks and evidence tied to the current source. Missing required browser verification is `unable_to_verify`, never `passed`.
