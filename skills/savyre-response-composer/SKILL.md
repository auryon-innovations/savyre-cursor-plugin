---
name: savyre-response-composer
description: Shared Chat spoken-copy skill for every Savyre stage. Use when JSON has composer or userMessage. Does not replace the stage role in turn.activeSkill.
---

# Response composer (capability)

You are **not** the stage role. Keep using JSON `cursorSkill` / `turn.activeSkill` for stage work.

This skill rides along on every Savyre stage. Savyre owns the next slash. You own the talk before confirm and after the Stage 01 draft.

## Talk to the user

**Always** make two things obvious:

1. **Which file you wrote** — exact path in backticks from `userMessage` / `message` (so the developer can open it)
2. **Which command is next** — usually `/savyre-next` (or `/savyre-answer OQ-00N …` if a question is pending)

If `userMessage` asks them to **confirm** (`/savyre-next` to confirm):

1. Read the product prompt from Stage 01 capture:
   - seven-stage: `stages/s01_task_definition/stage_input.json` field `assignedTask`
   - legacy: `savyre/stages/01-task-input/input.md` under Assigned task
2. Write **2–4 short sentences** in your own voice, like a normal Cursor reply.
3. Then write a short numbered list (Product, UX, API, Data, Stack — **only** headings the prompt supports).
4. **Save that same text** into the Stage 01 capture file above. Then speak that same text.
5. Then speak `userMessage` **exactly** (it names the path + `/savyre-next`).
6. Do **not** list Original Task / Explicit Requirements headings in chat.
7. Do **not** paste JSON, `message`, hashes, or `continuation`.

If `userMessage` says you will **write the draft** (path in backticks):

1. Write that exact file completely (do not leave scaffold stubs).
2. Run `turn`.
3. Speak the new `userMessage` **exactly** (it will say Please check \`path\` + `/savyre-next`).

If `userMessage` asks them to **lock** (Please check \`…\` + `/savyre-next`):

1. Write **1–2 short sentences** that you wrote the draft.
2. Speak `userMessage` **exactly**.

Then do any file work `message` asked for. Cursor will collapse those reads and edits.

- Speak `composer.details` only if they ask for more detail.
- Speak `composer.diagnostic` (or `composer.status`) only if they ask why.
- Repeat the working-file path whenever `userMessage` includes it.
- Do not mention `developer-review.md`, artifact, or ACCEPTED.
- Do not unlock or approve. Slash commands are OK.

If `composer.quality.ok` is false, still speak `userMessage`. Do not invent a longer explanation.
