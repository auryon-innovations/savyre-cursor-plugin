---
name: savyre-stage-task-definition
description: "Define a software task in Savyre S01. After the task is confirmed, inspect only the code that task touches, draw a mermaid diagram of that path, pause when a product fact is still open, then draft acceptance criteria for one final confirmation. Use application-discovery for that brief. Not technical planning, S02 code discovery, code changes, or delivery acceptance."
---

# S01 — Task Definition

## Boundary and inputs
Read `references/runtime-boundary.md` before managed or preview work. This package is a primary stage skill; compatible internal reusable roles assist it but do not replace its owner. In managed mode, check the verified active stage matches S01; mismatched/legacy context needs runtime mapping, not silent bypass.

- Original task and supplied references; project metadata and existing decisions
- In managed mode use the runtime draft-analysis path; analysis cannot require an already-approved S01 final

## Reusable skill invocation
Read `references/invocation-map.md` before selecting a dedicated/shared pass. After the task wording is confirmed, S01 loads `application-discovery` and follows its order: task-scoped discovery, current-path mermaid, a pause when sign-in, storage, the API, or what the user can do is still open, then acceptance criteria. S01 then uses `savyre-requirement-challenge` on that draft, before task confirmation. S02 uses `savyre-evidence-grounding` after its own discovery; do not perform S02 here. Cross-stage consumers run only when their runtime records/checkpoint are present. Managed invocation requires registered compatible package and delegated pass; missing assignment/availability is a diagnostic or explicit runtime fallback, not proof a call ran. The primary remains the stage owner; do not call savyre-run-stage recursively.

## Order inside Stage 1

1. **Ask.** Capture and confirm the task wording. Do not draft acceptance criteria yet.
2. **Task-related code discovery.** Read only the path that task touches.
3. **Mermaid.** Draw that observed path in the brief. If there is no application code, write **No existing flow** and skip the diagram.
4. **Follow-up pause.** If a missing fact would change what gets built, including sign-in, storage, the API, or what the user can do, ask at most three questions and wait. Assumptions wait until they choose **Recommend defaults** or **Decide for me**, or until they answer. If nothing material is missing, write **No open questions identified**.
5. **Acceptance criteria.** Draft them only after step 4. The developer approves the AC IDs before lock.

A clear bug fix or small edit stays a short look, a small diagram, and criteria for that fix. A new app or a large feature with open choices uses the full application-discovery brief.

## Hybrid acceptance criteria (required)

- Draft `AC-###` only after the current-path diagram section, or the **No existing flow** note, and only after the follow-up pause. An unanswered question blocks the criteria.
- **AI drafts** observable AC (`AC-###`) linked to `FR-###` / `NFR-###`; **human must approve** the exact contract version before freeze.
- Each AC needs a stable ID, requirement refs, observable action/outcome, and an objectively assessable expected result. When application code exists, state today's behavior and the requested change. Avoid unmeasurable terms without an agreed check.
- Identify assumptions as proposals; challenge vague, missing, or inferred acceptance. Ask one material blocking question at a time.
- **Do not write executable tests** in S01 (no test files, no claiming tests were generated). AC are the product contract; tests come in S04.
- Never recycle AC IDs. Revised wording for the same outcome keeps the ID and gets a new contract version. Removed AC stay as retired history; new outcomes get new IDs.
- Do not silently add product scope. Human confirmation refers to an exact contract version/hash; editing the contract invalidates that approval for the edited version.

## Chat capture (required before confirm)

Same behavior in Cursor Agent and Claude Code. When managed Chat has this stage enforced:

1. As soon as the developer names the product (chat message or leftover after `/savyre-start`), write a 2–4 sentence restatement plus Product / UX / API / Data / Stack (only supported headings) as `assignedTask` in `stages/s01_task_definition/stage_input.json` (JSON is the SoT; runtime regenerates the `stage_input.md` companion).
2. Speak that same restatement, then speak JSON `userMessage` exactly. Confirm copy names `stages/s01_task_definition/stage_input.md` — never tell the developer to confirm `stage_input.json`. Wait for `/savyre-next` to confirm. Do **not** write `task_brief.md` before confirm. Do **not** draft acceptance criteria before confirm.
3. After confirm, load `application-discovery` and write `task_brief.md` through confirmed task, task-related discovery, and the current-path mermaid (or **No existing flow**). Then pause. If a missing fact would change what gets built, including sign-in, storage, the API, or what the user can do, ask at most three questions, call Cursor `AskQuestion`, and wait. Do **not** write requirements, user stories, or acceptance criteria in that turn. Assumptions wait until they choose **Recommend defaults** or **Decide for me**, or until they answer. If nothing material is missing, write **No open questions identified**, then draft acceptance criteria. After the criteria exist, run `turn`. When `turn.activeSkill` becomes `savyre.requirement-challenge`, **in the same agent turn** write `stages/s01_task_definition/challenge_findings.json` (`schemaVersion` `"1.0"`, `findings` array — empty OK), run `turn` again, then speak `userMessage` exactly (AC approve + `/savyre-next` to lock).
4. Never invent a Savyre panel task box, Send button, or panel Validate step. Chat has no panel capture UI.
5. `/savyre-next` confirms only when `assignedTask` is non-empty. A filled `task_brief.md` alone is not enough. Lock also needs `challenge_findings.json` on disk. The brief is not ready for that challenge until the diagram section (or **No existing flow**) appears before the acceptance criteria.

## Mermaid preview

When this stage writes a fenced mermaid diagram, the markdown preview must be able to draw it. Use camelCase node ids. Put every label in double quotes. Do not use underscores, parentheses, colons, or dots anywhere in the diagram. Write `index js` instead of a filename, `env file` instead of an env filename, and `MONGO URI` instead of a name that contains an underscore. Keep one connected graph. Edge labels are short words with no colon, such as `-->|connected|`.

## Procedure

1. Capture exact designated original task separately from a helpful restatement; distinguish product requirements from workflow instructions. In Chat, that capture is the `assignedTask` write above. Wait for confirmation of that wording.
2. After confirmation, inspect only the task path (screen or command, API, data, and one similar existing feature). Record stack and current behavior in the brief. Do not audit the repository.
3. Add the current-path mermaid from that evidence. Every node cites a file or flow just found. Label inferences. No application code means **No existing flow** and no diagram.
4. Pause before acceptance criteria. Ask at most three questions when a missing fact would change the workflow, scope, or feasibility, including sign-in, storage, the API, or what the user can do. Offer **Guide me**, **Recommend defaults**, or **Decide for me** when a technical choice is still open. Wait for the answer. Assumptions wait until they choose **Recommend defaults** or **Decide for me**, or until they answer. If the task and the code already decide it, write **No open questions identified** and do not ask.
5. Extract supported requirements and observable criteria only after step 4. Include user stories only when actor/value helps feature work. For a user-facing task, each story is a person, a screen, one main action, and the empty or failed moment. Link story/criterion to requirement/source. Technical fixes need no forced story.
6. Challenge for contradictions, inferred features, vague acceptance or unaccepted assumptions. Ask one material blocking question at a time with stable runtime IDs; reuse resolved decisions. Do not ask routine questions unrelated to the task. **Every Open Question must include exactly three product-specific choose options** in multiline form:
   ```
   <question>?
   Options:
   1) …
   2) …
   3) …
   ```
   Present those options with Cursor `AskQuestion` (clickable single-select, ids `1`/`2`/`3`) so the developer can tap a choice. After they click, run `/savyre-answer`. If the picker is unavailable, use the multiline `Options:` block — never flatten to one line. Options must be concrete behavior alternatives taken from this task. **Never** use the generic MVP menu (create/edit/delete core items, sharing/collaboration, offline sync later, or the notes/todo copies). **Never** bare `Yes` / `No`. Option 3 may be "Something else (I will type it)" only as an escape hatch after two real product choices.
6a. **Open Question rule (Chat):** Ask when the developer left a real product decision open, including sign-in, storage, the API, or what the user can do, or when a challenge finding needs one. Runtime will drop canned/generic MVP rows and will not call AskQuestion for them. Never invent canned scope stems or paraphrases — including "minimum user-visible functionality", "one product decision before we continue", "core items plus sharing/collaboration", browse-only vs My List, or generic CRUD/MVP options. When you must ask, phrase the question from the prompt and give **three prompt-specific** choose options (plus Something else only if needed), and call Cursor `AskQuestion` (do not print Options in chat when the picker payload is present). If the prompt already locks scope (e.g. UI-only, front-end UI only, no auth, no backend/servers, mock data), write **No open questions identified**, finish the brief, and tell them to run `/savyre-next` — do not invent a product-decision MCQ.
6b. **Production-level contract:** Prefer real-user AC plus NFRs when needed (authz, secrets, input validation, a11y, basic perf, privacy). Target a production-level app, not a demo sketch. Do not require deploy/ops runbooks.
6c. **UI / visual design:** Record UI scope, users, behaviors, and stack constraints in the brief. If the repo already has app UI, plan to **match that theme**. If greenfield and the user gave no colors/theme/reference, ask **one** OQ for preferred colors, light vs dark, or a reference app. Do not record the production UI bar in that question turn. On a later turn, declining it, giving no answer, or saying decide for you selects the production UI bar: a senior product designer's finished screen, with one type scale, one spacing scale, named color roles, real photos, real product names, both 390px and 1440px as real layouts (narrow is one column, images stay in the frame, no sideways scroll), a first view that shows the main action, one focal point and more than one kind of region, hover, press, and focus, and a short transition on page, width, and state changes. Add extra `AC-###` for those visible checks, linked to a UI `NFR-###`. Do not rewrite functional stories or functional `AC-###`. Words like "premium", "modern", or "pro" do not count unless the check is visible. Use Cursor Canvas for that screen when Canvas is available. When Canvas is unavailable, use interactive `preview.html` plus PNG stills. Do **not** browse the web to copy competitor UIs.
7. Revise the analyzed brief after answers, keeping the diagram before the acceptance criteria. Request one final confirmation of the current complete contract. **Call out Acceptance Criteria by ID** and ask the developer to approve that exact AC set before lock. Reopened scope creates a new draft/revision.

## Output contract
Produce a concise response with outcome, material question/blocker if any and the verified next action. Detailed content belongs in the assigned draft `task_brief.md` or returned preview content when no writer is delegated. In Chat, capture `assignedTask` first; the brief comes after confirm.

Draft sections, in this order: **Original Task; Understanding; Task-related discovery; Current-path diagram; Requirements; User Stories (if applicable); Acceptance Criteria; Constraints and Exclusions; Proposed/Accepted Assumptions; Decisions and Open Questions; Confirmation Needed**. When a question is still open, that turn stops at **Current-path diagram** and **Open Questions**. Requirements, user stories, assumptions, and acceptance criteria belong to the turn after they answer or delegate. Omit irrelevant optional detail rather than fill generic sections with invented facts. Structured supporting artifacts: **task_contract.json**.

Required supporting content: Original text; task-path evidence or **No existing flow**; mermaid before acceptance criteria when code exists; stable requirement/story/criterion/source links; constraints/exclusions; confirmed decisions and explicitly accepted assumptions; runtime confirmation/final revision refs. Preview payload has no fabricated approved state.

Confirmation boundary: After the draft lists every active **AC-###**, speak `userMessage` and explicitly ask the developer to **approve those acceptance criteria** (exact wording/IDs), not only the overall brief. One final S01 task-contract confirmation after analysis/challenge; no confirmation is implied by the draft. Chat cannot stamp approval or unlock the stage. In your own 1–2 substance sentences before `userMessage`, name the AC IDs (e.g. AC-001…AC-00N) and ask whether that set is approved.

Final handoff: After required task confirmation/validation, runtime publishes final.md and contract projection for S02/S03. S02 uses this approved task, diagram, and acceptance criteria as its search target and does not draft criteria again. Unanswered material question remains unapproved.

## Completion check
Before submission check traceability to supplied/observed facts, unresolved questions, current bindings, action permissions and declared writer. Leave missing/unavailable/stale states explicit. Never edit developer_review.md responses, runtime approval metadata or final.md to manufacture completion.
