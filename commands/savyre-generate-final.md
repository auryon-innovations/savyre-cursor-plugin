---
name: savyre-generate-final
description: Run the same Savyre Generate final gate as the panel. Use when the user runs /savyre-generate-final.
---

# savyre-generate-final

Call the same Savyre action the panel uses. Do not write `final.md` yourself.

Run this **only after the developer types `/savyre-generate-final`**. Do not run it because Open Questions are empty.

Run from the **project** workspace root:

```bash
node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" action generate_final
```

## What to say

**Reply to the user with only JSON `userMessage`.** Do not paste JSON. Do not quote `message`. Follow `message` yourself. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

0. If `ok` is false because the challenge pass, evidence map, or an Open Question is still open, speak `userMessage` and **wait**. Do not invent a generate-final. Follow `turn.activeSkill`.

1. Follow `ok`, `data.stageId`, `panelStageId`, `boundStageId`, and `reason`. Do not dump them.
2. If `ok` is false because Chat is bound to a **different** stage than the panel, do **not** generate Stage 01 again. Speak `userMessage` and **wait**.
3. A `warning` about server scaffold / “continuing locally” is **not** a failed generate. Follow `ok`.
4. If `ok` is true, speak `userMessage` (ask `/savyre-validate`) and **wait**. Do not run validate yourself. Do not compare to a later panel refresh.
5. If `ok` is false for missing headings, **write or rewrite** `ai-output.md` using the start JSON `artifactTemplate`. Then speak `userMessage`. Do **not** run `/savyre-validate`. Do not invent ACCEPTED.
6. This does not unlock the next stage. Generate final runs only when Chat bind equals panel `currentStageId`.
