# Savyre Cursor plugin (generic stage guard)

Generic enforcement runtime for an **active Savyre stage**. It does not contain Savyre stage prompts, scoring, or accept/reject logic.

This repo is **only** the Cursor plugin. The VS Code/Cursor **extension** (panel, `prompts/stages/`) lives in `savyre-extension`.

Stage 1 Chat mode (`/savyre-start`) can lock Cursor to write only `savyre/stages/01-task-input/input.md`. Stages 2–3 Chat write that stage's `ai-output.md` (analysis / discovery artifact). Savyre validates and unlocks; Chat cannot advance the stage. Stages 4–5 Chat mode stay read-only. Accept, Generate final, and Validate stay in the extension.

## Layout

```text
savyre-cursor-plugin/
  .cursor-plugin/plugin.json
  commands/savyre-start.md | savyre-run.md | savyre-status.md | savyre-stop.md
  skills/savyre-task-input/SKILL.md                 Stage 1 role (instructions only)
  skills/savyre-requirement-analyst/SKILL.md       Stage 2 draft role
  skills/savyre-requirement-challenge/SKILL.md      Stage 2 critic role (after draft)
  skills/savyre-codebase-discovery/SKILL.md        Stage 3 draft role
  skills/savyre-evidence-grounding/SKILL.md         Stage 3 evidence role (after draft)
  skills/savyre-verification-before-completion/SKILL.md  Pre-lock check (after second pass)
  skills/savyre-impact-analyst/SKILL.md            Stage 4 role (instructions only)
  skills/savyre-plan-generation-and-review/SKILL.md Stage 5 role (instructions only)
  skills/savyre-implementation/SKILL.md            Stage 6 role (instructions only)
  skills/savyre-run-stage/SKILL.md                 Generic runner (pick role skill)
  hooks/hooks.json
  hooks/savyre-guard.mjs
  schemas/execution-manifest.schema.json
  fixtures/task-input.manifest.json                Stage 1 slip (read_write, input.md only)
  fixtures/requirement-analysis.manifest.json      Stage 2 slip (ai-output.md + challenge-findings.json)
  fixtures/codebase-discovery.manifest.json        Stage 3 slip (ai-output.md + evidence-map.json)
  fixtures/impact-analysis.manifest.json           Stage 4 slip (read_only)
  fixtures/plan-generation.manifest.json           Stage 5 slip (read_only)
  fixtures/implementation.manifest.json            Stage 6 slip (read_write)
  fixtures/test-hmac.key
```

Skills are **short role instructions**. Stage textbooks stay in the extension (`prompts/stages/*.md`). Do not copy those prompts into this plugin.

## Install locally (copy, do not junction, do not Add-from-local)

```powershell
Remove-Item "$env:USERPROFILE\.cursor\plugins\local\savyre-cursor-plugin" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "C:\Users\Ashish\Documents\Projects\savyre-cursor-plugin" "$env:USERPROFILE\.cursor\plugins\local\savyre-cursor-plugin" -Recurse
```

If **savyre-plugin-demo** is still listed in Customize, **Uninstall** it, then **Developer: Reload Window**.

## Live test

From a project workspace (not only the plugin folder):

```powershell
node "$env:USERPROFILE\.cursor\plugins\local\savyre-cursor-plugin\hooks\savyre-guard.mjs" status
node "$env:USERPROFILE\.cursor\plugins\local\savyre-cursor-plugin\hooks\savyre-guard.mjs" start
node "$env:USERPROFILE\.cursor\plugins\local\savyre-cursor-plugin\hooks\savyre-guard.mjs" run
node "$env:USERPROFILE\.cursor\plugins\local\savyre-cursor-plugin\hooks\savyre-guard.mjs" status
```

`start` reads `.savyre/stage-status.json` `currentStageId`. No session → `mode: idle` (does not invent a workflow). Stages 01–06 enforce the matching slip. Stages 07–15 return idle with a message and do not lock.

Stage 3–6 (same lock; Stages 2–5 are read-only; Stage 6 writes application files):

```powershell
node "$env:USERPROFILE\.cursor\plugins\local\savyre-cursor-plugin\hooks\savyre-guard.mjs" run 03-codebase-discovery
node "$env:USERPROFILE\.cursor\plugins\local\savyre-cursor-plugin\hooks\savyre-guard.mjs" run 04-impact-analysis
node "$env:USERPROFILE\.cursor\plugins\local\savyre-cursor-plugin\hooks\savyre-guard.mjs" run 05-plan-generation-and-review
node "$env:USERPROFILE\.cursor\plugins\local\savyre-cursor-plugin\hooks\savyre-guard.mjs" run 06-implementation
node "$env:USERPROFILE\.cursor\plugins\local\savyre-cursor-plugin\hooks\savyre-guard.mjs" status
```

Then in Agent chat:

1. Idle (before `run`, or after `stop`): `echo hello` works.
2. After `run` (default): Enforced, stage `02-requirement-analysis`. Reads limited to `savyre/stages/**`. Writes allowed on that stage's `ai-output.md` and `challenge-findings.json`.
3. After `run 03-…`: Enforced. Reads may include application source. Writes allowed on Stage 03 `ai-output.md` and `evidence-map.json`.
4. After `run 04-…` or `05-plan-generation-and-review`: Enforced, read-only. Writes blocked.
5. After `run 06-implementation`: Enforced, `writeMode` `read_write`. Write/StrReplace allowed on application files. Shell, Task, and Delete still blocked.
6. On Stages 4–5, `echo hello` and source edits are **blocked** (read-only slip). On Stages 2–3, Chat writes `ai-output.md`; the panel still Validates.
7. `/savyre-stop` or the `stop` CLI then idle; shell works again.

**Chat inject (experiment):** while enforced, a **new Agent chat** (`sessionStart`) injects stage context. Stage 01 does **not** dump official-assignment `input.md`; it tells the agent to ask what to build and wait. Stages 02–06 inject the **previous stage `final.md`** (Stage 02 → Stage 01 `final.md`). Missing current-stage `input.md` is expected. Stages 02–03 tell the agent to write `ai-output.md`; Savyre validates. Stages 04–05 stay panel-run. If the agent stops before Stage 01 has a real Assigned task, `stop` sends **one** follow-up. Accept still happens in the Savyre extension. Caps at `loop_limit` 2.

Lifecycle CLI (`run` / `start` / `status` / `stop`) is allowlisted while enforced so you can turn the lock off.

User-level hooks also live at `%USERPROFILE%\.cursor\hooks.json` and call this same guard. That is required so Agent shell is blocked even when the plugin process cwd is not the project folder.

The Savyre extension turns this lock on and off when the developer clicks **Run stage AI** for Task Input, Requirement Analysis, Codebase Discovery, Impact Analysis, Plan Generation and Review, and Implementation. `/savyre-start` binds the current Agent chat to the panel's current stage (01–06). Accept / Validate stay in the panel.

## Out of scope in this round

Savyre server signing and MCP current-stage instructions.
