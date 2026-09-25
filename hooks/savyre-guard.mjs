#!/usr/bin/env node
/**
 * Savyre thin plugin runtime.
 * - Hook mode (stdin JSON): enforce the active execution manifest.
 * - CLI: node savyre-guard.mjs run | start | status | stop | turn | confirm | next | answer | action | export-report | export
 *
 * Contains no Savyre stage methodology.
 */
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  BRAIN_MISSING_USER_MESSAGE,
  getSavyreRuntimeReport,
  loadSavyreBrain
} from './savyre-brain.mjs';
import { persistChatHookUsage } from './savyre-chat-usage.mjs';

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
  '06-implementation': path.join(PLUGIN_ROOT, 'fixtures', 'implementation.manifest.json'),
  's01-task-definition': path.join(PLUGIN_ROOT, 'fixtures', 's01-task-definition.manifest.json'),
  's02-code-discovery': path.join(PLUGIN_ROOT, 'fixtures', 's02-code-discovery.manifest.json'),
  's03-implementation-plan': path.join(PLUGIN_ROOT, 'fixtures', 's03-implementation-plan.manifest.json'),
  's04-build-review': path.join(PLUGIN_ROOT, 'fixtures', 's04-build-review.manifest.json'),
  's05-test-resolve': path.join(PLUGIN_ROOT, 'fixtures', 's05-test-resolve.manifest.json'),
  's06-delivery-readiness': path.join(PLUGIN_ROOT, 'fixtures', 's06-delivery-readiness.manifest.json'),
  's07-handoff': path.join(PLUGIN_ROOT, 'fixtures', 's07-handoff.manifest.json')
};
const STAGE_EXEC_PREFIX = {
  '01-task-input': 'ti',
  '02-requirement-analysis': 'ra',
  '03-codebase-discovery': 'cd',
  '04-impact-analysis': 'ia',
  '05-plan-generation-and-review': 'pl',
  '06-implementation': 'im',
  's01-task-definition': 's01',
  's02-code-discovery': 's02',
  's03-implementation-plan': 's03',
  's04-build-review': 's04',
  's05-test-resolve': 's05',
  's06-delivery-readiness': 's06',
  's07-handoff': 's07'
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
  '06-implementation',
  '07-implementation-tracking',
  '08-implementation-code-review',
  '09-test-discovery',
  '10-test-generation-and-review',
  '11-test-execution',
  '12-debugging-iteration',
  '13-security-regression-review',
  '14-final-code-review',
  '15-final-summary-ai-reflection'
];
const SEVEN_STAGE_CHAT_ORDER = [
  's01-task-definition',
  's02-code-discovery',
  's03-implementation-plan',
  's04-build-review',
  's05-test-resolve',
  's06-delivery-readiness',
  's07-handoff'
];
const STAGE_ROLE_SKILL = {
  '01-task-input': 'savyre-task-input',
  '02-requirement-analysis': 'savyre-requirement-analyst',
  '03-codebase-discovery': 'savyre-codebase-discovery',
  '04-impact-analysis': 'savyre-impact-analyst',
  '05-plan-generation-and-review': 'savyre-plan-generation-and-review',
  '06-implementation': 'savyre-implementation',
  '07-implementation-tracking': 'savyre-run-stage',
  '08-implementation-code-review': 'savyre-run-stage',
  '09-test-discovery': 'savyre-run-stage',
  '10-test-generation-and-review': 'savyre-run-stage',
  '11-test-execution': 'savyre-run-stage',
  '12-debugging-iteration': 'savyre-run-stage',
  '13-security-regression-review': 'savyre-run-stage',
  '14-final-code-review': 'savyre-run-stage',
  '15-final-summary-ai-reflection': 'savyre-run-stage',
  's01-task-definition': 'savyre-stage-task-definition',
  's02-code-discovery': 'savyre-stage-code-discovery',
  's03-implementation-plan': 'savyre-stage-implementation-plan',
  's04-build-review': 'savyre-stage-build-review',
  's05-test-resolve': 'savyre-stage-test-resolve',
  's06-delivery-readiness': 'savyre-stage-delivery-readiness',
  's07-handoff': 'savyre-stage-handoff'
};

function isSevenStageId(stageId) {
  return /^s0[1-7]-/.test(String(stageId || ''));
}

function isTaskCaptureStage(stageId) {
  return stageId === '01-task-input' || stageId === 's01-task-definition';
}

function sevenStageFolder(stageId) {
  return String(stageId || '').replace(/-/g, '_');
}

function stageDraftRel(stageId) {
  if (typeof brain?.stageDraftRel === 'function') {
    return brain.stageDraftRel(stageId);
  }
  const map = {
    's01-task-definition': 'stages/s01_task_definition/task_brief.md',
    's02-code-discovery': 'stages/s02_code_discovery/codebase_impact_report.md',
    's03-implementation-plan': 'stages/s03_implementation_plan/implementation_plan.md',
    's04-build-review': 'stages/s04_build_review/change_report.md',
    's05-test-resolve': 'stages/s05_test_resolve/verification_report.md',
    's06-delivery-readiness': 'stages/s06_delivery_readiness/delivery_readiness_report.md',
    's07-handoff': 'stages/s07_handoff/delivery_summary.md'
  };
  if (map[stageId]) return map[stageId];
  if (isSevenStageId(stageId)) return `stages/${sevenStageFolder(stageId)}/ai-output.md`;
  return `savyre/stages/${stageId}/ai-output.md`;
}

function stageInputRel(stageId) {
  if (stageId === 's01-task-definition') return 'stages/s01_task_definition/stage_input.json';
  return `savyre/stages/${stageId}/input.md`;
}

function stageReviewRel(stageId) {
  if (isSevenStageId(stageId)) return `stages/${sevenStageFolder(stageId)}/developer-review.md`;
  return `savyre/stages/${stageId}/developer-review.md`;
}

function stageFinalRel(stageId) {
  if (isSevenStageId(stageId)) return `stages/${sevenStageFolder(stageId)}/final.md`;
  return `savyre/stages/${stageId}/final.md`;
}

function chatOrderFor(stageId) {
  return isSevenStageId(stageId) ? SEVEN_STAGE_CHAT_ORDER : STAGE_CHAT_ORDER;
}
const REGISTRY_TO_CURSOR_SKILL = {
  'savyre.task-input-dialogue': 'savyre-task-input',
  'savyre.requirement-analysis': 'savyre-requirement-analyst',
  'savyre.requirement-challenge': 'savyre-requirement-challenge',
  'savyre.codebase-discovery': 'savyre-codebase-discovery',
  'savyre.evidence-grounding': 'savyre-evidence-grounding',
  'savyre.verification-before-completion': 'savyre-verification-before-completion',
  'savyre.impact-analyst': 'savyre-impact-analyst',
  'savyre.plan-generation-and-review': 'savyre-plan-generation-and-review',
  'savyre.implementation': 'savyre-implementation'
};

function isPanelRunStage(stageId) {
  if (typeof brain?.isPanelRunStage === 'function') {
    return brain.isPanelRunStage(stageId);
  }
  const id = String(stageId || '').trim();
  if (isSevenStageId(id)) {
    return false;
  }
  return (
    STAGE_CHAT_ORDER.includes(id) &&
    id !== '01-task-input' &&
    id !== '02-requirement-analysis' &&
    id !== '03-codebase-discovery' &&
    id !== '04-impact-analysis' &&
    id !== '05-plan-generation-and-review' &&
    id !== '06-implementation'
  );
}

/** Loaded from @savyre/run-config. Null means Chat cannot serve canned copy. */
let brain = null;

function deriveChatTurnState(input) {
  if (!brain) return 'connecting';
  return brain.deriveChatTurnState(input);
}

function pickActiveSkillRef(stageId, state, ctx = {}) {
  if (!brain) return null;
  if (typeof brain.resolveActiveSkill === 'function') {
    const skill = brain.resolveActiveSkill([], stageId, state, {
      challengeComplete: ctx.challengeComplete,
      evidenceReady: ctx.evidenceReady,
      pendingQuestion: ctx.pendingQuestion === true || state === 'needs_user_input',
      hasRemainingBacklog: ctx.hasRemainingBacklog === true
    });
    if (typeof brain.formatSkillRef === 'function') return brain.formatSkillRef(skill);
    if (skill?.id) return skill.version ? `${skill.id}@${skill.version}` : skill.id;
  }
  const specialized = brain.CHAT_SPECIALIZED_SKILL_ID?.[stageId];
  const skipSpecialized =
    state === 'needs_user_input' ||
    ctx.pendingQuestion === true ||
    (stageId === '02-requirement-analysis' && ctx.challengeComplete === true) ||
    (stageId === 's01-task-definition' && ctx.challengeComplete === true) ||
    (stageId === '03-codebase-discovery' && ctx.evidenceReady === true);
  const specializedStates = brain.CHAT_SPECIALIZED_STATES || [];
  if (specialized && specializedStates.includes(state) && !skipSpecialized) {
    return `${specialized}@1.0.0`;
  }
  if (
    (stageId === 's04-build-review' || stageId === '06-implementation') &&
    ctx.hasRemainingBacklog === true
  ) {
    return 'savyre.implementation@1.0.0';
  }
  if (
    brain.CHAT_PRIMARY_SKILL_ID?.[stageId] &&
    (state === 'output_ready' || state === 'ready_for_review') &&
    ctx.hasRemainingBacklog !== true
  ) {
    return `${brain.CHAT_VERIFY_SKILL_ID || 'savyre.verification-before-completion'}@1.0.0`;
  }
  const primary = brain.CHAT_PRIMARY_SKILL_ID?.[stageId];
  if (primary) return `${primary}@1.0.0`;
  return STAGE_ROLE_SKILL[stageId] || null;
}

function stageTitle(stageId) {
  if (!brain) return String(stageId || '').trim() || 'this stage';
  return brain.stageTitle(stageId);
}

function chatUserMessage(kind, opts = {}) {
  if (!brain) return BRAIN_MISSING_USER_MESSAGE;
  return brain.chatUserMessage(kind, opts);
}

function chatStartUserMessage(input) {
  if (!brain) return BRAIN_MISSING_USER_MESSAGE;
  return brain.chatStartUserMessage(input);
}

function stage01DraftAction() {
  return (
    brain?.STAGE01_DRAFT_ACTION ||
    (brain ? brain.chatUserMessage('task_confirmed_draft', { stageId: 's01-task-definition' }) : '') ||
    ''
  );
}

function stage01LockAction() {
  return (
    brain?.STAGE01_LOCK_ACTION ||
    (brain ? brain.chatUserMessage('ask_generate_final', { stageId: 's01-task-definition' }) : '') ||
    ''
  );
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
  '04-impact-analysis',
  '05-plan-generation-and-review',
  '06-implementation'
]);

const CONTINUE_SLASH = '/savyre-next';

function lockSlash(_stageId) {
  return CONTINUE_SLASH;
}

function checkSlash(_stageId) {
  return CONTINUE_SLASH;
}

function waitForDeveloperSlash(slash) {
  return `speak only userMessage and wait for the developer to run \`${slash}\`. Do not run it yourself.`;
}

const TALK_FROM_ASSIGNED_THEN_CONFIRM =
  'From the product prompt (input.md Assigned task or what they typed), write 2-4 short sentences plus a Product / UX / API / Data / Stack list (only headings the prompt supports). Save that same text under ## Assigned task in savyre/stages/01-task-input/input.md (replace leftover or the summarize-placeholder). Keep Official assignment unchanged. Speak that same Assigned task text, then speak userMessage exactly. Do not speak Original Task. Never list Original Task or other ai-output headings in chat. Do not invent features. Do not paste Official assignment, JSON, message, suggestedTask, or hashes. Wait for /savyre-next. Do not write ai-output.md until they continue.';

const TALK_FROM_ASSIGNED_THEN_LOCK =
  'Write 1-2 short sentences of substance about the draft. Do not name the file path and do not say I wrote / I\'ve written that file. Then speak userMessage exactly - do not invent a Please check / lock line. Do not invent features. Do not paste Official assignment, JSON, message, suggestedTask, hashes, or continuation. Do not list artifactTemplate headings in chat. Do not speak a leftover numbered list. Wait for /savyre-next.';

const TALK_AFTER_CONFIRM_THEN_DRAFT =
  'Task confirmed. Do not paste JSON. Do not speak leftover product names. Do not speak the canned draft line as the reply. Do not list Original Task headings in chat. Copy input.md Assigned task into Original Task unchanged. Fill the rest of ai-output.md from that same input.md text (no Generate Output placeholder). Then run turn. Then write 1-2 short sentences of substance (no file path, do not say I wrote the draft), then speak the new userMessage exactly.';

const WORKFLOW_INSTRUCTION_RX = [
  /\bRun stage AI\b/i,
  /\bGenerate final\.md\b/i,
  /\bGenerate Output\b/i,
  /\bGenerate Final\b/i,
  /\bValidate stage\b/i,
  /\b(all )?(15|14|13)[- ]stages?\b/i,
  /\b15-stage\b/i,
  /\bsavyre\/stages\b/i,
  /\bdeveloper-review\.md\b/i,
  /\bai-session-log\b/i,
  /\b\.savyre\//i,
  /\bSavyre AI Coding Workflow\b/i,
  /\bSavyre 15-stage\b/i,
  /\bworking through the\b/i,
  /\bHow to run Savyre\b/i,
  /\bWorkflow session\b/i,
  /\bevidence stays local\b/i,
  /\blog AI interactions\b/i,
  /\bStage \d{2}\b/i,
  /\bOfficial assignment\b/i,
  /\bRead the official assignment\b/i,
  /\bStage 01 — Task Input\b/i,
  /\bStage 01 – Task Input\b/i,
  /\bcandidate-review\.md\b/i,
  /\bComplete each stage\b/i,
  /\bAccept, Generate final, and Validate\b/i
];

const ASSIGNED_TASK_HEADING_RE = /##\s*Assigned task(?: \(in your own words\))?/i;

const ASSIGNED_SCAFFOLD_RX = [
  /^[-*]\s*$/,
  /^Summarize the task, bug, or feature request in your own words\.?$/i,
  /^Describe the (assigned )?task in your own words\.?$/i
];

function hashOriginalTask(text) {
  return createHash('sha256').update(String(text || '').trim(), 'utf8').digest('hex');
}

function stripMarkdownNoise(text) {
  return String(text || '').replace(/\*+/g, '').replace(/`+/g, '');
}

function looksLikeProductTask(text) {
  return /\b(create|build|make|implement|add|fix|app|todo|clone|website|feature|users? can)\b/i.test(
    text
  );
}

function looksLikeWorkflowDoc(text) {
  const plain = stripMarkdownNoise(text);
  return WORKFLOW_INSTRUCTION_RX.some((rx) => rx.test(plain) || rx.test(text));
}

function isWorkflowInstructionLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return false;
  const plain = stripMarkdownNoise(trimmed);
  if (/^#\s+(Stage 01|Savyre|Getting started|How to run)\b/i.test(plain)) return true;
  const bullet = plain.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '').trim();
  if (ASSIGNED_SCAFFOLD_RX.some((rx) => rx.test(plain) || rx.test(bullet))) return true;
  if (trimmed.startsWith('#') && !looksLikeProductTask(plain)) {
    return looksLikeWorkflowDoc(plain);
  }
  if (trimmed.startsWith('#') && looksLikeProductTask(plain)) return false;
  if (trimmed.startsWith('#') && !looksLikeWorkflowDoc(plain)) return false;
  return WORKFLOW_INSTRUCTION_RX.some((rx) => rx.test(bullet) || rx.test(plain));
}

function extractUserTaskFromMixedInput(raw) {
  const lines = String(raw || '').split(/\r?\n/);
  let discardedWorkflow = false;
  const kept = [];
  for (const line of lines) {
    if (isWorkflowInstructionLine(line)) {
      discardedWorkflow = true;
      continue;
    }
    const t = line.trim();
    if (/^#\s+(Stage 01|Savyre|Getting started|How to run)\b/i.test(t)) {
      discardedWorkflow = true;
      continue;
    }
    kept.push(line);
  }
  return {
    originalTask: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    discardedWorkflow
  };
}

function assignedTaskSectionBody(inputMd) {
  const match = String(inputMd || '').match(
    /##\s*Assigned task(?: \(in your own words\))?[\s\S]*?(?=\n##\s|$)/i
  );
  if (!match?.[0]) return '';
  return match[0].replace(ASSIGNED_TASK_HEADING_RE, '').trim();
}

function stripAssignedScaffold(body) {
  return String(body || '')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t || t === '-') return false;
      return !ASSIGNED_SCAFFOLD_RX.some((rx) => rx.test(t));
    })
    .join('\n')
    .trim();
}

function productWordingFromRaw(raw) {
  const extracted = extractUserTaskFromMixedInput(raw);
  const text = extracted.originalTask.trim();
  if (!text) return '';
  if (looksLikeWorkflowDoc(text) && !looksLikeProductTask(text)) return '';
  return text;
}

function productWordingFromStage01Input(inputMd) {
  return productWordingFromRaw(stripAssignedScaffold(assignedTaskSectionBody(inputMd)));
}

function looksLikeWorkflowReview(text) {
  const t = String(text || '');
  return (
    /\b15-stage\b/i.test(t) ||
    /working through the/i.test(t) ||
    /\bGenerate Output\b/i.test(t) ||
    /Savyre 15-stage/i.test(t)
  );
}

function trackOriginalTask(input) {
  const text = String(input.text || '').trim();
  const hash = hashOriginalTask(text);
  const prev = input.previousHash?.trim() || '';
  const prevRev = input.previousRevision && input.previousRevision > 0 ? input.previousRevision : 1;
  return {
    text,
    hash,
    source: input.source,
    revision: prev && prev !== hash ? prevRev + 1 : prev ? prevRev : 1
  };
}

function firstSentence(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  const cut = t.match(/^(.+?[.!?])(\s|$)/);
  return (cut?.[1] || t).trim();
}

function tidyPhrase(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^[-–,:;\s]+|[-–,:;\s]+$/g, '')
    .replace(/[.]+$/, '')
    .trim();
}

function normalizeFactKey(text) {
  return tidyPhrase(text).toLowerCase();
}

function truncateWords(text, limit) {
  const words = tidyPhrase(text).split(/\s+/).filter(Boolean);
  if (words.length <= limit) return words.join(' ');
  return `${words.slice(0, limit).join(' ')}…`;
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function extractWhatToBuild(text) {
  const forManage = extractForManageProduct(text);
  if (forManage) return forManage;
  const purpose = text.match(
    /\b(?:build|create|make|implement|develop(?:ing)?)\s+(?:a|an|the)?\s+(?:web\s+)?(app|application|site|website|tool|platform)\s+(where|that(?!\s+works\s+like)|to)\s+(.+?)(?=\s+(?:using|use\b|with|also|and use)\b|[.,;]|$)/i
  );
  if (purpose) {
    return truncateWords(`${purpose[1]} ${purpose[2]} ${purpose[3]}`, 12);
  }
  const built = text.match(
    /\b(?:build|create|make|implement|develop(?:ing)?)\s+(?:a|an|the)?\s+(.+?)(?=\s+(?:using|with|in|for|that|where|so that|and then)\b|[.,;]|$)/i
  );
  if (built?.[1]) return truncateWords(built[1], 8);
  const clone = text.match(/\b((?:[\w]+(?:\s+[\w]+){0,4})\s+clone)\b/i);
  return clone?.[1] ? tidyPhrase(clone[1]) : '';
}

function stripAssignmentPreamble(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  t = t.replace(
    /^(?:you are tasked with|your (?:task|assignment|job) is to)\s+(?:developing|building|creating|implementing|making|develop|build|create|implement|make)\s+/i,
    ''
  );
  t = t.replace(/\byour solution should include\b/gi, '');
  t = t.replace(/\bfocus on\b[\s\S]*$/i, '');
  return tidyPhrase(t);
}

function spokenTaskText(originalTask) {
  const product = productWordingFromRaw(originalTask) || String(originalTask || '').trim();
  return stripAssignmentPreamble(
    product.replace(/\bcpmplete\b/gi, 'complete').replace(/\s+/g, ' ').trim()
  );
}

function extractForManageProduct(text) {
  const m = text.match(
    /\b(?:web\s+)?(app|application|site|website|tool|platform)\s+for\s+(?:a|an|the)?\s*(.+?)\s+to\s+(manage|handle|track|book|schedule)\s+(.+?)(?=[.,;]|$)/i
  );
  if (!m) return '';
  const place = tidyPhrase(m[2]);
  const domain = tidyPhrase(m[4]);
  if (!place || !domain || /\bauth/i.test(place)) return '';
  return truncateWords(`${place} ${domain}`, 8);
}

function extractAudience(text) {
  const mine = text.match(/\bfor\s+(?:my|our)\s+(.+?)(?=\s+(?:using|with|that|where)|[.,;]|$)/i);
  if (!mine?.[1]) return '';
  const body = tidyPhrase(mine[1]);
  if (/\bauth(?:entication)?\b/i.test(body)) return '';
  return truncateWords(body, 10);
}

function looksLikeNoAuth(text) {
  return (
    /\b(?:no|without|not)\s+(?:any\s+)?(?:auth(?:entication)?|log[- ]?ins?|sign[- ]?ins?)(?:\s+required)?\b/i.test(
      text
    ) || /\b(?:auth(?:entication)?|log[- ]?in|sign[- ]?in)\s+(?:is\s+)?not\s+required\b/i.test(text)
  );
}

function stripTrailingAuthClause(text) {
  return tidyPhrase(
    String(text || '')
      .replace(
        /\b(?:with\s+)?(?:no|without|not)\s+(?:any\s+)?(?:auth(?:entication)?|log[- ]?ins?|sign[- ]?ins?)(?:\s+required)?\b/gi,
        ''
      )
      .replace(/\b(?:auth(?:entication)?|log[- ]?in|sign[- ]?in)\s+(?:is\s+)?not\s+required\b/gi, '')
  );
}

function extractProductLine(text) {
  const what = extractWhatToBuild(text);
  const audience = extractAudience(text);
  let line = what;
  if (what && audience && !normalizeFactKey(what).includes(normalizeFactKey(audience))) {
    line = truncateWords(`${what} for ${audience}`, 12);
  }
  return stripTrailingAuthClause(line);
}

function extractStack(text) {
  const namedStack = text.match(/\b(mern|mean)(?:\s+stack)?\b/i);
  if (namedStack?.[1]) {
    return /stack/i.test(namedStack[0]) ? tidyPhrase(namedStack[0]) : tidyPhrase(namedStack[1]);
  }
  const using = text.match(/\b(?:using|use[sd]?)\s+(?:the\s+)?([A-Za-z][\w.+#]*(?:\s+stack)?)/i);
  if (using?.[1] && !/^(the\s+)?(browser|url|urls|link|http|https|database|db)\b/i.test(using[1])) {
    return tidyPhrase(using[1]);
  }
  const inTech = text.match(
    /\bin\s+((?:[A-Za-z][\w.+#]*)(?:\s+and\s+[A-Za-z][\w.+#]*)?(?:\s+stack)?)/
  );
  if (inTech?.[1] && !/^(the|your|a|an|this|that|my)\b/i.test(inTech[1])) {
    return tidyPhrase(inTech[1]);
  }
  if (/\bonly the ui\b|\bui[- ]only\b|\bjust the ui\b|\bui only\b/i.test(text)) {
    return 'UI only';
  }
  if (/\bfrontend[- ]only\b|\bno backend\b|\bclient[- ]only\b/i.test(text)) {
    return 'frontend-only';
  }
  return '';
}

function extractAuthOrOpen(text) {
  if (looksLikeNoAuth(text)) return 'no authentication';
  const authFor = text.match(/\bfor\s+auth(?:entication)?\s+(.+?)(?=[.,;]|$)/i);
  if (authFor?.[1]) return `auth: ${truncateWords(authFor[1], 10)}`;
  if (
    /\b(sign[- ]?in|log[- ]?in|account|authentication)\b/i.test(text) &&
    /\b(undecided|versus|vs\.?|whether|optional|not (sure|decided))\b/i.test(text)
  ) {
    return 'sign-in is still open';
  }
  if (/\bauthentication\b|\bauth\b|\bsign[- ]?in\b|\blog[- ]?in\b/i.test(text)) {
    return 'authentication';
  }
  return '';
}

function extractSeededData(text) {
  if (/\bseeded(?:\s+data)?\b|\bseed data\b|\bmock data\b|\bsample data\b/i.test(text)) {
    return 'seeded data';
  }
  return '';
}

function extractApi(text) {
  const m = text.match(/\bbackend(?:\s+api)?\s+to\s+(.+?)(?=[.,;]|$)/i);
  if (m?.[1]) return `backend API to ${truncateWords(tidyPhrase(m[1]), 8)}`;
  if (/\bbackend api\b/i.test(text)) return 'backend API';
  return '';
}

function extractDataModel(text) {
  const m = text.match(/\bdata model\s+for\s+(?:storing\s+)?(.+?)(?=[.,;]|$)/i);
  if (m?.[1]) return truncateWords(tidyPhrase(m[1]), 10);
  return '';
}

function extractUx(text) {
  const bits = [];
  const worksLike = text.match(
    /\bthat works like\s+(.+?)(?=\s+(?:also\b|using\b|with\b)|[.]|$)/i
  );
  if (worksLike?.[1]) {
    bits.push(truncateWords(tidyPhrase(worksLike[1].replace(/^(?:a|an|the)\s+/i, '')), 16));
  }
  const upload = text.match(
    /\buser(?:s)?\s+(?:can\s+)?uploads?\s+([^.;]+?)(?=\s+and it\b|[.;]|$)/i
  );
  if (upload?.[1] && !bits.some((bit) => /\bupload/i.test(bit))) {
    bits.push(`uploads ${truncateWords(tidyPhrase(upload[1]), 8)}`);
  }
  if (
    /\bautomatically\s+(?:updates?|tracks?|syncs?|adjusts?)\b/i.test(text) &&
    !bits.some((bit) => /\bautomatic/i.test(bit))
  ) {
    const auto = text.match(
      /\bautomatically\s+((?:updates?|tracks?|syncs?|adjusts?)\s+.+?)(?=\s+(?:also\b|using\b|with\b)|[.;]|$)/i
    );
    bits.push(truncateWords(tidyPhrase(auto?.[1] || 'updates automatically'), 8));
  }
  const noMaintain = text.match(
    /\buser(?:s)?\s+(?:does not|do not|doesn’t|don't)\s+need to\s+(.+?)(?=\s+(?:also\b|using\b|with\b)|[.;]|$)/i
  );
  if (noMaintain?.[1] && !bits.some((bit) => normalizeFactKey(bit).includes('need to'))) {
    bits.push(`user does not need to ${truncateWords(tidyPhrase(noMaintain[1]), 8)}`);
  }
  const frontendFor = text.match(
    /\b((?:responsive\s+)?(?:frontend|ui|interface))\s+for\s+(?:both\s+)?(.+?)\s+and\s+(.+?)(?=[.,;]|$)/i
  );
  if (frontendFor) {
    bits.push(
      tidyPhrase(
        `${frontendFor[1]} for ${tidyPhrase(frontendFor[2])} and ${tidyPhrase(frontendFor[3])}`
      )
    );
  }
  const compare = text.match(
    /\bcompare(?:s|d)?\s+([^.;]+?)(?=\s+(?:using|use\b|with|also)\b|[.,;]|$)/i
  );
  if (compare?.[1] && !bits.some((bit) => /\bcompare/i.test(bit))) {
    bits.push(`compare ${truncateWords(tidyPhrase(compare[1]), 10)}`);
  }
  if (/\burls?\b/i.test(text) && /\b(price|compare)\b/i.test(text) && !bits.some((bit) => /\burl/i.test(bit))) {
    bits.push('uses a URL');
  }
  if (
    /\bprice/i.test(text) &&
    /\b(low|less|high)\b/i.test(text) &&
    !bits.some((bit) => /\bprice was low/i.test(bit))
  ) {
    bits.push('see when the price was low and high');
  }
  if (!bits.length) {
    const soThat = text.match(/\bso that\s+([^.;]+)/i);
    if (soThat?.[1] && wordCount(soThat[1]) >= 4) {
      bits.push(truncateWords(tidyPhrase(soThat[1]), 14));
    }
  }
  const joined = uniqueFacts(bits).join('; ');
  if (!joined || wordCount(joined) < 3) return '';
  return joined;
}

function extractDatabase(text) {
  const named = text.match(
    /\b(mongodb|postgres(?:ql)?|mysql|mariadb|sqlite|firebase|supabase|dynamodb|redis)\b/i
  );
  if (named?.[1]) return tidyPhrase(named[1]);
  return /\bmongo\b/i.test(text) ? 'MongoDB' : '';
}

function uniqueFacts(bits) {
  const seen = new Set();
  const out = [];
  for (const bit of bits) {
    const key = normalizeFactKey(bit);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(bit);
  }
  return out;
}

function summarizeProductFacts(originalTask) {
  const t = spokenTaskText(originalTask);
  if (!t) return '';
  const bits = uniqueFacts(
    [
      extractProductLine(t),
      extractUx(t),
      extractApi(t),
      extractDataModel(t),
      extractStack(t),
      /\bpersist|\blocalStorage\b|\blocal\s+storage\b|\bin the browser\b/i.test(t)
        ? 'persist in the browser'
        : '',
      extractAuthOrOpen(t),
      extractSeededData(t),
      extractDatabase(t)
    ].filter(Boolean)
  );
  let facts = bits.join('; ');
  if (!facts) facts = truncateWords(t, 16);
  return facts;
}

function titleForProductFact(bit) {
  const lower = normalizeFactKey(bit);
  if (
    /\bclone\b/.test(lower) ||
    /\b(todo|notes|app|application|site|website|ecommerce|e-commerce|shop|store|marketplace)\b/.test(
      lower
    )
  ) {
    return 'Product';
  }
  if (/\bui only\b|\bfrontend-only\b/.test(lower)) return 'Scope';
  if (/\bno authentication\b|\bnot required\b/.test(lower) || /\bauth|\bsign-in|\blogin\b/.test(lower)) {
    return 'Authentication';
  }
  if (/\b(mongodb|postgres|mysql|mariadb|sqlite|firebase|supabase|dynamodb|redis)\b/.test(lower)) {
    return 'Database';
  }
  if (/\bbackend|\bapi\b/.test(lower)) return 'API';
  if (/\bseeded|\bmock |\bsample data\b|\bdata model\b|\bappointment information\b/.test(lower)) {
    return 'Data';
  }
  if (/\busers can\b/.test(lower)) return 'Actions';
  if (/\bpersist\b/.test(lower)) return 'Persistence';
  if (/\bvisible\b/.test(lower)) return 'Behavior';
  if (
    /\bupload|\bautomatically updates|\bdoes not need to\b|\bcompare\b|\burl\b|\bprice was low\b|\bresponsive frontend\b|\bclinic staff\b/.test(
      lower
    )
  ) {
    return 'UX';
  }
  if (/\breact|\btypescript|\bmern|\bmean\b|\bstack\b/.test(lower)) return 'Stack';
  return 'Detail';
}

function formatChatReport(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const title = String(item.title || '').trim();
    const body = tidyPhrase(item.body);
    if (!title || !body) continue;
    const key = `${normalizeFactKey(title)}|${normalizeFactKey(body)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, body });
  }
  return out.map((item, i) => `${i + 1}. **${item.title}** — ${item.body}`).join('\n');
}

function collectProductFactItems(originalTask) {
  const t = spokenTaskText(originalTask);
  if (!t) return [];
  const usedTitles = new Set();
  const items = [];
  const push = (title, body) => {
    const cleaned = tidyPhrase(body);
    if (!cleaned) return;
    let heading = title;
    if (usedTitles.has(heading)) heading = 'Detail';
    usedTitles.add(heading);
    items.push({ title: heading, body: cleaned });
  };
  push('Product', extractProductLine(t));
  push('UX', extractUx(t));
  push('API', extractApi(t));
  push('Data', extractDataModel(t));
  const leftover = uniqueFacts(
    [
      extractStack(t),
      /\bpersist|\blocalStorage\b|\blocal\s+storage\b|\bin the browser\b/i.test(t)
        ? 'persist in the browser'
        : '',
      extractAuthOrOpen(t),
      extractSeededData(t),
      extractDatabase(t)
    ].filter(Boolean)
  );
  const already = new Set(items.map((item) => normalizeFactKey(item.body)));
  const productBody = items[0]?.body || '';
  for (const bit of leftover) {
    const key = normalizeFactKey(bit);
    if (already.has(key)) continue;
    if (productBody && normalizeFactKey(productBody).includes(key)) continue;
    if (key === 'authentication' && looksLikeNoAuth(t)) continue;
    if (
      key === 'no authentication' &&
      /\bno auth|\bwithout auth|\bno login|\bno authentication/.test(normalizeFactKey(productBody))
    ) {
      continue;
    }
    push(titleForProductFact(bit), bit);
  }
  if (items.length) return items;
  for (const bit of summarizeProductFacts(t)
    .split(';')
    .map((part) => tidyPhrase(part))
    .filter(Boolean)) {
    push(titleForProductFact(bit), bit);
  }
  return items;
}

function buildStage01IntakeReport(input) {
  return formatChatReport(collectProductFactItems(input.originalTask));
}

const INTAKE_LEAD_WORD_LIMIT = 40;

function ensureSpokenPeriod(text) {
  const t = tidyPhrase(text);
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function spokenArticle(product) {
  const p = tidyPhrase(product);
  if (!p) return '';
  if (/^(a|an|the)\b/i.test(p)) return p;
  return `${/^[aeiou]/i.test(p) ? 'an' : 'a'} ${p}`;
}

function spokenUxLine(ux) {
  const t = tidyPhrase(ux);
  if (!t) return '';
  if (/^users?\b/i.test(t)) return ensureSpokenPeriod(`${t.charAt(0).toUpperCase()}${t.slice(1)}`);
  if (/^uploads\b/i.test(t)) return ensureSpokenPeriod(`Users ${t}`);
  return ensureSpokenPeriod(`${t.charAt(0).toUpperCase()}${t.slice(1)}`);
}

function spokenRestFacts(items) {
  const bits = items.map((item) => item.body).filter(Boolean);
  if (!bits.length) return '';
  const auth = bits.filter((bit) => /auth|sign-in|login/i.test(bit));
  const other = bits.filter((bit) => !/auth|sign-in|login/i.test(bit));
  const parts = [...other];
  for (const bit of auth) {
    if (/^no /i.test(bit) || /still open/i.test(bit) || /^with /i.test(bit) || /^auth:/i.test(bit)) {
      parts.push(bit);
    } else {
      parts.push(`with ${bit}`);
    }
  }
  if (!parts.length) return '';
  const text = parts.join(', ');
  return ensureSpokenPeriod(`${text.charAt(0).toUpperCase()}${text.slice(1)}`);
}

function capLeadSentences(sentences) {
  const kept = sentences.filter(Boolean);
  while (kept.length > 1 && wordCount(kept.join(' ')) > INTAKE_LEAD_WORD_LIMIT) {
    kept.pop();
  }
  return kept.join(' ').trim();
}

function buildStage01IntakeLead(input) {
  const items = collectProductFactItems(input.originalTask);
  const product = items.find((item) => item.title === 'Product')?.body || '';
  const named = spokenArticle(product) || 'the product';
  if (input.draftReady) {
    return `I've written the Task Input draft for ${named}.`;
  }
  if (input.confirmed) {
    return `I'll write the Task Input draft for ${named}.`;
  }
  if (!items.length) return "I've captured the product.";
  const sentences = [`Got it — ${named}.`];
  const ux = items.find((item) => item.title === 'UX')?.body;
  if (ux) sentences.push(spokenUxLine(ux));
  const rest = spokenRestFacts(items.filter((item) => item.title !== 'Product' && item.title !== 'UX'));
  if (rest) sentences.push(rest);
  return capLeadSentences(sentences);
}

function buildStage01IntakeReview(input) {
  if (brain?.buildStage01IntakeReview) {
    return brain.buildStage01IntakeReview(input);
  }
  return BRAIN_MISSING_USER_MESSAGE;
}

function extractAssignedTaskPlain(inputText) {
  const raw = String(inputText || '').trim();
  if (!raw) return '';
  if (raw.startsWith('{')) {
    try {
      const doc = JSON.parse(raw);
      const task = typeof doc?.assignedTask === 'string' ? doc.assignedTask.trim() : '';
      if (task) return task;
    } catch {
      /* not JSON */
    }
  }
  return productWordingFromStage01Input(inputText);
}

function upsertAssignedTaskInInput(content, taskText) {
  const task = String(taskText || '').trim();
  const block = `## Assigned task (in your own words)\n\n${task}\n`;
  if (ASSIGNED_TASK_HEADING_RE.test(content)) {
    return content.replace(
      /##\s*Assigned task(?: \(in your own words\))?[\s\S]*?(?=\n##\s|$)/i,
      block
    );
  }
  return `${String(content || '').trimEnd()}\n\n${block}`;
}

async function persistAssignedTaskExact(workspace, taskText) {
  const task = String(taskText || '').trim();
  if (!task) return;
  const sevenAbs = path.join(workspace, 'stages', 's01_task_definition', 'stage_input.json');
  const legacyAbs = path.join(workspace, 'savyre', 'stages', '01-task-input', 'input.md');
  try {
    await fs.access(sevenAbs);
    let doc = { schemaVersion: '1.0.0', assignedTask: '' };
    try {
      doc = JSON.parse(await fs.readFile(sevenAbs, 'utf8'));
    } catch {
      /* use default */
    }
    doc.assignedTask = task;
    await fs.mkdir(path.dirname(sevenAbs), { recursive: true });
    await fs.writeFile(sevenAbs, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    return;
  } catch {
    /* fall through to legacy */
  }
  let current = '';
  try {
    current = await fs.readFile(legacyAbs, 'utf8');
  } catch {
    current = '';
  }
  const next = upsertAssignedTaskInInput(current, task);
  await fs.mkdir(path.dirname(legacyAbs), { recursive: true });
  await fs.writeFile(legacyAbs, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
}

function withUserMessage(payload, userMessage) {
  return { ...payload, userMessage };
}

const SKILL_PIN_REL = path.join('.savyre', 'skill-delivery-pin.json');

async function readPinnedSkillHashes(workspace) {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(workspace, SKILL_PIN_REL), 'utf8'));
    return raw.hashes && typeof raw.hashes === 'object' ? raw.hashes : {};
  } catch {
    return {};
  }
}

async function writePinnedSkillHashes(workspace, record) {
  const hashes = {};
  for (const skill of record?.skills || []) {
    if (skill.contentHash) hashes[skill.name] = skill.contentHash;
  }
  await fs.mkdir(path.join(workspace, '.savyre'), { recursive: true });
  await fs.writeFile(
    path.join(workspace, SKILL_PIN_REL),
    `${JSON.stringify({ hashes, at: new Date().toISOString() }, null, 2)}\n`,
    'utf8'
  );
}

async function readWorkflowIdentities(workspace) {
  const cfg = await readJsonIfPresent(path.join(workspace, '.savyre', 'config.json'));
  const workflowVersion = cfg?.workflow?.workflowVersion || 'savyre-ai-workflow-v1';
  const live = brain?.liveCompatibilityIdentities?.() || {
    workflowVersion: 'savyre-ai-workflow-v1',
    layoutVersion: 'shared-v1',
    artifactSchemaVersion: '1.0.0',
    bundleRef: 'live-fifteen-stage',
    runtimeId: 'savyre-run-config'
  };
  const target = brain?.targetCompatibilityIdentities?.() || {
    workflowVersion: 'savyre-ai-workflow-v2-seven-stage',
    layoutVersion: 'session-v1',
    artifactSchemaVersion: '1.0.0',
    bundleRef: 'bundle_candidate_1',
    runtimeId: 'savyre-run-config'
  };
  const installed = brain?.installedCompatibilityIdentities?.(PLUGIN_ROOT) || live;
  if (workflowVersion === 'savyre-ai-workflow-v2-seven-stage') {
    return { session: target, installed };
  }
  return { session: live, installed };
}

function buildGuardSkillDelivery(stageId, state, ctx, payloads, pinnedHashes, identities) {
  if (!brain?.resolveWorkflowSkillDelivery) {
    if (!brain?.deliverFifteenStagePluginSkills) return null;
    return brain.deliverFifteenStagePluginSkills({
      pluginRoot: PLUGIN_ROOT,
      stageId,
      state,
      ctx,
      payloads,
      pinnedHashes
    }).record;
  }
  return brain.resolveWorkflowSkillDelivery({
    installRoot: PLUGIN_ROOT,
    session: identities.session,
    installed: identities.installed,
    legacyStageId: stageId,
    workflowFamily: 'fifteen-stage',
    state,
    ctx,
    payloads,
    pinnedHashes
  }).record;
}

const WRITE_TOOLS = new Set([
  'Write',
  'Edit',
  'StrReplace',
  'Delete',
  'EditNotebook',
  'ApplyPatch',
  'SearchReplace',
  'MultiEdit',
  'NotebookEdit'
]);
const SHELL_TOOLS = new Set(['Shell', 'Bash', 'PowerShell']);
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

const LIFECYCLE_VERBS = 'run|start|status|stop|turn|confirm|next|answer|action';

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

function probeSavyreCliChatAction(cliJs) {
  if (!cliJs) return 'missing_cli';
  try {
    const result = spawnSync(
      process.execPath,
      [cliJs, 'workflow', 'chat-action', 'turn', '--json'],
      { cwd: os.tmpdir(), encoding: 'utf8', timeout: 15000 }
    );
    const text = `${result.stdout || ''}\n${result.stderr || ''}`;
    if (/Unknown workflow command:\s*chat-action/i.test(text)) return 'missing_command';
    if (/authentication required|AUTH_REQUIRED|sign in to Savyre/i.test(text)) return 'auth_required';
    if (parseCliJson(result.stdout) || parseCliJson(result.stderr)) return 'registered';
    if (result.status === 0) return 'registered';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

function describeCliChatActionCapability() {
  const cliJs = resolveSavyreCliJs();
  const probe = probeSavyreCliChatAction(cliJs);
  if (!cliJs) {
    return {
      id: 'workflow.chat-action',
      available: false,
      reason:
        'Savyre CLI not found. Set SAVYRE_CLI to cli/dist/savyre.js, or keep the extension repo next to this plugin.'
    };
  }
  if (probe === 'missing_command') {
    return {
      id: 'workflow.chat-action',
      available: false,
      cli: cliJs,
      reason: 'CLI is present but workflow chat-action is not registered.'
    };
  }
  if (probe === 'auth_required') {
    return {
      id: 'workflow.chat-action',
      available: true,
      cli: cliJs,
      reason: 'CLI registered; authentication required before turn execution.'
    };
  }
  if (probe === 'unavailable') {
    return {
      id: 'workflow.chat-action',
      available: false,
      cli: cliJs,
      reason: 'CLI chat-action probe failed.'
    };
  }
  return { id: 'workflow.chat-action', available: true, cli: cliJs };
}

function buildRuntimeCapabilities() {
  const runtime = getSavyreRuntimeReport();
  const cli = describeCliChatActionCapability();
  return {
    brain: runtime?.ok
      ? {
          available: true,
          indexPath: runtime.selected?.indexPath || null,
          runConfigVersion: runtime.selected?.runConfigVersion || runtime.runConfigVersion || null,
          capabilityVersion: runtime.capabilityVersion || '1.0.0'
        }
      : {
          available: false,
          reason: 'No compatible @savyre/run-config package found for the plugin runtime contract.',
          candidates: runtime?.candidates || []
        },
    cli
  };
}

function brainMissingRecoveryMessage() {
  const runtime = getSavyreRuntimeReport();
  const incompatible = runtime?.candidates?.filter((c) => c.status === 'incompatible') || [];
  if (incompatible.length) {
    const first = incompatible[0];
    const missing = first.missing?.length ? ` Missing: ${first.missing.join(', ')}.` : '';
    return `${BRAIN_MISSING_USER_MESSAGE} Found incompatible run-config at ${first.indexPath}.${missing} Use the Savyre panel or install a matching @savyre/run-config build.`;
  }
  return `${BRAIN_MISSING_USER_MESSAGE} Install @savyre/run-config from the Savyre extension or set SAVYRE_RUN_CONFIG_PATH.`;
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

async function effectivePanelStageId(workspace) {
  return readPanelStageId(workspace);
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
        ? `Chat is bound to ${boundStageId} but the panel is on ${current}. Do not generate-final, validate, confirm, or answer on ${boundStageId}. Speak userMessage. Wait for /savyre-next.`
        : `Chat is not bound to the panel. Speak userMessage. Wait for /savyre-next.`
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

function tryLoadChatAdapter(workspace) {
  const cliJs = resolveSavyreCliJs();
  if (!cliJs) return null;
  try {
    const result = spawnSync(
      process.execPath,
      [cliJs, 'workflow', 'chat-action', 'turn', '--json'],
      { cwd: workspace, encoding: 'utf8', timeout: 20000 }
    );
    const parsed =
      parseCliJson(result.stdout) ||
      parseCliJson(result.stderr) ||
      parseCliJson(`${result.stdout || ''}\n${result.stderr || ''}`);
    if (!parsed || typeof parsed !== 'object' || !parsed.data) return null;
    return parsed.data;
  } catch {
    /* adapter is optional when the CLI is missing or old */
  }
  return null;
}

function withUnifiedTurn(payload, workspace) {
  const data = tryLoadChatAdapter(workspace);
  if (!data) return payload;
  const next = { ...payload };
  if (data.unifiedTurn && data.unifiedTurn.status && data.unifiedTurn.nextAction) {
    // Prefer implement next-action when the guard already selected a backlog id.
    if (payload.nextBacklogItemId) {
      next.unifiedTurn = {
        ...data.unifiedTurn,
        status: 'working',
        interactionState: payload.turn?.state || 'drafting',
        nextAction: {
          id: 'implement',
          label: `Implement ${payload.nextBacklogItemId}`,
          stageId: data.unifiedTurn.stageId || payload.turn?.stageId || null
        }
      };
    } else {
      next.unifiedTurn = data.unifiedTurn;
    }
  }
  if (Object.prototype.hasOwnProperty.call(data, 'pendingQuestion')) {
    next.pendingQuestion = data.pendingQuestion;
    if (next.turn && data.pendingQuestion) {
      next.turn = {
        ...next.turn,
        question: {
          id: data.pendingQuestion.id,
          blocking: true,
          text: data.pendingQuestion.question
        }
      };
    } else if (next.turn && data.pendingQuestion === null) {
      next.turn = { ...next.turn, question: null };
    }
  }
  if (data.intervention) next.intervention = data.intervention;
  const keepGuardSpoken =
    Boolean(payload.nextBacklogItemId) ||
    (typeof payload.userMessage === 'string' &&
      (/to confirm/.test(payload.userMessage) ||
        /to lock /.test(payload.userMessage) ||
        /Please check `/.test(payload.userMessage) ||
        /I'll implement/.test(payload.userMessage) ||
        /do not lock Build/.test(payload.userMessage) ||
        /I've written `/.test(payload.userMessage) ||
        /I've saved that under `/.test(payload.userMessage) ||
        payload.userMessage === stage01DraftAction() ||
        (brain &&
          typeof brain.stage01DraftAction === 'function' &&
          payload.userMessage === brain.stage01DraftAction('s01-task-definition'))));
  if (keepGuardSpoken && typeof payload.userMessage === 'string' && payload.userMessage.trim()) {
    next.composer = {
      userMessage: payload.userMessage,
      report: '',
      lead: ''
    };
    next.userMessage = payload.userMessage;
  } else if (data.composer && typeof data.composer.userMessage === 'string' && data.composer.userMessage.trim()) {
    next.composer = {
      ...data.composer,
      report:
        typeof data.composer.report === 'string' && data.composer.report.trim()
          ? data.composer.report.trim()
          : typeof payload.composer?.report === 'string'
            ? payload.composer.report
            : ''
    };
    next.userMessage = data.composer.userMessage.trim();
  } else if (typeof data.userMessage === 'string' && data.userMessage.trim()) {
    next.userMessage = data.userMessage.trim();
  } else if (typeof data.intakeReview === 'string' && data.intakeReview.trim()) {
    const review = data.intakeReview.trim();
    if (!looksLikeWorkflowReview(review)) {
      next.intakeReview = review;
      next.userMessage = review;
    }
  }
  if (typeof data.intakeReview === 'string' && data.intakeReview.trim() && !looksLikeWorkflowReview(data.intakeReview)) {
    next.intakeReview = data.intakeReview.trim();
  }
  if (typeof data.originalTaskHash === 'string' && data.originalTaskHash) {
    next.originalTaskHash = data.originalTaskHash;
  }
  if (Array.isArray(data.capabilitySkills) && data.capabilitySkills.length) {
    next.capabilitySkills = data.capabilitySkills;
  }
  if (data.challenge && data.challenge.skillId) {
    next.challenge = data.challenge;
  }
  if (data.verification) {
    // Remaining backlog: never adopt a ready-to-lock verification from the adapter.
    if (payload.nextBacklogItemId) {
      next.verification = {
        ...data.verification,
        ready: false,
        kind: 'implement'
      };
    } else {
      next.verification = data.verification;
      if (next.turn && Array.isArray(next.turn.allowedActions) && data.verification.ready !== true) {
        next.turn = {
          ...next.turn,
          allowedActions: next.turn.allowedActions.filter(
            (a) => a !== 'generate_final' && a !== 'validate'
          )
        };
      }
    }
  }
  if (data.continuation) {
    if (payload.nextBacklogItemId && payload.activeSkill) {
      next.continuation = { ...data.continuation, activeSkill: payload.activeSkill };
    } else {
      next.continuation = data.continuation;
    }
  }
  if (data.recovery && data.recovery.action) {
    next.recovery = data.recovery;
    if (typeof data.recovery.userMessage === 'string' && data.recovery.userMessage.trim()) {
      if (
        !payload.nextBacklogItemId &&
        (data.recovery.action === 'ask' ||
          data.recovery.action === 'blocked' ||
          data.recovery.action === 'fallback_artifact')
      ) {
        next.userMessage = data.recovery.userMessage.trim();
      }
    }
  }
  if (next.intervention && next.intervention.ask === true && next.pendingQuestion?.id) {
    next.message = `Ask ${next.pendingQuestion.id} in this chat. Speak userMessage exactly (it tells them to run /savyre-answer). When they answer, run /savyre-answer with their words. Resume this same question if the chat restarts. Keep/Undo on a file edit is not an answer.`;
  } else if (payload.nextBacklogItemId) {
    next.message =
      payload.message ||
      `Implement only backlog item \`${payload.nextBacklogItemId}\` this turn. Speak userMessage. Wait for /savyre-next. Do not lock Build & Review while backlog items remain.`;
  } else if (next.intervention && next.intervention.ask === false) {
    next.message =
      'Follow userMessage. Do not invent a question. Treat routine naming, layout, and stack choices as assumptions.';
  }
  return next;
}

function localContinueWarning(stderr) {
  const text = String(stderr || '');
  const m = text.match(/Server workflow start skipped \([\s\S]*?\)[^\n]*continuing locally\./);
  return m ? m[0] : null;
}

async function runSavyreGate(workspace, subcommand, opts) {
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
        message = `${message} Generate final targeted ${gateStage} but Chat pinned ${pinnedStage}. Do not run validate. Speak userMessage. Wait for /savyre-next.`.trim();
        userMessage = chatUserMessage('mismatch');
      } else {
        message = `${message} Speak userMessage. Wait for the developer to run \`${checkSlash(gateStage || pinnedStage)}\`. Do not run it yourself. Chat did not unlock.`.trim();
        userMessage = chatUserMessage('ask_validate', { stageId: gateStage || pinnedStage });
      }
    } else if (subcommand === 'generate-final' && !parsed.ok) {
      userMessage = chatUserMessage('gate_failed', {
        stageId: gateStage || pinnedStage,
        summary: summarizeGateFailure(parsed)
      });
    }
    if (subcommand === 'validate' && parsed.ok) {
      message = `${message} Speak userMessage. Wait for /savyre-next. Do not start the next stage yourself. Unlock is Savyre's result, not a Chat decision.`.trim();
      const fromStage = gateStage || pinnedStage;
      const nextId = readPanelStageId(workspace);
      userMessage = chatUserMessage('ask_start_next', {
        stageId: fromStage,
        nextStageId: nextId && nextId !== fromStage ? nextId : null
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
    subcommand === 'validate' ? chatUserMessage('validate_failed') : chatUserMessage('gate_failed', { summary: err.slice(0, 180) })
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

function presentFailedGuard(reason, extra = {}) {
  return {
    ...extra,
    ok: false,
    mode: 'idle',
    enforced: false,
    reason: reason || extra.reason || 'guard failed'
  };
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
  const i = chatOrderFor(stageId).indexOf(stageId);
  return i > 0 ? chatOrderFor(stageId)[i - 1] : null;
}

/** Stage 01 uses input capture. Later stages use the previous stage's final.md. */
async function readChatSource(workspace, stageId) {
  if (isTaskCaptureStage(stageId)) {
    return {
      kind: 'input',
      previousStageId: null,
      file: await readStageFile(workspace, stageInputRel(stageId))
    };
  }
  const prev = previousChatStageId(stageId);
  if (!prev) {
    return {
      kind: 'input',
      previousStageId: null,
      file: await readStageFile(workspace, stageInputRel(stageId))
    };
  }
  return {
    kind: 'upstreamFinal',
    previousStageId: prev,
    file: await readStageFile(
      workspace,
      isSevenStageId(prev) ? `stages/${sevenStageFolder(prev)}/final.md` : `savyre/stages/${prev}/final.md`
    )
  };
}

async function readStageInput(workspace, stageId) {
  return readStageFile(workspace, stageInputRel(stageId));
}

async function aiOutputLooksWritten(workspace, stageId) {
  const abs = path.join(workspace, ...stageDraftRel(stageId).split('/'));
  try {
    const raw = await fs.readFile(abs, 'utf8');
    return raw.trim().length >= 200;
  } catch {
    return false;
  }
}

function summarizeGateFailure(parsed) {
  const first = String((parsed?.errors && parsed.errors[0]) || parsed?.message || parsed?.reason || '').trim();
  if (/developer-review/i.test(first) && /missing or empty/i.test(first)) {
    return 'the stage review was missing — I will add it.';
  }
  return first
    .replace(/developer-review\.md/gi, 'the stage review')
    .replace(/\bACCEPTED\b/g, 'accepted')
    .slice(0, 180);
}

function isImplementationStage(stageId) {
  return stageId === '06-implementation' || stageId === 's06-implementation';
}

async function ensureLockReadyReview(workspace, stageId, opts = {}) {
  if (isImplementationStage(stageId)) return false;
  const draftText = await readDraftText(workspace, stageId);
  const pending =
    typeof brain?.listPendingOpenQuestionTable === 'function'
      ? brain.listPendingOpenQuestionTable(draftText || '')
      : [];
  if (pending.length && !opts.force) return false;
  const review = await readStageReview(workspace, stageId);
  if (typeof brain?.buildLockReadyDeveloperReview !== 'function') return false;
  const next = brain.buildLockReadyDeveloperReview({
    draftText: draftText || '',
    reviewText: review.text
  });
  if (!String(next || '').trim()) return false;
  if (
    String(next).replace(/\r\n/g, '\n').trim() ===
    String(review.text || '').replace(/\r\n/g, '\n').trim()
  ) {
    return false;
  }
  await fs.mkdir(path.dirname(review.abs), { recursive: true });
  const body = next.endsWith('\n') ? next : `${next}\n`;
  const targets = [review.abs];
  if (stageId === 's01-task-definition' || String(stageId).startsWith('s0')) {
    const folder =
      typeof brain?.sevenStageFolder === 'function'
        ? brain.sevenStageFolder(stageId)
        : String(stageId).replace(/-/g, '_');
    targets.push(path.join(workspace, 'stages', folder, 'developer_review.md'));
    targets.push(path.join(workspace, 'savyre', 'stages', stageId, 'developer-review.md'));
  }
  for (const abs of [...new Set(targets)]) {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, body, 'utf8');
  }
  return true;
}

async function healOpenQuestionsNoneFile(workspace, stageId) {
  const abs = path.join(workspace, ...stageDraftRel(stageId).split('/'));
  try {
    const text = await fs.readFile(abs, 'utf8');
    const match = text.match(
      /((?:^|\n)(#{1,3})\s*Open Questions[ \t]*\n)([\s\S]*?)(?=\n#{1,3}\s|$)/i
    );
    if (!match) return false;
    const body = (match[3] || '').trim();
    const compact = body.replace(/\s+/g, ' ').trim();
    if (/^no open questions identified\.?$/i.test(compact)) return false;
    const stripped = compact.replace(/^[-*•]\s+/, '');
    const emptyNone =
      !body ||
      (/^none\.?\b/i.test(stripped) && !body.includes('|') && !/\bOQ-\d+/i.test(body));
    if (!emptyNone) return false;
    const next = text.replace(match[0], `${match[1]}No open questions identified.\n`);
    await fs.writeFile(abs, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
    return true;
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
  const challengeRels =
    typeof brain?.challengeFindingsCandidateRels === 'function'
      ? brain.challengeFindingsCandidateRels(stageId)
      : [
          'stages/s01_task_definition/challenge_findings.json',
          'stages/s01_task_definition/challenge-findings.json',
          'savyre/stages/02-requirement-analysis/challenge-findings.json'
        ];
  const evidenceRels =
    typeof brain?.evidenceMapCandidateRels === 'function'
      ? brain.evidenceMapCandidateRels(stageId)
      : [
          'stages/s02_code_discovery/discovery_evidence.json',
          'stages/s02_code_discovery/evidence-map.json',
          'savyre/stages/03-codebase-discovery/evidence-map.json'
        ];
  let challengeRaw = null;
  for (const rel of challengeRels) {
    challengeRaw = await readJsonIfPresent(path.join(workspace, ...rel.split('/')));
    if (challengeRaw) break;
  }
  let evidenceRaw = null;
  for (const rel of evidenceRels) {
    evidenceRaw = await readJsonIfPresent(path.join(workspace, ...rel.split('/')));
    if (evidenceRaw) break;
  }
  const isChallengeStage =
    stageId === '02-requirement-analysis' || stageId === 's01-task-definition';
  const isEvidenceStage =
    stageId === '03-codebase-discovery' || stageId === 's02-code-discovery';
  const challengeComplete = !isChallengeStage || parseChallengeFindings(challengeRaw).ok;
  const evidenceReady = !isEvidenceStage || parseEvidenceMap(evidenceRaw).ok;
  return { challengeComplete, evidenceReady };
}

function chatGenerateFinalBlockers({
  stageId,
  aiReady,
  hasPendingBlocking,
  challengeComplete,
  evidenceReady,
  hasRemainingBacklog
}) {
  if (typeof brain?.chatGenerateFinalBlockers === 'function') {
    return brain.chatGenerateFinalBlockers({
      stageId,
      aiReady,
      hasPendingBlocking,
      challengeOk: challengeComplete,
      evidenceOk: evidenceReady,
      hasRemainingBacklog
    });
  }
  if (!aiReady) return { ok: false, kind: 'draft_now' };
  if (hasPendingBlocking) return { ok: false, kind: 'need_answers' };
  if (hasRemainingBacklog) return { ok: false, kind: 'implement' };
  if (
    (stageId === '02-requirement-analysis' || stageId === 's01-task-definition') &&
    challengeComplete !== true
  ) {
    return { ok: false, kind: 'need_challenge' };
  }
  if (
    (stageId === '03-codebase-discovery' || stageId === 's02-code-discovery') &&
    evidenceReady !== true
  ) {
    return { ok: false, kind: 'need_evidence' };
  }
  return { ok: true, kind: 'ask_generate_final' };
}

function evaluateVerification(input) {
  if (typeof brain?.evaluateVerification === 'function') {
    return brain.evaluateVerification({
      stageId: input.stageId,
      aiReady: input.aiReady,
      hasPendingBlocking: input.hasPendingBlocking,
      challengeOk: input.challengeComplete,
      evidenceOk: input.evidenceReady,
      hasRemainingBacklog: input.hasRemainingBacklog
    });
  }
  const gate = chatGenerateFinalBlockers(input);
  const stageChallenge =
    input.stageId === '02-requirement-analysis' || input.stageId === 's01-task-definition';
  const stageEvidence =
    input.stageId === '03-codebase-discovery' || input.stageId === 's02-code-discovery';
  return {
    schemaVersion: '1.0',
    ready: gate.ok,
    kind: gate.kind,
    checks: {
      draftReady: Boolean(input.aiReady),
      openQuestionsResolved: !input.hasPendingBlocking,
      challengeOk: stageChallenge ? input.challengeComplete === true : null,
      evidenceOk: stageEvidence ? input.evidenceReady === true : null
    },
    canApprove: false,
    canUnlockStage: false
  };
}

function isVerificationBeforeCompletionEnabled() {
  return process.env.SAVYRE_VERIFICATION_BEFORE_COMPLETION !== '0';
}

function isChatContinuationEnabled() {
  return process.env.SAVYRE_CHAT_CONTINUATION !== '0';
}

function applyVerificationAllowedActions(actions, verification) {
  if (!isVerificationBeforeCompletionEnabled() || !verification || verification.ready) {
    return actions;
  }
  return (actions || []).filter((a) => a !== 'generate_final' && a !== 'validate');
}

function buildChatContinuation(checkpoint) {
  if (!isChatContinuationEnabled() || !checkpoint) return null;
  if (typeof brain?.buildChatContinuation === 'function') {
    return brain.buildChatContinuation(checkpoint);
  }
  return {
    schemaVersion: '1.0',
    sessionId: checkpoint.sessionId || null,
    stageId: checkpoint.stageId || null,
    sessionRevision: typeof checkpoint.sessionRevision === 'number' ? checkpoint.sessionRevision : 0,
    pendingQuestionId: checkpoint.pendingQuestionId || null,
    activeSkill: checkpoint.activeSkill || null,
    originalTaskHash: checkpoint.originalTaskHash || null,
    originalTaskRevision:
      typeof checkpoint.originalTaskRevision === 'number' ? checkpoint.originalTaskRevision : null,
    artifactRevision: checkpoint.artifactRevision || 0,
    workflowVersion: checkpoint.workflowVersion || null,
    bundleRef: checkpoint.bundleRef || null
  };
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
## Open Questions`,
  '04-impact-analysis': `# Impact Analysis
# Affected Files and Components
# Blast Radius
# Risks and Dependencies
# Test and Verification Impact
## Open Questions`,
  '05-plan-generation-and-review': `# Implementation Plan
# Approach
# Steps
# Plan Risks
## Open Questions`,
  's01-task-definition': `# Task Brief
# Explicit Requirements
# Potential Assumptions
# Acceptance Criteria
# Constraints
## Open Questions`,
  's02-code-discovery': `# Code Discovery
# Observed Findings
# Not Identified
## Open Questions`,
  's03-implementation-plan': `# Implementation Plan
# Approach
# Steps
# Plan Risks
## Open Questions`,
  's04-build-review': `# Actual Changes and Task Status
# Plan Reconciliation
# Validation Observed
# Findings
# Deviations and Blockers
## Open Questions`,
  's05-test-resolve': `# Verification Report
# Results
# Remaining Issues
## Open Questions`,
  's06-delivery-readiness': `# Delivery Readiness
# Checklist
# Risks
## Open Questions`,
  's07-handoff': `# Delivery Summary
# Handoff Notes
## Open Questions`
};

function chatWriteAiOutputMessage(stageId) {
  const headings = CHAT_ARTIFACT_HEADINGS[stageId] || '## Open Questions';
  const draftRel = stageDraftRel(stageId);
  const src =
    isTaskCaptureStage(stageId)
      ? 'Fill every section from the confirmed Assigned task only. Restate their product; do not copy process text.'
      : 'Fill from the previous stage final.md. Do not copy prompt instructions.';
  return [
    `Write \`${draftRel}\` now so Generate final will not fail.`,
    src,
    'Use these headings (a complete stage document, at least 200 characters, include ## Open Questions):',
    headings,
    'If there is no product-scope ambiguity, write `No open questions identified.` under ## Open Questions.',
    `Then run savyre-guard.mjs turn. If no pending question, ${waitForDeveloperSlash(lockSlash(stageId))} Do not run generate-final, validate, or the next stage yourself.`,
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
  const nextBacklogItemId = await readNextBacklogItemId(workspace, stageId);
  const hasRemainingBacklog = Boolean(nextBacklogItemId);
  const gate = chatGenerateFinalBlockers({
    stageId,
    aiReady: aiReady && !hasRemainingBacklog,
    hasPendingBlocking: false,
    challengeComplete: pass.challengeComplete,
    evidenceReady: pass.evidenceReady,
    hasRemainingBacklog
  });
  if (stageId === '06-implementation' || stageId === 's04-build-review') {
    if (nextBacklogItemId) {
      return `Implement only backlog item \`${nextBacklogItemId}\` this turn. Write its application files and \`${stageDraftRel(stageId)}\` for that id only, then stop. Speak userMessage. Wait for /savyre-next. Do not lock Build & Review while backlog items remain.`;
    }
    if (!aiReady) {
      return chatUserMessage('implement');
    }
  }
  if (!aiReady) {
    if (isPanelRunStage(stageId)) {
      return chatUserMessage('panel_run_ai', { stageId });
    }
    return chatWriteAiOutputMessage(stageId);
  }
  if (
    (stageId === '02-requirement-analysis' || stageId === 's01-task-definition') &&
    !pass.challengeComplete
  ) {
    return 'Draft exists. Run the requirement-challenge pass as a separate step. Write `stages/s01_task_definition/challenge_findings.json` with stageId `s01-task-definition`. Do not rewrite stageId to 02-requirement-analysis. Put blocking gaps in Open Questions. Do not rewrite the draft unless validation asked. Do not generate-final yet.';
  }
  if (
    (stageId === '03-codebase-discovery' || stageId === 's02-code-discovery') &&
    !pass.evidenceReady
  ) {
    return 'Draft exists. Run evidence-grounding. Write discovery evidence / evidence-map JSON for observed findings only (stages/s02_code_discovery/discovery_evidence.json or savyre/stages/03-codebase-discovery/evidence-map.json). Greenfield: greenfield true and empty or not-found items. Do not invent architecture. Do not generate-final yet.';
  }
  if (!gate.ok) {
    return 'Follow turn.activeSkill. Do not run generate-final until that pass is done.';
  }
  return `Run verification-before-completion (turn.activeSkill). If the check fails, stay on this stage. If it passes, ${waitForDeveloperSlash(lockSlash(stageId))} Do not run it, validate, or start the next stage yourself. Chat cannot unlock by itself.`;
}

function assignedTaskLooksFilled(inputText) {
  return Boolean(extractAssignedTaskPlain(inputText));
}

async function stage01SpokenFromDisk(workspace, opts = {}) {
  const stageId = opts.stageId || '01-task-input';
  const inputFile = await readStageInput(workspace, stageId);
  const assigned = extractAssignedTaskPlain(inputFile.text);
  if (!assigned) return null;
  const confirmed = Boolean(opts.confirmed);
  const draftReady = Boolean(opts.draftReady);
  const locked = Boolean(opts.locked);
  const pending = typeof opts.pendingQuestion === 'string' ? opts.pendingQuestion.trim() : '';
  const userMessage = pending
    ? chatUserMessage('ask_question', {
        question: pending,
        questionId: opts.pendingQuestionId || null
      })
    : locked
      ? chatUserMessage('ask_validate', { stageId })
      : draftReady && confirmed
        ? chatUserMessage('ask_generate_final', { stageId })
        : confirmed
          ? chatUserMessage('draft_now', { stageId })
          : buildStage01IntakeReview({
              originalTask: assigned,
              pendingQuestion: opts.pendingQuestion || null,
              confirmed,
              draftReady
            });
  const report = '';
  const lead = '';
  return { assigned, userMessage, report, lead };
}

async function stageChatWorkLooksDone(workspace, stageId) {
  if (isTaskCaptureStage(stageId)) {
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
  const draftRel = stageDraftRel(manifest.stageId);
  const prev = source.previousStageId;
  const prevFinalRel = prev
    ? isSevenStageId(prev)
      ? `stages/${sevenStageFolder(prev)}/final.md`
      : `savyre/stages/${prev}/final.md`
    : null;

  if (isTaskCaptureStage(manifest.stageId)) {
    const filled = assignedTaskLooksFilled(inputFile.text);
    const captureRel = stageInputRel(manifest.stageId);
    const seven = manifest.stageId === 's01-task-definition';
    return [
      `Savyre stage \`${manifest.stageId}\` is enforced (read_write, ${seven ? 'stage_input.json and task_brief.md' : 'input.md and ai-output.md'}).`,
      `Use the Cursor skill \`${role}\`. Follow JSON \`turn.activeSkill\` when present. Do not invent Savyre methodology.`,
      filled
        ? seven
          ? `Assigned task is captured in \`${captureRel}\`. Speak that restatement, then speak userMessage. Wait for /savyre-next to confirm. After confirm, write \`${draftRel}\`. Do not run panel Stage AI. Do not lock until the draft exists.`
          : 'Leftover or a one-liner under Assigned task is a scratch capture, not the final Assigned task. Replace `## Assigned task` with 2-4 short sentences plus a Product / UX / API / Data / Stack list from that prompt. Keep Official assignment unchanged. Speak that same Assigned task text, then speak userMessage. Wait for /savyre-next. After they continue, write ai-output.md from that Assigned task. Do not run panel Stage AI. Do not lock until ai-output.md exists.'
        : seven
          ? `FIRST MESSAGE: ask only what they want to build — unless JSON suggestedTask or intakeReview is already set. Write the restatement into \`${captureRel}\` field assignedTask (2-4 sentences plus Product / UX / API / Data / Stack). Speak that text, then speak userMessage. Wait for /savyre-next. Do not confirm for them.`
          : 'FIRST MESSAGE: ask only what they want to build — unless JSON suggestedTask or intakeReview is already set, then replace Assigned task with the restatement, speak it, and wait for /savyre-next. Official assignment / 15-stage text is Savyre process, not the product. After they name a product, write the 2-4 sentences plus Product / UX / API / Data / Stack list under `## Assigned task`. Wait for /savyre-next. Do not confirm for them.',
      seven
        ? `Before confirm you may write only \`${captureRel}\`. After confirm you may write \`${draftRel}\`. Cursor Agent cannot record ACCEPTED — that stays in the Savyre extension.`
        : 'Before confirm you may write only `input.md`. After confirm you may write `ai-output.md`. Cursor Agent cannot record ACCEPTED — that stays in the Savyre extension.'
    ].join('\n');
  }

  const isImplement =
    manifest.stageId === '06-implementation' || manifest.stageId === 's04-build-review';
  const isChatDraft =
    typeof brain?.isChatWriteStage === 'function'
      ? brain.isChatWriteStage(manifest.stageId)
      : [
          '02-requirement-analysis',
          '03-codebase-discovery',
          '04-impact-analysis',
          '05-plan-generation-and-review',
          's02-code-discovery',
          's03-implementation-plan',
          's05-test-resolve',
          's06-delivery-readiness',
          's07-handoff'
        ].includes(manifest.stageId);

  let writeHint;
  if (isImplement) {
    const reportRel = stageDraftRel(manifest.stageId);
    const nextId = source.nextBacklogItemId || '';
    writeHint = nextId
      ? `You may write application files with Write/StrReplace for backlog item \`${nextId}\` only. Do not implement any other backlog id this turn. Also write \`${reportRel}\` naming only \`${nextId}\` and that item's changed paths in backticks (and ## Open Questions). Then stop. Do not run Shell, start subagents, or delete files. Speak userMessage and wait for /savyre-next.`
      : `You may write application files with Write/StrReplace for one independently executable backlog item only. Also write \`${reportRel}\` for that id only. Then stop. Do not run Shell, start subagents, or delete files. Speak userMessage and wait for /savyre-next.`;
  } else if (isChatDraft) {
    const evidenceHint =
      manifest.stageId === '03-codebase-discovery' || manifest.stageId === 's02-code-discovery'
        ? ` Also write evidence under \`${isSevenStageId(manifest.stageId) ? 'stages/s02_code_discovery/discovery_evidence.json' : 'savyre/stages/03-codebase-discovery/evidence-map.json'}\` for observed findings only. Do not invent architecture on a greenfield repo.`
        : '';
    const challengeHint =
      manifest.stageId === '02-requirement-analysis'
        ? ' Do not add Confirmed Requirements or Functional Requirement Analysis — Savyre injects the Stage 01 contract.'
        : '';
    writeHint = `Write \`${draftRel}\` using the required headings. Source of truth is the previous final.md${prevFinalRel ? ` (\`${prevFinalRel}\`)` : ''}. Put Open Questions in that file and ask them here. Do not write answers. Do not edit developer-review.md.${evidenceHint}${challengeHint} If Generate final rejects the artifact, fix \`${draftRel}\`. Speak userMessage. Wait for /savyre-next. Do not run it yourself.`;
  } else {
    writeHint =
      'Read-only: do not edit application source. Do not invent drafts. Use the Savyre panel if this stage is panel-run. Then speak userMessage and wait for /savyre-next.';
  }

  const missingHint =
    source.kind === 'upstreamFinal'
      ? `This stage has no input.md — that is expected. Source of truth is the previous approved \`final.md\`${prevFinalRel ? ` (\`${prevFinalRel}\`)` : ''}.`
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
    isChatDraft
      ? `Work in this chat. Write \`${draftRel}\` here. Cursor Agent cannot record ACCEPTED — that stays in the Savyre extension.`
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
          'Assigned task is written. After /savyre-next, write ai-output.md with the required headings. If no Open Questions remain, speak userMessage and wait for /savyre-next to lock. Do not run it yourself.',
          'Do not invent more sections. Do not set ACCEPTED. Do not run /savyre-stop until they accept there.'
        ].join(' ')
      : [
          'Savyre stage `01-task-input` is still enforced. Use skill `savyre-task-input`.',
          'Speak userMessage once. Wait for a product or feature in their words. Do not ask the question again.',
          'Do not treat the official assignment or 15-stage workflow as the product task.',
          'Do not write Original Task, Explicit Requirements, or Open Questions.',
          'After they answer, write the restatement (2-4 sentences plus Product / UX / API / Data / Stack) under `## Assigned task` in `savyre/stages/01-task-input/input.md`. Do not leave their raw leftover as Assigned task.'
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
    manifest.stageId === '06-implementation' || manifest.stageId === 's04-build-review'
      ? 'Continue implementation in this chat. Write application files for the single next backlog item in JSON nextBacklogItemId (or userMessage) only, then stop. Then speak userMessage and wait for /savyre-next. Do not run it yourself.'
      : manifest.stageId === '02-requirement-analysis' ||
          manifest.stageId === '03-codebase-discovery' ||
          manifest.stageId === '04-impact-analysis' ||
          manifest.stageId === '05-plan-generation-and-review'
        ? `Write or fix \`savyre/stages/${manifest.stageId}/ai-output.md\` using the required headings. Ask remaining Open Questions in chat. Do not fill answers in developer-review.md. If none remain, speak userMessage and wait for /savyre-next. Do not run it yourself.`
        : 'Do not write ai-output.md. Use the Savyre panel to run this stage, then speak userMessage and wait for /savyre-next. Do not run it or validate yourself.';
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
    source.nextBacklogItemId = await readNextBacklogItemId(workspace, manifest.stageId);
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
    try {
      await persistChatHookUsage({
        workspace,
        stageId: manifest.stageId,
        executionId: manifest.executionId,
        hookInput: input,
        parse: brain?.parseChatHookUsage,
        merge: brain?.mergeChatAiUsage
      });
    } catch {
      /* token capture is best-effort */
    }
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
    if (manifest.stageId === '01-task-input' && !assignedTaskLooksFilled(source.file.text)) {
      await appendEvidence(workspace, {
        executionId: manifest.executionId,
        hook: 'stop',
        decision: 'note',
        reason: 'waiting for product task; no follow-up'
      });
      return {};
    }
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
      `${stageTitle(manifest.stageId)} does not allow terminal commands.`,
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

async function readNextBacklogItemId(workspace, stageId) {
  const id = String(stageId || '');
  if (id !== 's04-build-review' && id !== '06-implementation') return null;
  if (typeof brain?.selectNextImplementableBacklogId !== 'function') return null;
  const backlogRaw = await readJsonIfPresent(
    path.join(workspace, 'stages', 's03_implementation_plan', 'implementation_backlog.json')
  );
  const statusRaw = await readJsonIfPresent(
    path.join(workspace, 'stages', 's04_build_review', 'implementation_status.json')
  );
  const tasks = Array.isArray(backlogRaw?.tasks) ? backlogRaw.tasks : [];
  const items = Array.isArray(statusRaw?.items) ? statusRaw.items : [];
  let changeReportMarkdown = '';
  try {
    changeReportMarkdown = await fs.readFile(
      path.join(workspace, 'stages', 's04_build_review', 'change_report.md'),
      'utf8'
    );
  } catch {
    /* optional until first item */
  }
  const taskFolderAppliedIds = [];
  try {
    const tasksDir = path.join(workspace, 'stages', 's04_build_review', 'tasks');
    const entries = await fs.readdir(tasksDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      try {
        const summary = await fs.readFile(path.join(tasksDir, ent.name, 'task_summary.md'), 'utf8');
        const looksApplied =
          typeof brain?.taskSummaryLooksApplied === 'function'
            ? brain.taskSummaryLooksApplied(summary)
            : /\*\*Status:\*\*\s*(applied|verified)\b/i.test(summary);
        if (looksApplied) taskFolderAppliedIds.push(ent.name);
      } catch {
        /* skip */
      }
    }
  } catch {
    /* no tasks dir yet */
  }
  const applied =
    typeof brain?.mergeAppliedBacklogIds === 'function'
      ? brain.mergeAppliedBacklogIds({
          statusItems: items,
          changeReportMarkdown,
          taskFolderAppliedIds
        })
      : new Set(taskFolderAppliedIds.map((x) => String(x || '').toUpperCase()).filter(Boolean));

  // Persist progress so overwriting change_report.md for the next item does not lose applied ids.
  if (tasks.length && typeof brain?.buildImplementationStatusProjection === 'function') {
    try {
      const projection = brain.buildImplementationStatusProjection({
        backlog: tasks,
        executedIds: [...applied],
        folderIds: taskFolderAppliedIds,
        confirmationRef: 'chat:s04-progress',
        revision: `chat-${Date.now()}`
      });
      const statusAbs = path.join(workspace, 'stages', 's04_build_review', 'implementation_status.json');
      await fs.mkdir(path.dirname(statusAbs), { recursive: true });
      await fs.writeFile(statusAbs, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');
      if (typeof brain.renderImplementationStatusMarkdown === 'function') {
        await fs.writeFile(
          path.join(workspace, 'stages', 's04_build_review', 'implementation_status.md'),
          `${brain.renderImplementationStatusMarkdown(projection)}\n`,
          'utf8'
        );
      }
    } catch {
      /* best-effort */
    }
  }

  const statusItems = [...applied].map((appliedId) => ({ id: appliedId, state: 'applied' }));
  const next = brain.selectNextImplementableBacklogId(tasks, statusItems, {
    changeReportMarkdown,
    taskFolderAppliedIds
  });
  return typeof next === 'string' && next.trim() ? next.trim() : null;
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
  const statusStageId = await effectivePanelStageId(workspace);
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
        reason: `Chat mode does not support stage ${stageId}. Start a seven-stage or stages 01–06 session in the Savyre panel.`
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
  const captureTask = isTaskCaptureStage(stageId);
  const aiReady = await aiOutputLooksWritten(workspace, stageId);
  const pending = next && turn.state === 'needs_user_input' ? next : null;
  const pass = await loadChatPass(workspace, stageId);
  const bind = {
    captureTask,
    panelStageId: stageId,
    artifactTemplate: CHAT_ARTIFACT_HEADINGS[stageId] || null
  };
  if (leftover && !captureTask) bind.ignoredUserText = leftover;
  if (leftover && captureTask) {
    const product = productWordingFromRaw(leftover);
    if (product) {
      bind.suggestedTask = product;
      if (!existing?.developerConfirmed) {
        await persistAssignedTaskExact(workspace, product);
      }
    }
  }
  let taskReady = Boolean(bind.suggestedTask);
  if (captureTask && !existing?.developerConfirmed && !taskReady) {
    const inputFile = await readStageInput(workspace, stageId);
    taskReady = assignedTaskLooksFilled(inputFile.text);
  }
  let intakeSummary = null;
  let intakeReport = '';
  let intakeLead = '';
  let capturedHash = existing?.originalTaskHash || null;
  if (captureTask) {
    const startText = typeof bind.suggestedTask === 'string' ? bind.suggestedTask.trim() : '';
    const inputFile = await readStageInput(workspace, stageId);
    const assigned = startText || extractAssignedTaskPlain(inputFile.text);
    if (assigned) {
      const source = startText ? 'start-text' : existing?.originalTaskSource || 'chat';
      const tracked = trackOriginalTask({
        text: assigned,
        source,
        previousHash: existing?.originalTaskHash,
        previousRevision: existing?.originalTaskRevision
      });
      const latestCp =
        (await readJsonIfPresent(path.join(workspace, CHAT_CHECKPOINT_REL))) || existing;
      await writeCheckpoint(workspace, {
        ...latestCp,
        originalTaskHash: tracked.hash,
        originalTaskSource: tracked.source,
        originalTaskRevision: tracked.revision
      });
      capturedHash = tracked.hash;
      intakeSummary = buildStage01IntakeReview({
        originalTask: assigned,
        pendingQuestion: pending?.question || null,
        confirmed: Boolean(existing?.developerConfirmed),
        draftReady: aiReady
      });
      intakeReport = '';
      intakeLead = '';
    }
  }
  let message;
  if (bind.suggestedTask && captureTask && !existing?.developerConfirmed) {
    message = TALK_FROM_ASSIGNED_THEN_CONFIRM;
  } else if (captureTask && !existing?.developerConfirmed) {
    message =
      'Stage 01. Capture the assigned task if needed, then wait for /savyre-next. After they continue, write ai-output.md from the Assigned task using artifactTemplate. Do not lock yet.';
  } else   if (
    captureTask &&
    existing?.developerConfirmed &&
    aiReady &&
    existing?.lastGenerateFinalStageId !== stageId
  ) {
    message = `Run verification-before-completion (turn.activeSkill). If the check passes, ${TALK_FROM_ASSIGNED_THEN_LOCK} Do not run lock, validate, or start the next stage yourself.`;
  } else {
    message = await chatStageFollowupMessage(workspace, stageId, pending);
  }
  if (bind.ignoredUserText) {
    message = `Bound to ${stageId}. Extra text after /savyre-start was ignored — that is not a new Task Input. Do not write input.md or ask confirm. Work this stage. ${message}`;
  }
  const nextBacklogItemId = await readNextBacklogItemId(workspace, stageId);
  const hasRemainingBacklog = Boolean(nextBacklogItemId);
  const lockReady = aiReady && !hasRemainingBacklog;
  const userMessage = chatStartUserMessage({
    stageId,
    confirmed: Boolean(existing?.developerConfirmed),
    pendingQuestion: pending?.question || null,
    pendingQuestionId: pending?.id || null,
    aiReady: lockReady,
    suggestedTask: taskReady,
    ignoredUserText: Boolean(bind.ignoredUserText),
    challengeComplete: pass.challengeComplete,
    evidenceReady: pass.evidenceReady,
    intakeSummary,
    nextBacklogItemId
  });
  const verification = isVerificationBeforeCompletionEnabled()
    ? evaluateVerification({
        stageId,
        aiReady: lockReady,
        hasPendingBlocking: Boolean(pending),
        challengeComplete: pass.challengeComplete,
        evidenceReady: pass.evidenceReady,
        hasRemainingBacklog
      })
    : null;
  const baseActions = pending
    ? ['answer', 'status', 'cancel']
    : captureTask && !existing?.developerConfirmed
      ? ['confirm', 'status', 'cancel']
      : ['status', 'generate_final', 'validate', 'cancel'];
  const allowedActions = applyVerificationAllowedActions(baseActions, verification);
  const turnOut = turn ? { ...turn, allowedActions } : turn;
  const continuation = buildChatContinuation({
    ...(existing || {}),
    sessionId,
    stageId,
    pendingQuestionId: pending?.id || existing?.pendingQuestionId || null,
    activeSkill: turnOut?.activeSkill || existing?.activeSkill || null,
    originalTaskHash: capturedHash || existing?.originalTaskHash,
    originalTaskRevision: existing?.originalTaskRevision,
    artifactRevision: existing?.artifactRevision || 0
  });
  const extra = {
    pendingQuestion: pending,
    message,
    userMessage,
    ...(nextBacklogItemId ? { nextBacklogItemId } : {}),
    ...chatSkillFields(stageId, turnOut?.state, {
      ...pass,
      hasRemainingBacklog
    }),
    ...(capturedHash ? { originalTaskHash: capturedHash } : {}),
    ...(verification ? { verification } : {}),
    ...(continuation ? { continuation } : {}),
    ...(intakeReport
      ? { composer: { userMessage, report: intakeReport, lead: intakeLead } }
      : {})
  };
  if (latestOk && latest) {
    return withUnifiedTurn(
      { ...enforcedPayload(workspace, latest, turnOut), ...extra, ...bind },
      workspace
    );
  }
  if (runOut && runOut.mode === 'enforced') {
    return withUnifiedTurn(
      {
        ...runOut,
        turn: turnOut,
        canApprove: false,
        canUnlockStage: false,
        ...extra,
        ...bind
      },
      workspace
    );
  }
  return withUserMessage(
    presentFailedGuard(runOut?.reason || 'interactive execution unavailable', {
      stageId,
      turn: turnOut,
      canApprove: false,
      canUnlockStage: false,
      ...extra,
      ...bind
    }),
    chatUserMessage('recovery_fallback')
  );
}

async function cmdStatus() {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const capabilities = buildRuntimeCapabilities();
  const { manifest } = await loadActive(workspace);
  if (!manifest) {
    return withUserMessage(
      { mode: 'idle', reason: 'no active manifest', runtime: capabilities },
      chatUserMessage('lock_off')
    );
  }
  const verified = await verifyManifest(manifest, workspace);
  if (!verified.ok) {
    return withUserMessage(
      presentFailedGuard(verified.reason, {
        stageId: manifest.stageId,
        executionId: manifest.executionId
      }),
      chatUserMessage('lock_off')
    );
  }
  return withUnifiedTurn(
    withUserMessage(
      {
        mode: 'enforced',
        stageId: manifest.stageId,
        executionId: manifest.executionId,
        expiresAt: manifest.expiresAt,
        writeMode: manifest.writeMode,
        workflowId: manifest.workflowId,
        runtime: capabilities
      },
      chatUserMessage('on_stage', { stageId: manifest.stageId })
    ),
    workspace
  );
}

const WORKFLOW_REPORT_REL = path.join('savyre', 'workflow-report.html');

function parseExportReportFlags(argv = process.argv.slice(3)) {
  const flags = new Set(
    (argv || []).map((a) => String(a || '').trim().toLowerCase()).filter(Boolean)
  );
  return {
    noOpen: flags.has('--no-open'),
    preferChrome: !flags.has('--default-browser')
  };
}

function runSavyreWorkflowExport(workspace) {
  const bin = process.platform === 'win32' ? 'savyre.cmd' : 'savyre';
  const args = ['workflow', 'export', '--no-open'];
  const r = spawnSync(bin, args, {
    cwd: workspace,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: 180000,
    env: process.env
  });
  if (r.status === 0) {
    return {
      ok: true,
      stdout: String(r.stdout || ''),
      stderr: String(r.stderr || '')
    };
  }
  // Fallback: npm shim via cmd when PATH resolution fails without shell.
  const fallback = spawnSync(
    process.platform === 'win32' ? 'cmd.exe' : bin,
    process.platform === 'win32' ? ['/d', '/s', '/c', 'savyre workflow export --no-open'] : args,
    {
      cwd: workspace,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
      timeout: 180000,
      env: process.env
    }
  );
  if (fallback.status === 0) {
    return {
      ok: true,
      stdout: String(fallback.stdout || ''),
      stderr: String(fallback.stderr || '')
    };
  }
  return {
    ok: false,
    stdout: String(fallback.stdout || r.stdout || ''),
    stderr: String(fallback.stderr || r.stderr || ''),
    status: fallback.status ?? r.status ?? 1,
    error: (fallback.error || r.error) ? String((fallback.error || r.error).message || fallback.error || r.error) : ''
  };
}

function resolveChromeExecutable() {
  if (process.platform !== 'win32') return null;
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ];
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

function openReportFile(filePath, preferChrome) {
  const abs = path.resolve(filePath);
  if (!existsSync(abs)) {
    return { ok: false, reason: 'report-missing', browser: null };
  }
  try {
    if (process.platform === 'win32') {
      if (preferChrome) {
        const chrome = resolveChromeExecutable();
        if (chrome) {
          const child = spawnSync(chrome, [abs], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
          });
          if (child.error) {
            spawnSync('cmd', ['/c', 'start', '', 'chrome', abs], {
              detached: true,
              stdio: 'ignore',
              windowsHide: true,
              shell: false
            });
            return { ok: true, browser: 'chrome-start' };
          }
          return { ok: true, browser: 'chrome' };
        }
        spawnSync('cmd', ['/c', 'start', '', 'chrome', abs], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        });
        return { ok: true, browser: 'chrome-start' };
      }
      spawnSync('cmd', ['/c', 'start', '', abs], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      return { ok: true, browser: 'default' };
    }
    if (process.platform === 'darwin') {
      if (preferChrome) {
        spawnSync('open', ['-a', 'Google Chrome', abs], { detached: true, stdio: 'ignore' });
        return { ok: true, browser: 'chrome' };
      }
      spawnSync('open', [abs], { detached: true, stdio: 'ignore' });
      return { ok: true, browser: 'default' };
    }
    if (preferChrome) {
      const linuxChrome = ['google-chrome', 'chromium-browser', 'chromium'].find((bin) => {
        const which = spawnSync('which', [bin], { encoding: 'utf8' });
        return which.status === 0;
      });
      if (linuxChrome) {
        spawnSync(linuxChrome, [abs], { detached: true, stdio: 'ignore' });
        return { ok: true, browser: 'chrome' };
      }
    }
    spawnSync('xdg-open', [abs], { detached: true, stdio: 'ignore' });
    return { ok: true, browser: 'default' };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e), browser: null };
  }
}

/**
 * Export the workflow HTML report (via Savyre CLI) and open it in Chrome by default.
 * Flags: --no-open | --default-browser
 */
async function cmdExportReport() {
  const { noOpen, preferChrome } = parseExportReportFlags();
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  if (!workspace || !existsSync(path.join(workspace, '.savyre'))) {
    return withUserMessage(
      { ok: false, action: 'export-report', reason: 'no-workspace' },
      'Open your Savyre project folder first, then run /savyre-export again.'
    );
  }

  const reportAbs = path.join(workspace, WORKFLOW_REPORT_REL);
  const exportRun = runSavyreWorkflowExport(workspace);
  const reportExists = existsSync(reportAbs);

  if (!exportRun.ok && !reportExists) {
    const detail = (exportRun.stderr || exportRun.stdout || exportRun.error || '')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-3)
      .join(' ');
    return withUserMessage(
      {
        ok: false,
        action: 'export-report',
        reason: 'export-failed',
        detail: detail || undefined,
        reportPath: WORKFLOW_REPORT_REL.replace(/\\/g, '/')
      },
      detail
        ? `Could not export the report (${detail}). Install/update the Savyre CLI (\`npm i -g @auryon-innovations/cli\`) or use Export report in the Savyre panel.`
        : 'Could not export the report. Install the Savyre CLI or use Export report in the Savyre panel.'
    );
  }

  let opened = { ok: false, browser: null };
  if (!noOpen) {
    opened = openReportFile(reportAbs, preferChrome);
  }

  const rel = WORKFLOW_REPORT_REL.replace(/\\/g, '/');
  const usedExisting = !exportRun.ok && reportExists;
  let userMessage;
  if (noOpen) {
    userMessage = usedExisting
      ? `Report is ready at \`${rel}\` (opened nothing; --no-open).`
      : `Report saved at \`${rel}\`.`;
  } else if (opened.ok) {
    const where = preferChrome ? 'Chrome' : 'your browser';
    userMessage = usedExisting
      ? `Opened the existing report in ${where}: \`${rel}\`.`
      : `Report saved and opened in ${where}: \`${rel}\`.`;
  } else {
    userMessage = `Report saved at \`${rel}\`, but the browser did not open. Open that file manually.`;
  }

  return withUserMessage(
    {
      ok: true,
      action: 'export-report',
      reportPath: rel,
      absolutePath: reportAbs,
      exported: exportRun.ok,
      usedExisting,
      opened: !noOpen && opened.ok,
      browser: opened.browser || null,
      noOpen
    },
    userMessage
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
    const prev = existing;
    const transition =
      typeof brain?.checkpointPatchForStageTransition === 'function'
        ? brain.checkpointPatchForStageTransition({
            previous: prev || null,
            nextStageId: stageId,
            sessionId: sessionId || 'local',
            identities: brain.liveCompatibilityIdentities?.() || undefined
          })
        : {
            pendingQuestionId: null,
            artifactRevision: 0,
            developerConfirmed: isTaskCaptureStage(stageId) ? prev?.developerConfirmed === true : false,
            sessionRevision: (typeof prev?.sessionRevision === 'number' ? prev.sessionRevision : 0) + 1
          };
    existing = {
      schemaVersion: '1.0',
      sessionId: sessionId || 'local',
      stageId,
      state: 'connecting',
      activeSkill: pickActiveSkillRef(stageId, 'connecting'),
      pendingQuestionId: null,
      artifactRevision: 0,
      lastValidationCodes: [],
      ...transition,
      ...(typeof lastGf === 'string' && lastGf.trim()
        ? { lastGenerateFinalStageId: lastGf.trim(), lastGenerateFinalAt: lastGfAt }
        : {}),
      ...(prev?.originalTaskHash
        ? {
            originalTaskHash: prev.originalTaskHash,
            originalTaskSource: prev.originalTaskSource,
            originalTaskRevision: prev.originalTaskRevision
          }
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
    ...(!checkpoint.originalTaskHash && prev?.originalTaskHash
      ? {
          originalTaskHash: prev.originalTaskHash,
          originalTaskSource: prev.originalTaskSource,
          originalTaskRevision: prev.originalTaskRevision
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

async function readDraftText(workspace, stageId) {
  try {
    return await fs.readFile(path.join(workspace, ...stageDraftRel(stageId).split('/')), 'utf8');
  } catch {
    return '';
  }
}

async function readAnsweredQuestionIds(workspace, stageId) {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(workspace, CHAT_RESPONSES_REL), 'utf8'));
    return (raw.items || [])
      .filter((item) => item.stageId === stageId && /^OQ-\d+$/i.test(String(item.questionId || '')))
      .map((item) => String(item.questionId).toUpperCase());
  } catch {
    return [];
  }
}

async function readChallengeFindingList(workspace, stageId) {
  const rels =
    stageId === 's01-task-definition' || stageId === '02-requirement-analysis'
      ? [
          'stages/s01_task_definition/challenge_findings.json',
          'stages/s01_task_definition/challenge-findings.json',
          'savyre/stages/02-requirement-analysis/challenge-findings.json'
        ]
      : [];
  for (const rel of rels) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(workspace, ...rel.split('/')), 'utf8'));
      if (Array.isArray(raw?.findings)) return raw.findings;
    } catch {
      /* try next */
    }
  }
  return [];
}

async function resolveGenuineFromDisk(workspace, stageId, existing) {
  const review = await readStageReview(workspace, stageId);
  const draftText = await readDraftText(workspace, stageId);
  const inputFile = await readStageInput(workspace, stageId);
  const assigned = extractAssignedTaskPlain(inputFile.text);
  const answeredIds = await readAnsweredQuestionIds(workspace, stageId);
  const challengeFindings = await readChallengeFindingList(workspace, stageId);
  if (typeof brain?.resolveGenuineAsk === 'function') {
    return brain.resolveGenuineAsk({
      reviewText: review.text,
      draftText,
      assignedTask: assigned,
      challengeFindings,
      answeredIds,
      resumeQuestionId: existing?.pendingQuestionId || null
    });
  }
  const pending = listPendingReviewQuestions(review.text);
  const next = resumePendingQuestion(pending, existing?.pendingQuestionId);
  return {
    pending,
    next,
    decision: {
      ask: Boolean(next),
      question: next ? { id: next.id, question: next.question, blocking: true } : null
    }
  };
}

async function persistGenuineQuestionArtifacts(workspace, stageId, resolved) {
  if (!resolved?.next && !resolved?.decision?.ask) return;
  const rows = (resolved.pending || []).length
    ? resolved.pending
    : resolved.next
      ? [resolved.next]
      : [];
  if (!rows.length) return;
  if (typeof brain?.upsertOpenQuestionsTable === 'function') {
    try {
      const abs = path.join(workspace, ...stageDraftRel(stageId).split('/'));
      const draft = await fs.readFile(abs, 'utf8');
      if (!draft.trim()) return;
      const nextDraft =
        typeof brain.mergeOpenQuestionsTable === 'function'
          ? brain.mergeOpenQuestionsTable(draft, rows)
          : brain.upsertOpenQuestionsTable(draft, rows);
      if (nextDraft !== draft) {
        await fs.writeFile(abs, nextDraft.endsWith('\n') ? nextDraft : `${nextDraft}\n`, 'utf8');
      }
    } catch {
      /* draft not written yet */
    }
  }
  if (typeof brain?.upsertOpenQuestionReviewStubs === 'function') {
    const review = await readStageReview(workspace, stageId);
    const nextReview = brain.upsertOpenQuestionReviewStubs(review.text, rows);
    if (nextReview && nextReview !== review.text) {
      await fs.mkdir(path.dirname(review.abs), { recursive: true });
      await fs.writeFile(
        review.abs,
        nextReview.endsWith('\n') ? nextReview : `${nextReview}\n`,
        'utf8'
      );
    }
  }
}

function listPendingReviewQuestions(review) {
  if (typeof brain?.listPendingReviewQuestions === 'function') {
    return brain.listPendingReviewQuestions(review);
  }
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
      status !== 'OPEN' &&
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
  const preferredRel = stageReviewRel(stageId);
  const preferred = path.join(workspace, ...preferredRel.split('/'));
  const otherRel = isSevenStageId(stageId)
    ? `stages/${sevenStageFolder(stageId)}/candidate-review.md`
    : `savyre/stages/${stageId}/candidate-review.md`;
  const other = path.join(workspace, ...otherRel.split('/'));
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
  const keepConfirm = isTaskCaptureStage(stageId) && !existing?.developerConfirmed;
  const aiReady = await aiOutputLooksWritten(workspace, stageId);
  const nextBacklogItemId = await readNextBacklogItemId(workspace, stageId);
  const hasRemainingBacklog = Boolean(nextBacklogItemId);
  const lockReady =
    stageId === 's04-build-review' || stageId === '06-implementation'
      ? aiReady && !hasRemainingBacklog
      : aiReady;
  const resolved = await resolveGenuineFromDisk(workspace, stageId, existing);
  const next =
    keepConfirm || (isTaskCaptureStage(stageId) && !aiReady)
      ? null
      : resolved?.next || null;
  if (next) await persistGenuineQuestionArtifacts(workspace, stageId, resolved);
  const validationFailed =
    Array.isArray(existing?.lastValidationCodes) && existing.lastValidationCodes.length > 0;
  const state = deriveChatTurnState({
    awaitingConfirmation: keepConfirm,
    pendingQuestion: Boolean(next),
    aiReady: lockReady,
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
    activeSkill: pickActiveSkillRef(stageId, state, {
      ...pass,
      pendingQuestion: Boolean(next),
      hasRemainingBacklog
    })
  });
  const turn = turnFromCheckpoint(checkpoint);
  if (!keepConfirm && next) {
    turn.question = { id: next.id, blocking: true, text: next.question };
    turn.allowedActions = allowedActionsForState('needs_user_input');
  }
  return { turn, next, checkpoint, pass, nextBacklogItemId, hasRemainingBacklog, aiReady, lockReady };
}

async function cmdTurn() {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const match = await requireChatPanelMatch(workspace, 'turn');
  if (!match.ok) return match;
  const session = await readJsonIfPresent(path.join(workspace, '.savyre', 'session.json'));
  const stageId = match.panelStageId;
  const sessionId = session?.sessionId || 'local';
  const existing = await readOrCreateCheckpoint(workspace, stageId, sessionId);
  const { turn, next, pass, nextBacklogItemId, hasRemainingBacklog, aiReady, lockReady } =
    await buildInteractiveTurn(workspace, stageId, sessionId, existing);
  const fields = chatSkillFields(stageId, turn.state, {
    ...pass,
    pendingQuestion: Boolean(next),
    hasRemainingBacklog
  });
  const gate = chatGenerateFinalBlockers({
    stageId,
    aiReady: lockReady,
    hasPendingBlocking: Boolean(next),
    challengeComplete: pass.challengeComplete,
    evidenceReady: pass.evidenceReady,
    hasRemainingBacklog
  });
  const confirmed = Boolean(existing?.developerConfirmed);
  const locked = existing?.lastGenerateFinalStageId === stageId;
  const spoken =
    isTaskCaptureStage(stageId)
      ? await stage01SpokenFromDisk(workspace, {
          pendingQuestion: next?.question,
          confirmed,
          draftReady: aiReady,
          locked,
          stageId
        })
      : null;
  const awaitingConfirm = isTaskCaptureStage(stageId) && spoken && !confirmed && !next;
  const awaitingLock =
    isTaskCaptureStage(stageId) && spoken && confirmed && aiReady && !locked && !next;
  const userMessage = next
    ? chatUserMessage('ask_question', { question: next.question, questionId: next.id })
    : spoken?.userMessage ||
      chatStartUserMessage({
        stageId,
        confirmed,
        aiReady: lockReady,
        nextBacklogItemId,
        challengeComplete: pass.challengeComplete,
        evidenceReady: pass.evidenceReady
      });
  const message = next
    ? `Ask ${next.id} in this chat. Speak userMessage exactly (it tells them to run /savyre-answer). When they answer, run /savyre-answer with their words. Resume this same question if the chat restarts. Keep/Undo on a file edit is not an answer.`
    : awaitingConfirm
      ? TALK_FROM_ASSIGNED_THEN_CONFIRM
      : awaitingLock
        ? `Run verification-before-completion (turn.activeSkill). If the check passes, ${TALK_FROM_ASSIGNED_THEN_LOCK} Do not run lock, validate, or start the next stage yourself. Savyre unlocks if Validate passes.`
        : nextBacklogItemId
          ? `Implement only backlog item \`${nextBacklogItemId}\` this turn. Write its application files and \`${stageDraftRel(stageId)}\` for that id only, then stop. Speak userMessage. Wait for /savyre-next. Do not lock Build & Review while backlog items remain.`
          : gate.ok
            ? `Run verification-before-completion (turn.activeSkill). If the check passes, ${waitForDeveloperSlash(lockSlash(stageId))} Do not run it, validate, or start the next stage yourself. Savyre unlocks if Validate passes.`
            : 'Follow turn.activeSkill. Do not lock until that pass is done.';
  const pinnedHashes = await readPinnedSkillHashes(workspace);
  const identities = await readWorkflowIdentities(workspace);
  const skillDelivery = buildGuardSkillDelivery(stageId, turn.state, pass, {}, pinnedHashes, identities);
  if (skillDelivery?.ok) {
    await writePinnedSkillHashes(workspace, skillDelivery);
  }
  return withUnifiedTurn(
    {
      mode: 'turn',
      skill: fields.skill,
      cursorSkill: fields.cursorSkill,
      activeSkill: turn.activeSkill || fields.activeSkill,
      turn,
      pendingQuestion: next,
      intervention: next
        ? { ask: true, question: { id: next.id, question: next.question, blocking: true } }
        : { ask: false, question: null, suppressed: [] },
      unlocksStage: false,
      message,
      userMessage,
      ...(nextBacklogItemId ? { nextBacklogItemId } : {}),
      skillDelivery,
      ...(spoken?.report
        ? { composer: { userMessage, report: spoken.report, lead: spoken.lead || '' } }
        : {})
    },
    workspace
  );
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
  const draftText = await readDraftText(workspace, stageId);
  let applied;
  if (typeof brain?.applyGenuineAnswer === 'function') {
    applied = brain.applyGenuineAnswer({
      reviewText: review.text,
      draftText,
      questionId,
      answer
    });
    if (!applied.ok) {
      return withUserMessage(
        { ok: false, action: 'answer', unlocksStage: false, reason: applied.error },
        /vague/i.test(String(applied.error || ''))
          ? chatUserMessage('ask_question', {
              question: applied.next?.question || 'I need a clearer choice before we continue.',
              questionId: applied.next?.id || questionId
            })
          : chatUserMessage('ask_question', {
              question: applied.next?.question || '',
              questionId: applied.next?.id || questionId
            })
      );
    }
    await fs.mkdir(path.dirname(review.abs), { recursive: true });
    await fs.writeFile(
      review.abs,
      applied.reviewText.endsWith('\n') ? applied.reviewText : `${applied.reviewText}\n`,
      'utf8'
    );
    const aiAbs = path.join(workspace, ...stageDraftRel(stageId).split('/'));
    await fs.mkdir(path.dirname(aiAbs), { recursive: true });
    await fs.writeFile(
      aiAbs,
      applied.draftText.endsWith('\n') ? applied.draftText : `${applied.draftText}\n`,
      'utf8'
    );
  } else {
    if (!review.text.trim()) {
      return withUserMessage(
        { ok: false, action: 'answer', unlocksStage: false, reason: 'developer-review.md is missing.' },
        chatUserMessage('gate_failed')
      );
    }
    applied = applyAnswerToReview(review.text, questionId, answer);
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
      const aiAbs = path.join(workspace, ...stageDraftRel(stageId).split('/'));
      const aiText = await fs.readFile(aiAbs, 'utf8');
      const synced = applyAnswerToAiOutputTable(aiText, applied.answeredId, answer);
      if (synced.ok) {
        await fs.writeFile(aiAbs, synced.content.endsWith('\n') ? synced.content : `${synced.content}\n`, 'utf8');
      }
    } catch {
      /* draft missing */
    }
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
    activeSkill: pickActiveSkillRef(stageId, state, { ...pass, pendingQuestion: Boolean(applied.next) }),
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
  return withUnifiedTurn(
    {
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
        ? chatUserMessage('ask_question', {
            question: applied.next.question,
            questionId: applied.next.id
          })
        : chatUserMessage('ask_generate_final', { stageId })
    },
    workspace
  );
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
  if (!isTaskCaptureStage(current)) {
    return withUserMessage(
      {
        ok: false,
        action: 'confirm',
        unlocksStage: false,
        stageId: current,
        reason: current
          ? `Confirm is Task Definition / Task Input only. The panel is on ${current}. Speak userMessage. Wait for /savyre-next. Do not start it yourself.`
          : 'Confirm is Task Definition / Task Input only. No currentStageId. Start a session in the Savyre panel first.'
      },
      current ? chatUserMessage('confirm_not_stage_01') : chatUserMessage('start_panel')
    );
  }
  const inputFile = await readStageInput(workspace, current);
  const input = inputFile.text || '';
  const assigned = extractAssignedTaskPlain(input);
  if (!assigned) {
    return withUserMessage(
      {
        ok: false,
        action: 'confirm',
        unlocksStage: false,
        reason: current === 's01-task-definition' ? 'No assignedTask in stage_input.json' : 'No Stage 01 input.md'
      },
      chatUserMessage('ask_what_to_build')
    );
  }
  if (current === '01-task-input') {
    if (!/##\s*Assigned task/i.test(input)) {
      return withUserMessage(
        { ok: false, action: 'confirm', unlocksStage: false, reason: 'No assigned task to confirm' },
        chatUserMessage('ask_what_to_build')
      );
    }
  }
  const review = await readStageReview(workspace, current);
  const pending = listPendingReviewQuestions(review.text);
  const next = pending[0] || null;
  const confirmState = deriveChatTurnState({
    pendingQuestion: Boolean(next),
    aiReady: false
  });
  const existingCp = await readJsonIfPresent(path.join(workspace, CHAT_CHECKPOINT_REL));
  const tracked = assigned
    ? trackOriginalTask({
        text: assigned,
        source: existingCp?.originalTaskSource || 'chat',
        previousHash: existingCp?.originalTaskHash,
        previousRevision: existingCp?.originalTaskRevision
      })
    : null;
  const checkpoint = await writeCheckpoint(workspace, {
    schemaVersion: '1.0',
    sessionId: session?.sessionId || 'local',
    stageId: current,
    state: confirmState,
    activeSkill: pickActiveSkillRef(current, confirmState),
    pendingQuestionId: next?.id || null,
    artifactRevision: 1,
    lastValidationCodes: [],
    developerConfirmed: true,
    ...(existingCp?.originalTaskHash || tracked
      ? {
          originalTaskHash: tracked?.hash || existingCp?.originalTaskHash,
          originalTaskSource: tracked?.source || existingCp?.originalTaskSource,
          originalTaskRevision: tracked?.revision || existingCp?.originalTaskRevision
        }
      : {})
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
    stageId: current,
    questionId: 'STAGE01-CONFIRM',
    answer: 'confirmed',
    artifactRevision: 1,
    recordedAt: new Date().toISOString()
  });
  responses.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(responsesFile), { recursive: true });
  await fs.writeFile(responsesFile, `${JSON.stringify(responses, null, 2)}\n`, 'utf8');
  const reviewAfter = await readStageReview(workspace, current);
  const pendingAfter = listPendingReviewQuestions(reviewAfter.text);
  const nextAfter = pendingAfter[0] || null;
  const aiReady = await aiOutputLooksWritten(workspace, current);
  const message = nextAfter
    ? `Task confirmed. Ask ${nextAfter.id} in this chat: ${nextAfter.question} When they answer, run /savyre-answer with their words.`
    : TALK_AFTER_CONFIRM_THEN_DRAFT;
  const intakeReview = assigned
    ? buildStage01IntakeReview({
        originalTask: assigned,
        pendingQuestion: nextAfter?.question || null,
        confirmed: true,
        draftReady: false
      })
    : null;
  const intakeReport = '';
  const userMessage = intakeReview
    ? intakeReview
    : nextAfter
      ? chatUserMessage('ask_question', {
          question: nextAfter.question,
          questionId: nextAfter.id
        })
      : chatUserMessage('task_confirmed_draft', { stageId: current });
  const afterState = deriveChatTurnState({
    pendingQuestion: Boolean(nextAfter),
    aiReady
  });
  const checkpointAfter = await writeCheckpoint(workspace, {
    ...checkpoint,
    state: afterState,
    pendingQuestionId: nextAfter?.id || null,
    activeSkill: pickActiveSkillRef(current, afterState)
  });
  return withUnifiedTurn(
    {
      ok: true,
      action: 'confirm',
      unlocksStage: false,
      nextQuestion: nextAfter,
      artifactTemplate: CHAT_ARTIFACT_HEADINGS[current],
      message,
      userMessage,
      ...(intakeReview ? { intakeReview } : {}),
      ...(intakeReport ? { composer: { userMessage, report: intakeReport } } : {}),
      ...(tracked?.hash ? { originalTaskHash: tracked.hash } : {}),
      turn: turnFromCheckpoint(checkpointAfter)
    },
    workspace
  );
}

async function cmdGenerateFinal() {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const match = await requireChatPanelMatch(workspace, 'generate_final');
  if (!match.ok) return match;
  const stageId = match.panelStageId;
  const aiReady = await aiOutputLooksWritten(workspace, stageId);
  const existing = await readJsonIfPresent(path.join(workspace, CHAT_CHECKPOINT_REL));
  const resolved = await resolveGenuineFromDisk(workspace, stageId, existing);
  const draftTextEarly = await readDraftText(workspace, stageId);
  const reviewEarly = await readStageReview(workspace, stageId);
  const tablePendingEarly =
    typeof brain?.listPendingOpenQuestionTable === 'function'
      ? brain.listPendingOpenQuestionTable(draftTextEarly || '')
      : [];
  const nextAsk =
    resolved?.next ||
    tablePendingEarly[0] ||
    listPendingReviewQuestions(reviewEarly.text)[0] ||
    null;
  if (nextAsk) {
    await persistGenuineQuestionArtifacts(workspace, stageId, {
      ...resolved,
      next: nextAsk,
      pending: resolved?.pending?.length ? resolved.pending : [nextAsk],
      decision: { ask: true, question: { id: nextAsk.id, question: nextAsk.question, blocking: true } }
    });
    return withUserMessage(
      {
        ok: false,
        action: 'generate_final',
        unlocksStage: false,
        stageId,
        pendingQuestion: nextAsk,
        intervention: { ask: true, question: { id: nextAsk.id, question: nextAsk.question, blocking: true } },
        reason: 'Ask the open decision now. Do not lock yet.'
      },
      chatUserMessage('ask_question', {
        question: nextAsk.question,
        questionId: nextAsk.id
      })
    );
  }
  await ensureLockReadyReview(workspace, stageId);
  const pass = await loadChatPass(workspace, stageId);
  const nextBacklogItemId = await readNextBacklogItemId(workspace, stageId);
  const hasRemainingBacklog = Boolean(nextBacklogItemId);
  const gate = chatGenerateFinalBlockers({
    stageId,
    aiReady: aiReady && !hasRemainingBacklog,
    hasPendingBlocking: false,
    challengeComplete: pass.challengeComplete,
    evidenceReady: pass.evidenceReady,
    hasRemainingBacklog
  });
  if (!gate.ok) {
    return withUserMessage(
      {
        ok: false,
        action: 'generate_final',
        unlocksStage: false,
        stageId,
        ...(nextBacklogItemId ? { nextBacklogItemId } : {}),
        reason: hasRemainingBacklog
          ? `Backlog item ${nextBacklogItemId} is still pending. Implement it before locking Build & Review.`
          : `Chat generate-final blocked (${gate.kind}). Follow turn.activeSkill. Wait.`
      },
      chatStartUserMessage({
        stageId,
        aiReady: aiReady && !hasRemainingBacklog,
        nextBacklogItemId,
        challengeComplete: pass.challengeComplete,
        evidenceReady: pass.evidenceReady
      })
    );
  }
  await healOpenQuestionsNoneFile(workspace, stageId);
  await ensureLockReadyReview(workspace, stageId);
  let result = await runSavyreGate(workspace, 'generate-final', { stageId });
  if (!result.ok) {
    const missingReview = /developer-review|missing or empty/i.test(
      `${result.message || ''} ${(result.errors || []).join(' ')} ${result.reason || ''}`
    );
    const wroteReview = await ensureLockReadyReview(workspace, stageId, { force: missingReview });
    const healed = await healOpenQuestionsNoneFile(workspace, stageId);
    if (wroteReview || healed || missingReview) {
      result = await runSavyreGate(workspace, 'generate-final', { stageId });
    }
  }
  const gfStage = result.data?.stageId || match.panelStageId;
  if (result.ok && gfStage) {
    await writeLastGenerateFinalStageId(workspace, gfStage);
    if (typeof brain.ensureRequiredLockProjections === 'function') {
      const checkpoint = await readJsonIfPresent(path.join(workspace, CHAT_CHECKPOINT_REL));
      const confirmationRef =
        typeof checkpoint?.confirmationId === 'string' && checkpoint.confirmationId.trim()
          ? checkpoint.confirmationId.trim()
          : checkpoint?.developerConfirmed
            ? 'developer-confirm'
            : `lock:${gfStage}`;
      await brain.ensureRequiredLockProjections(workspace, gfStage, { confirmationRef });
    }
  }
  return result;
}

/**
 * One continue command. Order on the current stage:
 * confirm (Task Input) → Chat writes draft / verification → lock (generate-final) → check (validate) → rebind next stage.
 */
async function cmdNext() {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const panelStageId = await effectivePanelStageId(workspace);
  if (!panelStageId) {
    return withUserMessage(
      { ok: false, action: 'next', unlocksStage: false, reason: 'No currentStageId' },
      chatUserMessage('start_panel')
    );
  }
  const boundStageId = await readChatBoundStageId(workspace);
  if (!boundStageId || boundStageId !== panelStageId) {
    return cmdStart('');
  }
  const existing = await readJsonIfPresent(path.join(workspace, CHAT_CHECKPOINT_REL));
  if (isTaskCaptureStage(panelStageId) && !existing?.developerConfirmed) {
    return cmdConfirm();
  }
  const lastGf = await readLastGenerateFinalStageId(workspace);
  if (lastGf === panelStageId) {
    return cmdValidateGate();
  }
  // S04: while backlog items remain, continue implementing — do not jump to lock.
  if (panelStageId === 's04-build-review' || panelStageId === '06-implementation') {
    const nextBacklogItemId = await readNextBacklogItemId(workspace, panelStageId);
    if (nextBacklogItemId) {
      return cmdTurn();
    }
  }
  return cmdGenerateFinal();
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
        reason: `Generate final was for ${lastGf} but Chat/panel are on ${match.panelStageId}. Do not validate ${lastGf}. Speak userMessage. Wait for /savyre-next.`
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
  if (action === 'next') {
    return cmdNext();
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
  brain = await loadSavyreBrain();
  const verb = process.argv[2];
  if (verb === 'export-report' || verb === 'export') {
    reply(await cmdExportReport());
    return;
  }
  if (
    verb === 'run' ||
    verb === 'start' ||
    verb === 'status' ||
    verb === 'stop' ||
    verb === 'turn' ||
    verb === 'confirm' ||
    verb === 'next' ||
    verb === 'answer' ||
    verb === 'action'
  ) {
    if (!brain) {
      reply(
        withUserMessage(
          {
            mode: 'idle',
            reason: 'savyre-brain-missing',
            runtime: buildRuntimeCapabilities()
          },
          brainMissingRecoveryMessage()
        )
      );
      return;
    }
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
                  : verb === 'next'
                    ? await cmdNext()
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

  if (!brain) {
    const workspace = await findWorkspaceFromHook(input);
    const { manifest } = await loadActive(workspace);
    if (manifest) {
      const verified = await verifyManifest(manifest, workspace);
      if (verified.ok) {
        reply(
          deny(
            brainMissingRecoveryMessage(),
            [
              brainMissingRecoveryMessage(),
              'Savyre stage enforcement is active but the local runtime brain is unavailable.',
              'Use the Savyre panel for stage work until @savyre/run-config is compatible.'
            ].join(' ')
          )
        );
        return;
      }
    }
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
