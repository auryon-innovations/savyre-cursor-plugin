import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSavyreRuntimeReport, loadSavyreBrain, resetSavyreBrainCache } from './savyre-brain.mjs';

test('R07 plugin brain wiring passes runtime report', async () => {
  resetSavyreBrainCache();
  const report = await buildSavyreRuntimeReport();
  assert.ok(report.ok, JSON.stringify(report.candidates, null, 2));
  assert.ok(report.selected?.runConfigVersion);
});

test('R07 brain exposes session binding helpers for checkpoint transitions', async () => {
  resetSavyreBrainCache();
  const brain = await loadSavyreBrain();
  assert.ok(typeof brain.buildChatContinuation === 'function');
  assert.ok(typeof brain.checkpointPatchForStageTransition === 'function');
  assert.ok(typeof brain.evaluateResumeContinuation === 'function');
  assert.ok(typeof brain.preventDoubleConfirm === 'function');
});

test('R07 brain chat copy remains stable for regression baselines', async () => {
  resetSavyreBrainCache();
  const brain = await loadSavyreBrain();
  assert.equal(brain.chatUserMessage('ask_what_to_build'), 'What should we build?');
  assert.match(brain.chatUserMessage('need_challenge'), /second look/i);
});
