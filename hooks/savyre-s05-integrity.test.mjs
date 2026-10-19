import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const HOOKS = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HOOKS, '..');
const GUARD = path.join(HOOKS, 'savyre-guard.mjs');
const ORG_RUN_CONFIG = path.resolve(PLUGIN_ROOT, '..', 'savyre-ai-eng-org', 'packages', 'savyre-run-config');

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}

let ws;

function write(rel, body) {
  const abs = path.join(ws, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, typeof body === 'string' ? body : JSON.stringify(body, null, 2));
}

function hook(input) {
  const res = spawnSync(process.execPath, [GUARD], {
    cwd: ws,
    input: JSON.stringify({ cwd: ws, ...input }),
    encoding: 'utf8',
    env: { ...process.env, SAVYRE_RUN_CONFIG_PATH: process.env.SAVYRE_RUN_CONFIG_PATH || ORG_RUN_CONFIG },
    timeout: 60000
  });
  return JSON.parse(String(res.stdout || '').trim().split(/\r?\n/).pop() || '{}');
}

const denied = (r) => r.permission === 'deny' || r.decision === 'deny' || r.continue === false;
const writeTo = (rel) =>
  hook({ hook_event_name: 'preToolUse', tool_name: 'Write', tool_input: { path: path.join(ws, ...rel.split('/')), contents: 'x' } });

before(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'savyre-s05-hook-'));
  write('.savyre/session.json', { sessionId: 'wf_s05', status: 'started', startedAt: new Date().toISOString() });
  const key = fs.readFileSync(path.join(PLUGIN_ROOT, 'fixtures', 'test-hmac.key'), 'utf8').trim();
  const fixture = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'fixtures', 's05-test-resolve.manifest.json'), 'utf8'));
  const now = Date.now();
  const manifest = {
    ...fixture,
    workspaceRoot: ws,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 3600000).toISOString(),
    executionId: `exec-s05-${now}`
  };
  delete manifest.signature;
  manifest.signature = createHmac('sha256', key).update(stableStringify({ ...manifest })).digest('hex');
  write('.savyre/active-execution-manifest.json', manifest);
});

after(() => {
  fs.rmSync(ws, { recursive: true, force: true });
});

test('S05: the agent cannot run tests itself and is pointed at /savyre-next', () => {
  const r = hook({ hook_event_name: 'beforeShellExecution', command: 'npx playwright test' });
  assert.equal(denied(r), true);
  assert.match(JSON.stringify(r), /savyre-next/);
});

test('S05: only the verification report is writable; run receipts and the plan are runtime-owned', () => {
  assert.equal(denied(writeTo('stages/s05_test_resolve/verification_report.md')), false);
  assert.equal(denied(writeTo('.savyre/s05-test-runs.jsonl')), true);
  assert.equal(denied(writeTo('.savyre/s05-manual-checks.json')), true);
  assert.equal(denied(writeTo('stages/s05_test_resolve/test_plan.json')), true);
  assert.equal(denied(writeTo('stages/s05_test_resolve/diagnosis_report.md')), true);
  assert.equal(denied(writeTo('tests/new.spec.js')), true);
});
