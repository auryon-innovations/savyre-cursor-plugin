# Shared UI/UX standards

Evaluate the affected journey against the brief; do not redesign unrelated areas.

- Task completion: purpose and primary action are clear; users can finish the intended task.
- Information hierarchy: show decision-critical content first; group related details and use progressive disclosure for dense data.
- Navigation: predictable destinations, back/exit paths, and preserved state where the task requires it.
- Feedback: relevant loading, empty, success, error, disabled and validation states; actionable recovery; no false success.
- Visual quality: coherent typography, spacing, semantic colors and components; readable content without overlap, clipping or unexplained truncation.
- Responsiveness: verify intended viewport sizes, long content, realistic density and overflow behavior. Use project targets; absent targets, use 390px and 1440px widths as documented provisional web defaults. The narrow width is its own layout: one column, images inside the frame, no sideways scroll. A shrunk desktop grid does not pass. Do not invent a mobile feature requirement.
- Accessibility: semantic controls and labels, keyboard operation, visible focus, sensible focus movement, contrast, and error associations. Use project accessibility requirements; absent requirements, assess applicable WCAG 2.2 AA checks as a provisional target, not certification.
- Integration: production paths use intended data and actions; prototype mocks are removed or deliberately isolated.

Reference precedence: explicit instructions, approved designs/design system, existing app conventions, then documented defaults. Resolve consequential conflicts before dependent work; decide minor preferences consistently.

For new interfaces without references, establish type scale, spacing, color roles, component treatment and responsive behavior. A component library does not substitute for a coherent visual direction.

## Hi-fi design bar (default for substantial new screens)

Clients should not need a designer prompt for a clear first mockup. For **substantial new screens** or media-heavy browse/hero UIs, default to a **senior product designer’s finished screen** before AskQuestion — not a gray wireframe and not a static stack of cards and text. Words like “premium”, “modern”, or “pro” do not pass unless the checks below are on the screen.

**Medium (required):**

1. **Design brief before HTML.** Before any HTML or CSS, write a complete `designBrief`: product and users, one visual direction and why it fits, how each color is used, type hierarchy and font choices, section order and visual hierarchy, imagery and placement, component appearance and interaction states, first-viewport priorities, and narrow versus wide layout. Do not start HTML until that brief is complete. Do not ask the user to approve the brief. Then write interactive `preview.html` (`treatment: image_set`, `designMedium: images`) under `tasks/<id>/design/`. Persist `designBrief` / `designSpecification`. Do not use Cursor Canvas for this approval. The preview is standalone HTML and custom CSS. Do not use React, Tailwind, or shadcn for it.
2. **PNG stills** of the same pages beside `preview.html`.
3. **One finished visual direction** — one type scale (display title, body, muted meta), one spacing scale, named color roles (background, surface, text, muted text, one accent). The headline is clearly larger than the body. One focal point, and more than one kind of region. Do not repeat the same card grid down the page. Composition follows the product, not a universal template: a shop leads with products and photography; a dashboard leads with readable metrics and navigation, not identical cards; a portfolio leads with identity, type, and work samples; other products follow the task. If the user gave a reference, take its visual principles without copying it. With no reference, invent one finished direction and keep it. Do not stop at a generic template.
4. **Real content** — real product names, uneven title lengths, real prices, and real photos in one style. No gray boxes, no initials standing in for photos, no three identical feature cards, no purple gradient, no icon row standing in for content.
5. **On-screen words** — one voice and short labels. No filler such as “elevate” or “discover the art of.”
6. **States, motion, and both widths** — empty, loading, and error states say what happened and what to do next. The width control inside `preview.html` restacks that screen: narrow is one column, wide uses the extra room, images stay inside the frame, and nothing scrolls sideways. A browser media query alone does not pass, because the preview opens in a wide window. The first view shows the main action. The headline is not pushed below a tall image. Controls change on hover, press, and focus. Switching page, width, or ready, loading, empty, and error uses a short transition and honors reduced motion.
7. **Self-review, then AskQuestion** — open `preview.html` in a browser and Read the PNGs at both widths. Check the brief and the UI `AC-###`: product-specific composition, a compelling first view with a clear primary action, coherent type, spacing, and alignment, purposeful imagery, repeated regions only when justified, no horizontal overflow on the narrow frame, and hover and focus states. Revise at most twice. If major defects remain, list them and still call AskQuestion (do not only print the question). Do not hide defects or skip the question.
8. **After Approve** — the product page uses the preview’s type, color, spacing, photos, words, section order, layout, and motion. Do not simplify it into a generic component layout.

## preview.html bar

Write `stages/s04_build_review/tasks/<id>/design/preview.html`. It is the approval view, not the product app.

A substantial preview must be one browser page that combines look and behavior:

- One type scale, one spacing scale, named color roles, and real photos. The headline is clearly larger than the body. This is the designed page, not an editor-theme shell.
- One focal point and more than one kind of region. Not the same card grid repeated.
- The first view shows the main action. The headline is not pushed below a tall image.
- The width control restacks the frame. Narrow is one column. Wide uses the extra room. Images stay inside the frame. No sideways scroll. A browser media query alone does not pass.
- Controls change on hover, press, and focus. Page, width, and ready, loading, empty, and error changes use a short transition and honor reduced motion.
- Controls that change the page: navigation between the main screens, search, and filters when the brief includes them.
- Real product names, uneven title lengths, and real prices in every cell. Empty, loading, and error states are in the same page. The design brief and backlog ids stay in `designSpecification`, not in the page.
- Short labels in one voice. No filler headlines. Words like “premium”, “modern”, or “pro” do not pass unless the checks above are on the screen.
- PNG stills of those same screens, including an empty or error state, in the same `design/` folder.

Small edits (`designScope: small_edit`, `designCheckpoint: not_required`) skip this bar. Backend-only work skips design entirely.
