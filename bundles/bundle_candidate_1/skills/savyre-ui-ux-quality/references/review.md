# Review mode

Review the current rendered application, not just source or a prior mockup. Bind results to source revision and preview/build identity. Reuse prior evidence only if its source, environment and affected behavior remain valid.

1. Reassess UI impact from actual changes, including behavior controlled outside frontend files.
2. Determine required journeys, states and viewport coverage from scope and shared standards. Record any justified exclusions.
3. Start or connect to an authorized development preview. Prefer **Playwright MCP** when connected (`browser_navigate` → `browser_snapshot` / screenshot). If MCP and preview are both unavailable, attempt existing bounded recovery, then mark `CHK-BROWSER-PREVIEW` unavailable. Do not install tools or fabricate captures to bypass runtime restrictions. Do not use AC `npx playwright test` results as this check.
4. Exercise the primary journey and important error/recovery paths. Inspect screens visually; test keyboard and focus behavior. Run available automated accessibility checks using the existing stack or permitted axe-core integration.
5. Record checks as completed, failed, unavailable or not applicable with evidence. Required browser evidence must be present for `passed`. Automated scans cannot establish complete accessibility or usability.
6. Produce concrete findings: ID, screen/component, current location if known, expected versus observed behavior, reproduction, consequence, severity, evidence, fix criteria and resolution binding. Allow zero findings; avoid subjective taste-only blockers.

Severity:
- Critical: primary journey unusable or key action materially wrong; blocks pass.
- Major: usability, accessibility or visual issue materially impedes intended task; blocks pass.
- Minor: localized polish without material task impact; nonblocking.

Outcome precedence:
- `not_applicable`: no relevant UI/UX scope, with reason.
- `fixes_required`: an unresolved critical/major issue exists, even if other verification is unavailable; preserve missing coverage too.
- `unable_to_verify`: no known blocker but required verification is incomplete/unavailable/stale.
- `passed`: all required checks complete with no unresolved blocking finding; minor findings may remain.

Return corrections to authorized build work. Default maximum is two correction cycles after the initial implementation review, separately counted from mockup refinement. Recheck affected behavior and related regressions after changes. At the limit retain the actual outcome and report unresolved findings; never auto-pass. The runtime owns transitions and permission decisions.

Disclose self-review when no independent reviewer was assigned. A mockup-only review evaluates prototype scope and explicitly excludes production readiness.
