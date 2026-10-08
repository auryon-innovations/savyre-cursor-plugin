# Build mode

For user-facing work, design exploration is **proportionate**. **Cursor Canvas is first** for substantial new screens. Apply the **hi-fi design bar** in `standards.md` — clients should not need a custom prompt for a clear mockup.

1. Identify the affected journey, requirements, and permitted changes. Inspect the **target package** stack before proposing components. Record a **component strategy** (reuse existing / extend shadcn / introduce shadcn only for new unconstrained React / other stack / explicit migration).
2. Select mockup treatment:
   - Substantial new screen: **must try Cursor Canvas first** (`treatment: canvas`, `designMedium: canvas`) when the session supports it. Persist `designSpecification` + `designBrief`. `canvasRef` is optional extra. Canvas proposals must be production-like (hierarchy, direction, no gray placeholder content).
   - Small spacing/label correction: `treatment: none`, `designCheckpoint: not_required` — implement directly with existing conventions.
   - **Only if Canvas is unavailable** (record a tool fallback): hi-fi `image_set` under `tasks/<id>/design/` (PNG + optional `preview.html`). Do not choose images while Canvas works. Do not stop at SVG wireframes.
   - Backend-only: skip (`not_applicable`; `designCheckpoint: not_required`; `designMedium: none`).
3. **Do not** introduce React, shadcn, Tailwind, or a second library solely to enable this workflow. Existing apps reuse their library. shadcn MCP may **discover/install** only on authorized S04 writes, after inspecting local variants. If MCP is down, use installed components.
4. **Canvas path (default for substantial UI)** before AskQuestion:
   - Open / build the proposal in Cursor Canvas (Design Mode when available).
   - Persist portable `designBrief` / `designSpecification` so work resumes if Canvas is gone.
   - Write `ui_ux_report.json` with `treatment: canvas`, `designMedium: canvas`, `designCheckpoint: awaiting_human`.
   - Call Cursor AskQuestion NOW (Approve / Request changes / Something else). Do not only print the question.
5. **Image-set fallback** (Canvas unavailable only) before AskQuestion:
   - Write PNG(s) under `stages/s04_build_review/tasks/<id>/design/` (optional `preview.html` for browser-openable mock — design-phase only, not product `index.html`).
   - Real/CDN imagery when the UI shows media; no gray placeholder tiles.
   - List `designImageRels` on the report; Read PNGs into chat; then AskQuestion.
6. For Canvas/image proposals, write `ui_ux_report.json` + companion `.md` with `artifactType: "ui_ux_report"`, set `designCheckpoint: awaiting_human`, and **stop**. **Do not** write product UI files (`index.html`, `styles.css`, `app/`, `src/`, Playwright specs) in the same turn. The host blocks those paths until Approve. Canvas like ≠ implementation acceptance ≠ stage unlock.
7. After design OK (or skip for small edits): implement complete screens (layout, states, real routes/services). Simulated actions are not complete unless the task asked for a prototype.
8. Then AC TDD and `mode=review` with live browser preview (`CHK-BROWSER-PREVIEW`). Canvas/images never satisfy function/browser review.
9. Record source binding, strategy, design decisions, verification, and fallbacks.

Cost control: affected screens only, existing tokens/components, one direction, bounded refinement. Track activity under existing build usage records.
