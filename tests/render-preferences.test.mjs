import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const renderScript = path.join(testsDir, "..", "scripts", "render-preferences.mjs");

function setup() {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-prefs-"));
	const homeDir = path.join(tmpDir, "home");
	fs.mkdirSync(path.join(homeDir, ".codex"), { recursive: true });
	fs.mkdirSync(path.join(homeDir, ".claude"), { recursive: true });
	return { tmpDir, homeDir };
}

function render(homeDir, extraArgs = []) {
	return execFileSync("node", [
		renderScript,
		"--home", homeDir,
		...extraArgs,
	], { stdio: "pipe", encoding: "utf8" });
}

test("renderer writes both assistant instruction files with the contradiction policy", function() {
	const { homeDir } = setup();
	render(homeDir);

	const codex = fs.readFileSync(path.join(homeDir, ".codex/instructions.md"), "utf8");
	const claude = fs.readFileSync(path.join(homeDir, ".claude/CLAUDE.md"), "utf8");

	for (const content of [codex, claude]) {
		assert.match(content, /Apply the user's personal preferences first/);
		assert.match(content, /does not contradict them, apply both/);
		assert.match(content, /ask the user which rule should apply/);
		assert.match(content, /reusable resolution is already memorized/);
		assert.match(content, /ask whether to memorize/);
	}
});

test("renderer includes all migrated hard rules", function() {
	const { homeDir } = setup();
	render(homeDir);

	const codex = fs.readFileSync(path.join(homeDir, ".codex/instructions.md"), "utf8");
	const claude = fs.readFileSync(path.join(homeDir, ".claude/CLAUDE.md"), "utf8");

	const expectedFragments = [
		"describe your approach and wait for approval",
		"ask clarifying questions",
		"list the edge cases",
		"more than 3 files",
		"writing a test that reproduces",
		"reflect on what you did wrong",
		"do not hallucinate",
		"Test-driven development",
	];

	for (const content of [codex, claude]) {
		for (const fragment of expectedFragments) {
			assert.ok(
				content.includes(fragment),
				`Missing rule fragment: "${fragment}"`
			);
		}
	}
});

test("renderer preserves content outside sentinel markers", function() {
	const { homeDir } = setup();

	const existingContent = "# My Custom Header\n\nSome important notes here.\n";
	fs.writeFileSync(path.join(homeDir, ".codex/instructions.md"), existingContent);
	fs.writeFileSync(path.join(homeDir, ".claude/CLAUDE.md"), existingContent);

	render(homeDir);

	const codex = fs.readFileSync(path.join(homeDir, ".codex/instructions.md"), "utf8");
	const claude = fs.readFileSync(path.join(homeDir, ".claude/CLAUDE.md"), "utf8");

	for (const content of [codex, claude]) {
		assert.ok(content.includes("# My Custom Header"), "Custom header was lost");
		assert.ok(content.includes("Some important notes here."), "Custom notes were lost");
		assert.ok(content.includes("BEGIN PERSONAL-PREFERENCES"), "Sentinel markers missing");
		assert.ok(content.includes("END PERSONAL-PREFERENCES"), "Sentinel markers missing");
	}
});

test("re-rendering replaces only the sentinel section", function() {
	const { homeDir } = setup();

	const before = "# Before\n";
	const after = "\n# After\n";
	const markers = "<!-- BEGIN PERSONAL-PREFERENCES (generated — do not edit manually) -->\nold content\n<!-- END PERSONAL-PREFERENCES -->";
	fs.writeFileSync(path.join(homeDir, ".codex/instructions.md"), before + markers + after);
	fs.writeFileSync(path.join(homeDir, ".claude/CLAUDE.md"), before + markers + after);

	render(homeDir);

	const codex = fs.readFileSync(path.join(homeDir, ".codex/instructions.md"), "utf8");
	const claude = fs.readFileSync(path.join(homeDir, ".claude/CLAUDE.md"), "utf8");

	for (const content of [codex, claude]) {
		assert.ok(content.startsWith("# Before\n"), "Content before markers was modified");
		assert.ok(content.includes("# After"), "Content after markers was modified");
		assert.ok(!content.includes("old content"), "Old content between markers was not replaced");
		assert.ok(content.includes("Apply the user's personal preferences first"), "New content not rendered");
	}
});

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

	render(homeDir, ["--local-file", localFile]);

	const codex = fs.readFileSync(path.join(homeDir, ".codex", "instructions.md"), "utf8");
	assert.match(codex, /Apply the user's personal preferences first/);
	assert.match(codex, /Before writing any code, describe your approach and wait for approval/);
	assert.match(codex, /Local overlay rule/);
});

test("renderer writes only for detected assistant homes", function() {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-prefs-"));
	const homeDir = path.join(tmpDir, "home");
	fs.mkdirSync(path.join(homeDir, ".codex"), { recursive: true });

	render(homeDir);

	assert.equal(fs.existsSync(path.join(homeDir, ".codex", "instructions.md")), true);
	assert.equal(fs.existsSync(path.join(homeDir, ".claude", "CLAUDE.md")), false);
});
