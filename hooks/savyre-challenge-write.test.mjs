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

test('brain denies bare passed:true challenge writes and accepts completed', async () => {
  const previous = process.env.SAVYRE_RUN_CONFIG_PATH;
  process.env.SAVYRE_RUN_CONFIG_PATH = ORG_RUN_CONFIG;
  resetSavyreBrainCache();
  try {
    const brain = await loadSavyreBrain();
    assert.ok(brain);
    assert.equal(typeof brain.evaluateChallengeFindingsWrite, 'function');
    assert.equal(typeof brain.isChallengeFindingsGateComplete, 'function');

    const shortcut = brain.evaluateChallengeFindingsWrite({
      schemaVersion: '1.0',
      stageId: 's01-task-definition',
      passed: true,
      findings: []
    });
    assert.equal(shortcut.ok, false);
    assert.equal(
      brain.isChallengeFindingsGateComplete({
        schemaVersion: '1.0',
        stageId: 's01-task-definition',
        passed: true,
        findings: []
      }),
      false
    );

    const completed = brain.evaluateChallengeFindingsWrite({
      schemaVersion: '1.0',
      stageId: 's01-task-definition',
      status: 'completed',
      passed: true,
      findings: []
    });
    assert.equal(completed.ok, true);
    assert.equal(
      brain.isChallengeFindingsGateComplete({
        schemaVersion: '1.0',
        stageId: 's01-task-definition',
        status: 'completed',
        passed: true,
        findings: []
      }),
      true
    );
  } finally {
    if (previous === undefined) delete process.env.SAVYRE_RUN_CONFIG_PATH;
    else process.env.SAVYRE_RUN_CONFIG_PATH = previous;
    resetSavyreBrainCache();
  }
});
