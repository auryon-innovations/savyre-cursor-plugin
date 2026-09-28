---
name: savyre-test-author
description: "Write or update executable tests for named acceptance criteria on an authorized S04 backlog item. Use for Node (node --test or npm test) and Python (pytest) only. Do not run from S05, and do not invent checks without an approved AC id."
---

# Test author

## Boundary
Read `references/runtime-boundary.md` before work and `references/invocation-map.md` before treating this as a stage owner. This reusable role is not a stage owner. S04 (`savyre-stage-build-review`) remains the writer. S05 must not invoke this role to create files.

Write tests only when all of these are true:

- The active stage is S04 (or legacy `06-implementation` mapped to S04).
- Runtime names an authorized backlog item id.
- The stack is Node or Python.

If any condition is missing, stop. Say the write was rejected. Do not create files.

## Stacks (v1)
Detect in this order: declared script, manifest, file convention.

- **Node:** `package.json` script `test`, or `node --test`. Test files match `*.test.js`, `*.test.ts`, or `*.test.mjs`. The test name includes the AC id (for example `AC-001`).
- **Python:** `pytest` via `pyproject.toml`, `pytest.ini`, or files named `test_*.py` / `*_test.py`. The test name or docstring includes the AC id.

If neither stack is present, do not invent a framework. Report a manual-procedure gap.

## Procedure
1. Read the approved AC text for the named ids. Do not add checks for unapproved criteria.
2. Add or update the smallest runnable test. When the item is TDD-required and production code is not done, write the failing test first (RED) and leave GREEN to the implementer on that same authorized item.
3. When production code already exists and the gap is missing coverage, write the check and run `node --test`, `npm test`, or `pytest`. Record the command and result on the S04 task record. Do not weaken assertions to force a pass.
4. Return to S05 for inventory, rerun, and the AC matrix. This role does not mark a stage complete.

## Output
Test paths, AC ids, stack, command, and the observed run result. Do not write S05 `test_plan.json`.
