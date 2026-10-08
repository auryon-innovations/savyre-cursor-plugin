# Tool selection

Use capabilities already available and authorized in the execution environment. Tool names here are options, not assumed installations or free-plan guarantees.

## Browser / preview evidence (review mode)

UI/UX review must bind to a **live rendered preview**, not source alone and not AC RED/GREEN alone.

Preferred order:

1. **Playwright MCP** (Cursor `playwright` server: `browser_navigate`, `browser_snapshot`, screenshots) when connected and approved — explore the running app, capture the affected journey, attach refs as `mcp_snapshot:…` / screenshot paths.
2. **Authorized dev-server preview URL** when the app is already running — open it via MCP or record the URL as `preview_url:…` with observed interaction notes.
3. If neither MCP nor an authorized preview is available after bounded recovery: set check `CHK-BROWSER-PREVIEW` to `unavailable` and review outcome **`unable_to_verify`**. Never invent screenshots or mark **`passed`**.

### Separation from AC Playwright tests

| Concern | Tool | Counts as UI/UX review evidence? |
| --- | --- | --- |
| Explore UI, keyboard/focus, visual states | Playwright MCP / live preview | Yes |
| Acceptance criterion RED→GREEN | `npx playwright test` (or stack equivalent) | **No** (AC gate only) |

Do not treat `tests/*.spec.ts` pass logs or `redRunId`/`greenRunId` as completing `CHK-BROWSER-PREVIEW`.

## Other tools

- Existing framework/dev server: default code-based preview.
- axe-core or equivalent: automated accessibility support for web review. If required checks cannot run, record incomplete verification.
- Existing component system: first choice. For new unconstrained React apps, default to shadcn via MCP after recording component strategy. For existing apps, reuse the installed library; never add shadcn/React/Tailwind solely because MCP is available. MCP install only on authorized S04 writes. If MCP is unavailable, use installed components.
- Figma: consume supplied approved designs/components/prototypes through available authorized access.
- Penpot: optional interface design/prototyping workspace.
- Canva: optional supporting visual assets when selected, not the default interactive UI implementation.
- Cursor Canvas: optional design exploration for substantial screens (Design Mode feedback). Not production UI, not stage acceptance. Persist a portable design spec. If Canvas is unavailable, use the saved spec and the app preview.

Reading a supplied design and editing an external design document are separate actions. External writes require authorization and suitable integration/account permissions. No optional service is a completion dependency by default; if an explicitly required reference cannot be accessed, surface that dependency rather than inventing fidelity.

Prefer license-free existing tooling, but do not promise zero model, compute, hosting or external-service cost. Verify current plan/integration limits when selecting an external service. Do not install all listed tools.


## Managed rollout (Phase 3)

Honor `features.canvasShadcnUi` (default on). Setup and fallbacks:

- Configure shadcn MCP in the **target** `.cursor/mcp.json` only on authorized S04 writes for eligible stacks (`npx shadcn@latest mcp`). Preserve other servers.
- Read the Cursor Canvas skill under `~/.cursor/skills-cursor/canvas/` when designing (host allowlists that path). Only if Canvas is truly unavailable: portable design spec + app preview; record a tool fallback.
- If MCP is down: installed components / project tooling; same verification bar.
- Feature off: do not ensure MCP or inject strategy notes.

Private registries and Canvas host APIs are out of contract.
