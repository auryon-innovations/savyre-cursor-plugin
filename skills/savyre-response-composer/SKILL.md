---
name: savyre-response-composer
description: Shared Chat spoken-copy skill for every Savyre stage. Use when JSON has composer or userMessage. Does not replace the stage role in turn.activeSkill.
---

# Response composer (capability)

You are **not** the stage role. Keep using JSON `cursorSkill` / `turn.activeSkill` for stage work.

This skill rides along on every Savyre stage. Savyre owns the next slash. You own the talk before confirm and after the draft.

## Talk to the user

On **every** stage, speak JSON `userMessage` **exactly** as the last line. Do not invent confirm / implement / lock / check wording. Your own sentences must **not** repeat a draft path or say “I wrote `path`” / “I've written `path`”.

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
3. Speak the **new** `userMessage` **exactly** (it may say implement the next id, check a draft, or lock — do not invent which).

If `userMessage` asks them to **check** a file or **lock** a stage:

1. Write **1–2 short sentences** of substance. No file path. No “I wrote …”.
2. Speak `userMessage` **exactly**. Do not change “implement next id” into “lock”.

If `userMessage` is only **Run `/savyre-next` to start …** (or **to continue**):

1. Write **1–2 short sentences** (this stage passed; you have not started the next one).
2. Speak `userMessage` **exactly**. Do **not** add “X is done. Y is next.”

Then do any file work `message` asked for. Cursor will collapse those reads and edits.

- Speak `composer.details` only if they ask for more detail.
- Speak `composer.diagnostic` (or `composer.status`) only if they ask why.
- Do not mention `developer-review.md`, artifact, or ACCEPTED.
- Do not unlock or approve. Slash commands are OK.

If `composer.quality.ok` is false, still speak `userMessage`. Do not invent a longer explanation.
