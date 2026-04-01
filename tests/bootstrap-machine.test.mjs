import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRepoRoot = path.resolve(testsDir, "..");

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
		assert.equal(fs.realpathSync(path.join(tmpHome, ".assistant-preferences")), fs.realpathSync(repoRoot));
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
