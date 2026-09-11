import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSavyreBrain, resolveSavyreBrainIndex } from './savyre-brain.mjs';

test('resolves @savyre/run-config next to the plugin or extension', () => {
  const abs = resolveSavyreBrainIndex();
  assert.ok(abs, 'expected to find run-config dist/index.js');
  assert.match(abs.replaceAll('\\', '/'), /run-config\/dist\/index\.js$/);
});

test('chatUserMessage comes from the Savyre brain, not the plugin', async () => {
  const brain = await loadSavyreBrain();
  assert.ok(brain);
  assert.equal(brain.chatUserMessage('ask_what_to_build'), 'What should we build?');
  assert.equal(
    brain.chatUserMessage('confirm_task'),
    "If that's right, run `/savyre-next` to confirm."
  );
  assert.equal(
    brain.chatUserMessage('task_confirmed_draft'),
    "I'll write the Task Input draft from what you confirmed."
  );
});
