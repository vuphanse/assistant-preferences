import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { repoFilePath } from "./helpers/test-paths.mjs";

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(repoFilePath(relativePath), "utf8"));
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
