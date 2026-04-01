import path from "node:path";
import { fileURLToPath } from "node:url";

const helpersDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(helpersDir, "..", "..");

export function scriptPath(name) {
	return path.join(repoRoot, "scripts", name);
}

export function repoFilePath(name) {
	return path.join(repoRoot, name);
}
