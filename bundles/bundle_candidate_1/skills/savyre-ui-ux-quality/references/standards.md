# Shared UI/UX standards

Evaluate the affected journey against the brief; do not redesign unrelated areas.

- Task completion: purpose and primary action are clear; users can finish the intended task.
- Information hierarchy: show decision-critical content first; group related details and use progressive disclosure for dense data.
- Navigation: predictable destinations, back/exit paths, and preserved state where the task requires it.
- Feedback: relevant loading, empty, success, error, disabled and validation states; actionable recovery; no false success.
- Visual quality: coherent typography, spacing, semantic colors and components; readable content without overlap, clipping or unexplained truncation.
- Responsiveness: verify intended viewport sizes, long content, realistic density and overflow behavior. Use project targets; absent targets, use 390px and 1440px widths as documented provisional web defaults. Do not invent a mobile feature requirement.
- Accessibility: semantic controls and labels, keyboard operation, visible focus, sensible focus movement, contrast, and error associations. Use project accessibility requirements; absent requirements, assess applicable WCAG 2.2 AA checks as a provisional target, not certification.
- Integration: production paths use intended data and actions; prototype mocks are removed or deliberately isolated.

Reference precedence: explicit instructions, approved designs/design system, existing app conventions, then documented defaults. Resolve consequential conflicts before dependent work; decide minor preferences consistently.

For new interfaces without references, establish type scale, spacing, color roles, component treatment and responsive behavior. A component library does not substitute for a coherent visual direction.

## Hi-fi design bar (default for substantial new screens)

Clients should not need a designer prompt for a clear first mockup. For **substantial new screens** or media-heavy browse/hero UIs, default to a **production-like** proposal before AskQuestion — not a gray wireframe.

**Medium order (required):**

1. **Cursor Canvas first** when the session supports it (`treatment: canvas`, `designMedium: canvas`). Persist `designBrief` / `designSpecification`. Do not skip to PNG/`preview.html` while Canvas works.
2. **Images only if Canvas is unavailable** — record a tool fallback, then PNG (and optional `preview.html`) under `tasks/<id>/design/`.
3. **One clear visual direction** — background, accent, type hierarchy (strong display title, muted meta), spacing rhythm. If the Assigned task names a known product or reference, match that look; otherwise invent one coherent direction and stick to it.
4. **No placeholder tiles** — do not stop with empty gray rectangles for posters, cards, or heroes. Use real imagery when the UI shows media.
5. **Show before AskQuestion** — for Canvas: point the developer at Canvas + saved spec; for images: Read PNG(s) into chat and link `preview.html` if present. Then call AskQuestion (do not only print the question).
6. **Desktop + mobile** when the product is a responsive client UI — both must look production-like.

Small edits (`designScope: small_edit`, `designCheckpoint: not_required`) skip this bar. Backend-only work skips design entirely.
