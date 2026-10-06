/**
 * Install candidate bundle FROM org run-config INTO this Cursor plugin.
 * Direction: org → plugin only. Never copy this plugin's bundles back into org
 * (that overwrite loop makes org files "come back" after commit).
 *
 * Prefer: npm run publish:bundle  (from packages/savyre-run-config)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pluginRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(
  pluginRoot,
  process.env.SAVYRE_RUN_CONFIG_SRC ?? '../savyre-ai-eng-org/packages/savyre-run-config'
);
const sourceBundle = path.join(sourceRoot, 'bundles', 'bundle_candidate_1');
const destBundle = path.join(pluginRoot, 'bundles', 'bundle_candidate_1');

function copyDir(src, dest) {
  const orgBundles = path.resolve(sourceRoot, 'bundles');
  if (path.resolve(dest) === orgBundles || path.resolve(dest).startsWith(orgBundles + path.sep)) {
    throw new Error(`Refusing to write into org source bundle: ${dest}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(path.join(sourceBundle, 'bundle-manifest.json'))) {
  throw new Error(`Missing source candidate bundle at ${sourceBundle}`);
}

if (fs.existsSync(destBundle)) {
  fs.rmSync(destBundle, { recursive: true, force: true });
}
copyDir(sourceBundle, destBundle);

const runConfig = await import(
  pathToFileURL(path.join(sourceRoot, 'dist', 'index.js')).href
);
const resources = runConfig.resolveBundleResources(pluginRoot);
const identities = runConfig.identitiesMatchApprovedContracts(
  runConfig.loadCandidateBundle(pluginRoot)
);
if (!resources.ok || !identities.ok) {
  console.error(JSON.stringify({ resources, identities }, null, 2));
  throw new Error('Installed candidate bundle failed validation.');
}

const installRecord = {
  schemaVersion: '1.0.0',
  bundleRef: 'bundle_candidate_1',
  installedAt: new Date().toISOString(),
  sourceRoot,
  skillsRewritten: false,
  resourceOk: resources.ok,
  identitiesOk: identities.ok
};
fs.writeFileSync(
  path.join(destBundle, 'INSTALL.json'),
  `${JSON.stringify(installRecord, null, 2)}\n`,
  'utf8'
);

console.log(`Installed candidate bundle to ${destBundle}`);
console.log(`Validated ${runConfig.loadCandidateBundle(pluginRoot).entries.length} skill packages.`);
