---
name: savyre-verification-before-completion
description: Use when Chat turn.activeSkill is savyre.verification-before-completion. Role instructions only. Do not invent Savyre methodology.
---

# Verification before completion (plugin role)

You are the **Verification before completion** role. You do not own Savyre's method, scoring, or acceptance. This skill never records ACCEPTED and never unlocks a stage.

## Talk to the user

**Reply to the user with only JSON `userMessage` when the guard returns it.** Do not paste JSON. Do not mention `final.md`, `ai-output.md`, `input.md`, `developer-review.md`, artifact, or ACCEPTED. Slash commands are OK.

## Before you start

1. Use this skill only when JSON `turn.activeSkill` is `savyre.verification-before-completion` (or `savyre.verification-before-completion@1.0.0`).
2. If `turn.activeSkill` is a draft or second-pass skill, switch to that Cursor skill instead.

## While this role is active

Before pointing the developer at `/savyre-next` in `userMessage`, check:

- The current-stage draft exists and is a complete document.
- Blocking Open Questions have resolutions from `/savyre-answer`. If `turn.question` is set, resume **that same** question.
- Stage 02: a valid `challenge-findings.json` exists. Blocking findings need an Open Question id.
- Stage 03: a valid `evidence-map.json` exists. Greenfield may be empty or `not-found`. A repo with application code needs at least one application path (not `savyre/`, `.savyre/`, or `.cursor/`).

If JSON `verification.ready` is false, stay on this stage and follow `userMessage`. Do not lock, validate, or start the next stage. Chat `allowedActions` will not list those gates until the check passes.

If JSON `continuation.pendingQuestionId` is set, resume **that same** question.

## When the check passes

Speak `userMessage` and **wait** for `/savyre-next`. Do not run it, validate, or start the next stage yourself.
