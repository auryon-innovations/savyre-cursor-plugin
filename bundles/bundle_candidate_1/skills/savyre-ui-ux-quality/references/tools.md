# Tool selection

Use capabilities already available and authorized in the execution environment. Tool names here are options, not assumed installations or free-plan guarantees.

- Existing framework/dev server: default code-based preview.
- Browser automation (Playwright or an available equivalent): actual interaction checks and screenshots; visual inspection of captures is required for visual changes.
- axe-core or equivalent: automated accessibility support for web review. If required checks cannot run, record incomplete verification.
- Existing component system: first choice. shadcn/ui is optional only when compatible and appropriate; do not introduce competing design systems casually.
- Figma: consume supplied approved designs/components/prototypes through available authorized access.
- Penpot: optional interface design/prototyping workspace.
- Canva: optional supporting visual assets when selected, not the default interactive UI implementation.
- Coding canvas: optional preview surface if it runs the relevant framework. Do not assume it is available or equivalent to the integrated app.

Reading a supplied design and editing an external design document are separate actions. External writes require authorization and suitable integration/account permissions. No optional service is a completion dependency by default; if an explicitly required reference cannot be accessed, surface that dependency rather than inventing fidelity.

Prefer license-free existing tooling, but do not promise zero model, compute, hosting or external-service cost. Verify current plan/integration limits when selecting an external service. Do not install all listed tools.
