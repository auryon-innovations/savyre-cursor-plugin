/**
 * Persist Cursor Agent Chat stop-hook token usage onto stage metadata.
 * Parsing matches @savyre/run-config chatHookUsage (input_tokens already includes cache).
 */
import fs from 'fs/promises';
import path from 'path';

export const CHAT_AI_TOOL = 'cursor-chat';
const LEDGER_REL = path.join('.savyre', 'chat-token-usage.jsonl');
const STATE_REL = path.join('.savyre', 'chat-usage-state.json');

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function str(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function usageBags(input) {
  const bags = [input];
  for (const key of ['usage', 'token_usage', 'tokenUsage']) {
    const nested = input[key];
    if (nested && typeof nested === 'object') bags.push(nested);
  }
  return bags;
}

export function parseChatHookUsage(input) {
  if (!input || typeof input !== 'object') return null;
  const bags = usageBags(input);
  let prompt = null;
  let completion = null;
  let cacheRead = null;
  let cacheWrite = null;
  let model = null;
  let generationId = null;
  for (const bag of bags) {
    if (prompt == null) prompt = num(bag.input_tokens ?? bag.inputTokens);
    if (completion == null) completion = num(bag.output_tokens ?? bag.outputTokens);
    if (cacheRead == null) cacheRead = num(bag.cache_read_tokens ?? bag.cacheReadTokens);
    if (cacheWrite == null) cacheWrite = num(bag.cache_write_tokens ?? bag.cacheWriteTokens);
    if (!model) model = str(bag.model) || str(bag.model_id) || str(bag.modelId);
    if (!generationId) generationId = str(bag.generation_id) || str(bag.generationId);
  }
  if (prompt == null && completion == null) return null;
  const prompt_tokens = prompt ?? 0;
  const completion_tokens = completion ?? 0;
  const total_tokens = prompt_tokens + completion_tokens;
  if (total_tokens <= 0) return null;
  return {
    prompt_tokens,
    completion_tokens,
    total_tokens,
    model,
    generationId,
    cache_read_tokens: cacheRead,
    cache_write_tokens: cacheWrite
  };
}

export function mergeChatAiUsage(current, parsed, seenGenerationIds = []) {
  if (parsed.generationId && seenGenerationIds.includes(parsed.generationId)) {
    return { skip: true, reason: 'duplicate-generation' };
  }
  const nextPrompt = (Number(current?.prompt_tokens) || 0) + parsed.prompt_tokens;
  const nextCompletion = (Number(current?.completion_tokens) || 0) + parsed.completion_tokens;
  const generationIds = parsed.generationId
    ? [...seenGenerationIds, parsed.generationId].slice(-200)
    : seenGenerationIds;
  return {
    skip: false,
    generationIds,
    ai_usage: {
      tool: CHAT_AI_TOOL,
      model: parsed.model || current?.model || null,
      prompt_tokens: nextPrompt,
      completion_tokens: nextCompletion,
      total_tokens: nextPrompt + nextCompletion,
      usage_source: 'provider',
      ai_calls: (Number(current?.ai_calls) || 0) + 1
    }
  };
}

async function readJson(abs, fallback) {
  try {
    return JSON.parse(await fs.readFile(abs, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function persistChatHookUsage({
  workspace,
  stageId,
  executionId,
  hookInput,
  parse,
  merge
}) {
  if (!workspace || !stageId) return { recorded: false, reason: 'no-stage' };
  const parseFn = typeof parse === 'function' ? parse : parseChatHookUsage;
  const mergeFn = typeof merge === 'function' ? merge : mergeChatAiUsage;
  const parsed = parseFn(hookInput);
  if (!parsed) return { recorded: false, reason: 'no-usage' };

  const stateAbs = path.join(workspace, STATE_REL);
  const state = await readJson(stateAbs, { generationIds: [] });
  const seen = Array.isArray(state.generationIds) ? state.generationIds : [];
  const metaAbs = path.join(workspace, 'savyre', 'stages', stageId, 'metadata.json');
  const doc = await readJson(metaAbs, {});
  const merged = mergeFn(doc.ai_usage || {}, parsed, seen);
  if (merged.skip) return { recorded: false, reason: merged.reason };

  doc.ai_usage = merged.ai_usage;
  doc.updated_at = new Date().toISOString();
  await fs.mkdir(path.dirname(metaAbs), { recursive: true });
  await fs.writeFile(metaAbs, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

  await fs.mkdir(path.join(workspace, '.savyre'), { recursive: true });
  await fs.appendFile(
    path.join(workspace, LEDGER_REL),
    `${JSON.stringify({
      ts: new Date().toISOString(),
      stageId,
      executionId: executionId || null,
      prompt_tokens: parsed.prompt_tokens,
      completion_tokens: parsed.completion_tokens,
      total_tokens: parsed.total_tokens,
      model: parsed.model,
      generation_id: parsed.generationId,
      cache_read_tokens: parsed.cache_read_tokens,
      cache_write_tokens: parsed.cache_write_tokens
    })}\n`,
    'utf8'
  );
  await fs.writeFile(
    stateAbs,
    `${JSON.stringify({ generationIds: merged.generationIds }, null, 2)}\n`,
    'utf8'
  );
  return { recorded: true, ai_usage: merged.ai_usage };
}
