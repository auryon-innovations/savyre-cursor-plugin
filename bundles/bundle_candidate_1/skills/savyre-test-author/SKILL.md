---
name: savyre-test-author
description: "Write or update Playwright acceptance checks for named AC ids on an authorized S04 backlog item. Default stack is Playwright (JS/TS); use Playwright Python/Java/C# when that language is already present. Do not run from S05, and do not invent checks without an approved AC id."
---

# Test author

## Boundary
Read `references/runtime-boundary.md` before work and `references/invocation-map.md` before treating this as a stage owner. This reusable role is not a stage owner. S04 (`savyre-stage-build-review`) remains the writer. S05 must not invoke this role to create files.

Write tests only when all of these are true:

- The active stage is S04 (or legacy `06-implementation` mapped to S04).
- Runtime names an authorized backlog item id.
- The stack is a Playwright family stack (JS/TS, Python, Java, or C#), or an explicit human exemption names another stack.

If any condition is missing, stop. Say the write was rejected. Do not create files.

## Default stack (required)
**Playwright is the default for every AC-linked check.** Do not default to `node --test` or bare `npm test` for acceptance criteria.

Choose the Playwright flavor in this order:

1. Detected Playwright stack already in the repo (script, config, or specs).
2. Else if the project is Python-first (`pytest` / `pyproject.toml` without Playwright JS), use **Playwright Python** (`pytest` + Playwright).
3. Else if Maven/Gradle Playwright Java or .NET Playwright is configured, use that flavor.
4. Else use **Playwright JS/TS**: scaffold `@playwright/test` if missing, write `tests/<item>.spec.ts` (or `e2e/`), run `npx playwright test`.

Node and plain Python unit files may still exist for non-AC helpers, but AC titles must be covered by Playwright checks unless the human records an exemption.

Browser/runtime install (`npx playwright install`) is setup, not a valid RED. RED must be an assertion or locator failure for the intended behavior. The test title includes the AC id.

## Playwright MCP
When Playwright MCP tools are connected (`@playwright/mcp`), open the page and snapshot it before writing the spec. Clicks and snapshots are not RED/GREEN. Still write a committed `*.spec.ts` / `*.spec.js` and run `npx playwright test` (or the language command) for the S04 task record. If those tools are not connected, write the spec anyway.

## Procedure
1. Read the approved AC text for the named ids. Do not add checks for unapproved criteria.
2. Ensure the Playwright runner for the chosen flavor is available (add the smallest dependency/config if the repo has none).
3. When Playwright MCP tools are connected, open the page and snapshot it before the spec. If they are not connected, write the spec anyway.
4. Add or update the smallest runnable Playwright check. When the item is TDD-required and production code is not done, write the failing test first (RED) and leave GREEN to the implementer on that same authorized item. Keep existing functional checks. When an approved `AC-###` is a visible UI check, add assertions beside them for the visible text, the empty and error states, the 390px and 1440px widths, a narrow layout that is one column with no sideways overflow, and a first view that shows the main action. Do not add a pixel-diff suite. Do not replace the functional checks.
5. When production code already exists and the gap is missing coverage, write the check and run `npx playwright test`, Playwright Python `pytest`, `mvn test` / `gradle test`, or `dotnet test` as appropriate. Record the command and result on the S04 task record. Do not weaken assertions to force a pass.
6. Return to S05 for inventory, rerun, and the AC matrix. This role does not mark a stage complete.

## Output
Test paths, AC ids, stack, command, and the observed run result. Do not write S05 `test_plan.json`.
