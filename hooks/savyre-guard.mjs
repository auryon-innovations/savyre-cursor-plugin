#!/usr/bin/env node
/**
 * Savyre thin plugin runtime.
 * - Hook mode (stdin JSON): enforce the active execution manifest.
 * - CLI: node savyre-guard.mjs run | status | stop
 *
 * Contains no Savyre stage methodology.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY_ID = 'savyre-local-test';
const ACTIVE_REL = path.join('.savyre', 'active-execution-manifest.json');
const EVIDENCE_REL = path.join('.savyre', 'execution-evidence.jsonl');
const KEY_PATH = path.join(PLUGIN_ROOT, 'fixtures', 'test-hmac.key');
const STAGE_FIXTURES = {
  '02-requirement-analysis': path.join(PLUGIN_ROOT, 'fixtures', 'requirement-analysis.manifest.json'),
  '03-codebase-discovery': path.join(PLUGIN_ROOT, 'fixtures', 'codebase-discovery.manifest.json')
};
const DEFAULT_STAGE_ID = '02-requirement-analysis';
const LAST_WORKSPACE_PATH = path.join(PLUGIN_ROOT, 'runtime', 'last-workspace.json');

const WRITE_TOOLS = new Set([
  'Write',
  'StrReplace',
  'Delete',
  'EditNotebook',
  'ApplyPatch',
  'SearchReplace'
]);
const SHELL_TOOLS = new Set(['Shell', 'Bash']);
const SUBAGENT_TOOLS = new Set(['Task', 'Subagent']);
const DEFAULT_EXCLUDED = ['.env', '.env.local', '.env.production', 'id_rsa', 'id_ed25519', '.pem', 'credentials.json', 'secrets.json'];

function reply(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}

function signingPayload(manifest) {
  const copy = { ...manifest };
  delete copy.signature;
  return stableStringify(copy);
}

function hmacHex(manifest, key) {
  return createHmac('sha256', key).update(signingPayload(manifest)).digest('hex');
}

function signaturesMatch(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function normPath(p) {
  if (!p || typeof p !== 'string') return '';
  return path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function posixRel(from, to) {
  return path.relative(from, to).replace(/\\/g, '/');
}

async function readKey() {
  const raw = await fs.readFile(KEY_PATH, 'utf8');
  return raw.trim();
}

function isLifecycleCommand(command) {
  const c = String(command || '').replace(/\\/g, '/');
  return /savyre-guard\.mjs/.test(c) && /\b(run|status|stop)\b/.test(c);
}

function pushPath(list, value) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) pushPath(list, item);
    return;
  }
  if (typeof value === 'string' && value.trim()) list.push(value.trim());
}

function collectHookCandidates(input) {
  const candidates = [];
  pushPath(candidates, input?.workspace_roots);
  pushPath(candidates, input?.workspaceRoots);
  pushPath(candidates, input?.workspace_root);
  pushPath(candidates, input?.cwd);
  pushPath(candidates, input?.command_cwd);
  pushPath(candidates, input?.working_directory);
  pushPath(candidates, input?.tool_input?.working_directory);
  pushPath(candidates, input?.tool_input?.cwd);
  pushPath(candidates, process.env.CURSOR_PROJECT_DIR);
  pushPath(candidates, process.env.PWD);
  pushPath(candidates, process.cwd());
  return candidates;
}

function walkAncestors(start, match) {
  if (!start || typeof start !== 'string') return null;
  let dir = path.resolve(start);
  for (let i = 0; i < 16; i++) {
    if (match(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

async function readLastWorkspace() {
  try {
    const raw = await fs.readFile(LAST_WORKSPACE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const root = parsed?.workspaceRoot;
    return root && typeof root === 'string' ? path.resolve(root) : null;
  } catch {
    return null;
  }
}

async function writeLastWorkspace(workspace) {
  await fs.mkdir(path.dirname(LAST_WORKSPACE_PATH), { recursive: true });
  await fs.writeFile(
    LAST_WORKSPACE_PATH,
    `${JSON.stringify({ workspaceRoot: workspace, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8'
  );
}

async function clearLastWorkspace() {
  try {
    await fs.unlink(LAST_WORKSPACE_PATH);
  } catch {
    /* ignore */
  }
}

async function findWorkspaceFromHook(input = {}) {
  const last = await readLastWorkspace();
  const candidates = collectHookCandidates(input);
  if (last) candidates.unshift(last);

  for (const start of candidates) {
    const hit = walkAncestors(start, (dir) => existsSync(path.join(dir, ACTIVE_REL)));
    if (hit && normPath(hit) !== normPath(PLUGIN_ROOT)) return hit;
  }

  if (last && existsSync(path.join(last, ACTIVE_REL))) return last;

  for (const start of candidates) {
    const hit = walkAncestors(
      start,
      (dir) =>
        normPath(dir) !== normPath(PLUGIN_ROOT) &&
        (existsSync(path.join(dir, '.savyre')) ||
          existsSync(path.join(dir, '.git')) ||
          existsSync(path.join(dir, 'savyre')))
    );
    if (hit) return hit;
  }

  return last || path.resolve(process.cwd());
}

async function loadActive(workspace) {
  const file = path.join(workspace, ACTIVE_REL);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return { file, manifest: JSON.parse(raw) };
  } catch {
    return { file, manifest: null };
  }
}

function requiredFieldsOk(m) {
  if (!m || typeof m !== 'object') return 'manifest missing';
  const need = [
    'schemaVersion',
    'executionId',
    'workflowId',
    'stageId',
    'workspaceRoot',
    'issuedAt',
    'expiresAt',
    'writeMode',
    'keyId',
    'signature'
  ];
  for (const k of need) {
    if (m[k] === undefined || m[k] === null || m[k] === '') return `missing ${k}`;
  }
  if (m.schemaVersion !== '1') return 'unsupported schemaVersion';
  if (!STAGE_FIXTURES[m.stageId]) return `unsupported stageId ${m.stageId}`;
  if (m.writeMode !== 'read_only') return `writeMode must be read_only for this round`;
  return null;
}

async function verifyManifest(manifest, workspace) {
  const fieldErr = requiredFieldsOk(manifest);
  if (fieldErr) return { ok: false, reason: fieldErr };

  if (new Date(manifest.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  if (normPath(manifest.workspaceRoot) !== normPath(workspace)) {
    return { ok: false, reason: 'workspace mismatch' };
  }
  if (manifest.keyId !== KEY_ID) return { ok: false, reason: 'unknown keyId' };

  const key = await readKey();
  const expected = hmacHex(manifest, key);
  if (!signaturesMatch(expected, manifest.signature)) {
    return { ok: false, reason: 'bad signature' };
  }
  return { ok: true, reason: 'valid' };
}

async function appendEvidence(workspace, event) {
  try {
    const dir = path.join(workspace, '.savyre');
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
    await fs.appendFile(path.join(workspace, EVIDENCE_REL), `${line}\n`, 'utf8');
  } catch {
    /* evidence is best-effort */
  }
}

function deny(userMessage, agentMessage) {
  return {
    permission: 'deny',
    user_message: userMessage,
    agent_message: agentMessage || userMessage
  };
}

function allow() {
  return { permission: 'allow' };
}

function pathExcluded(workspace, filePath, excludedPaths) {
  const rel = posixRel(workspace, filePath);
  if (!rel || rel.startsWith('..')) return true;
  const lower = rel.toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  const patterns = excludedPaths?.length ? excludedPaths : DEFAULT_EXCLUDED;
  for (const p of patterns) {
    const needle = String(p).replace(/\\/g, '/').toLowerCase();
    if (!needle) continue;
    if (base === needle || lower === needle || lower.endsWith(`/${needle}`)) return true;
    if (needle.startsWith('.') && base === needle) return true;
    if (needle.includes('*')) {
      const re = new RegExp('^' + needle.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$', 'i');
      if (re.test(rel) || re.test(base)) return true;
    }
  }
  return false;
}

function toolName(input) {
  return String(input.tool_name || input.tool || '');
}

function fileFromInput(input) {
  return (
    input.file_path ||
    input.tool_input?.path ||
    input.tool_input?.file_path ||
    input.tool_input?.target_notebook ||
    ''
  );
}

async function handleHook(input) {
  const event = input.hook_event_name || '';
  const workspace = await findWorkspaceFromHook(input);
  const { manifest } = await loadActive(workspace);

  if (!manifest) {
    return event === 'stop' ? {} : allow();
  }

  const verified = await verifyManifest(manifest, workspace);
  if (!verified.ok) {
    if (event !== 'stop') {
      await appendEvidence(workspace, {
        executionId: manifest.executionId || null,
        hook: event,
        decision: 'idle',
        reason: verified.reason
      });
    }
    return event === 'stop' ? {} : allow();
  }

  const name = toolName(input);
  const command = input.command || input.tool_input?.command || '';

  if (event === 'beforeShellExecution' || (event === 'preToolUse' && SHELL_TOOLS.has(name))) {
    if (isLifecycleCommand(command)) {
      await appendEvidence(workspace, {
        executionId: manifest.executionId,
        hook: event,
        decision: 'allow',
        tool: 'Shell',
        reason: 'lifecycle'
      });
      return allow();
    }
    await appendEvidence(workspace, {
      executionId: manifest.executionId,
      hook: event,
      decision: 'deny',
      tool: 'Shell',
      reason: 'read_only'
    });
    return deny(
      `Savyre ${manifest.stageId} is read-only. Shell execution is blocked.`,
      'This stage is read-only. Do not run terminal commands. Use /savyre-stop to leave enforced mode. You cannot approve the stage.'
    );
  }

  if (event === 'preToolUse' && SUBAGENT_TOOLS.has(name)) {
    await appendEvidence(workspace, {
      executionId: manifest.executionId,
      hook: event,
      decision: 'deny',
      tool: name,
      reason: 'no write-enabled subagents'
    });
    return deny(
      `Savyre ${manifest.stageId} does not allow write-enabled subagents.`,
      'Do not start write-enabled subagents during this read-only Savyre stage.'
    );
  }

  if (event === 'preToolUse' && WRITE_TOOLS.has(name)) {
    await appendEvidence(workspace, {
      executionId: manifest.executionId,
      hook: event,
      decision: 'deny',
      tool: name,
      reason: 'read_only'
    });
    return deny(
      `Savyre ${manifest.stageId} is read-only. File edits are blocked.`,
      'Do not edit application files. Submit findings only. The Savyre extension records ACCEPTED.'
    );
  }

  if (event === 'beforeReadFile') {
    const fp = fileFromInput(input);
    if (fp && pathExcluded(workspace, fp, manifest.excludedPaths)) {
      await appendEvidence(workspace, {
        executionId: manifest.executionId,
        hook: event,
        decision: 'deny',
        tool: 'Read',
        reason: 'excluded path'
      });
      return deny(
        'Savyre blocked a read of an excluded path.',
        'That file is excluded by the active Savyre execution manifest.'
      );
    }
    return allow();
  }

  if (event === 'afterFileEdit') {
    await appendEvidence(workspace, {
      executionId: manifest.executionId,
      hook: event,
      decision: 'violation',
      tool: 'afterFileEdit',
      reason: fileFromInput(input) || 'file edit'
    });
    return {};
  }

  if (event === 'stop') {
    await appendEvidence(workspace, {
      executionId: manifest.executionId,
      hook: 'stop',
      decision: 'note',
      reason: 'agent loop ended; acceptance stays in the Savyre extension'
    });
    return {};
  }

  if (event === 'preToolUse') {
    const denied = (manifest.deniedTools || []).map((t) => t.toLowerCase());
    if (denied.includes(name.toLowerCase())) {
      await appendEvidence(workspace, {
        executionId: manifest.executionId,
        hook: event,
        decision: 'deny',
        tool: name,
        reason: 'deniedTools'
      });
      return deny(
        `Savyre blocked tool ${name} for this stage.`,
        `Tool ${name} is not allowed during the active Savyre execution.`
      );
    }
  }

  return event === 'stop' ? {} : allow();
}

async function cmdRun(stageIdArg) {
  const stageId = stageIdArg || DEFAULT_STAGE_ID;
  const fixturePath = STAGE_FIXTURES[stageId];
  if (!fixturePath) {
    return { mode: 'idle', reason: `unknown stageId ${stageId}` };
  }
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const key = await readKey();
  const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  const now = new Date();
  const prefix = stageId.startsWith('03') ? 'cd' : 'ra';
  const manifest = {
    ...fixture,
    workspaceRoot: workspace,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    executionId: `exec-${prefix}-${now.getTime()}`
  };
  delete manifest.signature;
  manifest.signature = hmacHex(manifest, key);

  await fs.mkdir(path.join(workspace, '.savyre'), { recursive: true });
  await fs.writeFile(path.join(workspace, ACTIVE_REL), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeLastWorkspace(workspace);
  await appendEvidence(workspace, {
    executionId: manifest.executionId,
    hook: 'cli',
    decision: 'enforced',
    reason: 'savyre-run'
  });
  return {
    mode: 'enforced',
    stageId: manifest.stageId,
    executionId: manifest.executionId,
    expiresAt: manifest.expiresAt,
    workspaceRoot: workspace
  };
}

async function cmdStatus() {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const { manifest } = await loadActive(workspace);
  if (!manifest) {
    return { mode: 'idle', reason: 'no active manifest' };
  }
  const verified = await verifyManifest(manifest, workspace);
  if (!verified.ok) {
    return {
      mode: 'idle',
      reason: verified.reason,
      stageId: manifest.stageId,
      executionId: manifest.executionId
    };
  }
  return {
    mode: 'enforced',
    stageId: manifest.stageId,
    executionId: manifest.executionId,
    expiresAt: manifest.expiresAt,
    writeMode: manifest.writeMode,
    workflowId: manifest.workflowId
  };
}

async function cmdStop() {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const { file, manifest } = await loadActive(workspace);
  try {
    await fs.unlink(file);
  } catch {
    /* already idle */
  }
  await clearLastWorkspace();
  await appendEvidence(workspace, {
    executionId: manifest?.executionId || null,
    hook: 'cli',
    decision: 'idle',
    reason: 'savyre-stop'
  });
  return { mode: 'idle' };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function main() {
  const verb = process.argv[2];
  if (verb === 'run' || verb === 'status' || verb === 'stop') {
    const out =
      verb === 'run' ? await cmdRun(process.argv[3]) : verb === 'status' ? await cmdStatus() : await cmdStop();
    reply(out);
    return;
  }

  const raw = await readStdin();
  if (!raw) {
    reply(allow());
    return;
  }
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    reply(allow());
    return;
  }
  const out = await handleHook(input);
  reply(out);
}

main().catch(() => {
  process.stdout.write(`${JSON.stringify({ permission: 'allow' })}\n`);
  process.exit(0);
});
