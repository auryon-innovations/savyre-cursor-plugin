import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pluginRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const runConfigCandidates = [
  process.env.SAVYRE_RUN_CONFIG_PATH,
  path.join(pluginRoot, '..', 'savyre-ai-eng-org', 'packages', 'savyre-run-config', 'dist', 'index.js'),
  path.join(pluginRoot, '..', 'savyre-extension', 'run-config', 'dist', 'index.js')
].filter(Boolean);

let runConfig = null;
for (const candidate of runConfigCandidates) {
  const abs = candidate.endsWith('index.js') ? candidate : path.join(candidate, 'dist', 'index.js');
  if (!fs.existsSync(abs)) continue;
  runConfig = await import(pathToFileURL(abs).href);
  break;
}
if (!runConfig?.buildPluginSkillRegistry) {
  throw new Error('Could not load buildPluginSkillRegistry from @savyre/run-config');
}

const registry = runConfig.buildPluginSkillRegistry(pluginRoot);
const out = {
  schemaVersion: runConfig.PLUGIN_SKILL_REGISTRY_VERSION || '1.0.0',
  pluginRoot,
  generatedAt: new Date().toISOString(),
  skills: registry
};
const rel = path.join('fixtures', 'skill-registry.json');
fs.writeFileSync(path.join(pluginRoot, rel), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(`Wrote ${rel} (${registry.filter((s) => s.present).length}/${registry.length} skills present)`);
