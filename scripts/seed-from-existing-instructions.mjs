import path from "node:path";
import { getRepoRoot, readJson, mergePreferenceLayers } from "./lib/project-paths.mjs";

const EXPECTED_PERSONAL_RULE_FRAGMENTS = [
	"Apply the user's personal preferences first whenever they are relevant.",
	"If another plugin, skill, or project-scoped rule does not contradict the personal preference in the same category, apply both.",
	"If a contradiction exists between a personal preference and a plugin, skill, or project-scoped rule in the same category, ask the user which rule should apply before acting unless a matching memorized conflict resolution already exists.",
	"Summarize the feedback as a generalized preference and ask whether to memorize it for future sessions.",
	"When the user resolves a contradiction in a reusable way, ask whether to memorize that conflict resolution for future sessions.",
	"Before writing any code, describe your approach and wait for approval.",
	"If the requirements are ambiguous, ask clarifying questions before starting implementation.",
	"After finishing code changes, list the edge cases and suggest test cases to cover them.",
	"If a task requires changes to more than 3 files, stop and break it into smaller tasks first.",
	"When there is a bug, start by writing a test that reproduces it, then fix it until the test passes.",
	"Every time the user corrects you, reflect on what you did wrong and come up with a plan to never make the same mistake again.",
	"When in doubt or not sure about the solution, do not hallucinate. Ask the user for guidance, recommendations, or a suggested approach.",
	"Test-driven development workflow must always be preferred when developing a new feature.",
	"Repeated code should be broken out to a common helper when it improves readability.",
	"After drafting tests, review whether existing helpers can replace bespoke test code and use them when they make the tests cleaner.",
	"For generated non-committed documents (plans, brainstorms, knowledge references), use ~/.assistant-preferences/local-docs/<project-name>/ as the default output location.",
];

const EXPECTED_MINIMAL_RULE_FRAGMENTS = [
	"When in doubt or not sure about the solution, do not hallucinate. Ask the user for guidance, recommendations, or a suggested approach.",
];

const repoRoot = getRepoRoot();
const personalData = mergePreferenceLayers(
	readJson(path.join(repoRoot, "preferences.json")),
	readJson(path.join(repoRoot, "profiles", "personal.json")),
);
const minimalData = mergePreferenceLayers(
	readJson(path.join(repoRoot, "preferences.json")),
	readJson(path.join(repoRoot, "profiles", "minimal.json")),
);

function flattenRules(data) {
	const all = [
		...data.preferences.hard,
		...data.preferences.conditional,
		...data.preferences.repeatableActions,
	];
	return all.map(p => p.rule).filter(Boolean);
}

function checkFragments(label, data, expectedFragments) {
	const rules = flattenRules(data);
	const missing = expectedFragments.filter(
		fragment => !rules.some(rule => rule.includes(fragment))
	);
	if (missing.length > 0) {
		console.error(`Missing rules in ${label}:`, missing);
		process.exit(1);
	}
}

function checkNoFavroLeakage(label, data) {
	const allText = JSON.stringify(data);
	if (allText.includes("favro-local-generated-docs-root") || allText.includes("/Users/vu/Development/Favro")) {
		console.error(`${label} contains Favro-specific local rules that should not be tracked.`);
		process.exit(1);
	}
}

checkFragments("base + personal", personalData, EXPECTED_PERSONAL_RULE_FRAGMENTS);
checkFragments("base + minimal", minimalData, EXPECTED_MINIMAL_RULE_FRAGMENTS);
checkNoFavroLeakage("base + personal", personalData);
checkNoFavroLeakage("base + minimal", minimalData);

console.log("All expected rules present.");
