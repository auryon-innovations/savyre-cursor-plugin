---
name: application-discovery
description: Turn an application idea or incomplete development request into a scoped development brief, identify missing requirements, infer application components, and recommend a technology stack with optional delegated decisions. Use when planning a new application or a substantial feature with unresolved product or architecture choices. Do not introduce discovery for a clear bug fix, small edit, or fully specified implementation.
---

# Application Discovery

Turn the user's intent into enough shared understanding to build the right thing. Judge completeness by consequential missing information, not prompt length. Scale the depth to the task: a prototype can need a few sentences; a production system may need explicit operational requirements.

## Savyre Stage 1 binding

S01 loads this skill after the developer confirms the task wording and before acceptance criteria. S01 remains the stage owner. This pass does not replace S02 code discovery, approve the stage, or write application source.

Write the result into the S01 draft `task_brief.md` in this order:

1. Confirmed task outcome (already captured).
2. Task-related code discovery.
3. Current-path mermaid diagram.
4. Follow-up questions, only when a missing fact would change what gets built. Wait for the answer before continuing.
5. Acceptance criteria.

**Task-related discovery.** Read only the path the confirmed task touches: the screen or command, the API, the data, and one similar feature already in the app. Record the existing stack and current behavior. Do not audit the whole repository.

**Mermaid.** After that look, add a `Current-path diagram` section with one fenced `mermaid` block of the observed path. Every node comes from a file or flow just found. Label observed facts separately from inferences. If the workspace has no application code, write **No existing flow** and skip the diagram. The markdown preview must be able to draw the diagram. Use camelCase node ids. Put every label in double quotes. Do not use underscores, parentheses, colons, or dots anywhere in the diagram. Write `index js` instead of a filename, `env file` instead of an env filename, and `MONGO URI` instead of a name that contains an underscore. Keep one connected graph. Edge labels are short words with no colon, such as `-->|connected|`.

**Follow-up pause.** After the diagram section (or the no-existing-flow note), decide readiness from the task plus what the code showed. Sign-in, storage, the API, and what the user can do are questions when the task leaves them open. Ask at most three questions and wait. Offer **Guide me**, **Recommend defaults**, or **Decide for me** when a technical choice is still open. Assumptions are allowed only after the developer chooses **Recommend defaults** or **Decide for me**, or after they answer. If the task and the code already answer it, write **No open questions identified** and do not ask. In a turn that asks a question, stop after the current-path note and the questions. Do not write requirements, user stories, or acceptance criteria in that turn.

**Acceptance criteria.** Draft `AC-###` only after that pause: either the developer has answered, or the brief says **No open questions identified**. Each criterion states the requested change and, when code exists, today's behavior.

**Small work.** A clear bug fix, small edit, or fully specified change gets a short look at the failing path, a small diagram of that path, and criteria for the fix. Do not run the full questionnaire.

## Start with the outcome

Read the conversation and relevant supplied materials first. When a repository is available, inspect its instructions, manifests, structure, and relevant implementation before proposing changes. Reuse established requirements and do not ask questions already answered by context.

Identify who will use the application, the problem it solves, and its main end-to-end workflow. Infer the necessary components from these needs: frontend, backend/API, full-stack web, mobile, desktop, CLI, background service, or a combination. Do not force the user to classify the application technically. Respect an explicit request for only one component.

## Assess readiness

Check only requirements that affect this request:

- Intended outcome, users, and essential workflow.
- Required inputs, data sources, and outputs.
- MVP scope and observable success criteria.
- Constraints that change the solution, such as an existing stack, target devices, integrations, budget, delivery date, sensitive data, or operational expectations.

These are decision dimensions, not mandatory form fields. Infer from evidence; omit irrelevant dimensions. Distinguish information supplied by the user from your own proposals.

Choose one readiness state:

- **Ready:** Enough information exists to carry out the requested next step.
- **Ready with assumptions:** The developer chose **Recommend defaults** or **Decide for me**, or already answered. State those reversible defaults and proceed. A missing fact about sign-in, storage, the API, or what the user can do stays **Needs clarification** until they answer or delegate.
- **Needs clarification:** A missing fact would change the core workflow, scope, feasibility, or an action that cannot be safely reversed. Ask only for those facts. Do not fill those facts as assumptions in the same turn.

Readiness is relative to the next step: missing production credentials need not block a local prototype. Do not silently substitute mocked behavior for a requested working integration.

## Clarify and delegate decisions

When clarification is useful, ask a small batch of up to three focused questions, with plain-language options where helpful. Prioritize questions by how much their answers change the solution. Do not present an exhaustive technical questionnaire.

Offer these decision styles when the user has unresolved choices and has not already expressed a preference:

- **Guide me:** Explain meaningful alternatives and let the user choose.
- **Recommend defaults:** Present a preferred approach and its main tradeoff; use reversible defaults unless the user objects, subject to any required answers or permissions.
- **Decide for me:** Select suitable technical defaults, explain consequential decisions briefly, and continue without repeated preference checks.

Accept equivalent natural language such as "you choose" as delegation. Preserve that choice across follow-ups; do not repeatedly ask for a mode. If no style is specified, ask. Recommend defaults only after the developer chooses **Recommend defaults** or **Decide for me**. Silence is not an answer to a required question or approval for an external action.

Delegation covers technical choices within the request, not business facts. Never present invented pricing rules, access policies, customer commitments, or legal obligations as established requirements. For an exploratory prototype, propose explicitly provisional business assumptions when appropriate. Otherwise ask the smallest necessary question. Choosing a hosting provider does not authorize purchasing, publishing, or creating external accounts.

## Select an approach

Prefer the existing stack and conventions when extending an application. For a new application, choose the simplest coherent stack that satisfies the workflow and constraints. Do not default every idea to a full-stack app, add a database without a persistence need, or introduce infrastructure for hypothetical scale.

Consider UI/runtime, server/API, data storage, authentication, integrations, deployment, and validation only where relevant. Use the user's preferences and team skills, operating cost, maintainability, and delivery needs as decision criteria. Explain major tradeoffs briefly; avoid a catalog of frameworks.

Verify current compatibility, support, pricing, or service limits from authoritative documentation when a recommendation depends on them. If verification is unavailable, label the uncertainty rather than promising compatibility or free hosting. Do not bake particular framework versions or a universal preferred stack into the workflow.

## Deliver an actionable brief

Use a compact response for simple work and a structured brief for larger work. In S01 the brief is `task_brief.md` and the diagram section comes before acceptance criteria. Include only applicable sections:

1. **Goal and users:** Intended outcome and main workflow.
2. **Scope:** MVP capabilities and meaningful exclusions.
3. **Task-related discovery:** Stack, current behavior, and the files on this task's path.
4. **Current-path diagram:** Mermaid of that path, or **No existing flow**.
5. **Application components:** What must run where, with a brief reason.
6. **Technical decisions:** Stack and integrations, distinguishing existing constraints from delegated recommendations.
7. **Assumptions and open questions:** Clearly separate provisional defaults from blocking unknowns.
8. **Acceptance criteria:** Observable behavior that establishes completion, including relevant failure cases. Draft these only after the diagram section, and only after open questions are answered or the brief says **No open questions identified**.
9. **Next steps:** A practical implementation sequence and the first actionable step. S02 still performs evidence-based code discovery; do not treat this brief as that stage.

Keep user requirements, delegated decisions, and unresolved questions visibly distinguishable. Do not require approval of the whole brief as a ritual. If the user requested planning, finish with the brief. If the user requested implementation, carry the brief into the authorized implementation once ready; do not stop merely to offer to build it. Honor a user's request to review the plan first. In managed S01, stop after the brief and the acceptance-criteria approval ask; S01 does not implement.

## Calibration examples

- "Build a booking app; you choose the stack." Clarify who books what and whether payments are required if context does not answer them. Choose technical defaults without requiring framework expertise. Treat cancellation rules as unknown or provisional, not invented facts.
- "Build a local task tracker, no login, store tasks in the browser; pick the tools." Proceed with a compact brief and minimal frontend approach. Do not ask about backend hosting or authentication.
- "Add CSV export to this existing dashboard." Inspect the existing app and reuse its stack; clarify export scope only if it changes the result. Draw the current list-to-data path, then write the export criteria. Do not restart whole-application discovery.
- "Fix this button's padding." Handle the edit directly with a short look and a small diagram. Do not trigger the full discovery questionnaire.
