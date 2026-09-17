---
name: savyre-evidence-grounding
description: "Ground an observed Savyre S02 discovery draft when the runtime assigns evidence grounding or a user requests a source-evidence audit preview. Return current path/symbol support and bounded gaps before impact; not repository-wide guarantees, planning or stage acceptance."
---

# Evidence Grounding

## Role and inputs
Read `references/runtime-boundary.md` before work and `references/invocation-map.md` when selecting a pass or returning to its primary. This reusable consumer is not the active primary stage, an approval authority or a missing runtime producer. In managed mode use only assigned compatible context; in explicitly requested preview label proposed outputs unbound.

Inputs: S02 observed draft, bounded source index/snippets, allowed application scope and current source bindings; optional diagrams/docs labeled by origin.

## Procedure

1. Check each observed file/component/relationship against actual supplied/current application evidence. Validate accessible paths; unavailable files become unresolved, not observed.
2. Exclude process scaffolding from application findings under runtime scope. Greenfield can return empty application evidence with not-found-in-scanned-scope reason.
3. Separate code/test/doc/not-found evidence, observation versus inference, confidence reasons and scan/truncation/source freshness. Never invent a symbol, execution edge or absence beyond inspected scope.
4. Return grounded corrections/gaps to S02 primary before impact analysis. Persist discovery_evidence.json only through its single delegated runtime/grounding writer; legacy evidence-map.json requires explicit mapping.

## Output and handoff
Discovery evidence items with observed path/symbol when available, type, source/evidence refs, confidence reason, relationship status, bounded not-found and limitation/truncation flags.

Artifact ownership: discovery_evidence.json payload; optional diagram/table consumes the same grounded relationships. No second evidence-map writer.

Return to the assigned primary/runtime without recursively dispatching yourself or pretending an unavailable role/tool ran. Preserve developer feedback and canonical state. A clean analysis is advisory; current runtime permits/completes actions.
