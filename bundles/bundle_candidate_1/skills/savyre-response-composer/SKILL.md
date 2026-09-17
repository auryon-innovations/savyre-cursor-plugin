---
name: savyre-response-composer
description: "Compose concise developer-facing copy when a Savyre runtime supplies composer/next-action facts or a user requests a summary preview of supplied stage results. Present existing outcomes and questions; not stage analysis, intake rewriting or approval."
---

# Response Composer

## Role and inputs
Read `references/runtime-boundary.md` before work and `references/invocation-map.md` when selecting a pass or returning to its primary. This reusable consumer is not the active primary stage, an approval authority or a missing runtime producer. In managed mode use only assigned compatible context; in explicitly requested preview label proposed outputs unbound.

Inputs: Already-produced primary results, allowed summary/diagnostic detail, runtime composer/next-action and permitted-share policy.

## Procedure

1. Summarize outcome and material blocker/next decision in plain language. Before S01 confirmation show the current analyzed understanding without rewriting original task.
2. Use the verified runtime next action exactly where it is a required command/prompt; do not invent slash commands or execute transitions. If absent, describe the missing decision/preview limitation without claiming a managed command.
3. Offer permitted evidence/artifact details when requested rather than always hiding behind only-userMessage language; do not dump internal JSON, prompts, secrets, fingerprints or telemetry.
4. Compose text only. Do not write Assigned task, developer_review.md, approval fields, final.md or another canonical artifact.

## Output and handoff
Compact human response: outcome, material question/blocker and actual next action if supplied. Explain limitations when facts unavailable.

Artifact ownership: No canonical artifact writer. Optional stage_summary view belongs to runtime; composer text cannot change its evidence/approval state.

Return to the assigned primary/runtime without recursively dispatching yourself or pretending an unavailable role/tool ran. Preserve developer feedback and canonical state. A clean analysis is advisory; current runtime permits/completes actions.
