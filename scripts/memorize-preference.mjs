import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const KIND_TO_KEY = {
	"hard": "hard",
	"conditional": "conditional",
	"repeatable-action": "repeatableActions",
	"conflict-resolution": "conflictResolutions",
};

const { values } = parseArgs({
	options: {
		file: { type: "string", default: "/Users/vu/.assistant-preferences/preferences.json" },
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

const kind = values.kind;
const key = KIND_TO_KEY[kind];
if (!key) {
	console.error(`Invalid --kind: ${kind}. Must be one of: ${Object.keys(KIND_TO_KEY).join(", ")}`);
	process.exit(1);
}

const data = JSON.parse(fs.readFileSync(values.file, "utf8"));
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

fs.writeFileSync(values.file, JSON.stringify(data, null, 2) + "\n");
console.log(`Added ${kind}: ${nextEntry.id}`);

// Auto-render instruction files
const scriptsDir = path.dirname(new URL(import.meta.url).pathname);
const renderScript = path.join(scriptsDir, "render-preferences.mjs");
if (fs.existsSync(renderScript)) {
	execFileSync("node", [renderScript], { stdio: "inherit" });
}
