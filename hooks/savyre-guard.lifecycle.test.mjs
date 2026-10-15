import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLifecycleCommand } from './savyre-lifecycle.mjs';

test('allows a single clean lifecycle invocation', () => {
  assert.equal(isLifecycleCommand('node hooks/savyre-guard.mjs status'), true);
  assert.equal(
    isLifecycleCommand(
      'node "C:/Users/x/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" next'
    ),
    true
  );
  assert.equal(isLifecycleCommand('node scripts/savyre-cli.mjs stop'), true);
  assert.equal(
    isLifecycleCommand('cd /tmp/project && node hooks/savyre-guard.mjs turn'),
    true
  );
  assert.equal(isLifecycleCommand('node hooks/savyre-guard.mjs answer OQ-001 1'), true);
});

test('rejects chained / compound lifecycle shells', () => {
  assert.equal(
    isLifecycleCommand('node hooks/savyre-guard.mjs status; echo shouldBeBlocked'),
    false
  );
  assert.equal(
    isLifecycleCommand('node hooks/savyre-guard.mjs status && echo more'),
    false
  );
  assert.equal(isLifecycleCommand('node hooks/savyre-guard.mjs status | cat'), false);
  assert.equal(isLifecycleCommand('node hooks/savyre-guard.mjs status > out.txt'), false);
  assert.equal(isLifecycleCommand('node hooks/savyre-guard.mjs status $(echo hi)'), false);
  assert.equal(
    isLifecycleCommand('echo status; node hooks/savyre-guard.mjs status'),
    false
  );
});
