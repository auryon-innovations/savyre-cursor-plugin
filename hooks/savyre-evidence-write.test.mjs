import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadSavyreBrain, resetSavyreBrainCache } from './savyre-brain.mjs';

const ORG_RUN_CONFIG = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'savyre-ai-eng-org',
  'packages',
  'savyre-run-config'
);

test('brain denies empty greenfield evidence for app repos and accepts path items', async () => {
  const previous = process.env.SAVYRE_RUN_CONFIG_PATH;
  process.env.SAVYRE_RUN_CONFIG_PATH = ORG_RUN_CONFIG;
  resetSavyreBrainCache();
  try {
    const brain = await loadSavyreBrain();
    assert.ok(brain);
    assert.equal(typeof brain.evaluateEvidenceMapWrite, 'function');
    assert.equal(typeof brain.isEvidenceMapGateComplete, 'function');
    assert.equal(typeof brain.workspaceHasProductSource, 'function');

    const bare = {
      schemaVersion: '1.0',
      stageId: 's02-code-discovery',
      greenfield: true,
      items: []
    };
    assert.equal(brain.isEvidenceMapGateComplete(bare, { hasApplicationCode: true }), false);
    assert.equal(brain.evaluateEvidenceMapWrite(bare, { hasApplicationCode: true }).ok, false);

    const completedGreenfield = { ...bare, status: 'completed' };
    assert.equal(
      brain.isEvidenceMapGateComplete(completedGreenfield, { hasApplicationCode: false }),
      true
    );
    assert.equal(
      brain.evaluateEvidenceMapWrite(completedGreenfield, { hasApplicationCode: false }).ok,
      true
    );

    const withPaths = {
      schemaVersion: '1.0',
      stageId: 's02-code-discovery',
      status: 'completed',
      items: [
        {
          path: 'client/src/index.js',
          evidenceType: 'code',
          confidence: 'high',
          anchor: 'routes'
        }
      ]
    };
    assert.equal(brain.isEvidenceMapGateComplete(withPaths, { hasApplicationCode: true }), true);
    assert.equal(brain.evaluateEvidenceMapWrite(withPaths, { hasApplicationCode: true }).ok, true);
  } finally {
    if (previous === undefined) delete process.env.SAVYRE_RUN_CONFIG_PATH;
    else process.env.SAVYRE_RUN_CONFIG_PATH = previous;
    resetSavyreBrainCache();
  }
});
