import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { scriptPath } from "./helpers/test-paths.mjs";

const seedScript = scriptPath("seed-from-existing-instructions.mjs");

test("seed validator confirms all expected rules are present", function() {
	const result = execFileSync("node", [seedScript], { stdio: "pipe", encoding: "utf8" });
	assert.match(result, /All expected rules present/);
});
