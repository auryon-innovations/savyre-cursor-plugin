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
