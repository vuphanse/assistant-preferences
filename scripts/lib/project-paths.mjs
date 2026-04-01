import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const preferenceKeys = [
	"hard",
	"conditional",
	"repeatableActions",
	"conflictResolutions",
];

const helperDir = path.dirname(fileURLToPath(import.meta.url));

export function getRepoRoot() {
	const scriptDir = helperDir;
	return path.resolve(scriptDir, "..", "..");
}

export function getHomeDir(explicitHome) {
	return explicitHome || process.env.HOME || os.homedir();
}

export function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function normalizePreferencesBlock(data = {}) {
	const preferences = data.preferences || {};
	return {
		...data,
		preferences: {
			hard: preferences.hard || [],
			conditional: preferences.conditional || [],
			repeatableActions: preferences.repeatableActions || [],
			conflictResolutions: preferences.conflictResolutions || [],
		},
	};
}

function mergeEntriesById(baseEntries, overlayEntries) {
	const merged = new Map();
	for (const entry of baseEntries) merged.set(entry.id, entry);
	for (const entry of overlayEntries) merged.set(entry.id, entry);
	return [...merged.values()];
}

export function mergePreferenceLayers(...layers) {
	const normalizedLayers = layers.map(normalizePreferencesBlock);
	const result = normalizePreferencesBlock({
		...normalizedLayers[0],
		preferences: {
			hard: [...normalizedLayers[0].preferences.hard],
			conditional: [...normalizedLayers[0].preferences.conditional],
			repeatableActions: [...normalizedLayers[0].preferences.repeatableActions],
			conflictResolutions: [...normalizedLayers[0].preferences.conflictResolutions],
		},
	});
	for (const layer of normalizedLayers.slice(1)) {
		for (const key of preferenceKeys) {
			result.preferences[key] = mergeEntriesById(result.preferences[key], layer.preferences[key]);
		}
	}
	return result;
}

export function getTrackedPreferencesPath(repoRoot) {
	return path.join(repoRoot, "preferences.json");
}

export function getProfilePath(repoRoot, profileName) {
	return path.join(repoRoot, "profiles", `${profileName}.json`);
}

export function getLocalPreferencesPath(repoRoot, explicitLocalFile) {
	return explicitLocalFile || path.join(repoRoot, "preferences.local.json");
}

export function loadEffectivePreferences({ repoRoot, localFile }) {
	const base = normalizePreferencesBlock(readJson(getTrackedPreferencesPath(repoRoot)));
	const localPath = getLocalPreferencesPath(repoRoot, localFile);
	const local = fs.existsSync(localPath) ? normalizePreferencesBlock(readJson(localPath)) : normalizePreferencesBlock({
		selectedProfile: "personal",
	});
	const profilePath = getProfilePath(repoRoot, local.selectedProfile || "personal");
	if (!fs.existsSync(profilePath))
		throw new Error(`Unknown selectedProfile: ${local.selectedProfile || "personal"}`);
	const profile = normalizePreferencesBlock(readJson(profilePath));
	return mergePreferenceLayers(base, profile, local);
}
