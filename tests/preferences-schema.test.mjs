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
