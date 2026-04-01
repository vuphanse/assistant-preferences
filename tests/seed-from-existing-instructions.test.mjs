import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("seed validator confirms all expected rules are present", function() {
	const result = execFileSync("node", [
		"/Users/vu/.assistant-preferences/scripts/seed-from-existing-instructions.mjs"
	], { stdio: "pipe", encoding: "utf8" });
	assert.match(result, /All expected rules present/);
});

test("seed validator exits with error when a rule is missing", function() {
	assert.throws(function() {
		execFileSync("node", [
			"/Users/vu/.assistant-preferences/scripts/seed-from-existing-instructions.mjs",
			"--file", "/dev/null"
		], { stdio: "pipe" });
	});
});
