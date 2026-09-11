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

function indexAt(root) {
  return path.join(root, 'dist', 'index.js');
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

export function resolveSavyreBrainIndex() {
  for (const root of runConfigRoots()) {
    const abs = root.endsWith(`${path.sep}index.js`) || root.endsWith('/index.js')
      ? root
      : existsSync(path.join(root, 'index.js'))
        ? path.join(root, 'index.js')
        : indexAt(root);
    if (existsSync(abs)) return abs;
  }
  return null;
}

let cached = null;

export async function loadSavyreBrain() {
  if (cached) return cached;
  const abs = resolveSavyreBrainIndex();
  if (!abs) return null;
  try {
    const mod = await import(pathToFileURL(abs).href);
    if (typeof mod.chatUserMessage !== 'function') return null;
    cached = mod;
    return cached;
  } catch {
    return null;
  }
}

export function resetSavyreBrainCache() {
  cached = null;
}
