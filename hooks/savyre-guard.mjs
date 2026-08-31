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
  '03-codebase-discovery': path.join(PLUGIN_ROOT, 'fixtures', 'codebase-discovery.manifest.json'),
  '04-impact-analysis': path.join(PLUGIN_ROOT, 'fixtures', 'impact-analysis.manifest.json'),
  '05-plan-generation-and-review': path.join(PLUGIN_ROOT, 'fixtures', 'plan-generation.manifest.json'),
  '06-implementation': path.join(PLUGIN_ROOT, 'fixtures', 'implementation.manifest.json')
};
const STAGE_EXEC_PREFIX = {
  '02-requirement-analysis': 'ra',
  '03-codebase-discovery': 'cd',
  '04-impact-analysis': 'ia',
  '05-plan-generation-and-review': 'pl',
  '06-implementation': 'im'
};
const DEFAULT_STAGE_ID = '02-requirement-analysis';
const LAST_WORKSPACE_PATH = path.join(PLUGIN_ROOT, 'runtime', 'last-workspace.json');
const CHAT_INJECT_REL = path.join('.savyre', 'chat-inject.json');
const INPUT_INJECT_MAX_CHARS = 6000;
const STAGE_ROLE_SKILL = {
  '02-requirement-analysis': 'savyre-requirement-analyst',
  '03-codebase-discovery': 'savyre-codebase-discovery',
  '04-impact-analysis': 'savyre-impact-analyst',
  '05-plan-generation-and-review': 'savyre-plan-generation-and-review',
  '06-implementation': 'savyre-implementation'
};

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
  if (m.stageId === '06-implementation') {
    if (m.writeMode !== 'read_write') return 'writeMode must be read_write for 06-implementation';
  } else if (m.writeMode !== 'read_only') {
    return 'writeMode must be read_only for this stage';
  }
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

function hookEventName(input) {
  const named = String(input.hook_event_name || input.hookEventName || '');
  if (named) return named;
  if (input.status === 'completed' || input.status === 'aborted' || input.status === 'error') {
    return 'stop';
  }
  if (input.session_id && (input.composer_mode || input.is_background_agent !== undefined) && !input.tool_name) {
    return 'sessionStart';
  }
  return '';
}

function toolName(input) {
  return String(input.tool_name || input.tool || '');
}

function clipText(text, max) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[truncated]`;
}

async function readStageInput(workspace, stageId) {
  const rel = `savyre/stages/${stageId}/input.md`;
  const abs = path.join(workspace, ...rel.split('/'));
  try {
    const raw = await fs.readFile(abs, 'utf8');
    const text = clipText(raw, INPUT_INJECT_MAX_CHARS);
    return { rel, missing: false, empty: !text, text };
  } catch {
    return { rel, missing: true, empty: true, text: '' };
  }
}

async function aiOutputLooksWritten(workspace, stageId) {
  const abs = path.join(workspace, 'savyre', 'stages', stageId, 'ai-output.md');
  try {
    const raw = await fs.readFile(abs, 'utf8');
    return raw.trim().length >= 200;
  } catch {
    return false;
  }
}

async function readChatInjectState(workspace) {
  try {
    return JSON.parse(await fs.readFile(path.join(workspace, CHAT_INJECT_REL), 'utf8'));
  } catch {
    return null;
  }
}

async function writeChatInjectState(workspace, state) {
  try {
    const dir = path.join(workspace, '.savyre');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(workspace, CHAT_INJECT_REL), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  } catch {
    /* best-effort */
  }
}

function buildSessionContext(manifest, inputFile) {
  const role = STAGE_ROLE_SKILL[manifest.stageId] || 'the matching Savyre role skill';
  const writeHint =
    manifest.writeMode === 'read_write'
      ? 'You may write application files with Write/StrReplace. Do not run Shell, start subagents, or delete files.'
      : 'Read-only: do not edit application source. Submit findings only as the stage instructs (typically ai-output.md).';
  const body = inputFile.missing
    ? `_${inputFile.rel} is not on disk yet._`
    : inputFile.empty
      ? `_${inputFile.rel} is empty._`
      : inputFile.text;
  return [
    `Savyre stage \`${manifest.stageId}\` is enforced (${manifest.writeMode}).`,
    `Use the Cursor skill \`${role}\`. Do not invent Savyre methodology.`,
    'Work in this chat. Ask the developer questions here. Cursor Agent cannot record ACCEPTED — that stays in the Savyre extension.',
    writeHint,
    '',
    `## ${inputFile.rel}`,
    body
  ].join('\n');
}

function buildStopFollowup(manifest, inputFile) {
  const role = STAGE_ROLE_SKILL[manifest.stageId] || 'the matching Savyre role skill';
  const inputHint = inputFile.missing || inputFile.empty
    ? `Open \`${inputFile.rel}\` if it exists.`
    : `Continue from \`${inputFile.rel}\` (already injected).`;
  return [
    `Savyre stage \`${manifest.stageId}\` is still enforced. Continue in this chat using skill \`${role}\`.`,
    inputHint,
    'Ask any remaining questions here, then write the stage output as instructed. Do not set ACCEPTED. Do not run /savyre-stop until the developer accepts in the Savyre extension.'
  ].join(' ');
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
  const event = hookEventName(input);
  const workspace = await findWorkspaceFromHook(input);
  const { manifest } = await loadActive(workspace);
  const quiet = event === 'stop' || event === 'sessionStart';

  if (!manifest) {
    return quiet ? {} : allow();
  }

  const verified = await verifyManifest(manifest, workspace);
  if (!verified.ok) {
    if (!quiet) {
      await appendEvidence(workspace, {
        executionId: manifest.executionId || null,
        hook: event,
        decision: 'idle',
        reason: verified.reason
      });
    }
    return quiet ? {} : allow();
  }

  if (event === 'sessionStart') {
    const inputFile = await readStageInput(workspace, manifest.stageId);
    const additional_context = buildSessionContext(manifest, inputFile);
    await writeChatInjectState(workspace, {
      executionId: manifest.executionId,
      stageId: manifest.stageId,
      sessionId: input.session_id || null,
      injectedAt: new Date().toISOString(),
      followupCount: 0
    });
    await appendEvidence(workspace, {
      executionId: manifest.executionId,
      hook: 'sessionStart',
      decision: 'inject',
      reason: inputFile.missing ? 'input.md missing' : 'input.md injected'
    });
    return { additional_context };
  }

  if (event === 'stop') {
    const status = String(input.status || 'completed');
    const loopCount = Number(input.loop_count || 0);
    if (status !== 'completed' || loopCount > 0) {
      await appendEvidence(workspace, {
        executionId: manifest.executionId,
        hook: 'stop',
        decision: 'note',
        reason: `agent loop ended (${status}); no follow-up`
      });
      return {};
    }
    const written = await aiOutputLooksWritten(workspace, manifest.stageId);
    const prior = await readChatInjectState(workspace);
    const alreadyFollowed =
      prior?.executionId === manifest.executionId && Number(prior?.followupCount || 0) > 0;
    if (written || alreadyFollowed) {
      await appendEvidence(workspace, {
        executionId: manifest.executionId,
        hook: 'stop',
        decision: 'note',
        reason: written ? 'ai-output.md present; no follow-up' : 'follow-up already sent'
      });
      return {};
    }
    const inputFile = await readStageInput(workspace, manifest.stageId);
    const followup_message = buildStopFollowup(manifest, inputFile);
    await writeChatInjectState(workspace, {
      ...(prior || {}),
      executionId: manifest.executionId,
      stageId: manifest.stageId,
      followupCount: 1,
      followupAt: new Date().toISOString()
    });
    await appendEvidence(workspace, {
      executionId: manifest.executionId,
      hook: 'stop',
      decision: 'followup',
      reason: 'continue stage in chat'
    });
    return { followup_message };
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
      reason: 'shell_blocked'
    });
    return deny(
      `Savyre ${manifest.stageId} does not allow shell. Terminal commands are blocked.`,
      'Do not run terminal commands. Use /savyre-stop to leave enforced mode. You cannot approve the stage.'
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
      'Do not start write-enabled subagents during this Savyre stage.'
    );
  }

  if (event === 'preToolUse' && WRITE_TOOLS.has(name)) {
    const writeOk = manifest.writeMode === 'read_write';
    const fp = fileFromInput(input);
    if (writeOk && fp && pathExcluded(workspace, fp, manifest.excludedPaths)) {
      await appendEvidence(workspace, {
        executionId: manifest.executionId,
        hook: event,
        decision: 'deny',
        tool: name,
        reason: 'excluded path'
      });
      return deny(
        'Savyre blocked a write to an excluded path.',
        'That file is excluded by the active Savyre execution manifest.'
      );
    }
    if (!writeOk) {
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
    const writeOk = manifest.writeMode === 'read_write';
    await appendEvidence(workspace, {
      executionId: manifest.executionId,
      hook: event,
      decision: writeOk ? 'allow' : 'violation',
      tool: 'afterFileEdit',
      reason: fileFromInput(input) || 'file edit'
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
  const prefix = STAGE_EXEC_PREFIX[stageId] || 'ra';
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
  try {
    await fs.unlink(path.join(workspace, CHAT_INJECT_REL));
  } catch {
    /* optional */
  }
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
