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
    env: { ...process.env, SAVYRE_RUN_CONFIG_PATH: ORG_RUN_CONFIG },
    timeout: 60000
  });
  const line = String(res.stdout || '').trim().split(/\r?\n/).pop() || '{}';
  return JSON.parse(line);
}

const writeTo = (rel, contents = 'x') =>
  hook({
    hook_event_name: 'preToolUse',
    tool_name: 'Write',
    tool_input: { path: path.join(ws, ...rel.split('/')), contents }
  });
const shell = (command) => hook({ hook_event_name: 'beforeShellExecution', command });
const denied = (r) => r.permission === 'deny' || r.decision === 'deny' || r.continue === false;

before(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'savyre-s04-hook-'));
  write('.savyre/session.json', { sessionId: 'wf_test', status: 'started', startedAt: new Date().toISOString() });
  write('stages/s03_implementation_plan/implementation_backlog.json', {
    artifactType: 'implementation_backlog',
    tasks: [
      {
        id: 'FS-001',
        type: 'FUNCTIONAL_STORY',
        title: 'Bill upload API',
        fileScope: ['src/upload/'],
        dependencies: [],
        doneChecks: ['upload works'],
        tddApplicability: 'required'
      },
      {
        id: 'FS-002',
        type: 'FUNCTIONAL_STORY',
        title: 'Stock deltas',
        fileScope: ['src/stock/'],
        dependencies: ['implementation_backlog.json#FS-001'],
        doneChecks: ['stock moves'],
        tddApplicability: 'required'
      }
    ]
  });
  const key = fs.readFileSync(path.join(PLUGIN_ROOT, 'fixtures', 'test-hmac.key'), 'utf8').trim();
  const fixture = JSON.parse(
    fs.readFileSync(path.join(PLUGIN_ROOT, 'fixtures', 's04-build-review.manifest.json'), 'utf8')
  );
  const now = Date.now();
  const manifest = {
    ...fixture,
    workspaceRoot: ws,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 3600000).toISOString(),
    executionId: `exec-s04-${now}`
  };
  delete manifest.signature;
  const copy = { ...manifest };
  manifest.signature = createHmac('sha256', key).update(stableStringify(copy)).digest('hex');
  write('.savyre/active-execution-manifest.json', manifest);
});

after(() => {
  fs.rmSync(ws, { recursive: true, force: true });
});

test('H4-1: protected runtime, human, and upstream records are denied', () => {
  for (const rel of [
    'stages/s04_build_review/final.md',
    'stages/s04_build_review/developer_review.md',
    'stages/s03_implementation_plan/implementation_backlog.json',
    '.savyre/chat-checkpoint.json',
    'stages/s04_build_review/tasks/FS-001/task_metadata.json',
    'stages/s04_build_review/implementation_status.json'
  ]) {
    assert.equal(denied(writeTo(rel)), true, rel);
  }
});

test('H4-1: drafts and in-scope source are allowed; out-of-scope source is denied', () => {
  assert.equal(denied(writeTo('stages/s04_build_review/change_report.md')), false);
  assert.equal(denied(writeTo('src/upload/handler.js')), false);
  assert.equal(denied(writeTo('tests/fs-001.spec.js')), false);
  assert.equal(denied(writeTo('src/stock/delta.js')), true);
});

test('H4-2: test shell allows the runner test subcommand only', () => {
  assert.equal(denied(shell('npx playwright test')), false);
  assert.equal(denied(shell('node --test')), false);
  assert.equal(denied(shell('npx playwright install')), true);
  assert.equal(denied(shell('node --test > .env')), true);
  assert.equal(denied(shell('npm install')), true);
});

test('H4-3 / S4-F1: syntax error is not RED and zero tests is not GREEN', () => {
  hook({
    hook_event_name: 'afterShellExecution',
    command: 'node --test',
    exit_code: 1,
    output: 'SyntaxError: Unexpected token )\n# tests 1\n# pass 0\n# fail 1'
  });
  hook({ hook_event_name: 'afterShellExecution', command: 'npx playwright test', exit_code: 0, output: 'Error: No tests found' });
  const receipts = fs
    .readFileSync(path.join(ws, '.savyre', 's04-test-runs.jsonl'), 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((l) => JSON.parse(l));
  assert.deepEqual(
    receipts.map((r) => r.kind),
    ['setup_error', 'no_tests']
  );
  const metaPath = path.join(ws, 'stages', 's04_build_review', 'tasks', 'FS-001', 'task_metadata.json');
  assert.equal(fs.existsSync(metaPath), false);

  hook({
    hook_event_name: 'afterShellExecution',
    command: 'node --test',
    exit_code: 1,
    output: 'not ok 1\nAssertionError [ERR_ASSERTION]: Expected values to be strictly equal\n# tests 1\n# pass 0\n# fail 1'
  });
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  assert.ok(meta.tddEvidence.redRunId);
  assert.equal(meta.tddEvidence.redIsBehaviorFailure, true);
  assert.equal(meta.tddEvidence.greenRunId, undefined);
});

test('setup-tests: lifecycle-allowed, shows the fixed plan, and does not install without yes', () => {
  assert.equal(denied(shell(`node "${GUARD}" setup-tests`)), false);
  write('package.json', { name: 'dental-app' });
  const prevBrowsers = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const emptyBrowsers = fs.mkdtempSync(path.join(os.tmpdir(), 'savyre-pw-none-'));
  try {
    const res = spawnSync(process.execPath, [GUARD, 'setup-tests'], {
      cwd: ws,
      encoding: 'utf8',
      env: { ...process.env, SAVYRE_RUN_CONFIG_PATH: ORG_RUN_CONFIG, PLAYWRIGHT_BROWSERS_PATH: emptyBrowsers },
      timeout: 60000
    });
    const out = JSON.parse(String(res.stdout || '').trim().split(/\r?\n/).pop());
    assert.equal(out.confirmed, false);
    assert.match(out.userMessage, /npm install --save-dev @playwright\/test/);
    assert.match(out.userMessage, /\/savyre-setup-tests yes/);
    assert.equal(fs.existsSync(path.join(ws, '.savyre', 's04-test-setup.json')), false);
    assert.equal(fs.existsSync(path.join(ws, 'node_modules')), false);
  } finally {
    fs.rmSync(emptyBrowsers, { recursive: true, force: true });
    if (prevBrowsers === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    else process.env.PLAYWRIGHT_BROWSERS_PATH = prevBrowsers;
    fs.rmSync(path.join(ws, 'package.json'), { force: true });
  }
});

test('S4-F3: design approval binds to the runtime-issued question and the current preview', () => {
  const ledgerPath = path.join(ws, '.savyre', 'design-approvals.json');
  const designDir = path.join(ws, 'stages', 's04_build_review', 'tasks', 'FS-001', 'design');
  write('stages/s04_build_review/tasks/FS-001/design/preview.html', '<html>v1</html>');
  write('stages/s04_build_review/tasks/FS-001/ui_ux_report.json', {
    artifactType: 'ui_ux_report',
    applicability: { required: true, reason: 'ui' },
    binding: { backlogItemIds: ['FS-001'] },
    mockup: { treatment: 'image_set', designMedium: 'images', designCheckpoint: 'awaiting_human', designImageRels: ['stages/s04_build_review/tasks/FS-001/design/preview.html'] },
    review: { outcome: 'pending', limitations: [] }
  });
  // The design question is recorded against the preview on disk.
  hook({ hook_event_name: 'preToolUse', tool_name: 'AskQuestion', tool_input: {} });
  assert.equal(fs.existsSync(ledgerPath), true);
  const asked = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  assert.ok(asked.asked['FS-001']?.previewDigest);
  assert.ok(fs.existsSync(designDir));
  fs.rmSync(path.join(ws, 'stages', 's04_build_review', 'tasks', 'FS-001'), { recursive: true, force: true });
  fs.rmSync(ledgerPath, { force: true });
});

test('greenfield: scaffold item may write package.json while no manifest exists', () => {
  // The fixture repo has no package.json; FS-001 is required-TDD with fileScope src/upload/ only.
  assert.equal(fs.existsSync(path.join(ws, 'package.json')), false);
  assert.equal(denied(writeTo('package.json', '{"name":"app"}')), false);
  assert.equal(denied(writeTo('playwright.config.js', 'module.exports = {};')), false);
  assert.equal(denied(writeTo('src/stock/delta.js')), true);
});

test('S4-F2: report "Status: applied" alone does not release FS-002', () => {
  write(
    'stages/s04_build_review/change_report.md',
    '# Actual Changes and Task Status\n\n**Backlog item:** FS-001\n**Status:** applied\n'
  );
  const r = hook({
    hook_event_name: 'preToolUse',
    tool_name: 'Write',
    tool_input: { path: path.join(ws, 'src', 'stock', 'delta.js'), contents: 'x' }
  });
  assert.equal(denied(r), true);
  const progress = JSON.parse(fs.readFileSync(path.join(ws, '.savyre', 's04-progress.json'), 'utf8'));
  assert.equal(progress.applied['FS-001'], undefined);
  assert.equal(progress.currentItem.id, 'FS-001');
});
