# Declared stage-to-skill invocation contract

Read when routing a stage or selecting a reusable pass. This is a candidate call contract, not proof current Savyre executes these calls. Runtime owns dispatch/allowed actions and must implement it using compatible bundle identities. Resolve packages by registered name/entry, never assumed sibling paths. Load only required roles; maintain one active primary stage owner.

## Primary stages and ordered dedicated subpasses
| Stage | Primary | Dedicated pass | When |
|---|---|---|---|
| S01 | savyre-stage-task-definition | savyre-requirement-challenge | After analyzed draft, before task confirmation |
| S02 | savyre-stage-code-discovery | savyre-evidence-grounding | After discovery, before grounded impact/finalization |
| S03 | savyre-stage-implementation-plan | none mandatory | Existing backlog validation is runtime logic |
| S04 | savyre-stage-build-review | none mandatory | Separate read-only review; disclose self-review if no independent reviewer |
| S05 | savyre-stage-test-resolve | none mandatory | Strategy/diagnosis read-only; write/correction action dispatched to S04 |
| S06 | savyre-stage-delivery-readiness | none mandatory | Actual readiness policy is runtime logic |
| S07 | savyre-stage-handoff | none mandatory | Export is supported runtime action |

## Cross-stage reusable consumers
- savyre-run-stage: entry dispatcher; check stage/session/bundle before primary. Primary and subpasses do not recursively call router.
- savyre-chat-continuation: before resuming, only with a runtime resume record; restore same question/action and actual task refs, not a hash as wording.
- savyre-unified-chat-turn: consume actual runtime turn/next-action projection after status/results; it is not the missing chat-action producer.
- savyre-intervention-judge: before asking a question, only with a supplied runtime intervention decision; no new permission/assumption acceptance.
- savyre-failure-recovery: only on runtime-reported failure/recovery state; bounded repair/retry/ask/blocked/fallback within current authority.
- savyre-verification-before-completion: after required internal passes, before recommending finalization or transition; only check current checkpoint evidence, not software correctness by appearance.
- savyre-response-composer: last presentation step, using already-produced stage facts and verified next action; does not overwrite intake/review/state.

Order is conditional, not an instruction to load all nine every turn. Runtime guards and user responses can pause/reopen work at any step. S01 challenger returning blockers preserves stable question IDs; S02 grounder returning gaps prevents unqualified impact assertions. Verification fails or unknown remains blocked/unassessed, not approval.

## Availability and preview
In managed mode if runtime assigns a dedicated subpass, check the assigned package/version exists and is allowed. If absent/incompatible stop that subpass with diagnostic or ask runtime for an explicit approved fallback; never claim it ran. Existing primary skills may perform their defined internal analysis only when runtime delegates that fallback. In standalone preview use available packaged dedicated skills by name to analyze supplied evidence and label draft outputs unbound. Do not claim runtime invocation occurred.

Each subpass returns findings/evidence/limitations to its primary and runtime; it does not take over artifact ownership. No dynamic fallback from one stage to another or legacy-number mapping is assumed. Test creation/fixes in S05 are requests for an authorized S04 action; after changed source, runtime invalidates and refreshes relevant reviews/runs.
