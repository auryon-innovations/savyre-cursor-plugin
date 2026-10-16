import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { test } from 'node:test';
import {
  isLifecycleCommand,
  resolveLifecycleScriptPath,
  trustedLifecycleScriptPaths
} from './savyre-lifecycle.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = path.join(PLUGIN_ROOT, 'hooks', 'savyre-guard.mjs');

test('allows a single clean lifecycle invocation of the installed guard', () => {
  assert.equal(
    isLifecycleCommand(`node "${GUARD}" status`, { pluginRoot: PLUGIN_ROOT }),
    true
  );
  assert.equal(
    isLifecycleCommand(`node "${GUARD.replace(/\\/g, '/')}" next`, {
      pluginRoot: PLUGIN_ROOT
    }),
    true
  );
  assert.equal(
    isLifecycleCommand('node hooks/savyre-guard.mjs turn', {
      pluginRoot: PLUGIN_ROOT,
      cwd: path.join(PLUGIN_ROOT)
    }),
    true
  );
  assert.equal(
    isLifecycleCommand(`node "${GUARD}" answer OQ-001 1`, { pluginRoot: PLUGIN_ROOT }),
    true
  );
});

test('rejects chained / compound lifecycle shells', () => {
  assert.equal(
    isLifecycleCommand(`node "${GUARD}" status; echo shouldBeBlocked`, {
      pluginRoot: PLUGIN_ROOT
    }),
    false
  );
  assert.equal(
    isLifecycleCommand(`node "${GUARD}" status && echo more`, { pluginRoot: PLUGIN_ROOT }),
    false
  );
  assert.equal(
    isLifecycleCommand(`node "${GUARD}" status | cat`, { pluginRoot: PLUGIN_ROOT }),
    false
  );
  assert.equal(
    isLifecycleCommand(`node "${GUARD}" status > out.txt`, { pluginRoot: PLUGIN_ROOT }),
    false
  );
  assert.equal(
    isLifecycleCommand(`node "${GUARD}" status $(echo hi)`, { pluginRoot: PLUGIN_ROOT }),
    false
  );
});

test('H3-1: rejects same-name untrusted lifecycle script path', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'savyre-untrusted-'));
  const fake = path.join(tmp, 'savyre-guard.mjs');
  fs.writeFileSync(fake, '// untrusted\n', 'utf8');
  try {
    assert.equal(
      isLifecycleCommand(`node "${fake}" status`, { pluginRoot: PLUGIN_ROOT }),
      false
    );
    const resolved = resolveLifecycleScriptPath(fake, { pluginRoot: PLUGIN_ROOT });
    const trusted = trustedLifecycleScriptPaths({ pluginRoot: PLUGIN_ROOT }).map((p) =>
      path.resolve(p).toLowerCase()
    );
    assert.ok(resolved);
    assert.equal(trusted.includes(path.resolve(resolved).toLowerCase()), false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('allows USERPROFILE / $env forms when they resolve to the installed plugin', () => {
  const home = os.homedir();
  const localGuard = path.join(
    home,
    '.cursor',
    'plugins',
    'local',
    'savyre-cursor-plugin',
    'hooks',
    'savyre-guard.mjs'
  );
  if (!fs.existsSync(localGuard)) return;
  assert.equal(
    isLifecycleCommand(
      'node "%USERPROFILE%/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" next',
      { pluginRoot: PLUGIN_ROOT }
    ),
    true
  );
  assert.equal(
    isLifecycleCommand(
      'node "$env:USERPROFILE/.cursor/plugins/local/savyre-cursor-plugin/hooks/savyre-guard.mjs" next',
      { pluginRoot: PLUGIN_ROOT }
    ),
    true
  );
});
