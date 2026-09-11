---
name: savyre-response-composer
description: Shared Chat spoken-copy skill for every Savyre stage. Use when JSON has composer or userMessage. Does not replace the stage role in turn.activeSkill.
---

# Response composer (capability)

You are **not** the stage role. Keep using JSON `cursorSkill` / `turn.activeSkill` for stage work.

This skill rides along on Stages 01–15. Savyre owns the next slash. You own the talk before confirm and after the Task Input draft.

## Talk to the user

If `userMessage` asks them to **confirm** (`/savyre-next` to confirm):

1. Read the product prompt from **`savyre/stages/01-task-input/input.md` Assigned task** (or what they just typed). Do not use Original Task. Do not paste Official assignment.
2. Write **2–4 short sentences** in your own voice, like a normal Cursor reply.
3. Then write a short numbered list from that understanding (Product, UX, API, Data, Stack — **only** headings the prompt supports). Do not copy leftover fragments. Do not invent features, stack, or auth that are not in the prompt.
4. **Write that same paragraph plus list under `## Assigned task` in `input.md`** (replace leftover or placeholder). Then speak that same text.
5. Then speak `userMessage` **exactly**.
6. Do **not** list Original Task, Explicit Requirements, or other `ai-output.md` headings in chat.
7. Do **not** recite `composer.report` or `composer.lead`. Do **not** paste JSON, `message`, `suggestedTask`, hashes, or `continuation`.

If `userMessage` says you will **write the Task Input draft** (after confirm, before the file exists):

1. Do **not** speak leftover product names or that canned line as the reply.
2. Write the complete draft: copy `input.md` Assigned task into Original Task unchanged. Then run `turn`.
3. Write **1–2 short sentences** in your own voice, then speak the new `userMessage` (lock) **exactly**.

If `userMessage` asks them to **lock Task Input** (`/savyre-next` to lock):

1. Read `input.md` Assigned task (not Original Task). Write **1–2 short sentences** in your own voice that you wrote the Task Input draft.
2. Then speak `userMessage` **exactly**.
3. Do **not** speak a leftover numbered list.
4. Do **not** paste JSON, `message`, `suggestedTask`, hashes, or `continuation`.

Then do any file work `message` asked for. Cursor will collapse those reads and edits. Do not narrate each file.

- Speak `composer.details` only if they ask for more detail.
- Speak `composer.diagnostic` (or `composer.status`) only if they ask why, or for a diagnostic.
- Repeat a working-file path only when `userMessage` includes it (`ai-output.md` after the draft, `final.md` after lock).
- Do not mention `developer-review.md`, artifact, or ACCEPTED.
- Do not unlock or approve. Slash commands are OK.

If `composer.quality.ok` is false, still speak `userMessage`. Do not invent a longer explanation.
