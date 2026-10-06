# Candidate bundle — source of truth

**Canonical location:** `packages/savyre-run-config/bundles/bundle_candidate_1/` in **savyre-ai-eng-org**.

## Sync direction (required)

```text
savyre-ai-eng-org (this tree)
  → savyre-cursor-plugin/bundles/bundle_candidate_1
  → savyre-claude-plugin/bundles/bundle_candidate_1
  → ~/.cursor/plugins/local/savyre-cursor-plugin (optional local install)
```

**Never** copy plugin bundles back into this org package. Edits belong here only.

## Publish

From this package:

```bash
npm run publish:bundle
```

Or:

```bash
node scripts/publish-candidate-bundle.mjs
```

Claude adapter can also refresh from org via:

```bash
node ../savyre-claude-plugin/scripts/sync-skills.mjs
```

(that script pulls the **candidate bundle from org**, not from Claude into org).
