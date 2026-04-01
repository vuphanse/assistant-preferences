import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const BEGIN = "<!-- BEGIN PERSONAL-PREFERENCES (generated — do not edit manually) -->";
const END = "<!-- END PERSONAL-PREFERENCES -->";

const { values } = parseArgs({
	options: { home: { type: "string", default: "/Users/vu" } },
});

const homeDir = values.home;
const prefsPath = "/Users/vu/.assistant-preferences/preferences.json";
const data = JSON.parse(fs.readFileSync(prefsPath, "utf8"));

function renderBody(data) {
	const lines = [
		"You are a specialized software engineer that helps me with coding task, when writing code, MUST always follow these instructions:",
		"",
	];

	// Policy rules
	lines.push("1. Apply the user's personal preferences first whenever relevant.");
	lines.push("2. If another plugin, skill, or project-scoped rule does not contradict them, apply both.");
	lines.push("3. Define contradiction at the category level, not globally.");
	lines.push("4. If a contradiction exists in the same category, ask the user which rule should apply before acting unless a reusable resolution is already memorized.");
	lines.push("5. When a reusable resolution is chosen, ask whether to memorize it.");
	lines.push("");

	// Hard preferences
	let ruleNum = 6;
	for (const pref of data.preferences.hard) {
		lines.push(`${ruleNum}. ${pref.rule}`);
		ruleNum++;
	}

	// Conditional preferences (non-policy ones)
	const userConditional = data.preferences.conditional.filter(
		p => p.source !== "user-approved-policy" && p.source !== "user-approved-design"
	);
	if (userConditional.length > 0) {
		lines.push("");
		lines.push("### Conditional Preferences");
		for (const pref of userConditional) {
			lines.push(`- **${pref.id}** (${pref.category}): ${pref.rule}`);
		}
	}

	// Repeatable actions
	if (data.preferences.repeatableActions.length > 0) {
		lines.push("");
		lines.push("### Repeatable Actions");
		for (const pref of data.preferences.repeatableActions) {
			const scope = pref.scope !== "global" ? ` [${pref.scope}]` : "";
			lines.push(`- **${pref.id}**${scope}: ${pref.rule}`);
		}
	}

	// Contradiction resolution guidance
	lines.push("");
	lines.push("When a contradiction is detected between a personal preference and a plugin, skill, or project-scoped rule in the same category, do not choose silently.");
	lines.push("Check for an existing memorized category-level resolution before asking the user.");
	lines.push("Ask the user which rule should govern this situation only if no memorized resolution applies.");
	lines.push("If the answer appears reusable, ask whether to memorize that conflict resolution.");

	return lines.join("\n");
}

function writeFile(targetPath, body) {
	const block = `${BEGIN}\n${body}\n${END}`;

	if (fs.existsSync(targetPath)) {
		const existing = fs.readFileSync(targetPath, "utf8");
		const startIdx = existing.indexOf(BEGIN);
		const endIdx = existing.indexOf(END);
		if (startIdx !== -1 && endIdx !== -1) {
			const updated = existing.slice(0, startIdx) + block + existing.slice(endIdx + END.length);
			fs.writeFileSync(targetPath, updated);
			return;
		}
		fs.writeFileSync(targetPath, existing.trimEnd() + "\n\n" + block + "\n");
		return;
	}
	fs.writeFileSync(targetPath, block + "\n");
}

const body = renderBody(data);

writeFile(path.join(homeDir, ".codex/instructions.md"), body);
writeFile(path.join(homeDir, ".claude/CLAUDE.md"), body);

console.log("Rendered preferences to both instruction files.");
