#!/usr/bin/env node
/**
 * Savyre thin plugin runtime.
 * - Hook mode (stdin JSON): enforce the active execution manifest.
 * - CLI: node savyre-guard.mjs run | start | status | stop | turn | confirm | answer | action
 *
 * Contains no Savyre stage methodology.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY_ID = 'savyre-local-test';
const ACTIVE_REL = path.join('.savyre', 'active-execution-manifest.json');
const EVIDENCE_REL = path.join('.savyre', 'execution-evidence.jsonl');
const KEY_PATH = path.join(PLUGIN_ROOT, 'fixtures', 'test-hmac.key');
const STAGE_FIXTURES = {
  '01-task-input': path.join(PLUGIN_ROOT, 'fixtures', 'task-input.manifest.json'),
  '02-requirement-analysis': path.join(PLUGIN_ROOT, 'fixtures', 'requirement-analysis.manifest.json'),
  '03-codebase-discovery': path.join(PLUGIN_ROOT, 'fixtures', 'codebase-discovery.manifest.json'),
  '04-impact-analysis': path.join(PLUGIN_ROOT, 'fixtures', 'impact-analysis.manifest.json'),
  '05-plan-generation-and-review': path.join(PLUGIN_ROOT, 'fixtures', 'plan-generation.manifest.json'),
  '06-implementation': path.join(PLUGIN_ROOT, 'fixtures', 'implementation.manifest.json')
};
const STAGE_EXEC_PREFIX = {
  '01-task-input': 'ti',
  '02-requirement-analysis': 'ra',
  '03-codebase-discovery': 'cd',
  '04-impact-analysis': 'ia',
  '05-plan-generation-and-review': 'pl',
  '06-implementation': 'im'
};
const DEFAULT_STAGE_ID = '02-requirement-analysis';
const LAST_WORKSPACE_PATH = path.join(PLUGIN_ROOT, 'runtime', 'last-workspace.json');
const CHAT_INJECT_REL = path.join('.savyre', 'chat-inject.json');
const CHAT_CHECKPOINT_REL = path.join('.savyre', 'chat-checkpoint.json');
const CHAT_RESPONSES_REL = path.join('.savyre', 'chat-responses.json');
const INPUT_INJECT_MAX_CHARS = 6000;
const STAGE_CHAT_ORDER = [
  '01-task-input',
  '02-requirement-analysis',
  '03-codebase-discovery',
  '04-impact-analysis',
  '05-plan-generation-and-review',
  '06-implementation'
];
const STAGE_ROLE_SKILL = {
  '01-task-input': 'savyre-task-input',
  '02-requirement-analysis': 'savyre-requirement-analyst',
  '03-codebase-discovery': 'savyre-codebase-discovery',
  '04-impact-analysis': 'savyre-impact-analyst',
  '05-plan-generation-and-review': 'savyre-plan-generation-and-review',
  '06-implementation': 'savyre-implementation'
};
const CHAT_PRIMARY_SKILL_ID = {
  '01-task-input': 'savyre.task-input-dialogue',
  '02-requirement-analysis': 'savyre.requirement-analysis',
  '03-codebase-discovery': 'savyre.codebase-discovery'
};
const CHAT_SPECIALIZED_SKILL_ID = {
  '02-requirement-analysis': 'savyre.requirement-challenge',
  '03-codebase-discovery': 'savyre.evidence-grounding'
};
const CHAT_SPECIALIZED_STATES = new Set([
  'output_ready',
  'ready_for_review',
  'needs_user_input',
  'validating'
]);
const REGISTRY_TO_CURSOR_SKILL = {
  'savyre.task-input-dialogue': 'savyre-task-input',
  'savyre.requirement-analysis': 'savyre-requirement-analyst',
  'savyre.requirement-challenge': 'savyre-requirement-challenge',
  'savyre.codebase-discovery': 'savyre-codebase-discovery',
  'savyre.evidence-grounding': 'savyre-evidence-grounding',
  'savyre.verification-before-completion': 'savyre-verification-before-completion'
};
const CHAT_VERIFY_SKILL_ID = 'savyre.verification-before-completion';

function deriveChatTurnState({ awaitingConfirmation, pendingQuestion, aiReady, validationFailed }) {
  if (awaitingConfirmation) return 'awaiting_confirmation';
  if (validationFailed) return 'validation_failed';
  if (pendingQuestion) return 'needs_user_input';
  if (aiReady) return 'output_ready';
  return 'drafting';
}

function pickActiveSkillRef(stageId, state, ctx = {}) {
  const specialized = CHAT_SPECIALIZED_SKILL_ID[stageId];
  const skipSpecialized =
    (stageId === '02-requirement-analysis' && ctx.challengeComplete === true) ||
    (stageId === '03-codebase-discovery' && ctx.evidenceReady === true);
  if (specialized && CHAT_SPECIALIZED_STATES.has(state) && !skipSpecialized) {
    return `${specialized}@1.0.0`;
  }
  if (
    CHAT_PRIMARY_SKILL_ID[stageId] &&
    (state === 'output_ready' || state === 'ready_for_review')
  ) {
    return `${CHAT_VERIFY_SKILL_ID}@1.0.0`;
  }
  const primary = CHAT_PRIMARY_SKILL_ID[stageId];
  if (primary) return `${primary}@1.0.0`;
  return STAGE_ROLE_SKILL[stageId] || null;
}

function cursorSkillForRef(activeSkill) {
  const id = String(activeSkill || '').split('@')[0];
  return REGISTRY_TO_CURSOR_SKILL[id] || null;
}

function chatSkillFields(stageId, state, ctx = {}) {
  const activeSkill = pickActiveSkillRef(stageId, state, ctx);
  const cursorSkill = cursorSkillForRef(activeSkill) || STAGE_ROLE_SKILL[stageId] || null;
  return { activeSkill, cursorSkill, skill: cursorSkill };
}
const WRITE_STAGES = new Set([
  '01-task-input',
  '02-requirement-analysis',
  '03-codebase-discovery',
  '06-implementation'
]);

const STAGE_TITLES = {
  '01-task-input': 'Task Input',
  '02-requirement-analysis': 'Requirement Analysis',
  '03-codebase-discovery': 'Codebase Discovery',
  '04-impact-analysis': 'Impact Analysis',
  '05-plan-generation-and-review': 'Plan Generation',
  '06-implementation': 'Implementation'
};

function stageTitle(stageId) {
  const id = typeof stageId === 'string' ? stageId.trim() : '';
  if (!id) return 'this stage';
  return STAGE_TITLES[id] || id;
}

function chatUserMessage(kind, opts = {}) {
  const title = stageTitle(opts.stageId);
  const nextTitle = stageTitle(opts.nextStageId);
  const question = typeof opts.question === 'string' ? opts.question.trim() : '';
  switch (kind) {
    case 'start_panel':
      return 'Start a session in the Savyre panel first.';
    case 'mismatch':
      return 'This chat is on a different step than the Savyre panel. Run `/savyre-start` with nothing after it so we match, then continue.';
    case 'ask_what_to_build':
      return 'What should we build?';
    case 'confirm_task':
      return "I've written the task in your words. If that's right, confirm with `/savyre-confirm` or the Confirm task button.";
    case 'ask_question':
      return question || 'I need one decision from you before we continue.';
    case 'draft_now':
      return `I'll draft ${title} from what you already confirmed.`;
    case 'ask_generate_final':
      return `The ${title} draft is ready. If it looks right, run \`/savyre-generate-final\`.`;
    case 'ask_validate':
      return `I've locked ${title}. Run \`/savyre-validate\` to check it and continue.`;
    case 'ask_start_next':
      return opts.nextStageId
        ? `${title} is complete. ${nextTitle} is next. Run \`/savyre-start\` with nothing after it when you want to continue.`
        : `${title} is complete. Run \`/savyre-start\` with nothing after it when you want to continue.`;
    case 'panel_run_ai':
      return `For ${title}, click Run Stage AI in the Savyre panel. When that's done, run \`/savyre-generate-final\` here.`;
    case 'implement':
      return "I'll write the app from the approved plan. When that's done, run `/savyre-generate-final`.";
    case 'ignored_extra':
      return `Those extra words were ignored — we're on ${title}, not a new task.`;
    case 'confirm_not_stage_01':
      return 'Confirm is only for Task Input. Run `/savyre-start` with nothing after it.';
    case 'gate_failed':
      return "That didn't go through. I'll fix the draft, then you can run `/savyre-generate-final` again.";
    case 'validate_failed':
      return "This stage didn't pass yet. I'll fix what failed.";
    case 'chat_unsupported':
      return "This stage isn't available in Chat yet. Continue in the Savyre panel.";
    case 'task_confirmed_draft':
      return "Task confirmed. I'll draft Task Input now.";
    case 'answer_saved_done':
      return `Got it. If the ${title} draft looks right, run \`/savyre-generate-final\`.`;
    case 'unavailable':
      return 'Savyre is not available here. Use the Savyre panel.';
    case 'lock_off':
      return 'The Savyre lock is off. Start a session in the panel, then run `/savyre-start`.';
    case 'on_stage':
      return `We're on ${title}.`;
    case 'challenge_now':
      return `I'll take a second look at ${title}.`;
    case 'evidence_now':
      return `I'll attach evidence for what I observed in ${title}.`;
    case 'need_challenge':
      return `${title} still needs a second look at the draft before we can lock it.`;
    case 'need_evidence':
      return `${title} still needs evidence for what was observed.`;
    case 'need_answers':
      return 'I still need a decision from you before we can lock this step.';
    default:
      return '';
  }
}

function chatStartUserMessage(input) {
  const parts = [];
  if (input.ignoredUserText) {
    parts.push(chatUserMessage('ignored_extra', { stageId: input.stageId }));
  }
  const pending = typeof input.pendingQuestion === 'string' ? input.pendingQuestion.trim() : '';
  if (pending) {
    parts.push(chatUserMessage('ask_question', { question: pending }));
    return parts.join(' ');
  }
  const stageId = input.stageId;
  if (stageId === '01-task-input' && !input.confirmed) {
    parts.push(chatUserMessage(input.suggestedTask ? 'confirm_task' : 'ask_what_to_build'));
    return parts.join(' ');
  }
  if (stageId === '04-impact-analysis' || stageId === '05-plan-generation-and-review') {
    parts.push(chatUserMessage('panel_run_ai', { stageId }));
    return parts.join(' ');
  }
  if (stageId === '06-implementation') {
    parts.push(chatUserMessage('implement'));
    return parts.join(' ');
  }
  if (!input.aiReady) {
    parts.push(chatUserMessage('draft_now', { stageId }));
    return parts.join(' ');
  }
  if (stageId === '02-requirement-analysis' && input.challengeComplete !== true) {
    parts.push(chatUserMessage('challenge_now', { stageId }));
    return parts.join(' ');
  }
  if (stageId === '03-codebase-discovery' && input.evidenceReady !== true) {
    parts.push(chatUserMessage('evidence_now', { stageId }));
    return parts.join(' ');
  }
  parts.push(chatUserMessage('ask_generate_final', { stageId }));
  return parts.join(' ');
}

function withUserMessage(payload, userMessage) {
  return { ...payload, userMessage };
}

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

const LIFECYCLE_VERBS = 'run|start|status|stop|turn|confirm|answer|action';

function isLifecycleCommand(command) {
  const c = String(command || '').replace(/\\/g, '/');
  if (!/savyre-guard\.mjs/.test(c)) return false;
  return new RegExp(`savyre-guard\\.mjs(?:["']|\\s)+["']?(${LIFECYCLE_VERBS})\\b`, 'i').test(c);
}

function resolveSavyreCliJs() {
  const home = os.homedir();
  const candidates = [
    process.env.SAVYRE_CLI,
    path.join(PLUGIN_ROOT, '..', 'savyre-extension', 'cli', 'dist', 'savyre.js'),
    path.join(home, 'Documents', 'Projects', 'savyre-extension', 'cli', 'dist', 'savyre.js')
  ];
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

function parseCliJson(stdout) {
  const text = String(stdout || '');
  if (!text.trim()) return null;
  try {
    return JSON.parse(text.trim());
  } catch {
    /* scan for last object with ok */
  }
  const found = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (esc) {
          esc = false;
          continue;
        }
        if (c === '\\') {
          esc = true;
          continue;
        }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          try {
            const o = JSON.parse(text.slice(i, j + 1));
            if (o && typeof o === 'object' && !Array.isArray(o) && typeof o.ok === 'boolean') {
              found.push(o);
            }
          } catch {
            /* ignore */
          }
          break;
        }
      }
    }
  }
  return found.length ? found[found.length - 1] : null;
}

function readPanelStageId(workspace) {
  try {
    const raw = JSON.parse(readFileSync(path.join(workspace, '.savyre', 'stage-status.json'), 'utf8'));
    return typeof raw.currentStageId === 'string' && raw.currentStageId.trim()
      ? raw.currentStageId.trim()
      : null;
  } catch {
    return null;
  }
}

async function readChatBoundStageId(workspace) {
  const existing = await readJsonIfPresent(path.join(workspace, CHAT_CHECKPOINT_REL));
  const v = existing?.stageId;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function chatPanelMismatchResult(action, boundStageId, panelStageId) {
  const current = panelStageId || 'unknown';
  return withUserMessage(
    {
      ok: false,
      action,
      unlocksStage: false,
      boundStageId: boundStageId || null,
      panelStageId,
      reason: boundStageId
        ? `Chat is bound to ${boundStageId} but the panel is on ${current}. Do not generate-final, validate, confirm, or answer on ${boundStageId}. Ask the developer to run /savyre-start (no extra text) for ${current}. Wait.`
        : `Chat is not bound to the panel. Ask the developer to run /savyre-start (no extra text) for ${current}. Wait.`
    },
    chatUserMessage('mismatch')
  );
}

async function requireChatPanelMatch(workspace, action) {
  const panelStageId = readPanelStageId(workspace);
  if (!panelStageId) {
    return withUserMessage(
      {
        ok: false,
        action,
        unlocksStage: false,
        reason: 'No currentStageId. Start a session in the Savyre panel first.'
      },
      chatUserMessage('start_panel')
    );
  }
  const boundStageId = await readChatBoundStageId(workspace);
  if (!boundStageId || boundStageId !== panelStageId) {
    return chatPanelMismatchResult(action, boundStageId, panelStageId);
  }
  return { ok: true, panelStageId, boundStageId };
}

function localContinueWarning(stderr) {
  const text = String(stderr || '');
  const m = text.match(/Server workflow start skipped \([\s\S]*?\)[^\n]*continuing locally\./);
  return m ? m[0] : null;
}

function runSavyreGate(workspace, subcommand, opts) {
  const cliJs = resolveSavyreCliJs();
  if (!cliJs) {
    return withUserMessage(
      {
        ok: false,
        action: subcommand,
        unlocksStage: false,
        reason:
          'Savyre CLI not found. Set SAVYRE_CLI to cli/dist/savyre.js, or keep the extension repo next to this plugin.'
      },
      chatUserMessage('unavailable')
    );
  }
  const timeout =
    Number(opts?.timeoutMs) > 0
      ? Number(opts.timeoutMs)
      : subcommand === 'run-stage'
        ? 600000
        : 180000;
  const pinnedStage =
    typeof opts?.stageId === 'string' && opts.stageId.trim() ? opts.stageId.trim() : null;
  const args = [cliJs, 'workflow', subcommand, '--json'];
  if (pinnedStage) args.push('--stage', pinnedStage);
  const result = spawnSync(process.execPath, args, {
    cwd: workspace,
    encoding: 'utf8',
    timeout
  });
  const parsed =
    parseCliJson(result.stdout) || parseCliJson(result.stderr) || parseCliJson(`${result.stdout || ''}\n${result.stderr || ''}`);
  const panelStageId = readPanelStageId(workspace);
  const warning = localContinueWarning(result.stderr);
  if (parsed && typeof parsed === 'object') {
    const action = subcommand === 'generate-final' ? 'generate_final' : subcommand;
    let message = String(parsed.message || '').trim();
    const gateStage = parsed.data?.stageId || pinnedStage || panelStageId || '';
    let userMessage = '';
    if (subcommand === 'generate-final' && parsed.ok) {
      if (pinnedStage && gateStage && gateStage !== pinnedStage) {
        message = `${message} Generate final targeted ${gateStage} but Chat pinned ${pinnedStage}. Do not run /savyre-validate. Ask the developer to run /savyre-start (no extra text). Wait.`.trim();
        userMessage = chatUserMessage('mismatch');
      } else {
        message = `${message} Ask the developer to run /savyre-validate in this chat for stage ${gateStage || pinnedStage}. Wait. Do not run it yourself. Chat did not unlock.`.trim();
        userMessage = chatUserMessage('ask_validate', { stageId: gateStage || pinnedStage });
      }
    } else if (subcommand === 'generate-final' && !parsed.ok) {
      userMessage = chatUserMessage('gate_failed');
    }
    if (subcommand === 'validate' && parsed.ok) {
      message = `${message} Ask the developer whether to run /savyre-start (no extra text) for the new current stage. Wait. Do not start it yourself. Unlock is Savyre's result, not a Chat decision.`.trim();
      const nextId = readPanelStageId(workspace);
      userMessage = chatUserMessage('ask_start_next', {
        stageId: gateStage || pinnedStage,
        nextStageId: nextId && nextId !== (gateStage || pinnedStage) ? nextId : null
      });
    } else if (subcommand === 'validate' && !parsed.ok) {
      userMessage = chatUserMessage('validate_failed');
    }
    return withUserMessage(
      {
        ...parsed,
        action,
        unlocksStage: false,
        cli: cliJs,
        message,
        panelStageId,
        ...(pinnedStage ? { pinnedStageId: pinnedStage } : {}),
        ...(warning ? { warning } : {})
      },
      userMessage
    );
  }
  const err = (result.stderr || result.stdout || result.error?.message || 'CLI failed')
    .replace(/Assertion failed:[\s\S]*$/m, '')
    .trim();
  return withUserMessage(
    {
      ok: false,
      action: subcommand === 'generate-final' ? 'generate_final' : subcommand,
      unlocksStage: false,
      panelStageId,
      reason: err.slice(0, 2000),
      ...(pinnedStage ? { pinnedStageId: pinnedStage } : {}),
      ...(warning ? { warning } : {})
    },
    subcommand === 'validate' ? chatUserMessage('validate_failed') : chatUserMessage('gate_failed')
  );
}

async function clearActiveLock(workspace) {
  try {
    await fs.unlink(path.join(workspace, ACTIVE_REL));
  } catch {
    /* already idle */
  }
  await clearLastWorkspace();
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
  const cwd = path.resolve(String(input.cwd || process.cwd()));
  const cwdProject = walkAncestors(
    cwd,
    (dir) =>
      normPath(dir) !== normPath(PLUGIN_ROOT) &&
      (existsSync(path.join(dir, '.savyre', 'stage-status.json')) ||
        existsSync(path.join(dir, '.savyre', 'session.json')))
  );
  if (cwdProject) return cwdProject;

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

  return last || cwd;
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
  if (WRITE_STAGES.has(m.stageId)) {
    if (m.writeMode !== 'read_write') return `writeMode must be read_write for ${m.stageId}`;
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

function pathAllowed(workspace, filePath, allowedPaths) {
  const patterns = allowedPaths?.length ? allowedPaths : ['**'];
  if (patterns.some((p) => String(p).replace(/\\/g, '/') === '**')) return true;
  if (!filePath) return false;
  const rel = posixRel(workspace, filePath);
  if (!rel || rel.startsWith('..')) return false;
  const lower = rel.replace(/\\/g, '/').toLowerCase();
  for (const p of patterns) {
    const needle = String(p).replace(/\\/g, '/').toLowerCase();
    if (!needle) continue;
    if (needle === '**') return true;
    if (needle.endsWith('/**')) {
      const prefix = needle.slice(0, -3);
      if (lower === prefix || lower.startsWith(`${prefix}/`)) return true;
      continue;
    }
    if (needle.includes('*')) {
      const re = new RegExp(
        `^${needle.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')}$`,
        'i'
      );
      if (re.test(rel) || re.test(lower)) return true;
      continue;
    }
    if (lower === needle) return true;
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

async function readStageFile(workspace, rel) {
  const abs = path.join(workspace, ...rel.split('/'));
  try {
    const raw = await fs.readFile(abs, 'utf8');
    const text = clipText(raw, INPUT_INJECT_MAX_CHARS);
    return { rel, missing: false, empty: !text, text };
  } catch {
    return { rel, missing: true, empty: true, text: '' };
  }
}

function previousChatStageId(stageId) {
  const i = STAGE_CHAT_ORDER.indexOf(stageId);
  return i > 0 ? STAGE_CHAT_ORDER[i - 1] : null;
}

/** Stage 01 uses input.md. Stages 02–06 use the previous stage's final.md. */
async function readChatSource(workspace, stageId) {
  if (stageId === '01-task-input') {
    return {
      kind: 'input',
      previousStageId: null,
      file: await readStageFile(workspace, 'savyre/stages/01-task-input/input.md')
    };
  }
  const prev = previousChatStageId(stageId);
  if (!prev) {
    return {
      kind: 'input',
      previousStageId: null,
      file: await readStageFile(workspace, `savyre/stages/${stageId}/input.md`)
    };
  }
  return {
    kind: 'upstreamFinal',
    previousStageId: prev,
    file: await readStageFile(workspace, `savyre/stages/${prev}/final.md`)
  };
}

async function readStageInput(workspace, stageId) {
  return readStageFile(workspace, `savyre/stages/${stageId}/input.md`);
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

function resumePendingQuestion(pending, pendingQuestionId) {
  if (!pending.length) return null;
  const wanted = String(pendingQuestionId || '').trim().toUpperCase();
  if (wanted) {
    const hit = pending.find((q) => String(q.id).toUpperCase() === wanted);
    if (hit) return hit;
  }
  return pending[0];
}

function isWorkflowEvidencePath(relPath) {
  const n = String(relPath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim()
    .toLowerCase();
  return (
    n === 'savyre' ||
    n.startsWith('savyre/') ||
    n === '.savyre' ||
    n.startsWith('.savyre/') ||
    n === '.cursor' ||
    n.startsWith('.cursor/')
  );
}

function parseChallengeFindings(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false };
  if (raw.schemaVersion !== '1.0' || !Array.isArray(raw.findings)) return { ok: false };
  for (const f of raw.findings) {
    if (!f || !String(f.summary || '').trim()) return { ok: false };
    if (f.blocking === true && !String(f.oqId || '').trim()) return { ok: false };
  }
  return { ok: true };
}

function parseEvidenceMap(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false };
  if (raw.schemaVersion !== '1.0' || !Array.isArray(raw.items)) return { ok: false };
  const types = new Set(['code', 'test', 'doc', 'not-found']);
  const conf = new Set(['high', 'medium', 'low']);
  for (const item of raw.items) {
    if (!item || !String(item.path || '').trim()) return { ok: false };
    if (!types.has(String(item.evidenceType || '')) || !conf.has(String(item.confidence || ''))) {
      return { ok: false };
    }
  }
  if (raw.greenfield === true) return { ok: true };
  if (!raw.items.length) return { ok: false };
  const observed = raw.items.filter(
    (i) => i.evidenceType !== 'not-found' && !isWorkflowEvidencePath(i.path)
  );
  if (!observed.length) return { ok: false };
  return { ok: true };
}

async function loadChatPass(workspace, stageId) {
  const challengeRaw = await readJsonIfPresent(
    path.join(workspace, 'savyre', 'stages', '02-requirement-analysis', 'challenge-findings.json')
  );
  const evidenceRaw = await readJsonIfPresent(
    path.join(workspace, 'savyre', 'stages', '03-codebase-discovery', 'evidence-map.json')
  );
  const challengeComplete =
    stageId !== '02-requirement-analysis' || parseChallengeFindings(challengeRaw).ok;
  const evidenceReady = stageId !== '03-codebase-discovery' || parseEvidenceMap(evidenceRaw).ok;
  return { challengeComplete, evidenceReady };
}

function chatGenerateFinalBlockers({ stageId, aiReady, hasPendingBlocking, challengeComplete, evidenceReady }) {
  if (!aiReady) return { ok: false, kind: 'draft_now' };
  if (hasPendingBlocking) return { ok: false, kind: 'need_answers' };
  if (stageId === '02-requirement-analysis' && challengeComplete !== true) {
    return { ok: false, kind: 'need_challenge' };
  }
  if (stageId === '03-codebase-discovery' && evidenceReady !== true) {
    return { ok: false, kind: 'need_evidence' };
  }
  return { ok: true, kind: 'ask_generate_final' };
}

const CHAT_ARTIFACT_HEADINGS = {
  '01-task-input': `# Original Task
# Explicit Requirements
# Potential Assumptions
# Acceptance Criteria
# Constraints
## Open Questions
# Task Completeness
# Extraction Confidence`,
  '02-requirement-analysis': `# Requirement Analysis
# Expected Behavior
# Scope
# Acceptance Criteria
## Open Questions`,
  '03-codebase-discovery': `# Codebase Discovery
# Application Repository Index
# Observed Findings
# Not Identified
## Open Questions`
};

function chatWriteAiOutputMessage(stageId) {
  const headings = CHAT_ARTIFACT_HEADINGS[stageId] || '## Open Questions';
  const src =
    stageId === '01-task-input'
      ? 'Fill every section from the confirmed Assigned task only. Restate their product; do not copy 15-stage process text.'
      : 'Fill from the previous stage final.md. Do not copy prompt instructions.';
  return [
    `Write \`savyre/stages/${stageId}/ai-output.md\` now so Generate final will not fail.`,
    src,
    'Use these headings (a complete stage document, at least 200 characters, include ## Open Questions):',
    headings,
    'If there is no product-scope ambiguity, write `No open questions identified.` under ## Open Questions.',
    'Then run savyre-guard.mjs turn. If no pending question, ask the developer to run /savyre-generate-final. Wait. Do not run generate-final, validate, or the next /savyre-start yourself.',
    'Do not click panel Stage AI. Do not invent ACCEPTED. Chat cannot unlock.'
  ].join(' ');
}

async function chatStageFollowupMessage(workspace, stageId, next) {
  if (next) {
    const q = next.question ? `: ${next.question}` : '';
    return `Ask ${next.id} in this chat${q}. When they answer, run /savyre-answer with their words. Resume this same question if the chat restarts. Do not edit developer-review.md yourself.`;
  }
  const aiReady = await aiOutputLooksWritten(workspace, stageId);
  const pass = await loadChatPass(workspace, stageId);
  const gate = chatGenerateFinalBlockers({
    stageId,
    aiReady,
    hasPendingBlocking: false,
    challengeComplete: pass.challengeComplete,
    evidenceReady: pass.evidenceReady
  });
  if (!aiReady) return chatWriteAiOutputMessage(stageId);
  if (stageId === '02-requirement-analysis' && !pass.challengeComplete) {
    return 'Draft exists. Run the requirement-challenge pass as a separate step. Write challenge-findings.json. Put blocking gaps in Open Questions. Do not rewrite the draft unless validation asked. Do not generate-final yet.';
  }
  if (stageId === '03-codebase-discovery' && !pass.evidenceReady) {
    return 'Draft exists. Run evidence-grounding. Write evidence-map.json for observed findings only. Greenfield: greenfield true and empty or not-found items. Do not invent architecture. Do not generate-final yet.';
  }
  if (!gate.ok) {
    return 'Follow turn.activeSkill. Do not run generate-final until that pass is done.';
  }
  return 'Run verification-before-completion (turn.activeSkill). If the check fails, stay on this stage. If it passes, ask the developer to run /savyre-generate-final. Wait. Do not run it, validate, or /savyre-start yourself. Chat cannot unlock by itself.';
}

function assignedTaskLooksFilled(inputText) {
  const match = String(inputText || '').match(
    /##\s*Assigned task(?: \(in your own words\))?[\s\S]*?(?=\n##\s|$)/i
  );
  if (!match) return false;
  const body = match[0].replace(/##\s*Assigned task(?: \(in your own words\))?/i, '').trim();
  const joined = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (!l || l === '-' || l === '*') return false;
      if (/^summarize the task/i.test(l)) return false;
      if (/^describe the (assigned )?task/i.test(l)) return false;
      return true;
    })
    .join(' ')
    .trim();
  if (joined.length < 16) return false;
  const workflowHits = [
    /\b15 stages\b/i,
    /official assignment/i,
    /savyre\/stages/i,
    /run stage ai/i,
    /savyre ai coding workflow/i
  ].filter((rx) => rx.test(joined)).length;
  return workflowHits < 2;
}

async function stageChatWorkLooksDone(workspace, stageId) {
  if (stageId === '01-task-input') {
    const inputFile = await readStageInput(workspace, stageId);
    return assignedTaskLooksFilled(inputFile.text);
  }
  return aiOutputLooksWritten(workspace, stageId);
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

function buildSessionContext(manifest, source) {
  const role = STAGE_ROLE_SKILL[manifest.stageId] || 'the matching Savyre role skill';
  const inputFile = source.file;
  if (manifest.stageId === '01-task-input') {
    const filled = assignedTaskLooksFilled(inputFile.text);
    return [
      'Savyre stage `01-task-input` is enforced (read_write, input.md and ai-output.md).',
      `Use the Cursor skill \`${role}\`. Follow JSON \`turn.activeSkill\` when present. Do not invent Savyre methodology.`,
      filled
        ? 'Assigned task already has developer wording. Confirm with /savyre-confirm. After confirm, write ai-output.md using the required headings filled from the Assigned task. Do not run panel Stage AI. Do not generate-final until ai-output.md exists.'
        : 'FIRST MESSAGE: ask only what they want to build. Then wait. Do not write files yet. Official assignment / 15-stage text is Savyre process, not the product task. After they name a product, write only `## Assigned task (in your own words)` using their words. Ask them to confirm with /savyre-confirm. Do not confirm for them.',
      'Before confirm you may write only `input.md`. After confirm you may write `ai-output.md`. Cursor Agent cannot record ACCEPTED — that stays in the Savyre extension.'
    ].join('\n');
  }
  const writeHint =
    manifest.stageId === '06-implementation'
      ? 'You may write application files with Write/StrReplace. Do not run Shell, start subagents, or delete files.'
      : manifest.stageId === '02-requirement-analysis' || manifest.stageId === '03-codebase-discovery'
        ? `Write \`savyre/stages/${manifest.stageId}/ai-output.md\` using the required headings. Source of truth is the previous final.md. Put Open Questions in that file and ask them here. Do not write answers. Do not edit developer-review.md.${
            manifest.stageId === '03-codebase-discovery'
              ? ' Also write evidence-map.json for observed findings only. Do not invent architecture on a greenfield repo.'
              : ' Do not add Confirmed Requirements or Functional Requirement Analysis — Savyre injects the Stage 01 contract.'
          } If Generate final rejects the artifact, fix ai-output.md. Then ask the developer to run /savyre-generate-final. Wait. Do not run it yourself.`
        : 'Read-only: do not edit application source. Do not write ai-output.md. Use the Savyre panel to run this stage. Then ask the developer to run /savyre-generate-final. Wait. Do not run it or validate yourself.';
  const prev = source.previousStageId;
  const missingHint =
    source.kind === 'upstreamFinal'
      ? `This stage has no input.md — that is expected. Source of truth is the previous approved \`final.md\`${prev ? ` (\`savyre/stages/${prev}/final.md\`)` : ''}.`
      : `_${inputFile.rel} is not on disk yet._`;
  const body = inputFile.missing
    ? `_${inputFile.rel} is missing. Validate the previous stage in the Savyre panel first. Do not invent requirements._`
    : inputFile.empty
      ? `_${inputFile.rel} is empty. Validate the previous stage in the Savyre panel first._`
      : inputFile.text;
  return [
    `Savyre stage \`${manifest.stageId}\` is enforced (${manifest.writeMode}).`,
    `Use the Cursor skill \`${role}\`. Follow JSON \`turn.activeSkill\` when present. Do not invent Savyre methodology.`,
    missingHint,
    manifest.stageId === '02-requirement-analysis' || manifest.stageId === '03-codebase-discovery'
      ? 'Work in this chat. Write ai-output.md here. Cursor Agent cannot record ACCEPTED — that stays in the Savyre extension.'
      : 'Work in this chat. Cursor Agent cannot record ACCEPTED — that stays in the Savyre extension.',
    writeHint,
    '',
    `## ${inputFile.rel}`,
    body
  ].join('\n');
}

function buildStopFollowup(manifest, source) {
  const role = STAGE_ROLE_SKILL[manifest.stageId] || 'the matching Savyre role skill';
  const inputFile = source.file;
  if (manifest.stageId === '01-task-input') {
    return assignedTaskLooksFilled(inputFile.text)
      ? [
          'Savyre stage `01-task-input` is still enforced. Use skill `savyre-task-input`.',
          'Assigned task is written. After /savyre-confirm, write ai-output.md with the required headings. If no Open Questions remain, ask the developer to run /savyre-generate-final. Wait. Do not run it yourself.',
          'Do not invent more sections. Do not set ACCEPTED. Do not run /savyre-stop until they accept there.'
        ].join(' ')
      : [
          'Savyre stage `01-task-input` is still enforced. Use skill `savyre-task-input`.',
          'Ask only: What should we build? Wait for a product or feature in their words.',
          'Do not treat the official assignment or 15-stage workflow as the product task.',
          'Do not write Original Task, Explicit Requirements, or Open Questions.',
          'After they answer, write only `## Assigned task (in your own words)` in `savyre/stages/01-task-input/input.md`.'
        ].join(' ');
  }
  const prev = source.previousStageId;
  const inputHint =
    source.kind === 'upstreamFinal'
      ? inputFile.missing || inputFile.empty
        ? `Source of truth is the previous \`final.md\`${prev ? ` (\`savyre/stages/${prev}/final.md\`)` : ''}. It is missing — use the Savyre panel to Validate the prior stage. This stage has no input.md.`
        : `Continue from the previous approved \`final.md\` (\`${inputFile.rel}\`). This stage has no input.md — that is expected.`
      : inputFile.missing || inputFile.empty
        ? `Open \`${inputFile.rel}\` if it exists.`
        : `Continue from \`${inputFile.rel}\` (already injected).`;
  const workHint =
    manifest.stageId === '06-implementation'
      ? 'Continue implementation in this chat. Write application files. Then ask the developer to run /savyre-generate-final. Wait. Do not run it yourself.'
      : manifest.stageId === '02-requirement-analysis' || manifest.stageId === '03-codebase-discovery'
        ? `Write or fix \`savyre/stages/${manifest.stageId}/ai-output.md\` using the required headings. Ask remaining Open Questions in chat. Do not fill answers in developer-review.md. If none remain, ask the developer to run /savyre-generate-final. Wait. Do not run it yourself.`
        : 'Do not write ai-output.md. Use the Savyre panel to run this stage, then ask the developer to run /savyre-generate-final. Wait. Do not run it or validate yourself.';
  return [
    `Savyre stage \`${manifest.stageId}\` is still enforced. Continue in this chat using skill \`${role}\`.`,
    inputHint,
    `${workHint} Do not set ACCEPTED. Do not run /savyre-stop until the developer accepts there.`
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
    const source = await readChatSource(workspace, manifest.stageId);
    const additional_context = buildSessionContext(manifest, source);
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
      reason: source.kind === 'upstreamFinal'
        ? source.file.missing
          ? 'upstream final.md missing'
          : 'upstream final.md injected'
        : source.file.missing
          ? 'input.md missing'
          : 'input.md injected'
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
    const written = await stageChatWorkLooksDone(workspace, manifest.stageId);
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
    const source = await readChatSource(workspace, manifest.stageId);
    const followup_message = buildStopFollowup(manifest, source);
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
    if (writeOk && fp && !pathAllowed(workspace, fp, manifest.allowedPaths)) {
      await appendEvidence(workspace, {
        executionId: manifest.executionId,
        hook: event,
        decision: 'deny',
        tool: name,
        reason: 'path not allowed'
      });
      return deny(
        'Savyre blocked a write outside allowed paths.',
        'You may only write files listed in the active Savyre execution manifest allowedPaths.'
      );
    }
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
    workspaceRoot: workspace,
    ...chatSkillFields(stageId, 'drafting')
  };
}

async function readJsonIfPresent(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

function sessionLooksActive(session) {
  if (!session || typeof session !== 'object') return false;
  if (session.status === 'ended' || session.endedAt) return false;
  if (session.status === 'started' || session.status === 'in_progress' || session.status === 'paused') {
    return true;
  }
  return Boolean(session.startedAt);
}

async function markSessionChatWorker(workspace) {
  const file = path.join(workspace, '.savyre', 'session.json');
  const session = await readJsonIfPresent(file);
  if (!session || typeof session !== 'object') return;
  if (session.workerInterface === 'chat') return;
  session.workerInterface = 'chat';
  session.updatedAt = new Date().toISOString();
  try {
    await fs.writeFile(file, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
  } catch {
    /* best-effort */
  }
}

function enforcedPayload(workspace, manifest, turn) {
  const fields = chatSkillFields(manifest.stageId, turn?.state);
  return {
    mode: 'enforced',
    stageId: manifest.stageId,
    executionId: manifest.executionId,
    expiresAt: manifest.expiresAt,
    workspaceRoot: workspace,
    skill: turn?.activeSkill ? cursorSkillForRef(turn.activeSkill) || fields.skill : fields.skill,
    cursorSkill: turn?.activeSkill
      ? cursorSkillForRef(turn.activeSkill) || fields.cursorSkill
      : fields.cursorSkill,
    activeSkill: turn?.activeSkill || fields.activeSkill,
    turn: turn || null,
    canApprove: false,
    canUnlockStage: false
  };
}

function leftoverCliText(fromIndex) {
  return process.argv
    .slice(fromIndex)
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function cmdStart(userText) {
  const leftover = String(userText || leftoverCliText(3) || '').trim();
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const session = await readJsonIfPresent(path.join(workspace, '.savyre', 'session.json'));
  if (!sessionLooksActive(session)) {
    return withUserMessage(
      {
        mode: 'idle',
        reason: 'No active Savyre session. Start a session in the Savyre panel first.'
      },
      chatUserMessage('start_panel')
    );
  }
  await markSessionChatWorker(workspace);
  const status = await readJsonIfPresent(path.join(workspace, '.savyre', 'stage-status.json'));
  const statusStageId =
    typeof status?.currentStageId === 'string' && status.currentStageId.trim()
      ? status.currentStageId.trim()
      : null;
  const running = await readJsonIfPresent(path.join(workspace, '.savyre', 'stage-ai-running.json'));
  const runningStageId =
    typeof running?.stageId === 'string' && STAGE_FIXTURES[running.stageId] ? running.stageId : null;
  const { manifest } = await loadActive(workspace);
  const verified = manifest ? await verifyManifest(manifest, workspace) : { ok: false };
  const lockStageId =
    verified.ok && manifest?.stageId && STAGE_FIXTURES[manifest.stageId] ? manifest.stageId : null;

  let stageId = statusStageId;
  if (runningStageId) {
    stageId = runningStageId;
  }

  if (!stageId) {
    return withUserMessage(
      {
        mode: 'idle',
        reason: 'No currentStageId in .savyre/stage-status.json. Start a session in the Savyre panel first.'
      },
      chatUserMessage('start_panel')
    );
  }
  if (!STAGE_FIXTURES[stageId]) {
    return withUserMessage(
      {
        mode: 'idle',
        stageId,
        reason: `Chat mode v1 supports stages 01–06 only. Current stage is ${stageId}. Accept and Validate stay in Savyre.`
      },
      chatUserMessage('chat_unsupported')
    );
  }
  if (lockStageId && lockStageId !== stageId) {
    await clearActiveLock(workspace);
  }
  let latest = (await loadActive(workspace)).manifest;
  let latestOk = Boolean(
    latest && (await verifyManifest(latest, workspace)).ok && latest.stageId === stageId
  );
  let runOut = null;
  if (!latestOk) {
    runOut = await cmdRun(stageId);
    latest = (await loadActive(workspace)).manifest;
    latestOk = Boolean(
      latest && (await verifyManifest(latest, workspace)).ok && latest.stageId === stageId
    );
  }
  const sessionId = session?.sessionId || 'local';
  const existing = await readOrCreateCheckpoint(workspace, stageId, sessionId);
  const { turn, next } = await buildInteractiveTurn(workspace, stageId, sessionId, existing);
  const captureTask = stageId === '01-task-input';
  const aiReady = await aiOutputLooksWritten(workspace, stageId);
  const pending = next && turn.state === 'needs_user_input' ? next : null;
  const pass = await loadChatPass(workspace, stageId);
  const bind = {
    captureTask,
    panelStageId: stageId,
    artifactTemplate: CHAT_ARTIFACT_HEADINGS[stageId] || null
  };
  if (leftover && !captureTask) bind.ignoredUserText = leftover;
  if (leftover && captureTask) bind.suggestedTask = leftover;
  let taskReady = Boolean(bind.suggestedTask);
  if (captureTask && !existing?.developerConfirmed && !taskReady) {
    const inputFile = await readStageInput(workspace, stageId);
    taskReady = assignedTaskLooksFilled(inputFile.text);
  }
  let message;
  if (bind.suggestedTask && captureTask && !existing?.developerConfirmed) {
    message =
      'Stage 01. A task draft was passed after /savyre-start. Write it only under Assigned task in input.md, then ask the developer to /savyre-confirm. Do not confirm for them. After confirm, write ai-output.md with the required headings so Generate final will not fail.';
  } else if (captureTask && !existing?.developerConfirmed) {
    message =
      'Stage 01. Capture the assigned task if needed, then /savyre-confirm. After confirm, write ai-output.md from the Assigned task using artifactTemplate. Do not generate-final yet.';
  } else {
    message = await chatStageFollowupMessage(workspace, stageId, pending);
  }
  if (bind.ignoredUserText) {
    message = `Bound to ${stageId}. Extra text after /savyre-start was ignored — that is not a new Stage 01 task. Do not write input.md or ask /savyre-confirm. Work this stage. ${message}`;
  }
  const userMessage = chatStartUserMessage({
    stageId,
    confirmed: Boolean(existing?.developerConfirmed),
    pendingQuestion: pending?.question || null,
    aiReady,
    suggestedTask: taskReady,
    ignoredUserText: Boolean(bind.ignoredUserText),
    challengeComplete: pass.challengeComplete,
    evidenceReady: pass.evidenceReady
  });
  const gate = chatGenerateFinalBlockers({
    stageId,
    aiReady,
    hasPendingBlocking: Boolean(pending),
    challengeComplete: pass.challengeComplete,
    evidenceReady: pass.evidenceReady
  });
  const allowedActions =
    pending
      ? ['answer', 'status', 'cancel']
      : captureTask && !existing?.developerConfirmed
        ? ['confirm', 'status', 'cancel']
        : gate.ok
          ? ['status', 'generate_final', 'validate', 'cancel']
          : ['status', 'cancel'];
  const turnOut = turn ? { ...turn, allowedActions } : turn;
  const extra = {
    pendingQuestion: pending,
    message,
    userMessage,
    ...chatSkillFields(stageId, turnOut?.state, pass)
  };
  if (latestOk && latest) {
    return { ...enforcedPayload(workspace, latest, turnOut), ...extra, ...bind };
  }
  return {
    ...(runOut || { mode: 'enforced', stageId }),
    turn: turnOut,
    canApprove: false,
    canUnlockStage: false,
    ...extra,
    ...bind
  };
}

async function cmdStatus() {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const { manifest } = await loadActive(workspace);
  if (!manifest) {
    return withUserMessage(
      { mode: 'idle', reason: 'no active manifest' },
      chatUserMessage('lock_off')
    );
  }
  const verified = await verifyManifest(manifest, workspace);
  if (!verified.ok) {
    return withUserMessage(
      {
        mode: 'idle',
        reason: verified.reason,
        stageId: manifest.stageId,
        executionId: manifest.executionId
      },
      chatUserMessage('lock_off')
    );
  }
  return withUserMessage(
    {
      mode: 'enforced',
      stageId: manifest.stageId,
      executionId: manifest.executionId,
      expiresAt: manifest.expiresAt,
      writeMode: manifest.writeMode,
      workflowId: manifest.workflowId
    },
    chatUserMessage('on_stage', { stageId: manifest.stageId })
  );
}

function allowedActionsForState(state) {
  if (state === 'needs_user_input') return ['answer', 'status', 'cancel'];
  if (state === 'awaiting_confirmation') return ['confirm', 'status', 'cancel'];
  if (state === 'ready_for_review' || state === 'output_ready') {
    return ['status', 'generate_final', 'validate', 'cancel'];
  }
  if (state === 'validation_failed') return ['status', 'answer', 'cancel'];
  if (state === 'completed' || state === 'cancelled') return ['status'];
  return ['status', 'cancel'];
}

async function readOrCreateCheckpoint(workspace, stageId, sessionId) {
  const file = path.join(workspace, CHAT_CHECKPOINT_REL);
  let existing = await readJsonIfPresent(file);
  if (!existing || existing.stageId !== stageId) {
    const lastGf = existing?.lastGenerateFinalStageId;
    const lastGfAt = existing?.lastGenerateFinalAt;
    existing = {
      schemaVersion: '1.0',
      sessionId: sessionId || 'local',
      stageId,
      state: 'connecting',
      activeSkill: pickActiveSkillRef(stageId, 'connecting'),
      pendingQuestionId: null,
      artifactRevision: 0,
      lastValidationCodes: [],
      ...(typeof lastGf === 'string' && lastGf.trim()
        ? { lastGenerateFinalStageId: lastGf.trim(), lastGenerateFinalAt: lastGfAt }
        : {}),
      updatedAt: new Date().toISOString()
    };
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
  }
  return existing;
}

async function writeCheckpoint(workspace, checkpoint) {
  const file = path.join(workspace, CHAT_CHECKPOINT_REL);
  const prev = await readJsonIfPresent(file);
  const lastGf = checkpoint.lastGenerateFinalStageId || prev?.lastGenerateFinalStageId;
  const next = {
    ...checkpoint,
    ...(typeof lastGf === 'string' && lastGf.trim()
      ? {
          lastGenerateFinalStageId: lastGf.trim(),
          lastGenerateFinalAt: checkpoint.lastGenerateFinalAt || prev?.lastGenerateFinalAt
        }
      : {}),
    updatedAt: new Date().toISOString()
  };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

async function readLastGenerateFinalStageId(workspace) {
  const existing = await readJsonIfPresent(path.join(workspace, CHAT_CHECKPOINT_REL));
  const v = existing?.lastGenerateFinalStageId;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

async function writeLastGenerateFinalStageId(workspace, stageId) {
  const file = path.join(workspace, CHAT_CHECKPOINT_REL);
  const existing = (await readJsonIfPresent(file)) || {};
  const next = {
    ...existing,
    lastGenerateFinalStageId: stageId,
    lastGenerateFinalAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function turnFromCheckpoint(checkpoint) {
  return {
    schemaVersion: '1.0',
    sessionId: checkpoint.sessionId,
    stageId: checkpoint.stageId,
    state: checkpoint.state,
    activeSkill: checkpoint.activeSkill || null,
    question: checkpoint.pendingQuestionId
      ? { id: checkpoint.pendingQuestionId, blocking: true }
      : null,
    allowedActions: allowedActionsForState(checkpoint.state),
    artifactRevision: checkpoint.artifactRevision || 0,
    validation: {
      status: Array.isArray(checkpoint.lastValidationCodes) && checkpoint.lastValidationCodes.length
        ? 'failed'
        : 'ok',
      codes: checkpoint.lastValidationCodes || []
    },
    interactionComplete: checkpoint.state === 'completed' || checkpoint.state === 'cancelled',
    canApprove: false,
    canUnlockStage: false
  };
}

function isVagueAnswer(question, answer) {
  const res = String(answer || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.!?]+$/g, '')
    .toLowerCase();
  if (!res) return true;
  if (!/^(yes|no|y|n|ok|okay|k|sure|fine|yeah|yep|yup|nah|nope)$/i.test(res)) return false;
  if (/\bor\b|\bwhich\b|\bwhat\b/i.test(String(question || ''))) return true;
  return false;
}

function listPendingReviewQuestions(review) {
  const md = String(review || '').replace(/\r\n/g, '\n');
  const section = md.match(/##\s*Open-Question Responses\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!section?.[1] || /No open questions require a response/i.test(section[1])) return [];
  const pending = [];
  const parts = section[1].split(/(?=###\s*OQ-\d+)/i);
  for (const part of parts) {
    const header = part.match(/^###\s*(OQ-\d+)/i);
    if (!header) continue;
    const id = header[1].toUpperCase();
    const block = part.replace(/^###\s*OQ-\d+\s*\n?/i, '').split(/\n##\s/)[0] || '';
    const cleaned = block.replace(/<!--[\s\S]*?-->/g, '');
    const questionLine = cleaned.match(/^Question:\s*(.*)$/im);
    const questionBody = questionLine
      ? [questionLine[1], ...(cleaned.split(/^Question:\s*.*$/im)[1] || '')
          .split(/\n(?=Impact:|Blocking|Resolution:|Status:)/)[0]
          .split('\n')]
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('<!--'))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
      : id;
    const resolution = (cleaned.match(/^Resolution:\s*(.*)$/im)?.[1] || '').trim();
    const status = (cleaned.match(/^Status:\s*(.*)$/im)?.[1] || '').trim().split(/\s/)[0].toUpperCase();
    const blocking = /blocking(?: question)?:\s*yes/i.test(cleaned);
    const answered =
      Boolean(resolution) &&
      status !== '' &&
      status !== 'OPEN' &&
      status !== 'ANSWERED' &&
      !isVagueAnswer(questionBody, resolution);
    if (!answered) pending.push({ id, question: questionBody || id, blocking });
  }
  return pending;
}

function splitMarkdownRow(line) {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function applyAnswerToAiOutputTable(aiOutput, questionId, answer) {
  const id = String(questionId || '').toUpperCase();
  const safe = String(answer || '')
    .replace(/\|/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
  if (!id || !safe) return { ok: false, content: String(aiOutput || '') };
  const lines = String(aiOutput || '').replace(/\r\n/g, '\n').split('\n');
  let inOq = false;
  const col = {};
  let sawHeader = false;
  let updated = false;
  const next = lines.map((line) => {
    if (/^#{1,3}\s*Open Questions\s*$/i.test(line.trim())) {
      inOq = true;
      sawHeader = false;
      for (const k of Object.keys(col)) delete col[k];
      return line;
    }
    if (inOq && /^#{1,3}\s+\S/.test(line.trim())) {
      inOq = false;
      return line;
    }
    if (!inOq || !line.trim().startsWith('|')) return line;
    const cells = splitMarkdownRow(line);
    if (!sawHeader && cells.some((c) => /^id$/i.test(c))) {
      cells.forEach((c, idx) => {
        col[c.toLowerCase()] = idx;
      });
      sawHeader = true;
      return line;
    }
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) return line;
    if (col.id == null) return line;
    if (String(cells[col.id] || '').toUpperCase() !== id) return line;
    const statusIdx = col.status;
    const resIdx = col.resolution;
    const needed = Math.max(statusIdx ?? -1, resIdx ?? -1);
    while (cells.length <= needed) cells.push('');
    if (statusIdx != null) cells[statusIdx] = 'RESOLVED';
    if (resIdx != null) cells[resIdx] = safe;
    updated = true;
    return `| ${cells.join(' | ')} |`;
  });
  return { ok: updated, content: next.join('\n') };
}

function applyAnswerToReview(review, questionId, answer) {
  const md = String(review || '').replace(/\r\n/g, '\n');
  answer = String(answer || '')
    .replace(/\|/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
  const pending = listPendingReviewQuestions(md);
  const target = questionId
    ? pending.find((q) => q.id === String(questionId).toUpperCase())
    : pending[0];
  if (!target) return { ok: false, error: questionId ? `Question ${questionId} is not open.` : 'No open questions left.' };
  if (isVagueAnswer(target.question, answer)) {
    return { ok: false, error: `That answer is too vague for ${target.id}. Say the actual choice.` };
  }
  const blockRe = new RegExp(
    `(###\\s*${target.id}\\s*\\n)([\\s\\S]*?)(?=\\n###\\s*OQ-|\\n##\\s|$)`,
    'i'
  );
  if (!blockRe.test(md)) return { ok: false, error: `Could not find ${target.id}.` };
  let next = md.replace(blockRe, (_, header, block) => {
    let b = block;
    b = /^Resolution:\s*/im.test(b)
      ? b.replace(/^Resolution:\s*.*$/im, `Resolution: ${answer}`)
      : `Resolution: ${answer}\n${b}`;
    b = /^Status:\s*/im.test(b) ? b.replace(/^Status:\s*.*$/im, 'Status: RESOLVED') : `${b}\nStatus: RESOLVED\n`;
    return `${header}${b}`;
  });
  const remaining = listPendingReviewQuestions(next);
  next = next.replace(/^Open Questions Remaining:\s*\d+/im, `Open Questions Remaining: ${remaining.length}`);
  next = next.replace(
    /^Blocking Questions:\s*\d+/im,
    `Blocking Questions: ${remaining.filter((q) => q.blocking).length}`
  );
  if (remaining.length === 0) {
    next = next.replace(/(##\s*Review Status\s*\n)([\s\S]*?)(?=\n##\s)/i, '$1\nACCEPTED\n\n');
    next = next.replace(/(##\s*Required Modifications\s*\n)([\s\S]*?)(?=\n##\s)/i, '$1\nNone\n\n');
  }
  return { ok: true, content: next, answeredId: target.id, remaining, next: remaining[0] || null };
}

async function readStageReview(workspace, stageId) {
  const preferred = path.join(workspace, 'savyre', 'stages', stageId, 'developer-review.md');
  const other = path.join(workspace, 'savyre', 'stages', stageId, 'candidate-review.md');
  try {
    return { abs: preferred, text: await fs.readFile(preferred, 'utf8') };
  } catch {
    /* try candidate */
  }
  try {
    return { abs: other, text: await fs.readFile(other, 'utf8') };
  } catch {
    return { abs: preferred, text: '' };
  }
}

async function buildInteractiveTurn(workspace, stageId, sessionId, existing) {
  const review = await readStageReview(workspace, stageId);
  const pending = listPendingReviewQuestions(review.text);
  const next = resumePendingQuestion(pending, existing?.pendingQuestionId);
  const keepConfirm = stageId === '01-task-input' && !existing?.developerConfirmed;
  const aiReady = await aiOutputLooksWritten(workspace, stageId);
  const validationFailed =
    Array.isArray(existing?.lastValidationCodes) && existing.lastValidationCodes.length > 0;
  const state = deriveChatTurnState({
    awaitingConfirmation: keepConfirm,
    pendingQuestion: Boolean(next),
    aiReady,
    validationFailed: validationFailed && !next && !keepConfirm
  });
  const pass = await loadChatPass(workspace, stageId);
  const checkpoint = await writeCheckpoint(workspace, {
    ...existing,
    schemaVersion: existing?.schemaVersion || '1.0',
    sessionId,
    stageId,
    state,
    pendingQuestionId: keepConfirm ? null : next?.id || null,
    activeSkill: pickActiveSkillRef(stageId, state, pass)
  });
  const turn = turnFromCheckpoint(checkpoint);
  if (!keepConfirm && next) {
    turn.question = { id: next.id, blocking: true, text: next.question };
    turn.allowedActions = allowedActionsForState('needs_user_input');
  }
  return { turn, next, checkpoint, pass };
}

async function cmdTurn() {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const match = await requireChatPanelMatch(workspace, 'turn');
  if (!match.ok) return match;
  const session = await readJsonIfPresent(path.join(workspace, '.savyre', 'session.json'));
  const stageId = match.panelStageId;
  const sessionId = session?.sessionId || 'local';
  const existing = await readOrCreateCheckpoint(workspace, stageId, sessionId);
  const { turn, next, pass } = await buildInteractiveTurn(workspace, stageId, sessionId, existing);
  const fields = chatSkillFields(stageId, turn.state, pass);
  const aiReady = await aiOutputLooksWritten(workspace, stageId);
  const gate = chatGenerateFinalBlockers({
    stageId,
    aiReady,
    hasPendingBlocking: Boolean(next),
    challengeComplete: pass.challengeComplete,
    evidenceReady: pass.evidenceReady
  });
  return {
    mode: 'turn',
    skill: fields.skill,
    cursorSkill: fields.cursorSkill,
    activeSkill: turn.activeSkill || fields.activeSkill,
    turn,
    pendingQuestion: next,
    unlocksStage: false,
    message: next
      ? `Ask ${next.id} in this chat. When they answer, run /savyre-answer with their words. Resume this same question if the chat restarts.`
      : gate.ok
        ? 'Run verification-before-completion (turn.activeSkill). If the check passes, ask the developer to run /savyre-generate-final. Wait. Do not run it, validate, or the next /savyre-start yourself. Savyre unlocks if Validate passes.'
        : 'Follow turn.activeSkill. Do not run generate-final until that pass is done.',
    userMessage: next
      ? chatUserMessage('ask_question', { question: next.question })
      : chatUserMessage(gate.kind, { stageId })
  };
}

async function cmdAnswer(questionIdOrAnswer, ...rest) {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const match = await requireChatPanelMatch(workspace, 'answer');
  if (!match.ok) return match;
  const session = await readJsonIfPresent(path.join(workspace, '.savyre', 'session.json'));
  const stageId = match.panelStageId;
  const first = String(questionIdOrAnswer || '').trim();
  let questionId = null;
  let answer = '';
  if (/^OQ-\d+$/i.test(first)) {
    questionId = first.toUpperCase();
    answer = rest.join(' ').trim();
  } else {
    answer = [first, ...rest].join(' ').trim();
  }
  if (!answer) {
    return withUserMessage(
      { ok: false, action: 'answer', unlocksStage: false, reason: 'Missing answer text. Usage: answer [OQ-001] <developer words>' },
      chatUserMessage('ask_question')
    );
  }
  const review = await readStageReview(workspace, stageId);
  if (!review.text.trim()) {
    return withUserMessage(
      { ok: false, action: 'answer', unlocksStage: false, reason: 'developer-review.md is missing.' },
      chatUserMessage('gate_failed')
    );
  }
  const applied = applyAnswerToReview(review.text, questionId, answer);
  if (!applied.ok) {
    return withUserMessage(
      { ok: false, action: 'answer', unlocksStage: false, reason: applied.error },
      /vague/i.test(String(applied.error || ''))
        ? chatUserMessage('ask_question', { question: 'I need a clearer choice before we continue.' })
        : chatUserMessage('ask_question')
    );
  }
  await fs.writeFile(review.abs, applied.content.endsWith('\n') ? applied.content : `${applied.content}\n`, 'utf8');
  try {
    const aiAbs = path.join(workspace, 'savyre', 'stages', stageId, 'ai-output.md');
    const aiText = await fs.readFile(aiAbs, 'utf8');
    const synced = applyAnswerToAiOutputTable(aiText, applied.answeredId, answer);
    if (synced.ok) {
      await fs.writeFile(aiAbs, synced.content.endsWith('\n') ? synced.content : `${synced.content}\n`, 'utf8');
    }
  } catch {
    /* ai-output.md missing */
  }
  const aiReady = await aiOutputLooksWritten(workspace, stageId);
  const pass = await loadChatPass(workspace, stageId);
  const state = deriveChatTurnState({
    pendingQuestion: Boolean(applied.next),
    aiReady
  });
  const checkpoint = await writeCheckpoint(workspace, {
    schemaVersion: '1.0',
    sessionId: session?.sessionId || 'local',
    stageId,
    state,
    activeSkill: pickActiveSkillRef(stageId, state, pass),
    pendingQuestionId: applied.next?.id || null,
    artifactRevision: 1,
    lastValidationCodes: [],
    developerConfirmed: true
  });
  const responsesFile = path.join(workspace, CHAT_RESPONSES_REL);
  let responses = { schemaVersion: '1.0', items: [] };
  try {
    responses = JSON.parse(await fs.readFile(responsesFile, 'utf8'));
  } catch {
    /* create */
  }
  if (!Array.isArray(responses.items)) responses.items = [];
  responses.items.push({
    stageId,
    questionId: applied.answeredId,
    answer,
    artifactRevision: 1,
    recordedAt: new Date().toISOString()
  });
  responses.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(responsesFile), { recursive: true });
  await fs.writeFile(responsesFile, `${JSON.stringify(responses, null, 2)}\n`, 'utf8');
  const turn = turnFromCheckpoint(checkpoint);
  if (applied.next) {
    turn.question = { id: applied.next.id, blocking: true, text: applied.next.question };
  }
  const gate = chatGenerateFinalBlockers({
    stageId,
    aiReady,
    hasPendingBlocking: Boolean(applied.next),
    challengeComplete: pass.challengeComplete,
    evidenceReady: pass.evidenceReady
  });
  return {
    ok: true,
    action: 'answer',
    unlocksStage: false,
    answeredId: applied.answeredId,
    remaining: applied.remaining,
    nextQuestion: applied.next,
    turn,
    message: applied.next
      ? `Saved ${applied.answeredId}. Ask next: ${applied.next.id} — ${applied.next.question}`
      : `Saved ${applied.answeredId}. Follow turn.activeSkill. Wait.`,
    userMessage: applied.next
      ? chatUserMessage('ask_question', { question: applied.next.question })
      : chatUserMessage(gate.kind, { stageId })
  };
}

async function cmdConfirm() {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const session = await readJsonIfPresent(path.join(workspace, '.savyre', 'session.json'));
  if (!sessionLooksActive(session)) {
    return withUserMessage(
      {
        ok: false,
        action: 'confirm',
        unlocksStage: false,
        reason: 'No active Savyre session. Start a session in the Savyre panel first.'
      },
      chatUserMessage('start_panel')
    );
  }
  const match = await requireChatPanelMatch(workspace, 'confirm');
  if (!match.ok) return match;
  const current = match.panelStageId;
  if (current !== '01-task-input') {
    return withUserMessage(
      {
        ok: false,
        action: 'confirm',
        unlocksStage: false,
        stageId: current,
        reason: current
          ? `Confirm is Stage 01 only. The panel is on ${current}. Ask the developer to run /savyre-start with no extra task text. Wait. Do not start it yourself. Do not rewrite Stage 01 input.md.`
          : 'Confirm is Stage 01 only. No currentStageId. Start a session in the Savyre panel first.'
      },
      current ? chatUserMessage('confirm_not_stage_01') : chatUserMessage('start_panel')
    );
  }
  const inputAbs = path.join(workspace, 'savyre', 'stages', '01-task-input', 'input.md');
  let input = '';
  try {
    input = await fs.readFile(inputAbs, 'utf8');
  } catch {
    return withUserMessage(
      { ok: false, action: 'confirm', unlocksStage: false, reason: 'No Stage 01 input.md' },
      chatUserMessage('ask_what_to_build')
    );
  }
  if (!/##\s*Assigned task/i.test(input) || !input.replace(/##\s*Assigned task[\s\S]*?/i, '').trim()) {
    const body = input.split(/##\s*Assigned task(?: \(in your own words\))?/i)[1] || '';
    const cleaned = body.split(/\n##\s/)[0] || '';
    if (!cleaned.replace(/[-*\s]/g, '').trim()) {
      return withUserMessage(
        { ok: false, action: 'confirm', unlocksStage: false, reason: 'No assigned task to confirm' },
        chatUserMessage('ask_what_to_build')
      );
    }
  }
  const review = await readStageReview(workspace, '01-task-input');
  const pending = listPendingReviewQuestions(review.text);
  const next = pending[0] || null;
  const confirmState = deriveChatTurnState({
    pendingQuestion: Boolean(next),
    aiReady: false
  });
  const checkpoint = await writeCheckpoint(workspace, {
    schemaVersion: '1.0',
    sessionId: session?.sessionId || 'local',
    stageId: '01-task-input',
    state: confirmState,
    activeSkill: pickActiveSkillRef('01-task-input', confirmState),
    pendingQuestionId: next?.id || null,
    artifactRevision: 1,
    lastValidationCodes: [],
    developerConfirmed: true
  });
  const responsesFile = path.join(workspace, CHAT_RESPONSES_REL);
  let responses = { schemaVersion: '1.0', items: [] };
  try {
    responses = JSON.parse(await fs.readFile(responsesFile, 'utf8'));
  } catch {
    /* create */
  }
  if (!Array.isArray(responses.items)) responses.items = [];
  responses.items.push({
    stageId: '01-task-input',
    questionId: 'STAGE01-CONFIRM',
    answer: 'confirmed',
    artifactRevision: 1,
    recordedAt: new Date().toISOString()
  });
  responses.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(responsesFile), { recursive: true });
  await fs.writeFile(responsesFile, `${JSON.stringify(responses, null, 2)}\n`, 'utf8');
  const reviewAfter = await readStageReview(workspace, '01-task-input');
  const pendingAfter = listPendingReviewQuestions(reviewAfter.text);
  const nextAfter = pendingAfter[0] || null;
  const aiReady = await aiOutputLooksWritten(workspace, '01-task-input');
  const message = nextAfter
    ? `Task confirmed. Ask ${nextAfter.id} in this chat: ${nextAfter.question} When they answer, run /savyre-answer with their words.`
    : await chatStageFollowupMessage(workspace, '01-task-input', null);
  const userMessage = nextAfter
    ? chatUserMessage('ask_question', { question: nextAfter.question })
    : aiReady
      ? chatUserMessage('ask_generate_final', { stageId: '01-task-input' })
      : chatUserMessage('task_confirmed_draft');
  const afterState = deriveChatTurnState({
    pendingQuestion: Boolean(nextAfter),
    aiReady
  });
  const checkpointAfter = await writeCheckpoint(workspace, {
    ...checkpoint,
    state: afterState,
    pendingQuestionId: nextAfter?.id || null,
    activeSkill: pickActiveSkillRef('01-task-input', afterState)
  });
  return {
    ok: true,
    action: 'confirm',
    unlocksStage: false,
    nextQuestion: nextAfter,
    artifactTemplate: CHAT_ARTIFACT_HEADINGS['01-task-input'],
    message,
    userMessage,
    turn: turnFromCheckpoint(checkpointAfter)
  };
}

async function cmdGenerateFinal() {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const match = await requireChatPanelMatch(workspace, 'generate_final');
  if (!match.ok) return match;
  const stageId = match.panelStageId;
  const aiReady = await aiOutputLooksWritten(workspace, stageId);
  const review = await readStageReview(workspace, stageId);
  const pending = listPendingReviewQuestions(review.text);
  const pass = await loadChatPass(workspace, stageId);
  const gate = chatGenerateFinalBlockers({
    stageId,
    aiReady,
    hasPendingBlocking: pending.some((q) => q.blocking) || pending.length > 0,
    challengeComplete: pass.challengeComplete,
    evidenceReady: pass.evidenceReady
  });
  if (!gate.ok) {
    return withUserMessage(
      {
        ok: false,
        action: 'generate_final',
        unlocksStage: false,
        stageId,
        reason: `Chat generate-final blocked (${gate.kind}). Follow turn.activeSkill. Wait.`
      },
      chatUserMessage(gate.kind, { stageId })
    );
  }
  const result = runSavyreGate(workspace, 'generate-final', { stageId });
  const gfStage = result.data?.stageId || match.panelStageId;
  if (result.ok && gfStage) {
    await writeLastGenerateFinalStageId(workspace, gfStage);
  }
  return result;
}

async function cmdValidateGate() {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const match = await requireChatPanelMatch(workspace, 'validate');
  if (!match.ok) return match;
  const lastGf = await readLastGenerateFinalStageId(workspace);
  if (lastGf && lastGf !== match.panelStageId) {
    return withUserMessage(
      {
        ok: false,
        action: 'validate',
        unlocksStage: false,
        panelStageId: match.panelStageId,
        boundStageId: match.boundStageId,
        lastGenerateFinalStageId: lastGf,
        data: { stageId: match.panelStageId },
        reason: `Generate final was for ${lastGf} but Chat/panel are on ${match.panelStageId}. Do not validate ${lastGf}. Ask the developer to run /savyre-start (no extra text) for ${match.panelStageId}. Wait.`
      },
      chatUserMessage('mismatch')
    );
  }
  return runSavyreGate(workspace, 'validate', { stageId: match.panelStageId });
}

async function cmdAction(actionName, ...rest) {
  const action = String(actionName || '').trim();
  if (action === 'confirm') return cmdConfirm();
  if (action === 'turn' || action === 'status') return cmdTurn();
  if (action === 'answer') return cmdAnswer(...rest);
  if (action === 'generate_final' || action === 'generate-final') {
    return cmdGenerateFinal();
  }
  if (action === 'run_stage' || action === 'run-stage') {
    const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
    return runSavyreGate(workspace, 'run-stage');
  }
  if (action === 'validate') {
    return cmdValidateGate();
  }
  return withUserMessage(
    { ok: false, action, unlocksStage: false, reason: `Unknown action ${action}` },
    chatUserMessage('unavailable')
  );
}

async function cmdStop() {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const { manifest } = await loadActive(workspace);
  await clearActiveLock(workspace);
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
  return withUserMessage({ mode: 'idle' }, chatUserMessage('lock_off'));
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function main() {
  const verb = process.argv[2];
  if (
    verb === 'run' ||
    verb === 'start' ||
    verb === 'status' ||
    verb === 'stop' ||
    verb === 'turn' ||
    verb === 'confirm' ||
    verb === 'answer' ||
    verb === 'action'
  ) {
    const out =
      verb === 'run'
        ? await cmdRun(process.argv[3])
        : verb === 'start'
          ? await cmdStart(leftoverCliText(3))
          : verb === 'status'
            ? await cmdStatus()
            : verb === 'stop'
              ? await cmdStop()
              : verb === 'turn'
                ? await cmdTurn()
                : verb === 'confirm'
                  ? await cmdConfirm()
                  : verb === 'answer'
                    ? await cmdAnswer(...process.argv.slice(3))
                    : await cmdAction(process.argv[3], ...process.argv.slice(4));
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
