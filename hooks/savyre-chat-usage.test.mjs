import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'os';
import path from 'path';
import { test } from 'node:test';
import {
  CHAT_AI_TOOL,
  persistChatHookUsage,
  parseChatHookUsage
} from './savyre-chat-usage.mjs';

test('parseChatHookUsage does not add cache on top of input_tokens', () => {
  const parsed = parseChatHookUsage({
    input_tokens: 500,
    output_tokens: 25,
    cache_read_tokens: 80,
    cache_write_tokens: 10
  });
  assert.equal(parsed.prompt_tokens, 500);
  assert.equal(parsed.completion_tokens, 25);
  assert.equal(parsed.total_tokens, 525);
});

test('persistChatHookUsage accumulates turns and skips duplicate generation ids', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'savyre-chat-usage-'));
  try {
    const first = await persistChatHookUsage({
      workspace: root,
      stageId: '01-task-input',
      executionId: 'exec-1',
      hookInput: {
        input_tokens: 100,
        output_tokens: 20,
        generation_id: 'gen-1',
        model: 'composer-2'
      }
    });
    assert.equal(first.recorded, true);
    assert.equal(first.ai_usage.tool, CHAT_AI_TOOL);
    assert.equal(first.ai_usage.total_tokens, 120);

    const dup = await persistChatHookUsage({
      workspace: root,
      stageId: '01-task-input',
      executionId: 'exec-1',
      hookInput: {
        input_tokens: 100,
        output_tokens: 20,
        generation_id: 'gen-1'
      }
    });
    assert.equal(dup.recorded, false);
    assert.equal(dup.reason, 'duplicate-generation');

    const second = await persistChatHookUsage({
      workspace: root,
      stageId: '01-task-input',
      executionId: 'exec-1',
      hookInput: {
        input_tokens: 10,
        output_tokens: 5,
        generation_id: 'gen-2'
      }
    });
    assert.equal(second.recorded, true);
    assert.equal(second.ai_usage.prompt_tokens, 110);
    assert.equal(second.ai_usage.completion_tokens, 25);
    assert.equal(second.ai_usage.ai_calls, 2);

    const meta = JSON.parse(
      await readFile(path.join(root, 'savyre', 'stages', '01-task-input', 'metadata.json'), 'utf8')
    );
    assert.equal(meta.ai_usage.usage_source, 'provider');
    assert.equal(meta.ai_usage.total_tokens, 135);

    const ledger = await readFile(path.join(root, '.savyre', 'chat-token-usage.jsonl'), 'utf8');
    assert.equal(ledger.trim().split('\n').length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
