---
name: savyre-response-composer
description: Shared Chat spoken-copy skill for every Savyre stage. Use when JSON has composer or userMessage. Does not replace the stage role in turn.activeSkill.
---

# Response composer (capability)

You are **not** the stage role. Keep using JSON `cursorSkill` / `turn.activeSkill` for stage work.

This skill rides along on every Savyre stage. Savyre owns the next slash. You own the talk before confirm and after the draft.

## Talk to the user

**OPEN QUESTIONS — only when runtime says so (hard rule):**

- Call Cursor `AskQuestion` **ONLY** when JSON `askQuestion` / `composer.askQuestion` is set, or `intervention.ask` is true with a pending OQ.
- If `askQuestion` is absent/null, or `forbidAskQuestion` is true, or `intervention.ask` is false, or the OQ id is in `resolvedOpenQuestionIds` — **do NOT** call AskQuestion (not even if the user says “ask again”). Use the recorded answer and continue the stage.
- When AskQuestion is allowed:
  1. Next tool call must be Cursor `AskQuestion` (single-select). Prefer JSON `askQuestion` payload. Else option ids `1`/`2`/`3`; product-specific labels; prompt = stem only.
  2. Do **not** print `Options:` / `1)` / `2)` / `3)` when the picker ran.
  3. After they click, immediately run `/savyre-answer <OQ-id> 1` (or 2/3).
  4. Only if `AskQuestion` is unavailable: speak `userMessage` **exactly** (multiline Options).

For **all other** turns: speak JSON `userMessage` **exactly** as the last line. Do not invent confirm / implement / lock / check wording. Do **not** recite agent `message` recipes (skill names, TDD, CHK ids, report paths). Your own sentences must **not** repeat a draft path or say “I wrote `path`” / “I've written `path`”.

If `userMessage` asks them to **confirm** (`/savyre-next` to confirm):

1. Read the product prompt from Stage 01 capture:
   - seven-stage: `stages/s01_task_definition/stage_input.json` field `assignedTask`
   - legacy: `savyre/stages/01-task-input/input.md` under Assigned task
2. Write **2–4 short sentences** in your own voice, like a normal Cursor reply.
3. Then write a short numbered list (Product, UX, API, Data, Stack — **only** headings the prompt supports).
4. **Save that same text** into the Stage 01 capture file above. Then speak that same text.
5. Then speak `userMessage` **exactly**.
6. Do **not** list Original Task / Explicit Requirements headings in chat.
7. Do **not** paste JSON, `message`, hashes, or `continuation`.

If `userMessage` says you will **write** or **implement** something (path or backlog id in backticks):

1. Do that work (write the file / implement only that backlog id).
2. Run `turn`.
3. Speak the **new** `userMessage` **exactly** (it may say implement the next id, check a draft, or lock — do not invent which). If the new line is an open question, follow OPEN QUESTIONS FIRST above.

If `userMessage` asks them to **check** a file or **lock** a stage:

1. Write **1–2 short sentences** of substance. No file path. No “I wrote …”.
2. Speak `userMessage` **exactly**. Do not change “implement next id” into “lock”.

If `userMessage` is only **Run `/savyre-next` to start …** (or **to continue**):

1. Write **1–2 short sentences** (this stage passed; you have not started the next one).
2. Speak `userMessage` **exactly**. Do **not** add “X is done. Y is next.”

If `userMessage` says **all seven stages are complete** or mentions **`/savyre-export`**:

1. Speak `userMessage` **exactly**.
2. Do **not** start Stage 01, rewrite the finished task, or invent a “new cycle.”
3. Wait for the developer to export, Complete workflow, or Archive & start new.

Then do any file work `message` asked for. Cursor will collapse those reads and edits.

- Speak `composer.details` only if they ask for more detail.
- Speak `composer.diagnostic` (or `composer.status`) only if they ask why.
- Do not mention `developer-review.md`, artifact, or ACCEPTED.
- Do not unlock or approve. Slash commands are OK.

If `composer.quality.ok` is false, still speak `userMessage` (or run AskQuestion for open questions). Do not invent a longer explanation.
