# Build mode

1. Identify the affected user journey, requirements and permitted changes. Inspect actual components before proposing new ones. Record only consequential design decisions.
2. Select mockup treatment:
   - Minor existing-screen change: modify and preview that screen directly.
   - New screen using familiar patterns: one code-based mockup.
   - New/complex journey: clickable prototype of essential steps.
   - Backend-only: skip with reason.
   - Alternatives: only when requested or a consequential unresolved decision warrants them.
3. The model writes UI code; render it in the existing framework/development server using realistic static data. For new screens use an isolated preview route/component. Do not train a model or default to image generation for tables, forms, dashboards or navigation.
4. Inspect structure and interactions first, then visual detail. Default to one direction and one initial mockup plus at most one refinement. Explicit user scope may expand this. At the limit, surface consequential unresolved choices rather than generating endless alternatives.
5. Reuse suitable mockup code during implementation. Implement relevant edge states and responsive/accessibility behavior. Mockup actions must not cause live external operations. Remove or isolate preview-only routes and data before production readiness.
6. Capture rendered evidence and correct obvious problems. A mockup is not verified backend integration. Return current source binding, affected areas, design decisions, mockup count, evidence and limitations for review.

Do not stop automatically for mockup approval. Honor an explicit user checkpoint or existing managed approval boundary. For a mockup-only task, deliver the preview and clearly state simulated behavior.

Cost control: affected screens only, existing tokens/components, static data before backend integration where practical, one direction, bounded refinement, targeted captures. Track activity under existing build usage records without duplicating billing totals.
