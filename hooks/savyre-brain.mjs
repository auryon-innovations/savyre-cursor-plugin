/**
 * Load the Savyre Chat brain from @savyre/run-config.
 * The open plugin does not contain canned Chat copy. A plugin clone
 * without the Savyre extension/org package cannot serve Chat userMessage.
 */
import { existsSync, readdirSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const BRAIN_MISSING_USER_MESSAGE = 'Savyre is not available here. Use the Savyre panel.';

const FALLBACK_REQUIRED_EXPORTS = [
  'chatUserMessage',
  'chatStartUserMessage',
  'deriveChatTurnState',
  'stageTitle',
  'buildStage01IntakeReview',
  'CHAT_PRIMARY_SKILL_ID',
  'CHAT_SPECIALIZED_SKILL_ID',
  'CHAT_SPECIALIZED_STATES',
  'CHAT_VERIFY_SKILL_ID',
  'RUN_CONFIG_VERSION'
];

function indexAt(root) {
  return path.join(root, 'dist', 'index.js');
}

function resolveIndexPath(root) {
  if (root.endsWith(`${path.sep}index.js`) || root.endsWith('/index.js')) return root;
  if (existsSync(path.join(root, 'index.js'))) return path.join(root, 'index.js');
  return indexAt(root);
}

function runConfigRoots() {
  const home = os.homedir();
  const env = typeof process.env.SAVYRE_RUN_CONFIG_PATH === 'string'
    ? process.env.SAVYRE_RUN_CONFIG_PATH.trim()
    : '';
  const roots = [];
  if (env) roots.push(env);
  roots.push(
    path.join(PLUGIN_ROOT, '..', 'savyre-extension', 'run-config'),
    path.join(PLUGIN_ROOT, '..', 'savyre-extension', 'vendor', '@savyre', 'run-config'),
    path.join(PLUGIN_ROOT, '..', 'savyre-ai-eng-org', 'packages', 'savyre-run-config'),
    path.join(home, 'Documents', 'Projects', 'savyre-extension', 'run-config'),
    path.join(home, 'Documents', 'Projects', 'savyre-ai-eng-org', 'packages', 'savyre-run-config')
  );
  for (const extRoot of [
    path.join(home, '.cursor', 'extensions'),
    path.join(home, '.vscode', 'extensions')
  ]) {
    if (!existsSync(extRoot)) continue;
    for (const name of readdirSync(extRoot)) {
      if (!/savyre/i.test(name)) continue;
      roots.push(path.join(extRoot, name, 'run-config'));
    }
  }
  return roots;
}

function exportPresent(mod, name) {
  if (!(name in mod)) return false;
  const value = mod[name];
  if (typeof value === 'function') return true;
  if (name.startsWith('CHAT_') || name === 'RUN_CONFIG_VERSION') {
    return value !== undefined && value !== null;
  }
  return typeof value === 'function';
}

function validateBrainModule(mod) {
  if (typeof mod?.validatePluginBrainModule === 'function') {
    return mod.validatePluginBrainModule(mod);
  }
  const missing = FALLBACK_REQUIRED_EXPORTS.filter((name) => !exportPresent(mod, name));
  return {
    ok: missing.length === 0,
    capabilityVersion: '1.0.0',
    missing,
    runConfigVersion: typeof mod?.RUN_CONFIG_VERSION === 'string' ? mod.RUN_CONFIG_VERSION : undefined
  };
}

export function enumerateBrainCandidates() {
  const seen = new Set();
  const candidates = [];
  for (const root of runConfigRoots()) {
    const indexPath = resolveIndexPath(root);
    const key = indexPath.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      root,
      indexPath,
      exists: existsSync(indexPath)
    });
  }
  return candidates;
}

export async function inspectBrainCandidate(candidate) {
  if (!candidate.exists) {
    return {
      ...candidate,
      status: 'missing',
      ok: false,
      missing: [],
      error: 'index.js not found'
    };
  }
  try {
    const mod = await import(`${pathToFileURL(candidate.indexPath).href}?t=${Date.now()}`);
    const validation = validateBrainModule(mod);
    return {
      ...candidate,
      status: validation.ok ? 'compatible' : 'incompatible',
      ok: validation.ok,
      missing: validation.missing,
      capabilityVersion: validation.capabilityVersion,
      runConfigVersion: validation.runConfigVersion
    };
  } catch (error) {
    return {
      ...candidate,
      status: 'load_error',
      ok: false,
      missing: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function resolveSavyreBrainCandidates() {
  const listed = enumerateBrainCandidates();
  const inspected = [];
  for (const candidate of listed) {
    inspected.push(await inspectBrainCandidate(candidate));
  }
  return inspected;
}

export function resolveSavyreBrainIndex(candidates = null) {
  const list = candidates || enumerateBrainCandidates();
  for (const candidate of list) {
    if (candidate.exists) return candidate.indexPath;
  }
  return null;
}

let cached = null;
let cachedReport = null;

export async function buildSavyreRuntimeReport() {
  const candidates = await resolveSavyreBrainCandidates();
  const selected = candidates.find((c) => c.ok) || null;
  return {
    ok: Boolean(selected),
    capabilityVersion: selected?.capabilityVersion || '1.0.0',
    runConfigVersion: selected?.runConfigVersion || null,
    selected: selected
      ? {
          indexPath: selected.indexPath,
          root: selected.root,
          runConfigVersion: selected.runConfigVersion || null
        }
      : null,
    candidates: candidates.map((c) => ({
      root: c.root,
      indexPath: c.indexPath,
      status: c.status,
      ok: c.ok,
      missing: c.missing || [],
      runConfigVersion: c.runConfigVersion || null,
      error: c.error || null
    }))
  };
}

export async function loadSavyreBrain() {
  if (cached) return cached;
  const report = await buildSavyreRuntimeReport();
  cachedReport = report;
  if (!report.selected) return null;
  try {
    const mod = await import(pathToFileURL(report.selected.indexPath).href);
    const validation = validateBrainModule(mod);
    if (!validation.ok) return null;
    cached = mod;
    return cached;
  } catch {
    return null;
  }
}

export function getSavyreRuntimeReport() {
  return cachedReport;
}

export function resetSavyreBrainCache() {
  cached = null;
  cachedReport = null;
}
