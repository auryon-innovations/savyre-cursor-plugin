# Build mode

For user-facing work, **lightweight UI before backend** is mandatory: static/fake data preview first, then a **human design checkpoint**, then full wiring.

1. Identify the affected user journey, requirements and permitted changes. Inspect actual components before proposing new ones. Record only consequential design decisions.
2. Select mockup treatment:
   - Minor existing-screen change: modify and preview that screen directly (`direct_preview`).
   - New screen using familiar patterns: one code-based mockup (`single_screen`).
   - New/complex journey: clickable prototype of essential steps (`clickable_journey`).
   - Backend-only: skip with reason (`not_applicable`; `designCheckpoint: not_required`).
   - Alternatives: only when requested or a consequential unresolved decision warrants them.
3. Write UI code and render it in the existing framework/dev server using **realistic static data**. For new screens use an isolated preview route/component. Do not train a model or default to image generation for tables, forms, dashboards or navigation. Mockup actions must **not** call live APIs or cause live external operations.
4. Inspect structure and interactions first, then visual detail. Default to one direction and one initial mockup plus at most one refinement. Explicit user scope may expand this. At the limit, surface consequential unresolved choices rather than generating endless alternatives.
5. **Human checkpoint (required for applicable UI):** after the preview is runnable, set `mockup.designCheckpoint` to `awaiting_human`, capture preview evidence, write `stages/s04_build_review/tasks/<backlog_item_id>/ui_ux_report.json` **and** companion `ui_ux_report.md` (keep JSON; never repo-root `tasks/`), and **stop**. Chat must include a **browser-openable** preview URL (`file:///…` to the mock HTML, or `http://localhost:…` / `http://127.0.0.1:…` — never a bare path like `app/index.html`). Ask with Cursor `AskQuestion` (ids `1`/`2`/`3`: Approve design and continue / Request design changes / Something else). Do not lock Build & Review and do not start backend integration, real data wiring, or AC TDD RED→GREEN until they click approve (`approved`) or request changes (`changes_requested` → refine preview → checkpoint again). Backend-only / not_applicable skips this gate. App UI source stays in the product tree (`app/`, `src/`, etc.) — only the report/status live under S04.
6. After design approval only: reuse suitable mockup code for implementation, wire real behavior, implement edge states and responsive/accessibility behavior. Remove or isolate preview-only routes and data before production readiness.
7. Capture rendered evidence and correct obvious problems. A mockup is not verified backend integration. Return current source binding, affected areas, design decisions, mockup count, `designCheckpoint`, evidence and limitations for the later review pass.

For a mockup-only task, deliver the preview, disclose simulated behavior, stop at the human checkpoint, and do not claim production readiness.

Cost control: affected screens only, existing tokens/components, static data before backend integration, one direction, bounded refinement, targeted captures. Track activity under existing build usage records without duplicating billing totals.
