/** Lifecycle shell allowlist helpers for savyre-guard. */

import { existsSync, realpathSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

export const LIFECYCLE_VERBS =
  'run|start|status|stop|turn|confirm|next|answer|action|reset-stage|reset-workflow|setup-tests';

const LIFECYCLE_VERB_SET = new Set(LIFECYCLE_VERBS.split('|'));

const THIS_PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Expand Windows-style env tokens used in lifecycle docs.
 * `$env:VAR` is normalized to `%VAR%` before expansion.
 */
export function expandLifecycleEnvPath(raw) {
  let p = String(raw || '').trim();
  if (!p) return '';
  p = p.replace(/\$env:([A-Za-z_][A-Za-z0-9_]*)/gi, '%$1%');
  p = p.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (_, name) => {
    const v = process.env[name];
    return typeof v === 'string' && v ? v : `%${name}%`;
  });
  return p;
}

function tryRealpath(abs) {
  try {
    if (!existsSync(abs)) return null;
    return realpathSync(abs);
  } catch {
    return null;
  }
}

function normFile(p) {
  return path.resolve(String(p || '')).replace(/\\/g, '/').toLowerCase();
}

/**
 * Installed guard/CLI scripts that may receive shell permission during enforced stages.
 */
export function trustedLifecycleScriptPaths(opts = {}) {
  const pluginRoot = path.resolve(String(opts.pluginRoot || THIS_PLUGIN_ROOT));
  const home = os.homedir();
  const candidates = [
    path.join(pluginRoot, 'hooks', 'savyre-guard.mjs'),
    path.join(pluginRoot, 'hooks', 'savyre-cli.mjs'),
    path.join(home, '.cursor', 'plugins', 'local', 'savyre-cursor-plugin', 'hooks', 'savyre-guard.mjs'),
    path.join(home, '.cursor', 'plugins', 'local', 'savyre-cursor-plugin', 'hooks', 'savyre-cli.mjs')
  ];
  const out = [];
  const seen = new Set();
  for (const c of candidates) {
    const real = tryRealpath(c) || (existsSync(c) ? path.resolve(c) : null);
    if (!real) continue;
    const key = normFile(real);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(real);
  }
  return out;
}

/**
 * Resolve the script path token from a lifecycle command to a realpath when possible.
 */
export function resolveLifecycleScriptPath(scriptToken, opts = {}) {
  const cwd = path.resolve(String(opts.cwd || process.cwd()));
  const pluginRoot = path.resolve(String(opts.pluginRoot || THIS_PLUGIN_ROOT));
  let raw = expandLifecycleEnvPath(String(scriptToken || '').replace(/^["']|["']$/g, ''));
  if (!raw) return null;
  raw = raw.replace(/\\/g, '/');
  const base = path.basename(raw).toLowerCase();
  if (base !== 'savyre-guard.mjs' && base !== 'savyre-cli.mjs') return null;

  const attempts = [];
  if (path.isAbsolute(raw) || /^[A-Za-z]:\//.test(raw)) {
    attempts.push(path.resolve(raw));
  } else {
    attempts.push(path.resolve(cwd, raw));
    attempts.push(path.resolve(pluginRoot, raw));
    attempts.push(path.resolve(pluginRoot, 'hooks', base));
  }

  for (const abs of attempts) {
    const real = tryRealpath(abs);
    if (real) return real;
  }
  // Path does not exist — still return normalized absolute for deny comparison.
  return attempts[0] ? path.resolve(attempts[0]) : null;
}

function extractLifecycleMatch(command) {
  const compact = String(command || '').replace(/\s+/g, ' ').trim();
  if (!compact) return null;

  let body = compact
    .replace(/\\/g, '/')
    .replace(/\$env:([A-Za-z_][A-Za-z0-9_]*)/gi, '%$1%');
  body = body.replace(/^cd\s+(?:\.{1,2}\/)?[\w./%-]+\s+&&\s+/i, '');

  if (/[`$()]/.test(body.replace(/%[A-Za-z_][A-Za-z0-9_]*%/g, ''))) return null;
  if (/[|&;<>]/.test(body)) return null;

  const m = body.match(
    /^(?:(?:node|nodejs)\s+)?(?:["']?)([^\s"']*savyre-(?:guard|cli)\.mjs)(?:["']?)\s+["']?([A-Za-z0-9_-]+)["']?(?:\s+(.*))?$/i
  );
  if (!m) return null;
  const verb = String(m[2] || '').toLowerCase();
  if (!LIFECYCLE_VERB_SET.has(verb)) return null;
  const rest = String(m[3] || '').trim();
  if (rest) {
    if (/[|&;<>`$()]/.test(rest.replace(/%[A-Za-z_][A-Za-z0-9_]*%/g, ''))) return null;
    if (
      /\b(?:node|nodejs|npm|npx|pnpm|yarn|bun|deno|python3?|py|bash|sh|zsh|cmd|powershell|pwsh|echo|curl|wget)\b/i.test(
        rest
      )
    ) {
      return null;
    }
    if (/\.(?:mjs|cjs|js|ts|exe|bat|cmd|ps1)\b/i.test(rest)) return null;
  }
  return { scriptToken: m[1], verb, rest, body };
}

/**
 * Allow only one clean lifecycle invocation of a *trusted installed* guard/CLI.
 * Reject chained shells, pipelines, redirects, substitutions, extra executables,
 * and same-name scripts outside the installed plugin roots (H3-1).
 *
 * @param {string} command
 * @param {{ pluginRoot?: string, cwd?: string, trustedScripts?: string[] }} [opts]
 */
export function isLifecycleCommand(command, opts = {}) {
  const matched = extractLifecycleMatch(command);
  if (!matched) return false;

  const trusted = (opts.trustedScripts && opts.trustedScripts.length
    ? opts.trustedScripts
    : trustedLifecycleScriptPaths(opts)
  ).map((p) => normFile(p));

  if (!trusted.length) return false;

  const resolved = resolveLifecycleScriptPath(matched.scriptToken, opts);
  if (!resolved) return false;
  const key = normFile(resolved);
  return trusted.includes(key);
}
