# Assistant Preferences Shared Portable Repo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `assistant-preferences` into a portable shared git repository with tracked `minimal` and `personal` profiles, one untracked local machine file, optional `Codex`/`Claude` support, and a stable runtime path at `~/.assistant-preferences`.

**Architecture:** Keep the real repository in any user-chosen checkout location and use bootstrap to symlink `~/.assistant-preferences` to it. Build the effective config by merging tracked `preferences.json`, one tracked profile from `profiles/`, and one untracked `preferences.local.json`, with later layers replacing earlier entries by `id`.

**Tech Stack:** Git, Node.js built-in modules, zsh shell scripts, JSON, Markdown

---

## Scope Notes

- This plan covers implementation only, not execution in this session.
- It supersedes the earlier repo-migration draft that assumed a single tracked `preferences.json` plus local overlay.
- This plan assumes the approved design in [2026-04-01-assistant-preferences-shared-portable-design.md](/Users/vu/.assistant-preferences/local-docs/assistant-preferences/specs/2026-04-01-assistant-preferences-shared-portable-design.md).

## Target File Structure

```text
/path/to/assistant-preferences/
├── .gitignore
├── preferences.json
├── preferences.local.example.json
├── profiles/
│   ├── minimal.json
│   └── personal.json
├── README.md
├── scripts/
│   ├── bootstrap-machine.sh
│   ├── link-skills.sh
│   ├── memorize-preference.mjs
│   ├── render-preferences.mjs
│   ├── seed-from-existing-instructions.mjs
│   └── lib/
│       └── project-paths.mjs
├── skills/
│   └── personal-preferences/
│       └── SKILL.md
└── tests/
    ├── helpers/
    │   └── test-paths.mjs
    ├── memorize-preference.test.mjs
    ├── preferences-schema.test.mjs
    ├── render-preferences.test.mjs
    └── seed-from-existing-instructions.test.mjs
```

### Task 1: Introduce Shared Profiles And Local File Schema

**Files:**
- Create: `profiles/minimal.json`
- Create: `profiles/personal.json`
- Create: `preferences.local.example.json`
- Modify: `.gitignore`
- Test: `tests/preferences-schema.test.mjs`

- [ ] **Step 1: Create the profiles directory and add the minimal profile**

Create `profiles/minimal.json`:

```json
{
  "preferences": {
    "hard": [
      {
        "id": "do-not-hallucinate",
        "category": "safety",
        "scope": "global",
        "rule": "When in doubt or not sure about the solution, do not hallucinate. Ask the user for guidance, recommendations, or a suggested approach.",
        "source": "shared-profile",
        "createdAt": "2026-04-01T00:00:00.000Z"
      }
    ],
    "conditional": [],
    "repeatableActions": [],
    "conflictResolutions": []
  }
}
```

- [ ] **Step 2: Create the richer personal profile from the current non-Favro preferences**

Create `profiles/personal.json` with these initial tracked entries from the current non-Favro setup:

```json
{
  "preferences": {
    "hard": [
      {
        "id": "describe-approach-before-coding",
        "category": "workflow",
        "scope": "global",
        "rule": "Before writing any code, describe your approach and wait for approval.",
        "source": "shared-profile",
        "createdAt": "2026-04-01T00:00:00.000Z"
      },
      {
        "id": "ask-clarifying-questions",
        "category": "workflow",
        "scope": "global",
        "rule": "If the requirements are ambiguous, ask clarifying questions before starting implementation.",
        "source": "shared-profile",
        "createdAt": "2026-04-01T00:00:00.000Z"
      },
      {
        "id": "list-edge-cases-after-code",
        "category": "workflow",
        "scope": "global",
        "rule": "After finishing code changes, list the edge cases and suggest test cases to cover them.",
        "source": "shared-profile",
        "createdAt": "2026-04-01T00:00:00.000Z"
      },
      {
        "id": "break-large-tasks",
        "category": "workflow",
        "scope": "global",
        "rule": "If a task requires changes to more than 3 files, stop and break it into smaller tasks first.",
        "source": "shared-profile",
        "createdAt": "2026-04-01T00:00:00.000Z"
      },
      {
        "id": "reproduce-bug-with-test",
        "category": "debugging",
        "scope": "global",
        "rule": "When there is a bug, start by writing a test that reproduces it, then fix it until the test passes.",
        "source": "shared-profile",
        "createdAt": "2026-04-01T00:00:00.000Z"
      },
      {
        "id": "reflect-on-corrections",
        "category": "learning",
        "scope": "global",
        "rule": "Every time the user corrects you, reflect on what you did wrong and come up with a plan to never make the same mistake again.",
        "source": "shared-profile",
        "createdAt": "2026-04-01T00:00:00.000Z"
      },
      {
        "id": "do-not-hallucinate",
        "category": "safety",
        "scope": "global",
        "rule": "When in doubt or not sure about the solution, do not hallucinate. Ask the user for guidance, recommendations, or a suggested approach.",
        "source": "shared-profile",
        "createdAt": "2026-04-01T00:00:00.000Z"
      },
      {
        "id": "prefer-tdd",
        "category": "workflow",
        "scope": "global",
        "rule": "Test-driven development workflow must always be preferred when developing a new feature.",
        "source": "shared-profile",
        "createdAt": "2026-04-01T00:00:00.000Z"
      }
    ],
    "conditional": [
      {
        "id": "extract-repeated-review-code",
        "category": "code_review",
        "scope": "global",
        "appliesWhen": [
          "manual_review_of_agent_generated_code"
        ],
        "rule": "Repeated code should be broken out to a common helper when it improves readability.",
        "source": "shared-profile",
        "createdAt": "2026-04-01T00:00:00.000Z"
      },
      {
        "id": "refine-tests-with-existing-helpers",
        "category": "testing",
        "scope": "global",
        "appliesWhen": [
          "after-drafting-tests"
        ],
        "rule": "After drafting tests, review whether existing helpers can replace bespoke test code and use them when they make the tests cleaner.",
        "source": "shared-profile",
        "createdAt": "2026-04-01T00:00:00.000Z"
      }
    ],
    "repeatableActions": [],
    "conflictResolutions": []
  }
}
```

Expected result: `personal` holds the reusable non-Favro preferences and `minimal` stays intentionally small.

- [ ] **Step 3: Add the new tracked files without changing the renderer contract yet**

At this stage, do **not** strip the current `preferences.json` yet. Leave the existing runtime behavior intact until profile-aware loading lands in Task 2.

Expected result: after Task 1, the repository contains the new profile files and local-file template, but `render-preferences.mjs` still works exactly as before.

- [ ] **Step 4: Define the local file template and ignore rules**

Create `preferences.local.example.json`:

```json
{
  "selectedProfile": "personal",
  "preferences": {
    "hard": [],
    "conditional": [],
    "repeatableActions": [],
    "conflictResolutions": []
  }
}
```

Update `.gitignore`:

```gitignore
local-docs/
preferences.local.json
.DS_Store
*.log
```

Expected result: local machine state is documented but not tracked, while the old single-file runtime still works until Task 2 lands.

- [ ] **Step 5: Update schema coverage for the new tracked files**

Extend `tests/preferences-schema.test.mjs` to assert:

```js
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

test("shared config files expose the expected top-level structure", function() {
	for (const relativePath of [
		"preferences.json",
		"profiles/minimal.json",
		"profiles/personal.json",
		"preferences.local.example.json",
	]) {
		const data = readJson(relativePath);
		assert.ok(data.preferences);
		assert.ok(Array.isArray(data.preferences.hard));
		assert.ok(Array.isArray(data.preferences.conditional));
		assert.ok(Array.isArray(data.preferences.repeatableActions));
		assert.ok(Array.isArray(data.preferences.conflictResolutions));
	}
});
```

- [ ] **Step 6: Run the schema test and commit**

Run:

```bash
node --test tests/preferences-schema.test.mjs
node --test tests/seed-from-existing-instructions.test.mjs
```

Expected: PASS

Commit:

```bash
git add .gitignore preferences.local.example.json profiles tests/preferences-schema.test.mjs
git commit -m "feat: add shared profiles and local config schema"
```

### Task 2: Add Repo-Relative Path Helpers And Merge Logic

**Files:**
- Create: `scripts/lib/project-paths.mjs`
- Modify: `scripts/render-preferences.mjs`
- Modify: `scripts/memorize-preference.mjs`
- Modify: `scripts/seed-from-existing-instructions.mjs`
- Test: `tests/render-preferences.test.mjs`
- Test: `tests/memorize-preference.test.mjs`
- Test: `tests/seed-from-existing-instructions.test.mjs`

- [ ] **Step 1: Create the shared helper module**

Create `scripts/lib/project-paths.mjs`:

```js
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const preferenceKeys = [
	"hard",
	"conditional",
	"repeatableActions",
	"conflictResolutions",
];

const helperDir = path.dirname(fileURLToPath(import.meta.url));

export function getRepoRoot() {
	const scriptDir = helperDir;
	return path.resolve(scriptDir, "..", "..");
}

export function getHomeDir(explicitHome) {
	return explicitHome || process.env.HOME || os.homedir();
}

export function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function normalizePreferencesBlock(data = {}) {
	const preferences = data.preferences || {};
	return {
		...data,
		preferences: {
			hard: preferences.hard || [],
			conditional: preferences.conditional || [],
			repeatableActions: preferences.repeatableActions || [],
			conflictResolutions: preferences.conflictResolutions || [],
		},
	};
}

function mergeEntriesById(baseEntries, overlayEntries) {
	const merged = new Map();
	for (const entry of baseEntries) merged.set(entry.id, entry);
	for (const entry of overlayEntries) merged.set(entry.id, entry);
	return [...merged.values()];
}

export function mergePreferenceLayers(...layers) {
	const normalizedLayers = layers.map(normalizePreferencesBlock);
	const result = normalizePreferencesBlock({
		...normalizedLayers[0],
		preferences: {
			hard: [...normalizedLayers[0].preferences.hard],
			conditional: [...normalizedLayers[0].preferences.conditional],
			repeatableActions: [...normalizedLayers[0].preferences.repeatableActions],
			conflictResolutions: [...normalizedLayers[0].preferences.conflictResolutions],
		},
	});
	for (const layer of normalizedLayers.slice(1)) {
		for (const key of preferenceKeys) {
			result.preferences[key] = mergeEntriesById(result.preferences[key], layer.preferences[key]);
		}
	}
	return result;
}

export function getTrackedPreferencesPath(repoRoot) {
	return path.join(repoRoot, "preferences.json");
}

export function getProfilePath(repoRoot, profileName) {
	return path.join(repoRoot, "profiles", `${profileName}.json`);
}

export function getLocalPreferencesPath(repoRoot, explicitLocalFile) {
	return explicitLocalFile || path.join(repoRoot, "preferences.local.json");
}

export function loadEffectivePreferences({ repoRoot, localFile }) {
	const base = normalizePreferencesBlock(readJson(getTrackedPreferencesPath(repoRoot)));
	const localPath = getLocalPreferencesPath(repoRoot, localFile);
	const local = fs.existsSync(localPath) ? normalizePreferencesBlock(readJson(localPath)) : normalizePreferencesBlock({
		selectedProfile: "personal",
	});
	const profilePath = getProfilePath(repoRoot, local.selectedProfile || "personal");
	if (!fs.existsSync(profilePath))
		throw new Error(`Unknown selectedProfile: ${local.selectedProfile || "personal"}`);
	const profile = normalizePreferencesBlock(readJson(profilePath));
	return mergePreferenceLayers(base, profile, local);
}
```

- [ ] **Step 2: Refactor the renderer around the helper and switch `preferences.json` to shared-base-only content in the same commit**

In this step, update both the loader and the tracked base file together so there is no commit where the renderer still expects all rules to live in `preferences.json` after that file has been stripped.

Replace `preferences.json` with the shared-base-only content:

```json
{
  "version": 1,
  "policy": {
    "nonOverridable": [
      "system-safety",
      "platform-safety"
    ],
    "defaultScope": "global",
    "defaultBehavior": "apply-personal-preferences-first",
    "contradictionBehavior": "ask-user-before-choosing",
    "contradictionScope": "category-level",
    "memorizationBehavior": "ask-before-persisting",
    "repeatPromptBehavior": "do-not-reask-already-memorized-preferences"
  },
  "preferences": {
    "hard": [],
    "conditional": [
      {
        "id": "apply-personal-preferences-first",
        "category": "priority",
        "scope": "global",
        "appliesWhen": [
          "personal-preference-relevant"
        ],
        "rule": "Apply the user's personal preferences first whenever they are relevant.",
        "source": "shared-base",
        "createdAt": "2026-04-01T00:00:00.000Z"
      },
      {
        "id": "apply-both-when-no-category-level-contradiction",
        "category": "priority",
        "scope": "global",
        "appliesWhen": [
          "personal-preference-relevant",
          "no-contradiction-with-project-plugin-or-skill-rules-in-same-category"
        ],
        "rule": "If another plugin, skill, or project-scoped rule does not contradict the personal preference in the same category, apply both.",
        "source": "shared-base",
        "createdAt": "2026-04-01T00:00:00.000Z"
      },
      {
        "id": "ask-on-category-level-contradiction",
        "category": "conflict_resolution",
        "scope": "global",
        "appliesWhen": [
          "contradiction-between-personal-and-project-plugin-or-skill-rule-in-same-category"
        ],
        "rule": "If a contradiction exists between a personal preference and a plugin, skill, or project-scoped rule in the same category, ask the user which rule should apply before acting unless a matching memorized conflict resolution already exists.",
        "source": "shared-base",
        "createdAt": "2026-04-01T00:00:00.000Z"
      },
      {
        "id": "ask-to-memorize-durable-feedback",
        "category": "memory",
        "scope": "global",
        "appliesWhen": [
          "user-gives-repeatable-correction-or-preference"
        ],
        "rule": "Summarize the feedback as a generalized preference and ask whether to memorize it for future sessions.",
        "source": "shared-base",
        "createdAt": "2026-04-01T00:00:00.000Z"
      },
      {
        "id": "ask-to-memorize-reusable-conflict-resolution",
        "category": "memory",
        "scope": "global",
        "appliesWhen": [
          "user-resolves-contradiction-in-a-reusable-way"
        ],
        "rule": "When the user resolves a contradiction in a reusable way, ask whether to memorize that conflict resolution for future sessions.",
        "source": "shared-base",
        "createdAt": "2026-04-01T00:00:00.000Z"
      }
    ],
    "repeatableActions": [],
    "conflictResolutions": []
  }
}
```

Update `scripts/render-preferences.mjs`:

```js
import { getHomeDir, getRepoRoot, loadEffectivePreferences } from "./lib/project-paths.mjs";

const { values } = parseArgs({
	options: {
		home: { type: "string" },
		"local-file": { type: "string" },
	},
});

const repoRoot = getRepoRoot();
const homeDir = getHomeDir(values.home);
const data = loadEffectivePreferences({
	repoRoot,
	localFile: values["local-file"],
});
```

Replace unconditional writes with target detection:

```js
const targets = [
	{
		name: "codex",
		isInstalled: fs.existsSync(path.join(homeDir, ".codex")),
		targetPath: path.join(homeDir, ".codex", "instructions.md"),
	},
	{
		name: "claude",
		isInstalled: fs.existsSync(path.join(homeDir, ".claude")),
		targetPath: path.join(homeDir, ".claude", "CLAUDE.md"),
	},
].filter(target => target.isInstalled);

for (const target of targets) {
	writeFile(target.targetPath, body);
}

if (targets.length === 0)
	console.log("No supported assistant homes detected. Nothing rendered.");
else
	console.log(`Rendered preferences for: ${targets.map(target => target.name).join(", ")}`);
```

- [ ] **Step 3: Make memorization write to the local file by default**

Update `scripts/memorize-preference.mjs` so the default destination is the local machine file:

```js
import { getLocalPreferencesPath, getRepoRoot } from "./lib/project-paths.mjs";

const repoRoot = getRepoRoot();
const filePath = getLocalPreferencesPath(repoRoot, values.file);

if (!fs.existsSync(filePath)) {
	fs.writeFileSync(filePath, JSON.stringify({
		selectedProfile: "personal",
		preferences: {
			hard: [],
			conditional: [],
			repeatableActions: [],
			conflictResolutions: [],
		},
	}, null, 2) + "\n");
}
```

Keep rerendering afterward:

```js
execFileSync("node", [renderScript, ...renderArgs], { stdio: "inherit" });
```

Expected result: new memorized preferences stay local unless a future workflow intentionally edits tracked profiles.

- [ ] **Step 4: Refactor the seed validator to operate on tracked shared files with explicit post-migration expectations**

Update `scripts/seed-from-existing-instructions.mjs` so it validates:

- `preferences.json`
- `profiles/minimal.json`
- `profiles/personal.json`

Recommended structure:

```js
import path from "node:path";
import { getRepoRoot, readJson, mergePreferenceLayers } from "./lib/project-paths.mjs";

const EXPECTED_PERSONAL_RULE_FRAGMENTS = [
	"Apply the user's personal preferences first whenever they are relevant.",
	"If another plugin, skill, or project-scoped rule does not contradict the personal preference in the same category, apply both.",
	"If a contradiction exists between a personal preference and a plugin, skill, or project-scoped rule in the same category, ask the user which rule should apply before acting unless a matching memorized conflict resolution already exists.",
	"Summarize the feedback as a generalized preference and ask whether to memorize it for future sessions.",
	"When the user resolves a contradiction in a reusable way, ask whether to memorize that conflict resolution for future sessions.",
	"Before writing any code, describe your approach and wait for approval.",
	"If the requirements are ambiguous, ask clarifying questions before starting implementation.",
	"After finishing code changes, list the edge cases and suggest test cases to cover them.",
	"If a task requires changes to more than 3 files, stop and break it into smaller tasks first.",
	"When there is a bug, start by writing a test that reproduces it, then fix it until the test passes.",
	"Every time the user corrects you, reflect on what you did wrong and come up with a plan to never make the same mistake again.",
	"When in doubt or not sure about the solution, do not hallucinate. Ask the user for guidance, recommendations, or a suggested approach.",
	"Test-driven development workflow must always be preferred when developing a new feature.",
	"Repeated code should be broken out to a common helper when it improves readability.",
	"After drafting tests, review whether existing helpers can replace bespoke test code and use them when they make the tests cleaner.",
];

const EXPECTED_MINIMAL_RULE_FRAGMENTS = [
	"When in doubt or not sure about the solution, do not hallucinate. Ask the user for guidance, recommendations, or a suggested approach.",
];

const repoRoot = getRepoRoot();
const personalData = mergePreferenceLayers(
	readJson(path.join(repoRoot, "preferences.json")),
	readJson(path.join(repoRoot, "profiles", "personal.json")),
);
const minimalData = mergePreferenceLayers(
	readJson(path.join(repoRoot, "preferences.json")),
	readJson(path.join(repoRoot, "profiles", "minimal.json")),
);
```

The script should flatten rules from each merged config and assert:

- every `EXPECTED_PERSONAL_RULE_FRAGMENTS` item is present in the merged base + personal config
- every `EXPECTED_MINIMAL_RULE_FRAGMENTS` item is present in the merged base + minimal config
- neither merged config contains `favro-local-generated-docs-root` or `/Users/vu/Development/Favro`

Expected result: seed validation describes the tracked shared setup and does not depend on one machine’s local file.

- [ ] **Step 5: Add merge and detection coverage to the tests**

Update `tests/render-preferences.test.mjs` with these cases:

```js
const testsDir = path.dirname(fileURLToPath(import.meta.url));
const renderScript = path.join(testsDir, "..", "scripts", "render-preferences.mjs");

test("renderer merges base, selected profile, and local overlay", function() {
	const { homeDir } = setup();
	const localFile = path.join(homeDir, "preferences.local.json");
	fs.writeFileSync(localFile, JSON.stringify({
		selectedProfile: "personal",
		preferences: {
			hard: [
				{
					id: "local-hard-rule",
					category: "workflow",
					scope: "global",
					rule: "Local overlay rule.",
					source: "local-machine",
					createdAt: "2026-04-01T00:00:00.000Z"
				}
			],
			conditional: [],
			repeatableActions: [],
			conflictResolutions: []
		}
	}, null, 2));

	execFileSync("node", [
		renderScript,
		"--home", homeDir,
		"--local-file", localFile,
	], { stdio: "pipe", encoding: "utf8" });

	const codex = fs.readFileSync(path.join(homeDir, ".codex", "instructions.md"), "utf8");
	assert.match(codex, /Apply the user's personal preferences first/);
	assert.match(codex, /Before writing any code, describe your approach and wait for approval/);
	assert.match(codex, /Local overlay rule/);
});

test("renderer writes only for detected assistant homes", function() {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-prefs-"));
	const homeDir = path.join(tmpDir, "home");
	fs.mkdirSync(path.join(homeDir, ".codex"), { recursive: true });

	execFileSync("node", [
		renderScript,
		"--home", homeDir,
	], { stdio: "pipe", encoding: "utf8" });

	assert.equal(fs.existsSync(path.join(homeDir, ".codex", "instructions.md")), true);
	assert.equal(fs.existsSync(path.join(homeDir, ".claude", "CLAUDE.md")), false);
});
```

Update `tests/memorize-preference.test.mjs` to assert:

```js
assert.equal(saved.selectedProfile, "personal");
assert.equal(saved.preferences.conditional[0].id, "extract-repeated-review-code");
```

- [ ] **Step 6: Run the script-related tests and commit**

Run:

```bash
node --test tests/render-preferences.test.mjs
node --test tests/memorize-preference.test.mjs
node --test tests/seed-from-existing-instructions.test.mjs
```

Expected: PASS

Commit:

```bash
git add preferences.json scripts tests
git commit -m "refactor: add profile-aware portable preference loading"
```

### Task 3: Make Skill Linking And Bootstrap Portable And Safe

**Files:**
- Create: `scripts/bootstrap-machine.sh`
- Create: `tests/bootstrap-machine.test.mjs`
- Modify: `scripts/link-skills.sh`
- Test: `tests/render-preferences.test.mjs`

- [ ] **Step 1: Update skill linking for optional targets**

Replace `scripts/link-skills.sh` with:

```bash
#!/bin/zsh
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${0:A}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
skill_source="$repo_root/skills/personal-preferences"

if [ -d "$HOME/.codex" ]; then
	# Codex is detected via ~/.codex, but the shared skill is discovered from ~/.agents/skills.
	mkdir -p "$HOME/.agents/skills"
	ln -sfn "$skill_source" "$HOME/.agents/skills/personal-preferences"
fi

if [ -d "$HOME/.claude" ]; then
	mkdir -p "$HOME/.claude/skills"
	ln -sfn "$skill_source" "$HOME/.claude/skills/personal-preferences"
fi
```

Expected result: the script only links for detected targets.

- [ ] **Step 2: Add the bootstrap script**

Create `scripts/bootstrap-machine.sh`:

```bash
#!/bin/zsh
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${0:A}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
runtime_path="$HOME/.assistant-preferences"
example_path="$repo_root/preferences.local.example.json"
local_path="$repo_root/preferences.local.json"

if [ -L "$runtime_path" ]; then
	current_target="$(readlink "$runtime_path")"
	if [ "$current_target" != "$repo_root" ]; then
		echo "Refusing to replace existing ~/.assistant-preferences symlink: $current_target" >&2
		exit 1
	fi
elif [ -e "$runtime_path" ]; then
	echo "Refusing to replace existing non-symlink path: $runtime_path" >&2
	exit 1
else
	ln -s "$repo_root" "$runtime_path"
fi

if [ ! -e "$local_path" ]; then
	cp "$example_path" "$local_path"
fi

"$repo_root/scripts/link-skills.sh"
echo "Bootstrap complete for $repo_root"
```

- [ ] **Step 3: Add a bootstrap-focused verification test**

Create `tests/bootstrap-machine.test.mjs` so it operates on a disposable copy of the repo instead of the real checkout:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, "..");
const sourceRepoRoot = repoRoot;

function copyRepoFixture() {
	const tmpRepoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-repo-copy-"));
	fs.cpSync(sourceRepoRoot, tmpRepoRoot, {
		recursive: true,
		filter: source => {
			const base = path.basename(source);
			return base !== ".git" && base !== "local-docs";
		},
	});
	return tmpRepoRoot;
}

test("bootstrap creates the runtime symlink and local config from the current checkout copy", function() {
	const repoRoot = copyRepoFixture();
	const bootstrapScript = path.join(repoRoot, "scripts", "bootstrap-machine.sh");
	const localPrefsPath = path.join(repoRoot, "preferences.local.json");
	const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-bootstrap-"));
	try {
		fs.mkdirSync(path.join(tmpHome, ".codex"), { recursive: true });
		execFileSync("zsh", [bootstrapScript], {
			env: { ...process.env, HOME: tmpHome },
			stdio: "pipe",
		});
		assert.equal(fs.readlinkSync(path.join(tmpHome, ".assistant-preferences")), repoRoot);
		assert.equal(fs.existsSync(localPrefsPath), true);
		assert.equal(fs.lstatSync(path.join(tmpHome, ".agents", "skills", "personal-preferences")).isSymbolicLink(), true);
	} finally {
		fs.rmSync(tmpHome, { recursive: true, force: true });
		fs.rmSync(repoRoot, { recursive: true, force: true });
	}
});

test("bootstrap does not overwrite an existing local preferences file", function() {
	const repoRoot = copyRepoFixture();
	const bootstrapScript = path.join(repoRoot, "scripts", "bootstrap-machine.sh");
	const localPrefsPath = path.join(repoRoot, "preferences.local.json");
	const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-bootstrap-"));
	const original = JSON.stringify({
		selectedProfile: "minimal",
		preferences: {
			hard: [],
			conditional: [],
			repeatableActions: [],
			conflictResolutions: [],
		},
	}, null, 2) + "\n";

	try {
		fs.writeFileSync(localPrefsPath, original);
		execFileSync("zsh", [bootstrapScript], {
			env: { ...process.env, HOME: tmpHome },
			stdio: "pipe",
		});

		assert.equal(fs.readFileSync(localPrefsPath, "utf8"), original);
	} finally {
		fs.rmSync(tmpHome, { recursive: true, force: true });
		fs.rmSync(repoRoot, { recursive: true, force: true });
	}
});
```

- [ ] **Step 4: Run the bootstrap-relevant tests and commit**

Run:

```bash
node --test tests/render-preferences.test.mjs
node --test tests/bootstrap-machine.test.mjs
```

Expected: PASS

Commit:

```bash
git add scripts tests
git commit -m "feat: add portable bootstrap and target-aware skill linking"
```

### Task 4: Refactor Tests To Be Checkout-Relative

**Files:**
- Create: `tests/helpers/test-paths.mjs`
- Modify: `tests/render-preferences.test.mjs`
- Modify: `tests/memorize-preference.test.mjs`
- Modify: `tests/preferences-schema.test.mjs`
- Modify: `tests/seed-from-existing-instructions.test.mjs`

- [ ] **Step 1: Add the shared test helper**

Create `tests/helpers/test-paths.mjs`:

```js
import path from "node:path";
import { fileURLToPath } from "node:url";

const helpersDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(helpersDir, "..", "..");

export function scriptPath(name) {
	return path.join(repoRoot, "scripts", name);
}

export function repoFilePath(name) {
	return path.join(repoRoot, name);
}
```

- [ ] **Step 2: Replace hard-coded absolute paths in the tests**

Update all test files to replace strings like:

```js
"/Users/vu/.assistant-preferences/scripts/render-preferences.mjs"
"/Users/vu/.assistant-preferences/scripts/memorize-preference.mjs"
"/Users/vu/.assistant-preferences/preferences.json"
```

with:

```js
scriptPath("render-preferences.mjs")
scriptPath("memorize-preference.mjs")
repoFilePath("preferences.json")
```

Expected result: tests pass from any checkout location and any username.

- [ ] **Step 3: Add a regression test for unknown profiles**

Extend `tests/render-preferences.test.mjs`:

```js
test("renderer fails clearly when selectedProfile is missing", function() {
	const { homeDir } = setup();
	const localFile = path.join(homeDir, "preferences.local.json");
	fs.writeFileSync(localFile, JSON.stringify({
		selectedProfile: "missing-profile",
		preferences: {
			hard: [],
			conditional: [],
			repeatableActions: [],
			conflictResolutions: [],
		},
	}, null, 2));

	assert.throws(function() {
		execFileSync("node", [
			scriptPath("render-preferences.mjs"),
			"--home", homeDir,
			"--local-file", localFile,
		], { stdio: "pipe" });
	}, /Unknown selectedProfile/);
});
```

- [ ] **Step 4: Run the full test suite and commit**

Run:

```bash
node --test tests/*.test.mjs
```

Expected: PASS

Commit:

```bash
git add tests
git commit -m "test: make assistant-preferences tests portable"
```

### Task 5: Rewrite Documentation Around The Shared/Local Model

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite the architecture section**

The README should include this repository model:

```md
## Repository Model

- Shared tracked base: `preferences.json`
- Shared tracked profiles: `profiles/minimal.json`, `profiles/personal.json`
- Untracked machine-local file: `preferences.local.json`
- Stable runtime path: `~/.assistant-preferences`
- Real repository location: any user-chosen checkout path
```

- [ ] **Step 2: Add setup instructions**

Add a setup section with these commands:

````md
## Setup

```bash
cd /path/to/assistant-preferences
./scripts/bootstrap-machine.sh
node ./scripts/render-preferences.mjs
```

If `preferences.local.json` does not exist, bootstrap creates it from `preferences.local.example.json`.
The default selected profile is `personal`.
````

- [ ] **Step 3: Add a customization section**

Document this example local file:

```json
{
  "selectedProfile": "personal",
  "preferences": {
    "conditional": [
      {
        "id": "favro-local-generated-docs-root",
        "category": "documentation_workflow",
        "scope": "repo:Favro",
        "appliesWhen": [
          "repo-favro",
          "local-generated-docs-relevant"
        ],
        "rule": "For Favro work, use ~/.assistant-preferences/local-docs/Favro/ as the machine-local docs root for generated non-committed documents.",
        "source": "local-machine",
        "createdAt": "2026-04-01T00:00:00.000Z"
      }
    ]
  }
}
```

Then state explicitly:

- secrets must never be committed
- Favro/work-only rules must stay in `preferences.local.json`
- users can customize beyond `minimal` and `personal` by editing the local file

- [ ] **Step 4: Run tests and commit**

Run:

```bash
node --test tests/*.test.mjs
```

Expected: PASS

Commit:

```bash
git add README.md
git commit -m "docs: document shared profiles and local machine config"
```

### Task 6: Prepare The Current Machine’s Migration Bucket Map

**Files:**
- Test: `tests/preferences-schema.test.mjs`
- Local only after implementation: `preferences.local.json`

- [ ] **Step 1: Enumerate the current preferences by destination bucket**

Use this mapping rule during implementation:

```text
Shared base `preferences.json`:
- generic contradiction policy

Tracked `profiles/personal.json`:
- reusable non-Favro workflow, testing, review, and memory preferences

Tracked `profiles/minimal.json`:
- very small starter subset

Untracked `preferences.local.json`:
- Favro rules
- work-only paths
- machine-specific commands
- secrets
```

- [ ] **Step 2: Add an explicit regression check for Favro leakage**

Add a test assertion in `tests/preferences-schema.test.mjs`:

```js
test("tracked shared files do not contain Favro-specific local rules", function() {
	for (const relativePath of [
		"preferences.json",
		"profiles/minimal.json",
		"profiles/personal.json",
	]) {
		const content = fs.readFileSync(repoFilePath(relativePath), "utf8");
		assert.equal(content.includes("favro-local-generated-docs-root"), false);
		assert.equal(content.includes("/Users/vu/Development/Favro"), false);
	}
});
```

- [ ] **Step 3: Add the concrete current-machine local migration step**

After the tracked files are implemented, create this untracked `preferences.local.json` on the current machine:

```json
{
  "selectedProfile": "personal",
  "preferences": {
    "hard": [],
    "conditional": [
      {
        "id": "favro-local-generated-docs-root",
        "category": "documentation_workflow",
        "scope": "repo:Favro",
        "appliesWhen": [
          "repo-favro",
          "local-generated-docs-relevant"
        ],
        "rule": "For Favro work, use ~/.assistant-preferences/local-docs/Favro/ as the machine-local docs root for generated non-committed documents. When gathering context, check both the Favro repository Docs/ directory and ~/.assistant-preferences/local-docs/Favro/. Write local generated docs under shared/, plans/, knowledge-references/, brainstorm/, or misc/ in the local-docs root by default, and only write into repository Docs/ when the document is explicitly intended to be committed or shared.",
        "source": "local-machine",
        "createdAt": "2026-04-01T00:00:00.000Z"
      }
    ],
    "repeatableActions": [
      {
        "id": "default-mainapp-typecheck",
        "category": "verification",
        "scope": "repo:Favro",
        "appliesWhen": [
          "typescript_edit_in_mainapp"
        ],
        "rule": "Prefer make typecheck-MainApp as the default verification command.",
        "source": "local-machine",
        "createdAt": "2026-04-01T00:00:00.000Z"
      }
    ],
    "conflictResolutions": [
      {
        "id": "code-review-helper-extraction-vs-inline-subsystem-rule",
        "category": "code_review",
        "scope": "global",
        "appliesWhen": [
          "manual_review_of_agent_generated_code",
          "repetition-affects-readability"
        ],
        "source": "local-machine",
        "createdAt": "2026-04-01T00:00:00.000Z",
        "whenPersonalRule": "extract-repeated-review-code",
        "whenExternalRule": "project-prefers-inline-repetition",
        "chosenSide": "project",
        "rationale": "This subsystem intentionally keeps paired logic inline for local comparison."
      }
    ]
  }
}
```

Expected result: the current machine preserves the existing Favro/work-specific behavior without leaking it into tracked files.

- [ ] **Step 4: Run the full suite and create the final implementation commit**

Run:

```bash
node --test tests/*.test.mjs
```

Expected: PASS

Commit:

```bash
git add profiles preferences.json preferences.local.example.json scripts tests README.md
git commit -m "feat: make assistant-preferences portable and shareable"
```

## Verification Checklist

- `node --test tests/*.test.mjs` passes
- tracked files contain no Favro/work-only rules
- tracked files contain no hard-coded `/Users/vu/...` paths
- bootstrap works from any checkout location
- renderer works when only `~/.codex` exists
- renderer works when only `~/.claude` exists
- local machine state remains untracked

## Execution Note

This document is a planning artifact only. Do not execute implementation or migration steps in this session unless the user explicitly asks for execution.
