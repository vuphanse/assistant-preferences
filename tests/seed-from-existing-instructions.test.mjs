import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const seedScript = path.join(testsDir, "..", "scripts", "seed-from-existing-instructions.mjs");

test("seed validator confirms all expected rules are present", function() {
	const result = execFileSync("node", [seedScript], { stdio: "pipe", encoding: "utf8" });
	assert.match(result, /All expected rules present/);
});
