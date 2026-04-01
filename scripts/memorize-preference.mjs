import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { getLocalPreferencesPath, getRepoRoot } from "./lib/project-paths.mjs";

const KIND_TO_KEY = {
	"hard": "hard",
	"conditional": "conditional",
	"repeatable-action": "repeatableActions",
	"conflict-resolution": "conflictResolutions",
};

const repoRoot = getRepoRoot();

const { values } = parseArgs({
	options: {
		file: { type: "string" },
		kind: { type: "string" },
		id: { type: "string" },
		category: { type: "string" },
		scope: { type: "string", default: "global" },
		"applies-when": { type: "string", multiple: true },
		rule: { type: "string" },
		replace: { type: "boolean", default: false },
		"when-personal-rule": { type: "string" },
		"when-external-rule": { type: "string" },
		"chosen-side": { type: "string" },
		rationale: { type: "string" },
	},
});

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

const kind = values.kind;
const key = KIND_TO_KEY[kind];
if (!key) {
	console.error(`Invalid --kind: ${kind}. Must be one of: ${Object.keys(KIND_TO_KEY).join(", ")}`);
	process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
const entries = data.preferences[key];

const nextEntry = {
	id: values.id,
	category: values.category,
	scope: values.scope,
	appliesWhen: values["applies-when"] || [],
	rule: values.rule,
	source: "user-confirmed",
	createdAt: new Date().toISOString(),
};

if (kind === "conflict-resolution") {
	if (!values["when-personal-rule"] || !values["when-external-rule"] || !values["chosen-side"]) {
		console.error("conflict-resolution requires --when-personal-rule, --when-external-rule, and --chosen-side");
		process.exit(1);
	}
	nextEntry.whenPersonalRule = values["when-personal-rule"];
	nextEntry.whenExternalRule = values["when-external-rule"];
	nextEntry.chosenSide = values["chosen-side"];
	if (values.rationale) nextEntry.rationale = values.rationale;
	delete nextEntry.rule;
}

if (entries.some(entry => entry.id === nextEntry.id) && !values.replace) {
	throw new Error(`Preference id already exists: ${nextEntry.id}`);
}

if (values.replace) {
	const idx = entries.findIndex(entry => entry.id === nextEntry.id);
	if (idx !== -1) {
		entries[idx] = nextEntry;
	} else {
		entries.push(nextEntry);
	}
} else {
	entries.push(nextEntry);
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
console.log(`Added ${kind}: ${nextEntry.id}`);

// Auto-render instruction files
const renderScript = path.join(repoRoot, "scripts", "render-preferences.mjs");
const renderArgs = [];
if (values.file) renderArgs.push("--local-file", values.file);
if (fs.existsSync(renderScript)) {
	execFileSync("node", [renderScript, ...renderArgs], { stdio: "inherit" });
}
