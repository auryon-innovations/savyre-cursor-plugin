import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  buildSavyreRuntimeReport,
  loadSavyreBrain,
  resetSavyreBrainCache,
  resolveSavyreBrainCandidates
} from './savyre-brain.mjs';

test('selects a compatible run-config candidate and reports identity', async () => {
  resetSavyreBrainCache();
  const report = await buildSavyreRuntimeReport();
  assert.ok(report.ok, JSON.stringify(report.candidates, null, 2));
  assert.match(String(report.selected?.indexPath || '').replaceAll('\\', '/'), /run-config\/dist\/index\.js$/);
  assert.ok(report.selected?.runConfigVersion);
});

test('chatUserMessage comes from the Savyre brain, not the plugin', async () => {
  resetSavyreBrainCache();
  const brain = await loadSavyreBrain();
  assert.ok(brain);
  assert.equal(brain.chatUserMessage('ask_what_to_build'), 'What should we build?');
  assert.equal(
    brain.chatUserMessage('confirm_task'),
    "I've saved that under `savyre/stages/01-task-input/input.md`. If that's right, run `/savyre-next` to confirm."
  );
  assert.equal(
    brain.chatUserMessage('confirm_task', { stageId: 's01-task-definition' }),
    "I've saved that under `stages/s01_task_definition/stage_input.json`. If that's right, run `/savyre-next` to confirm."
  );
  assert.equal(
    brain.chatUserMessage('task_confirmed_draft'),
    "I'll write `savyre/stages/01-task-input/ai-output.md` from what you confirmed."
  );
  assert.equal(
    brain.chatUserMessage('task_confirmed_draft', { stageId: 's01-task-definition' }),
    "I'll write `stages/s01_task_definition/task_brief.md` from what you confirmed."
  );
});

test('skips an incompatible automatic candidate for a later compatible one', async () => {
  const previous = process.env.SAVYRE_RUN_CONFIG_PATH;
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'savyre-brain-'));
  const badRoot = path.join(tmp, 'bad');
  mkdirSync(path.join(badRoot, 'dist'), { recursive: true });
  writeFileSync(
    path.join(badRoot, 'dist', 'index.js'),
    'export function chatUserMessage() { return "bad"; }\n',
    'utf8'
  );
  process.env.SAVYRE_RUN_CONFIG_PATH = badRoot;
  resetSavyreBrainCache();
  try {
    const candidates = await resolveSavyreBrainCandidates();
    const first = candidates[0];
    assert.equal(first.status, 'incompatible');
    const report = await buildSavyreRuntimeReport();
    assert.ok(report.ok, 'expected a later compatible candidate');
    assert.notEqual(report.selected?.indexPath, first.indexPath);
  } finally {
    if (previous === undefined) delete process.env.SAVYRE_RUN_CONFIG_PATH;
    else process.env.SAVYRE_RUN_CONFIG_PATH = previous;
    resetSavyreBrainCache();
  }
});
