#!/usr/bin/env node
/**
 * Savyre thin plugin runtime.
 * - Hook mode (stdin JSON): enforce the active execution manifest.
 * - CLI: node savyre-guard.mjs run | start | status | stop | turn | confirm | next | answer | action
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
import { BRAIN_MISSING_USER_MESSAGE, loadSavyreBrain } from './savyre-brain.mjs';
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
const REGISTRY_TO_CURSOR_SKILL = {
  'savyre.task-input-dialogue': 'savyre-task-input',
  'savyre.requirement-analysis': 'savyre-requirement-analyst',
  'savyre.requirement-challenge': 'savyre-requirement-challenge',
  'savyre.codebase-discovery': 'savyre-codebase-discovery',
  'savyre.evidence-grounding': 'savyre-evidence-grounding',
  'savyre.verification-before-completion': 'savyre-verification-before-completion'
};

/** Loaded from @savyre/run-config. Null means Chat cannot serve canned copy. */
let brain = null;

function deriveChatTurnState(input) {
  if (!brain) return 'connecting';
  return brain.deriveChatTurnState(input);
}

function pickActiveSkillRef(stageId, state, ctx = {}) {
  if (!brain) return null;
  const specialized = brain.CHAT_SPECIALIZED_SKILL_ID?.[stageId];
  const skipSpecialized =
    (stageId === '02-requirement-analysis' && ctx.challengeComplete === true) ||
    (stageId === '03-codebase-discovery' && ctx.evidenceReady === true);
  const specializedStates = brain.CHAT_SPECIALIZED_STATES || [];
  if (specialized && specializedStates.includes(state) && !skipSpecialized) {
    return `${specialized}@1.0.0`;
  }
  if (
    brain.CHAT_PRIMARY_SKILL_ID?.[stageId] &&
    (state === 'output_ready' || state === 'ready_for_review')
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
    (brain ? brain.chatUserMessage('task_confirmed_draft') : '') ||
    ''
  );
}

function stage01LockAction() {
  return (
    brain?.STAGE01_LOCK_ACTION ||
    (brain ? brain.chatUserMessage('ask_generate_final', { stageId: '01-task-input' }) : '') ||
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
  'Read savyre/stages/01-task-input/input.md Assigned task (not Original Task). Write 1-2 short sentences in your own voice that you wrote the Task Input draft, from that input.md text. Do not invent features. Do not paste Official assignment, JSON, message, suggestedTask, hashes, or continuation. Do not list artifactTemplate headings in chat. Then speak userMessage exactly. Do not speak a leftover numbered list. Wait for /savyre-next.';

const TALK_AFTER_CONFIRM_THEN_DRAFT =
  'Task confirmed. Do not paste JSON. Do not speak leftover product names. Do not speak the canned draft line as the reply. Do not list Original Task headings in chat. Copy input.md Assigned task into Original Task unchanged. Fill the rest of ai-output.md from that same input.md text (no Generate Output placeholder). Then run turn. Then write 1-2 short sentences from input.md Assigned task (not Original Task), then speak the new userMessage exactly (lock).';

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
  const abs = path.join(workspace, 'savyre', 'stages', '01-task-input', 'input.md');
  let current = '';
  try {
    current = await fs.readFile(abs, 'utf8');
  } catch {
    current = '';
  }
  const next = upsertAssignedTaskInInput(current, taskText);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
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
    next.unifiedTurn = data.unifiedTurn;
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
  const keepIntakeTalk =
    typeof payload.userMessage === 'string' &&
    (/to confirm/.test(payload.userMessage) ||
      /to lock Task Input/.test(payload.userMessage) ||
      payload.userMessage === stage01DraftAction());
  if (keepIntakeTalk) {
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
  if (data.continuation) next.continuation = data.continuation;
  if (data.recovery && data.recovery.action) {
    next.recovery = data.recovery;
    if (typeof data.recovery.userMessage === 'string' && data.recovery.userMessage.trim()) {
      if (
        data.recovery.action === 'ask' ||
        data.recovery.action === 'blocked' ||
        data.recovery.action === 'fallback_artifact'
      ) {
        next.userMessage = data.recovery.userMessage.trim();
      }
    }
  }
  if (next.intervention && next.intervention.ask === true && next.pendingQuestion?.id) {
    next.message = `Ask ${next.pendingQuestion.id} in this chat. When they answer, run /savyre-answer with their words. Resume this same question if the chat restarts.`;
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
        message = `${message} Generate final targeted ${gateStage} but Chat pinned ${pinnedStage}. Do not run validate. Speak userMessage. Wait for /savyre-next.`.trim();
        userMessage = chatUserMessage('mismatch');
      } else {
        message = `${message} Speak userMessage. Wait for the developer to run \`${checkSlash(gateStage || pinnedStage)}\`. Do not run it yourself. Chat did not unlock.`.trim();
        userMessage = chatUserMessage('ask_validate', { stageId: gateStage || pinnedStage });
      }
    } else if (subcommand === 'generate-final' && !parsed.ok) {
      userMessage = chatUserMessage('gate_failed');
    }
    if (subcommand === 'validate' && parsed.ok) {
      message = `${message} Speak userMessage. Wait for /savyre-next. Do not start the next stage yourself. Unlock is Savyre's result, not a Chat decision.`.trim();
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

async function healOpenQuestionsNoneFile(workspace, stageId) {
  const abs = path.join(workspace, 'savyre', 'stages', stageId, 'ai-output.md');
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

function isVerificationBeforeCompletionEnabled() {
  return process.env.SAVYRE_VERIFICATION_BEFORE_COMPLETION !== '0';
}

function isChatContinuationEnabled() {
  return process.env.SAVYRE_CHAT_CONTINUATION !== '0';
}

function evaluateVerification(input) {
  const gate = chatGenerateFinalBlockers(input);
  const stage02 = input.stageId === '02-requirement-analysis';
  const stage03 = input.stageId === '03-codebase-discovery';
  return {
    schemaVersion: '1.0',
    ready: gate.ok,
    kind: gate.kind,
    checks: {
      draftReady: Boolean(input.aiReady),
      openQuestionsResolved: !input.hasPendingBlocking,
      challengeOk: stage02 ? input.challengeComplete === true : null,
      evidenceOk: stage03 ? input.evidenceReady === true : null
    },
    canApprove: false,
    canUnlockStage: false
  };
}

function applyVerificationAllowedActions(actions, verification) {
  if (!isVerificationBeforeCompletionEnabled() || !verification || verification.ready) {
    return actions;
  }
  return (actions || []).filter((a) => a !== 'generate_final' && a !== 'validate');
}

function buildChatContinuation(checkpoint) {
  if (!isChatContinuationEnabled() || !checkpoint) return null;
  return {
    schemaVersion: '1.0',
    sessionId: checkpoint.sessionId || null,
    stageId: checkpoint.stageId || null,
    pendingQuestionId: checkpoint.pendingQuestionId || null,
    activeSkill: checkpoint.activeSkill || null,
    originalTaskHash: checkpoint.originalTaskHash || null,
    originalTaskRevision:
      typeof checkpoint.originalTaskRevision === 'number' ? checkpoint.originalTaskRevision : null,
    artifactRevision: checkpoint.artifactRevision || 0
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
  return `Run verification-before-completion (turn.activeSkill). If the check fails, stay on this stage. If it passes, ${waitForDeveloperSlash(lockSlash(stageId))} Do not run it, validate, or start the next stage yourself. Chat cannot unlock by itself.`;
}

function assignedTaskLooksFilled(inputText) {
  return Boolean(productWordingFromStage01Input(inputText));
}

async function stage01SpokenFromDisk(workspace, opts = {}) {
  const inputFile = await readStageInput(workspace, '01-task-input');
  const assigned = extractAssignedTaskPlain(inputFile.text);
  if (!assigned) return null;
  const confirmed = Boolean(opts.confirmed);
  const draftReady = Boolean(opts.draftReady);
  const locked = Boolean(opts.locked);
  const userMessage = locked
    ? chatUserMessage('ask_validate', { stageId: '01-task-input' })
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
        ? 'Leftover or a one-liner under Assigned task is a scratch capture, not the final Assigned task. Replace `## Assigned task` with 2-4 short sentences plus a Product / UX / API / Data / Stack list from that prompt. Keep Official assignment unchanged. Speak that same Assigned task text, then speak userMessage. Wait for /savyre-next. After they continue, write ai-output.md from that Assigned task. Do not run panel Stage AI. Do not lock until ai-output.md exists.'
        : 'FIRST MESSAGE: ask only what they want to build — unless JSON suggestedTask or intakeReview is already set, then replace Assigned task with the restatement, speak it, and wait for /savyre-next. Official assignment / 15-stage text is Savyre process, not the product. After they name a product, write the 2-4 sentences plus Product / UX / API / Data / Stack list under `## Assigned task`. Wait for /savyre-next. Do not confirm for them.',
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
          } If Generate final rejects the artifact, fix ai-output.md. Speak userMessage. Wait for /savyre-next. Do not run it yourself.`
        : 'Read-only: do not edit application source. Do not write ai-output.md. Use the Savyre panel to run this stage. Then speak userMessage and wait for /savyre-next. Do not run it or validate yourself.';
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
    manifest.stageId === '06-implementation'
      ? 'Continue implementation in this chat. Write application files. Then speak userMessage and wait for /savyre-next. Do not run it yourself.'
      : manifest.stageId === '02-requirement-analysis' || manifest.stageId === '03-codebase-discovery'
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
  } else if (
    captureTask &&
    existing?.developerConfirmed &&
    aiReady &&
    existing?.lastGenerateFinalStageId !== '01-task-input'
  ) {
    message = `Run verification-before-completion (turn.activeSkill). If the check passes, ${TALK_FROM_ASSIGNED_THEN_LOCK} Do not run lock, validate, or start the next stage yourself.`;
  } else {
    message = await chatStageFollowupMessage(workspace, stageId, pending);
  }
  if (bind.ignoredUserText) {
    message = `Bound to ${stageId}. Extra text after /savyre-start was ignored — that is not a new Task Input. Do not write input.md or ask confirm. Work this stage. ${message}`;
  }
  const userMessage = chatStartUserMessage({
    stageId,
    confirmed: Boolean(existing?.developerConfirmed),
    pendingQuestion: pending?.question || null,
    aiReady,
    suggestedTask: taskReady,
    ignoredUserText: Boolean(bind.ignoredUserText),
    challengeComplete: pass.challengeComplete,
    evidenceReady: pass.evidenceReady,
    intakeSummary
  });
  const verification = isVerificationBeforeCompletionEnabled()
    ? evaluateVerification({
        stageId,
        aiReady,
        hasPendingBlocking: Boolean(pending),
        challengeComplete: pass.challengeComplete,
        evidenceReady: pass.evidenceReady
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
    ...chatSkillFields(stageId, turnOut?.state, pass),
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
        workflowId: manifest.workflowId
      },
      chatUserMessage('on_stage', { stageId: manifest.stageId })
    ),
    workspace
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
  const confirmed = Boolean(existing?.developerConfirmed);
  const locked = existing?.lastGenerateFinalStageId === stageId;
  const spoken =
    stageId === '01-task-input'
      ? await stage01SpokenFromDisk(workspace, {
          pendingQuestion: next?.question,
          confirmed,
          draftReady: aiReady,
          locked
        })
      : null;
  const awaitingConfirm = stageId === '01-task-input' && spoken && !confirmed && !next;
  const awaitingLock =
    stageId === '01-task-input' && spoken && confirmed && aiReady && !locked && !next;
  const userMessage = next
    ? chatUserMessage('ask_question', { question: next.question })
    : spoken?.userMessage || chatUserMessage(gate.kind, { stageId });
  const message = next
    ? `Ask ${next.id} in this chat. When they answer, run /savyre-answer with their words. Resume this same question if the chat restarts.`
    : awaitingConfirm
      ? TALK_FROM_ASSIGNED_THEN_CONFIRM
      : awaitingLock
        ? `Run verification-before-completion (turn.activeSkill). If the check passes, ${TALK_FROM_ASSIGNED_THEN_LOCK} Do not run lock, validate, or start the next stage yourself. Savyre unlocks if Validate passes.`
        : gate.ok
          ? `Run verification-before-completion (turn.activeSkill). If the check passes, ${waitForDeveloperSlash(lockSlash(stageId))} Do not run it, validate, or start the next stage yourself. Savyre unlocks if Validate passes.`
          : 'Follow turn.activeSkill. Do not lock until that pass is done.';
  return withUnifiedTurn(
    {
      mode: 'turn',
      skill: fields.skill,
      cursorSkill: fields.cursorSkill,
      activeSkill: turn.activeSkill || fields.activeSkill,
      turn,
      pendingQuestion: next,
      unlocksStage: false,
      message,
      userMessage,
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
        ? chatUserMessage('ask_question', { question: applied.next.question })
        : chatUserMessage(gate.kind, { stageId })
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
  if (current !== '01-task-input') {
    return withUserMessage(
      {
        ok: false,
        action: 'confirm',
        unlocksStage: false,
        stageId: current,
        reason: current
          ? `Confirm is Task Input only. The panel is on ${current}. Speak userMessage. Wait for /savyre-next. Do not start it yourself. Do not rewrite Task Input input.md.`
          : 'Confirm is Task Input only. No currentStageId. Start a session in the Savyre panel first.'
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
  const assigned = extractAssignedTaskPlain(input);
  if (!assigned) {
    return withUserMessage(
      { ok: false, action: 'confirm', unlocksStage: false, reason: 'No assigned task to confirm' },
      chatUserMessage('ask_what_to_build')
    );
  }
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
    stageId: '01-task-input',
    state: confirmState,
    activeSkill: pickActiveSkillRef('01-task-input', confirmState),
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
      ? chatUserMessage('ask_question', { question: nextAfter.question })
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
  return withUnifiedTurn(
    {
      ok: true,
      action: 'confirm',
      unlocksStage: false,
      nextQuestion: nextAfter,
      artifactTemplate: CHAT_ARTIFACT_HEADINGS['01-task-input'],
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
  await healOpenQuestionsNoneFile(workspace, stageId);
  let result = runSavyreGate(workspace, 'generate-final', { stageId });
  if (!result.ok) {
    const healed = await healOpenQuestionsNoneFile(workspace, stageId);
    if (healed) {
      result = runSavyreGate(workspace, 'generate-final', { stageId });
    }
  }
  const gfStage = result.data?.stageId || match.panelStageId;
  if (result.ok && gfStage) {
    await writeLastGenerateFinalStageId(workspace, gfStage);
  }
  return result;
}

/**
 * One continue command. Order on the current stage:
 * confirm (Task Input) → Chat writes draft / verification → lock (generate-final) → check (validate) → rebind next stage.
 */
async function cmdNext() {
  const workspace = await findWorkspaceFromHook({ cwd: process.cwd() });
  const panelStageId = readPanelStageId(workspace);
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
  if (panelStageId === '01-task-input' && !existing?.developerConfirmed) {
    return cmdConfirm();
  }
  const lastGf = await readLastGenerateFinalStageId(workspace);
  if (lastGf === panelStageId) {
    return cmdValidateGate();
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
          { mode: 'idle', reason: 'savyre-brain-missing' },
          BRAIN_MISSING_USER_MESSAGE
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

  if (!brain) {
    reply(allow());
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
