import fs from "node:fs";
import { parseArgs } from "node:util";

const EXPECTED_KEYWORDS = [
	"describe your approach and wait for approval",
	"ask clarifying questions",
	"list the edge cases",
	"more than 3 files",
	"writing a test that reproduces",
	"reflect on what you did wrong",
	"do not hallucinate",
	"test-driven development",
];

const { values } = parseArgs({
	options: { file: { type: "string", default: "/Users/vu/.assistant-preferences/preferences.json" } },
});

const data = JSON.parse(fs.readFileSync(values.file, "utf8"));
const allRules = [...data.preferences.hard, ...data.preferences.conditional]
	.map(p => p.rule.toLowerCase());

const missing = EXPECTED_KEYWORDS.filter(k => !allRules.some(rule => rule.includes(k)));
if (missing.length > 0) {
	console.error("Missing rules in preferences.json:", missing);
	process.exit(1);
}
console.log("All expected rules present.");
