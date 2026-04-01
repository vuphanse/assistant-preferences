import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(testsDir, "..", "scripts", "memorize-preference.mjs");

function makePrefsFile() {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-memory-"));
	const prefsPath = path.join(tmpDir, "preferences.local.json");
	fs.writeFileSync(prefsPath, JSON.stringify({
		selectedProfile: "personal",
		preferences: { hard: [], conditional: [], repeatableActions: [], conflictResolutions: [] }
	}, null, 2));
	return prefsPath;
}

test("memorize-preference appends a new conditional preference without duplicating ids", function() {
	const prefsPath = makePrefsFile();

	execFileSync("node", [
		SCRIPT,
		"--file", prefsPath,
		"--kind", "conditional",
		"--id", "extract-repeated-review-code",
		"--category", "code_review",
		"--scope", "global",
		"--applies-when", "manual_review_of_agent_generated_code",
		"--rule", "Repeated code should be broken out to a common helper when it improves readability."
	]);

	const saved = JSON.parse(fs.readFileSync(prefsPath, "utf8"));
	assert.equal(saved.selectedProfile, "personal");
	assert.equal(saved.preferences.conditional.length, 1);
	assert.equal(saved.preferences.conditional[0].id, "extract-repeated-review-code");
});

test("memorize-preference rejects duplicate ids", function() {
	const prefsPath = makePrefsFile();

	execFileSync("node", [
		SCRIPT, "--file", prefsPath,
		"--kind", "conditional", "--id", "dup-test",
		"--category", "test", "--scope", "global",
		"--applies-when", "always", "--rule", "First rule."
	]);

	assert.throws(function() {
		execFileSync("node", [
			SCRIPT, "--file", prefsPath,
			"--kind", "conditional", "--id", "dup-test",
			"--category", "test", "--scope", "global",
			"--applies-when", "always", "--rule", "Duplicate rule."
		], { stdio: "pipe" });
	}, /already exists/i);
});

test("memorize-preference appends a repeatable-action", function() {
	const prefsPath = makePrefsFile();

	execFileSync("node", [
		SCRIPT, "--file", prefsPath,
		"--kind", "repeatable-action", "--id", "default-typecheck",
		"--category", "verification", "--scope", "repo:Favro",
		"--applies-when", "typescript_edit",
		"--rule", "Prefer make typecheck-MainApp."
	]);

	const saved = JSON.parse(fs.readFileSync(prefsPath, "utf8"));
	assert.equal(saved.preferences.repeatableActions.length, 1);
	assert.equal(saved.preferences.repeatableActions[0].id, "default-typecheck");
});

test("memorize-preference appends a conflict-resolution", function() {
	const prefsPath = makePrefsFile();

	execFileSync("node", [
		SCRIPT, "--file", prefsPath,
		"--kind", "conflict-resolution", "--id", "cr-test",
		"--category", "code_review", "--scope", "global",
		"--applies-when", "review_code",
		"--when-personal-rule", "extract-helpers",
		"--when-external-rule", "keep-inline",
		"--chosen-side", "project",
		"--rationale", "Subsystem prefers inline."
	]);

	const saved = JSON.parse(fs.readFileSync(prefsPath, "utf8"));
	assert.equal(saved.preferences.conflictResolutions.length, 1);
	assert.equal(saved.preferences.conflictResolutions[0].chosenSide, "project");
	assert.equal(saved.preferences.conflictResolutions[0].rationale, "Subsystem prefers inline.");
});
