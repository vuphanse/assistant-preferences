import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("preferences.json has the required top-level sections", function() {
	const raw = fs.readFileSync("/Users/vu/.assistant-preferences/preferences.json", "utf8");
	const data = JSON.parse(raw);

	assert.equal(data.version, 1);
	assert.equal(data.policy.defaultScope, "global");
	assert.equal(data.policy.defaultBehavior, "apply-personal-preferences-first");
	assert.equal(data.policy.contradictionBehavior, "ask-user-before-choosing");
	assert.equal(data.policy.contradictionScope, "category-level");
	assert.equal(data.policy.memorizationBehavior, "ask-before-persisting");
	assert.equal(data.policy.repeatPromptBehavior, "do-not-reask-already-memorized-preferences");
	assert.ok(Array.isArray(data.preferences.hard));
	assert.ok(Array.isArray(data.preferences.conditional));
	assert.ok(Array.isArray(data.preferences.repeatableActions));
	assert.ok(Array.isArray(data.preferences.conflictResolutions));
});
