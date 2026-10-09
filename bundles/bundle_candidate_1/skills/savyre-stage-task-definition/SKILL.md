---
name: savyre-stage-task-definition
description: "Define and analyze a software task in Savyre S01 or an explicitly requested task-brief preview, returning requirements, applicable user stories and acceptance criteria for one final confirmation. Use for intake clarification and requirement challenge; not technical planning, code changes or delivery acceptance."
---

# S01 â€” Task Definition

## Boundary and inputs
Read `references/runtime-boundary.md` before managed or preview work. This package is a primary stage skill; compatible internal reusable roles assist it but do not replace its owner. In managed mode, check the verified active stage matches S01; mismatched/legacy context needs runtime mapping, not silent bypass.

- Original task and supplied references; project metadata and existing decisions
- In managed mode use the runtime draft-analysis path; analysis cannot require an already-approved S01 final

## Reusable skill invocation
Read `references/invocation-map.md` before selecting a dedicated/shared pass. S01 uses savyre-requirement-challenge after analyzed draft; S02 uses savyre-evidence-grounding after discovery before impact. Cross-stage consumers run only when their runtime records/checkpoint are present. Managed invocation requires registered compatible package and delegated pass; missing assignment/availability is a diagnostic or explicit runtime fallback, not proof a call ran. The primary remains the stage owner; do not call savyre-run-stage recursively.

## Hybrid acceptance criteria (required)

- **AI drafts** observable AC (`AC-###`) linked to `FR-###` / `NFR-###`; **human must approve** the exact contract version before freeze.
- Each AC needs a stable ID, requirement refs, observable action/outcome, and an objectively assessable expected result. Avoid unmeasurable terms without an agreed check.
- Identify assumptions as proposals; challenge vague, missing, or inferred acceptance. Ask one material blocking question at a time.
- **Do not write executable tests** in S01 (no test files, no claiming tests were generated). AC are the product contract; tests come in S04.
- Never recycle AC IDs. Revised wording for the same outcome keeps the ID and gets a new contract version. Removed AC stay as retired history; new outcomes get new IDs.
- Do not silently add product scope. Human confirmation refers to an exact contract version/hash; editing the contract invalidates that approval for the edited version.

## Chat capture (required before confirm)

Same behavior in Cursor Agent and Claude Code. When managed Chat has this stage enforced:

1. As soon as the developer names the product (chat message or leftover after `/savyre-start`), write a 2â€“4 sentence restatement plus Product / UX / API / Data / Stack (only supported headings) as `assignedTask` in `stages/s01_task_definition/stage_input.json` (JSON is the SoT; runtime regenerates the `stage_input.md` companion).
2. Speak that same restatement, then speak JSON `userMessage` exactly. Confirm copy names `stages/s01_task_definition/stage_input.md` â€” never tell the developer to confirm `stage_input.json`. Wait for `/savyre-next` to confirm. Do **not** write `task_brief.md` before confirm.
3. After confirm, write `task_brief.md`, run `turn`. When `turn.activeSkill` becomes `savyre.requirement-challenge`, **in the same agent turn** write `stages/s01_task_definition/challenge_findings.json` (`schemaVersion` `"1.0"`, `findings` array â€” empty OK), run `turn` again, then speak `userMessage` exactly (AC approve + `/savyre-next` to lock).
4. Never invent a Savyre panel task box, Send button, or panel Validate step. Chat has no panel capture UI.
5. `/savyre-next` confirms only when `assignedTask` is non-empty. A filled `task_brief.md` alone is not enough. Lock also needs `challenge_findings.json` on disk.

## Procedure

1. Capture exact designated original task separately from a helpful restatement; distinguish product requirements from workflow instructions. In Chat, that capture is the `assignedTask` write above.
2. Extract supported requirements and observable criteria. For a user-facing task, each story is a person, a screen, one main action, and the empty or failed moment. Link story/criterion to requirement/source. Technical fixes need no forced story.
3. Challenge for contradictions, inferred features, vague acceptance or unaccepted assumptions. Ask one material blocking question at a time with stable runtime IDs; reuse resolved decisions. Do not ask routine questions unrelated to the task. **Every Open Question must include exactly three product-specific choose options** in multiline form:
   ```
   <question>?
   Options:
   1) â€¦
   2) â€¦
   3) â€¦
   ```
   Present those options with Cursor `AskQuestion` (clickable single-select, ids `1`/`2`/`3`) so the developer can tap a choice. After they click, run `/savyre-answer`. If the picker is unavailable, use the multiline `Options:` block â€” never flatten to one line. Options must be concrete product/behavior alternatives for *this* app (e.g. â€œCreate/edit/delete notesâ€, â€œShared listsâ€, â€œOffline personal onlyâ€) â€” **never** bare `Yes` / `No`. Option 3 may be â€œSomething else (I will type it)â€ only as an escape hatch after two real product choices.
3a. **Open Question rule (Chat):** Ask **only** when the developer left a real undecided product decision in the prompt (or a challenge finding needs one). Runtime will drop canned/generic MVP rows and will not call AskQuestion for them. Never invent canned scope stems or paraphrases — including "minimum user-visible functionality", "one product decision before we continue", "core items plus sharing/collaboration", browse-only vs My List, or generic CRUD/MVP options. When you must ask, phrase the question from the prompt and give **three prompt-specific** choose options (plus Something else only if needed), and call Cursor `AskQuestion` (do not print Options in chat when the picker payload is present). If the prompt already locks scope (e.g. UI-only, front-end UI only, no auth, no backend/servers, mock data), write **No open questions identified**, finish the brief, and tell them to run `/savyre-next` — do not invent a product-decision MCQ.
3b. **Production-level contract:** Prefer real-user AC plus NFRs when needed (authz, secrets, input validation, a11y, basic perf, privacy). Target a production-level app, not a demo sketch. Do not require deploy/ops runbooks.
3c. **UI / visual design:** Record UI scope, users, behaviors, and stack constraints in the brief. If the repo already has app UI, plan to **match that theme**. If greenfield and the user gave no colors/theme/reference, ask **one** OQ for preferred colors, light vs dark, or a reference app. Declining it, or saying decide for you, selects the production UI bar: a senior product designer’s finished screen, with one type scale, one spacing scale, named color roles, real photos, real product names, both 390px and 1440px as real layouts (narrow is one column, images stay in the frame, no sideways scroll), a first view that shows the main action, one focal point and more than one kind of region, hover, press, and focus, and a short transition on page, width, and state changes. Add extra `AC-###` for those visible checks, linked to a UI `NFR-###`. Do not rewrite functional stories or functional `AC-###`. Words like “premium”, “modern”, or “pro” do not count unless the check is visible. Do **not** browse the web to copy competitor UIs.
4. Revise analyzed brief after answers, then request one final confirmation of the current complete contract. **Call out Acceptance Criteria by ID** and ask the developer to approve that exact AC set before lock. Reopened scope creates a new draft/revision.

## Output contract
Produce a concise response with outcome, material question/blocker if any and the verified next action. Detailed content belongs in the assigned draft `task_brief.md` or returned preview content when no writer is delegated. In Chat, capture `assignedTask` first; the brief comes after confirm.

Draft sections: **Original Task; Understanding; Requirements; User Stories (if applicable); Acceptance Criteria; Constraints and Exclusions; Proposed/Accepted Assumptions; Decisions and Open Questions; Confirmation Needed**. Omit irrelevant optional detail rather than fill generic sections with invented facts. Structured supporting artifacts: **task_contract.json**.

Required supporting content: Original text; stable requirement/story/criterion/source links; constraints/exclusions; confirmed decisions and explicitly accepted assumptions; runtime confirmation/final revision refs. Preview payload has no fabricated approved state.

Confirmation boundary: After the draft lists every active **AC-###**, speak `userMessage` and explicitly ask the developer to **approve those acceptance criteria** (exact wording/IDs), not only the overall brief. One final S01 task-contract confirmation after analysis/challenge; no confirmation is implied by the draft. Chat cannot stamp approval or unlock the stage. In your own 1â€“2 substance sentences before `userMessage`, name the AC IDs (e.g. AC-001â€¦AC-00N) and ask whether that set is approved.

Final handoff: After required task confirmation/validation, runtime publishes final.md and contract projection for S02/S03. Unanswered material question remains unapproved.

## Completion check
Before submission check traceability to supplied/observed facts, unresolved questions, current bindings, action permissions and declared writer. Leave missing/unavailable/stale states explicit. Never edit developer_review.md responses, runtime approval metadata or final.md to manufacture completion.
