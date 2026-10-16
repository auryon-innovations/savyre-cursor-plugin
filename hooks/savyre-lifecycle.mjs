/** Lifecycle shell allowlist helpers for savyre-guard. */

export const LIFECYCLE_VERBS =
  'run|start|status|stop|turn|confirm|next|answer|action|reset-stage|reset-workflow';

const LIFECYCLE_VERB_SET = new Set(LIFECYCLE_VERBS.split('|'));

/**
 * Allow only one clean lifecycle invocation (guard/cli + one permitted verb).
 * Reject chained shells, pipelines, redirects, substitutions, and extra executables.
 * Windows docs use `$env:USERPROFILE` / `%USERPROFILE%` in the path — those are allowed.
 */
export function isLifecycleCommand(command) {
  const compact = String(command || '').replace(/\s+/g, ' ').trim();
  if (!compact) return false;

  // Normalize Windows env path forms so `$` in `$env:VAR` is not treated as substitution.
  let body = compact
    .replace(/\\/g, '/')
    .replace(/\$env:([A-Za-z_][A-Za-z0-9_]*)/gi, '%$1%');
  body = body.replace(/^cd\s+(?:\.{1,2}\/)?[\w./%-]+\s+&&\s+/i, '');

  // After env normalization, still reject command substitution / chaining.
  if (/[`$()]/.test(body.replace(/%[A-Za-z_][A-Za-z0-9_]*%/g, ''))) return false;
  if (/[|&;<>]/.test(body)) return false;

  const m = body.match(
    /^(?:(?:node|nodejs)\s+)?(?:["']?)([^\s"']*\/)?savyre-(?:guard|cli)\.mjs(?:["']?)\s+["']?([A-Za-z0-9_-]+)["']?(?:\s+(.*))?$/i
  );
  if (!m) return false;
  const verb = String(m[2] || '').toLowerCase();
  if (!LIFECYCLE_VERB_SET.has(verb)) return false;
  const rest = String(m[3] || '').trim();
  if (!rest) return true;
  if (/[|&;<>`$()]/.test(rest.replace(/%[A-Za-z_][A-Za-z0-9_]*%/g, ''))) return false;
  if (
    /\b(?:node|nodejs|npm|npx|pnpm|yarn|bun|deno|python3?|py|bash|sh|zsh|cmd|powershell|pwsh|echo|curl|wget)\b/i.test(
      rest
    )
  ) {
    return false;
  }
  if (/\.(?:mjs|cjs|js|ts|exe|bat|cmd|ps1)\b/i.test(rest)) return false;
  return true;
}
